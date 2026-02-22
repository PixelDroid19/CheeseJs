/**
 * BM25 Keyword Scoring Module
 *
 * Implements the BM25 (Best Matching 25) ranking function for keyword-based
 * retrieval alongside vector similarity search. BM25 excels at exact keyword
 * matches that embedding models sometimes miss (e.g., specific function names,
 * error codes, config keys).
 *
 * Parameters:
 * - k1 (1.2): term frequency saturation. Higher = more weight to repeated terms.
 * - b (0.75): length normalization. 0 = no normalization, 1 = full normalization.
 */

/** Tokenize text into lowercase terms, stripping punctuation */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Pre-computed BM25 index over a corpus of documents.
 */
export class BM25Index {
  private readonly k1: number;
  private readonly b: number;

  /** document frequency: term -> number of docs containing it */
  private df: Map<string, number> = new Map();
  /** term frequencies per document: docIndex -> (term -> count) */
  private tfDocs: Map<string, number>[] = [];
  /** document lengths (in tokens) */
  private docLengths: number[] = [];
  /** average document length */
  private avgDl = 0;
  /** total number of documents */
  private n = 0;
  /** document IDs in insertion order */
  private docIds: string[] = [];

  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  /**
   * Build the index from an array of documents.
   * Each document has an id and content string.
   */
  build(docs: { id: string; content: string }[]) {
    this.n = docs.length;
    this.df = new Map();
    this.tfDocs = [];
    this.docLengths = [];
    this.docIds = [];

    let totalLength = 0;

    for (const doc of docs) {
      const tokens = tokenize(doc.content);
      this.docIds.push(doc.id);
      this.docLengths.push(tokens.length);
      totalLength += tokens.length;

      // Count term frequencies for this document
      const tf = new Map<string, number>();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }
      this.tfDocs.push(tf);

      // Update document frequencies
      for (const term of tf.keys()) {
        this.df.set(term, (this.df.get(term) || 0) + 1);
      }
    }

    this.avgDl = this.n > 0 ? totalLength / this.n : 0;
  }

  /**
   * Score a query against all indexed documents.
   * Returns an array of { id, score } sorted by score descending.
   */
  score(query: string): { id: string; score: number }[] {
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0 || this.n === 0) return [];

    const scores: { id: string; score: number }[] = [];

    for (let i = 0; i < this.n; i++) {
      let docScore = 0;
      const tf = this.tfDocs[i];
      const dl = this.docLengths[i];

      for (const term of queryTerms) {
        const termFreq = tf.get(term) || 0;
        if (termFreq === 0) continue;

        const docFreq = this.df.get(term) || 0;
        // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
        const idf = Math.log((this.n - docFreq + 0.5) / (docFreq + 0.5) + 1);
        // TF component with saturation and length normalization
        const tfNorm =
          (termFreq * (this.k1 + 1)) /
          (termFreq + this.k1 * (1 - this.b + this.b * (dl / this.avgDl)));

        docScore += idf * tfNorm;
      }

      if (docScore > 0) {
        scores.push({ id: this.docIds[i], score: docScore });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores;
  }

  /**
   * Score a query and return results for specific document IDs only.
   */
  scoreForIds(query: string, ids: Set<string>): Map<string, number> {
    const allScores = this.score(query);
    const result = new Map<string, number>();
    for (const s of allScores) {
      if (ids.has(s.id)) {
        result.set(s.id, s.score);
      }
    }
    return result;
  }

  get size(): number {
    return this.n;
  }
}

/**
 * Fuse vector similarity scores with BM25 keyword scores.
 *
 * Uses reciprocal rank fusion (RRF) which is robust to different score scales:
 *   fusedScore = vectorWeight / (k + vectorRank) + bm25Weight / (k + bm25Rank)
 *
 * @param vectorResults - Results from vector search with scores
 * @param bm25Scores - BM25 scores keyed by chunk ID
 * @param vectorWeight - Weight for vector results (default 0.7)
 * @param bm25Weight - Weight for BM25 results (default 0.3)
 * @param k - RRF constant (default 60, standard in literature)
 */
export function fuseScores<T extends { id: string; score: number }>(
  vectorResults: T[],
  bm25Scores: Map<string, number>,
  vectorWeight = 0.7,
  bm25Weight = 0.3,
  k = 60
): T[] {
  // Build rank maps
  // Vector results are already sorted by score desc
  const vectorRanks = new Map<string, number>();
  for (let i = 0; i < vectorResults.length; i++) {
    vectorRanks.set(vectorResults[i].id, i + 1);
  }

  // BM25: sort by score to get ranks
  const bm25Sorted = [...bm25Scores.entries()].sort((a, b) => b[1] - a[1]);
  const bm25Ranks = new Map<string, number>();
  for (let i = 0; i < bm25Sorted.length; i++) {
    bm25Ranks.set(bm25Sorted[i][0], i + 1);
  }

  // Collect all unique IDs
  const allIds = new Set([...vectorRanks.keys(), ...bm25Ranks.keys()]);
  // Default rank for items not present in one list
  const defaultRank = Math.max(vectorResults.length, bm25Sorted.length) + 1;

  // Build a map from id to the original result object
  const resultMap = new Map<string, T>();
  for (const r of vectorResults) {
    resultMap.set(r.id, r);
  }

  // Calculate fused scores
  const fused: T[] = [];
  for (const id of allIds) {
    const vRank = vectorRanks.get(id) ?? defaultRank;
    const bRank = bm25Ranks.get(id) ?? defaultRank;

    const fusedScore = vectorWeight / (k + vRank) + bm25Weight / (k + bRank);

    const original = resultMap.get(id);
    if (original) {
      fused.push({ ...original, score: fusedScore });
    }
    // If not in vectorResults (BM25-only hit), we skip it since
    // we don't have the full chunk data from vector store
  }

  fused.sort((a, b) => b.score - a.score);
  return fused;
}
