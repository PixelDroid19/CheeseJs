import type { CodeRunner } from './types/runner';
import type { PackageManager, PythonPackageManager } from './types/packages';
import type {
  RagConfig,
  RegisteredDocument,
  SearchOptions,
  PipelineOptions,
  PipelineResult,
  SearchResult,
  SubStep,
  StrategyDecision,
} from './types/rag';

declare module 'json-cycle';
declare module 'stringify-object';

declare global {
  interface Window {
    electronAPI: {
      closeApp: () => void;
      maximizeApp: () => void;
      unmaximizeApp: () => void;
      minimizeApp: () => void;
      showContextMenu: () => void;
      onToggleMagicComments: (callback: () => void) => void;
      // Filesystem operations
      readFile?: (
        path: string,
        options?: { startLine?: number; endLine?: number }
      ) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeFile?: (
        path: string,
        content: string
      ) => Promise<{ success: boolean; error?: string }>;
      listFiles?: (
        path: string,
        recursive?: boolean
      ) => Promise<{ success: boolean; files?: string[]; error?: string }>;
      searchInFiles?: (
        pattern: string,
        directory: string
      ) => Promise<{
        success: boolean;
        results?: Array<{ file: string; line: number; content: string }>;
        error?: string;
      }>;
      executeCommand?: (
        command: string,
        cwd?: string
      ) => Promise<{
        success: boolean;
        stdout?: string;
        stderr?: string;
        error?: string;
      }>;
      deleteFile?: (
        path: string
      ) => Promise<{ success: boolean; error?: string }>;
      getWorkspacePath?: () => Promise<string>;
    };
    codeRunner: CodeRunner;
    packageManager: PackageManager;
    pythonPackageManager: PythonPackageManager;
    aiProxy: {
      fetch: (request: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: string;
      }) => Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: string;
      }>;
      streamFetch: (
        request: {
          url: string;
          method: string;
          headers: Record<string, string>;
          body?: string;
        },
        onChunk: (chunk: string) => void,
        onEnd: () => void,
        onError: (error: {
          status: number;
          statusText: string;
          body: string;
        }) => void
      ) => Promise<{ streamId: string; abort: () => void }>;
    };
    rag: {
      ingest: (doc: {
        id: string;
        content: string;
        metadata: Record<string, unknown>;
      }) => Promise<{ success: boolean; count?: number; error?: string }>;
      search: (
        query: string,
        limit?: number
      ) => Promise<{
        success: boolean;
        results?: SearchResult[];
        error?: string;
      }>;
      clear: () => Promise<{ success: boolean; error?: string }>;
      indexCodebase: () => Promise<{
        success: boolean;
        count?: number;
        docs?: number;
        error?: string;
      }>;

      // Document Management
      getDocuments: () => Promise<{
        success: boolean;
        documents?: RegisteredDocument[];
        error?: string;
      }>;
      addFile: (filePath: string) => Promise<{
        success: boolean;
        document?: RegisteredDocument;
        error?: string;
      }>;
      addUrl: (url: string) => Promise<{
        success: boolean;
        document?: RegisteredDocument;
        error?: string;
      }>;
      removeDocument: (
        id: string
      ) => Promise<{ success: boolean; error?: string }>;

      // Configuration
      getConfig: () => Promise<{
        success: boolean;
        config?: RagConfig;
        error?: string;
      }>;
      setConfig: (
        config: Partial<RagConfig>
      ) => Promise<{ success: boolean; config?: RagConfig; error?: string }>;

      // Advanced Search
      searchAdvanced: (
        query: string,
        options?: SearchOptions
      ) => Promise<{
        success: boolean;
        results?: SearchResult[];
        meta?: { limit: number; threshold: number; totalResults: number };
        error?: string;
      }>;

      // Get chunks by document IDs (for pinned docs - no embedding needed)
      getChunksByDocuments: (
        documentIds: string[],
        limit?: number
      ) => Promise<{
        success: boolean;
        results?: SearchResult[];
        error?: string;
      }>;

      // Strategy Decision
      decideStrategy: (
        documentIds: string[],
        query: string
      ) => Promise<{
        success: boolean;
        decision?: StrategyDecision;
        error?: string;
      }>;

      // Pipeline Search (full chain: rewrite → hybrid → rerank → distill → trim)
      searchPipeline: (
        query: string,
        options?: PipelineOptions
      ) => Promise<{
        success: boolean;
        result?: PipelineResult;
        error?: string;
      }>;

      // Progress Events
      onProgress: (
        callback: (progress: {
          id: string;
          status: 'pending' | 'processing' | 'indexed' | 'error';
          message: string;
          subSteps?: SubStep[];
        }) => void
      ) => () => void;
    };
    // E2E testing properties
    monaco?: typeof import('monaco-editor');
    editor?: import('monaco-editor').editor.IStandaloneCodeEditor;
    useCodeStore?: unknown;
  }
}

// Para hacer posible "import type" de un archivo .d.ts sin top-level export,
// a veces es necesario un simple export:
export { };
