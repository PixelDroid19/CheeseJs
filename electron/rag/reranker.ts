/**
 * Re-ranking Module
 *
 * Provides a lightweight cross-encoder-style re-ranker that scores
 * (query, chunk) pairs using multiple signals:
 *
 * 1. Embedding cosine similarity (from initial search score)
 * 2. Keyword overlap (exact term matching between query and chunk)
 * 3. Metadata relevance (chunk type, recency)
 * 4. Position boost (earlier chunks in a document are often more important)
 *
 * This is used as a second-pass ranker after initial retrieval.
 * The idea: over-fetch (3x limit), then re-rank and return top results.
 */

import { tokenize } from './bm25';
import { SearchResult, MetadataBoost } from './types';

/** Weights for re-ranking signals */
export interface RerankerWeights {
  /** Weight for the original similarity score (default 0.5) */
  similarityWeight?: number;
  /** Weight for keyword overlap score (default 0.25) */
  keywordWeight?: number;
  /** Weight for metadata relevance score (default 0.15) */
  metadataWeight?: number;
  /** Weight for position score (default 0.1) */
  positionWeight?: number;
}

const DEFAULT_WEIGHTS: Required<RerankerWeights> = {
  similarityWeight: 0.5,
  keywordWeight: 0.25,
  metadataWeight: 0.15,
  positionWeight: 0.1,
};

/**
 * Re-rank search results using multiple scoring signals.
 *
 * @param results - Initial search results (should be over-fetched, e.g., 3x limit)
 * @param query - The original search query
 * @param limit - How many results to return after re-ranking
 * @param weights - Optional weights for scoring signals
 * @param metadataBoost - Optional metadata boost config
 */
export function rerank(
  results: SearchResult[],
  query: string,
  limit: number,
  weights?: RerankerWeights,
  metadataBoost?: MetadataBoost
): SearchResult[] {
  if (results.length === 0) return [];

  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const queryTerms = new Set(tokenize(query));

  // Find max original score for normalization
  const maxScore = Math.max(...results.map((r) => r.score), 0.001);

  // Score each result
  const scored = results.map((r) => {
    // 1. Normalized similarity score (from initial vector/hybrid search)
    const simScore = r.score / maxScore;

    // 2. Keyword overlap: ratio of query terms found in chunk content
    const kwScore = computeKeywordOverlap(queryTerms, r.content);

    // 3. Metadata relevance score
    const metaScore = computeMetadataScore(r, metadataBoost);

    // 4. Position score: earlier chunks are slightly preferred
    const posScore = computePositionScore(r);

    const totalScore =
      w.similarityWeight * simScore +
      w.keywordWeight * kwScore +
      w.metadataWeight * metaScore +
      w.positionWeight * posScore;

    return { result: r, totalScore };
  });

  // Sort by composite score descending
  scored.sort((a, b) => b.totalScore - a.totalScore);

  // Return top results with updated scores
  return scored.slice(0, limit).map((s) => ({
    ...s.result,
    score: s.totalScore,
  }));
}

/**
 * Compute keyword overlap between query terms and chunk content.
 * Returns a value between 0 and 1.
 */
function computeKeywordOverlap(
  queryTerms: Set<string>,
  content: string
): number {
  if (queryTerms.size === 0) return 0;

  const contentTokens = new Set(tokenize(content));
  let matches = 0;

  for (const term of queryTerms) {
    if (contentTokens.has(term)) {
      matches++;
    }
  }

  return matches / queryTerms.size;
}

/**
 * Compute a metadata relevance score (0-1).
 * Considers chunk type preference and recency.
 */
function computeMetadataScore(
  result: SearchResult,
  boost?: MetadataBoost
): number {
  let score = 0.5; // Neutral baseline
  const meta = result.metadata;

  // Chunk type preference
  if (boost?.preferredChunkTypes && boost.preferredChunkTypes.length > 0) {
    const chunkType = meta.chunkType;
    if (
      typeof chunkType === 'string' &&
      boost.preferredChunkTypes.includes(chunkType)
    ) {
      score += 0.25;
    }
  }

  // Recency boost
  if (boost?.recencyBoost && boost.recencyBoost > 0) {
    const dateIndexed = meta.dateIndexed;
    if (typeof dateIndexed === 'number') {
      const now = Date.now();
      const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
      const age = now - dateIndexed;
      const recencyFactor = Math.max(0, 1 - age / MAX_AGE);
      score += boost.recencyBoost * recencyFactor * 0.25;
    }
  }

  // Code chunks with symbol names are generally more useful
  if (typeof meta.symbolName === 'string' && meta.symbolName.length > 0) {
    score += 0.1;
  }

  return Math.min(1, score);
}

/**
 * Compute a position score (0-1).
 * Earlier chunks in a document (lower chunkIndex) are slightly preferred
 * since they often contain definitions, imports, and high-level structure.
 */
function computePositionScore(result: SearchResult): number {
  const meta = result.metadata;
  const chunkIndex = typeof meta.chunkIndex === 'number' ? meta.chunkIndex : 0;
  const totalChunks =
    typeof meta.totalChunks === 'number' ? meta.totalChunks : 1;

  if (totalChunks <= 1) return 1;

  // Linear decay: first chunk = 1.0, last chunk = 0.3
  return 1 - 0.7 * (chunkIndex / (totalChunks - 1));
}
