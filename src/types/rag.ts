export interface RegisteredDocument {
    id: string;
    title: string;
    type: 'file' | 'url' | 'codebase';
    pathOrUrl: string;
    addedAt: number;
    status: 'pending' | 'processing' | 'indexed' | 'error';
    chunkCount: number;
    error?: string;
    metadata?: Record<string, unknown>;
}

export type InjectionStrategy = 'auto' | 'always-retrieve' | 'always-inject';

export interface RagConfig {
    retrievalLimit: number;
    retrievalThreshold: number;
    injectionStrategy: InjectionStrategy;
    maxContextTokens: number;
}

export interface SearchOptions {
    limit?: number;
    threshold?: number;
    strategy?: 'auto' | 'retrieve' | 'inject-full';
    maxTokens?: number;
    documentIds?: string[];
}

export interface SubStep {
    id: string;
    name: string;
    status: 'waiting' | 'loading' | 'done' | 'error';
    progress?: number;
    message?: string;
}

export interface StrategyDecision {
    strategy: 'inject-full' | 'retrieve';
    reason: string;
    tokenCount?: number;
}

export interface MetadataFilter {
    language?: string | string[];
    fileExtension?: string | string[];
    documentType?: string | string[];
    chunkType?: string | string[];
    dateAfter?: number;
    dateBefore?: number;
}

export interface PipelineOptions {
    retrievalLimit?: number;
    threshold?: number;
    maxContextTokens?: number;
    documentIds?: string[];
    metadataFilter?: MetadataFilter;
    vectorWeight?: number;
    bm25Weight?: number;
    includeAttribution?: boolean;
    enableRewrite?: boolean;
    enableHybrid?: boolean;
    enableRerank?: boolean;
    enableDistill?: boolean;
}

export interface PipelineResult {
    context: string;
    tokenCount: number;
    chunksIncluded: number;
    chunksRetrieved: number;
    rewrittenQuery?: string;
    wasRewritten: boolean;
    sourceIds: string[];
}

export interface SearchResult {
    id: string;
    content: string;
    score: number;
    metadata: Record<string, unknown>;
}
