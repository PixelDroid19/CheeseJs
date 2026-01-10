export interface RagDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface RagChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

export interface SearchResult extends RagChunk {
  score: number;
}

export interface RagStats {
  documentCount: number;
  chunkCount: number;
  lastUpdated: number;
}
