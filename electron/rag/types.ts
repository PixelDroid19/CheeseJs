export interface RagDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface RegisteredDocument {
  id: string;
  title: string;
  type: 'file' | 'url' | 'codebase';
  pathOrUrl: string;
  addedAt: number;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  error?: string;
  chunkCount: number;
  size?: number;
  metadata?: Record<string, unknown>;
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

// RAG Configuration types
export type InjectionStrategy = 'auto' | 'always-retrieve' | 'always-inject';

export interface RagConfig {
  retrievalLimit: number; // Max chunks to return (1-10, default: 5)
  retrievalThreshold: number; // Min similarity score (0.0-1.0, default: 0.5)
  injectionStrategy: InjectionStrategy; // How to inject context
  maxContextTokens: number; // Max tokens for full injection (default: 4000)
}

export const DEFAULT_RAG_CONFIG: RagConfig = {
  retrievalLimit: 5,
  retrievalThreshold: 0.5,
  injectionStrategy: 'auto',
  maxContextTokens: 4000,
};

// Advanced search options
export interface SearchOptions {
  limit?: number;
  threshold?: number;
  strategy?: 'auto' | 'retrieve' | 'inject-full';
  maxTokens?: number;
  documentIds?: string[]; // Filter by specific documents
}

// Progress events with sub-steps
export interface SubStep {
  id: string;
  name: string;
  status: 'waiting' | 'loading' | 'done' | 'error';
  progress?: number; // 0-100
  message?: string;
}

export interface RagProgressEvent {
  id: string;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  message: string;
  subSteps?: SubStep[];
}

// Strategy decision result
export interface StrategyDecision {
  strategy: 'inject-full' | 'retrieve';
  reason: string;
  tokenCount?: number;
  documentsToInject?: string[];
}
