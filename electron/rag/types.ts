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
  metadataFilter?: MetadataFilter; // Filter by chunk metadata
}

/**
 * Metadata-based pre-filtering for search results.
 * All fields are optional; only provided fields are applied (AND logic).
 */
export interface MetadataFilter {
  /** Filter by programming language (e.g., 'ts', 'js', 'py') */
  language?: string | string[];
  /** Filter by file extension (e.g., '.ts', '.md') */
  fileExtension?: string | string[];
  /** Filter by document type (e.g., 'code', 'prose', 'url', 'pdf') */
  documentType?: string | string[];
  /** Filter by chunk type (e.g., 'function', 'class', 'section', 'paragraph') */
  chunkType?: string | string[];
  /** Only include chunks indexed after this timestamp (ms) */
  dateAfter?: number;
  /** Only include chunks indexed before this timestamp (ms) */
  dateBefore?: number;
}

/**
 * Scoring boost configuration for metadata-aware ranking.
 */
export interface MetadataBoost {
  /** Boost recent documents (0-1, default 0.1). Applied as: score * (1 + recencyBoost * recencyFactor) */
  recencyBoost?: number;
  /** Boost exact chunkType matches (0-1, default 0.05) */
  chunkTypeBoost?: number;
  /** Preferred chunk types to boost (e.g., ['function', 'class']) */
  preferredChunkTypes?: string[];
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

/**
 * Options for the full RAG search pipeline.
 * Chains: query rewrite -> hybrid search -> re-rank -> context distill -> auto-trim
 */
export interface PipelineOptions {
  /** Max chunks to retrieve before re-ranking (default 15) */
  retrievalLimit?: number;
  /** Min similarity threshold (0-1, default 0.3) */
  threshold?: number;
  /** Max tokens for the final assembled context (default from RagConfig) */
  maxContextTokens?: number;
  /** Filter by specific document IDs */
  documentIds?: string[];
  /** Metadata pre-filter */
  metadataFilter?: MetadataFilter;
  /** Vector vs BM25 weight balance (default 0.7 vector) */
  vectorWeight?: number;
  /** BM25 weight (default 0.3) */
  bm25Weight?: number;
  /** Whether to include source attribution in output (default true) */
  includeAttribution?: boolean;
  /** Whether to enable query rewriting (default true) */
  enableRewrite?: boolean;
  /** Whether to enable hybrid search (default true) */
  enableHybrid?: boolean;
  /** Whether to enable re-ranking (default true) */
  enableRerank?: boolean;
  /** Whether to enable context distillation (default true) */
  enableDistill?: boolean;
}

/**
 * Result from the search pipeline.
 */
export interface PipelineResult {
  /** The assembled context string, ready for LLM injection */
  context: string;
  /** Token count of the assembled context */
  tokenCount: number;
  /** Number of chunks included */
  chunksIncluded: number;
  /** Total chunks retrieved before trimming */
  chunksRetrieved: number;
  /** The rewritten query (if rewriting was applied) */
  rewrittenQuery?: string;
  /** Whether query was rewritten */
  wasRewritten: boolean;
  /** Source chunk IDs for traceability */
  sourceIds: string[];
}
