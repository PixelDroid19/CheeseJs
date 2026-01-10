import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import { app } from 'electron';
import { RagChunk, SearchResult } from './types';
import fs from 'fs';

export class VectorStore {
  private dbPath: string;
  private db: lancedb.Connection | null = null;
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
      console.log('Initializing Vector Store at:', this.dbPath);
      this.db = await lancedb.connect(this.dbPath);
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
        await table.delete(`documentId = '${documentId}'`);
      }
    } catch (e) {
      console.error('Error deleting document from vector store:', e);
    }
  }
}

export const vectorStore = new VectorStore();
