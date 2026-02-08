import path from 'path';
import { app } from 'electron';
import { RagChunk, SearchResult, MetadataFilter, MetadataBoost } from './types';
import { BM25Index, fuseScores } from './bm25';
import fs from 'fs';

// Lazy-loaded to avoid loading native LanceDB binary at startup
let lancedb: typeof import('@lancedb/lancedb') | null = null;
async function getLancedb() {
  if (!lancedb) {
    lancedb = await import('@lancedb/lancedb');
  }
  return lancedb;
}

export class VectorStore {
  private dbPath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any = null;
  private tableName = 'rag_chunks';

  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'rag-store');
    // Ensure directory exists
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
  }

  async init() {
    if (!this.db) {
      const lance = await getLancedb();
      console.log('Initializing Vector Store at:', this.dbPath);
      this.db = await lance.connect(this.dbPath);
    }
  }

  async addChunks(chunks: RagChunk[]) {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    if (chunks.length === 0) return;

    // Prepare data for LanceDB
    const data = chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      content: chunk.content,
      metadata: JSON.stringify(chunk.metadata),
      vector: chunk.embedding as number[],
    }));

    // Check if table exists
    const tableNames = await this.db.tableNames();
    if (tableNames.includes(this.tableName)) {
      const table = await this.db.openTable(this.tableName);
      await table.add(data);
    } else {
      // Create table
      // LanceDB infers schema from data
      await this.db.createTable(this.tableName, data);
    }
  }

  async search(
    queryVector: number[],
    limit = 5,
    documentIds?: string[]
  ): Promise<SearchResult[]> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    const tableNames = await this.db.tableNames();
    if (!tableNames.includes(this.tableName)) {
      return [];
    }

    const table = await this.db.openTable(this.tableName);
    // LanceDB default metric is L2
    let results = await table
      .search(queryVector)
      .limit(limit * 2)
      .toArray(); // Fetch extra for filtering

    // Filter by document IDs if provided
    if (documentIds && documentIds.length > 0) {
      const idSet = new Set(documentIds);
      results = results.filter((r) => idSet.has(r.documentId as string));
    }

    return results.slice(0, limit).map((r) => ({
      id: r.id as string,
      documentId: r.documentId as string,
      content: r.content as string,
      metadata:
        typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      embedding: r.vector as number[],
      // _distance is returned by LanceDB search
      score: 1 / (1 + ((r._distance as number) || 0)), // Convert distance to similarity score
    }));
  }

  /**
   * Search with threshold filtering
   * Returns only results above the threshold score
   */
  async searchWithThreshold(
    queryVector: number[],
    limit = 5,
    threshold = 0.5,
    documentIds?: string[]
  ): Promise<SearchResult[]> {
    const results = await this.search(queryVector, limit * 2, documentIds);

    // Filter by threshold
    const filtered = results.filter((r) => r.score >= threshold);

    console.log(
      `[VectorStore] Search: ${results.length} results, ${filtered.length} above threshold ${threshold}`
    );

    return filtered.slice(0, limit);
  }

  /**
   * Search with metadata filtering and optional boost scoring.
   * Over-fetches from vector search, then applies metadata filters and boosts in JS.
   */
  async searchWithMetadata(
    queryVector: number[],
    limit = 5,
    threshold = 0.5,
    options: {
      documentIds?: string[];
      metadataFilter?: MetadataFilter;
      metadataBoost?: MetadataBoost;
    } = {}
  ): Promise<SearchResult[]> {
    const { documentIds, metadataFilter, metadataBoost } = options;

    // Over-fetch to account for filtering
    const overFetchMultiplier = metadataFilter ? 4 : 2;
    let results = await this.search(
      queryVector,
      limit * overFetchMultiplier,
      documentIds
    );

    // Apply threshold
    results = results.filter((r) => r.score >= threshold);

    // Apply metadata filters
    if (metadataFilter) {
      results = applyMetadataFilter(results, metadataFilter);
    }

    // Apply metadata boosts
    if (metadataBoost) {
      results = applyMetadataBoost(results, metadataBoost);
      // Re-sort after boosting
      results.sort((a, b) => b.score - a.score);
    }

    console.log(
      `[VectorStore] MetadataSearch: ${results.length} results after filtering/boosting (limit: ${limit}, threshold: ${threshold})`
    );

    return results.slice(0, limit);
  }

  /**
   * Hybrid search combining vector similarity with BM25 keyword scoring.
   * Over-fetches from vector search, builds a BM25 index over those results,
   * then fuses scores using reciprocal rank fusion.
   */
  async hybridSearch(
    queryVector: number[],
    queryText: string,
    limit = 5,
    threshold = 0.5,
    options: {
      documentIds?: string[];
      metadataFilter?: MetadataFilter;
      metadataBoost?: MetadataBoost;
      vectorWeight?: number;
      bm25Weight?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const {
      documentIds,
      metadataFilter,
      metadataBoost,
      vectorWeight = 0.7,
      bm25Weight = 0.3,
    } = options;

    // Over-fetch for fusion — we need a large pool for BM25 re-ranking
    const overFetch = limit * 5;
    let results = await this.search(queryVector, overFetch, documentIds);

    // Apply threshold on raw vector results
    results = results.filter((r) => r.score >= threshold * 0.5); // Looser threshold pre-fusion

    // Apply metadata filters before fusion (reduces corpus)
    if (metadataFilter) {
      results = applyMetadataFilter(results, metadataFilter);
    }

    if (results.length === 0) return [];

    // Build BM25 index from the over-fetched vector results
    const bm25 = new BM25Index();
    bm25.build(results.map((r) => ({ id: r.id, content: r.content })));

    // Get BM25 scores for the query
    const bm25ScoreIds = new Set(results.map((r) => r.id));
    const bm25Scores = bm25.scoreForIds(queryText, bm25ScoreIds);

    // Fuse vector + BM25 scores using reciprocal rank fusion
    let fused = fuseScores(results, bm25Scores, vectorWeight, bm25Weight);

    // Apply metadata boosts after fusion
    if (metadataBoost) {
      fused = applyMetadataBoost(fused, metadataBoost);
      fused.sort((a, b) => b.score - a.score);
    }

    console.log(
      `[VectorStore] HybridSearch: ${fused.length} results after fusion (vector=${vectorWeight}, bm25=${bm25Weight})`
    );

    return fused.slice(0, limit);
  }

  async clear() {
    await this.init();
    if (!this.db) return;
    try {
      const tableNames = await this.db.tableNames();
      if (tableNames.includes(this.tableName)) {
        await this.db.dropTable(this.tableName);
      }
    } catch (e) {
      console.error('Error clearing vector store:', e);
    }
  }

  async deleteDocument(documentId: string) {
    await this.init();
    if (!this.db) return;
    try {
      const tableNames = await this.db.tableNames();
      if (tableNames.includes(this.tableName)) {
        const table = await this.db.openTable(this.tableName);
        // Sanitize documentId to prevent SQL injection via single quotes
        const sanitizedId = documentId.replace(/'/g, "''");
        await table.delete(`documentId = '${sanitizedId}'`);
      }
    } catch (e) {
      console.error('Error deleting document from vector store:', e);
    }
  }

  /**
   * Get all chunks belonging to specific document IDs without vector search.
   * Used for pinned docs where we want all content, not similarity-ranked results.
   */
  async getChunksByDocumentIds(
    documentIds: string[],
    limit?: number
  ): Promise<SearchResult[]> {
    await this.init();
    if (!this.db) return [];
    if (documentIds.length === 0) return [];

    try {
      const tableNames = await this.db.tableNames();
      if (!tableNames.includes(this.tableName)) {
        return [];
      }

      const table = await this.db.openTable(this.tableName);

      // Build a filter predicate for multiple document IDs
      const idSet = new Set(documentIds);

      // Fetch all rows from table and filter by documentId
      // LanceDB doesn't support IN queries easily, so we filter in JS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let results: any[] = await table.query().toArray();
      results = results.filter((r) => idSet.has(r.documentId as string));

      if (limit && limit > 0) {
        results = results.slice(0, limit);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return results.map((r: any) => ({
        id: r.id as string,
        documentId: r.documentId as string,
        content: r.content as string,
        metadata:
          typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
        embedding: r.vector as number[],
        score: 1.0, // Full relevance since these are explicitly requested
      }));
    } catch (e) {
      console.error('Error getting chunks by document IDs:', e);
      return [];
    }
  }
}

export const vectorStore = new VectorStore();

// ---------------------------------------------------------------------------
// Metadata filtering and boost helpers
// ---------------------------------------------------------------------------

/**
 * Check if a metadata value matches a filter value (single string or array of strings).
 */
function matchesFilter(
  metaValue: unknown,
  filterValue: string | string[]
): boolean {
  if (metaValue === undefined || metaValue === null) return false;
  const metaStr = String(metaValue);
  if (Array.isArray(filterValue)) {
    return filterValue.some((v) => v === metaStr);
  }
  return filterValue === metaStr;
}

/**
 * Apply metadata-based pre-filtering to search results.
 * All filter fields use AND logic (all must match).
 */
function applyMetadataFilter(
  results: SearchResult[],
  filter: MetadataFilter
): SearchResult[] {
  return results.filter((r) => {
    const meta = r.metadata;

    if (filter.language !== undefined) {
      if (!matchesFilter(meta.language, filter.language)) return false;
    }
    if (filter.fileExtension !== undefined) {
      if (!matchesFilter(meta.fileExtension, filter.fileExtension))
        return false;
    }
    if (filter.documentType !== undefined) {
      if (!matchesFilter(meta.documentType, filter.documentType)) return false;
    }
    if (filter.chunkType !== undefined) {
      if (!matchesFilter(meta.chunkType, filter.chunkType)) return false;
    }
    if (filter.dateAfter !== undefined) {
      const dateIndexed = meta.dateIndexed;
      if (typeof dateIndexed !== 'number' || dateIndexed < filter.dateAfter) {
        return false;
      }
    }
    if (filter.dateBefore !== undefined) {
      const dateIndexed = meta.dateIndexed;
      if (typeof dateIndexed !== 'number' || dateIndexed > filter.dateBefore) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Apply metadata-based score boosts to search results.
 * Modifies scores in place and returns the same array.
 */
function applyMetadataBoost(
  results: SearchResult[],
  boost: MetadataBoost
): SearchResult[] {
  const now = Date.now();
  // Max age for recency calculation: 30 days in ms
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  for (const r of results) {
    let boostedScore = r.score;

    // Recency boost: newer documents score slightly higher
    if (boost.recencyBoost && boost.recencyBoost > 0) {
      const dateIndexed = r.metadata.dateIndexed;
      if (typeof dateIndexed === 'number') {
        const age = now - dateIndexed;
        // recencyFactor: 1.0 for brand new, 0.0 for 30+ days old
        const recencyFactor = Math.max(0, 1 - age / MAX_AGE_MS);
        boostedScore *= 1 + boost.recencyBoost * recencyFactor;
      }
    }

    // Chunk type boost: preferred chunk types get a small score bump
    if (
      boost.chunkTypeBoost &&
      boost.chunkTypeBoost > 0 &&
      boost.preferredChunkTypes &&
      boost.preferredChunkTypes.length > 0
    ) {
      const chunkType = r.metadata.chunkType;
      if (
        typeof chunkType === 'string' &&
        boost.preferredChunkTypes.includes(chunkType)
      ) {
        boostedScore *= 1 + boost.chunkTypeBoost;
      }
    }

    r.score = boostedScore;
  }

  return results;
}
