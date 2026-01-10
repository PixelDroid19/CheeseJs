declare module 'json-cycle';
declare module 'stringify-object';

// ============================================================================
// CODE RUNNER TYPES
// ============================================================================

interface ExecutionOptions {
  timeout?: number;
  showUndefined?: boolean;
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
  magicComments?: boolean;
  language?: 'javascript' | 'typescript' | 'python';
}

interface ExecutionResult {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete';
  id: string;
  data?: unknown;
  line?: number;
  jsType?: string;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

type ResultCallback = (result: ExecutionResult) => void;

interface CodeRunner {
  execute: (
    id: string,
    code: string,
    options?: ExecutionOptions
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  cancel: (id: string) => void;
  isReady: (language?: string) => Promise<boolean>;
  waitForReady: (language?: string) => Promise<boolean>;
  onResult: (callback: ResultCallback) => () => void;
  removeResultListener: (callback: ResultCallback) => void;
  onInputRequest: (
    callback: (request: {
      id: string;
      data: { prompt: string; line: number; requestId?: string };
    }) => void
  ) => () => void;
  sendInputResponse: (id: string, value: string, requestId?: string) => void;
  onJSInputRequest: (
    callback: (request: {
      type: 'prompt-request' | 'alert-request';
      message: string;
    }) => void
  ) => () => void;
  sendJSInputResponse: (value: string) => void;
}

// ============================================================================
// PACKAGE MANAGER TYPES
// ============================================================================

interface PackageInstallResult {
  success: boolean;
  packageName: string;
  version?: string;
  error?: string;
}

interface InstalledPackage {
  name: string;
  version: string;
  path: string;
}

interface PackageManager {
  install: (packageName: string) => Promise<PackageInstallResult>;
  uninstall: (packageName: string) => Promise<PackageInstallResult>;
  list: () => Promise<{
    success: boolean;
    packages: InstalledPackage[];
    error?: string;
  }>;
  getNodeModulesPath: () => Promise<string>;
}

// ============================================================================
// PYTHON PACKAGE MANAGER TYPES
// ============================================================================

interface PythonPackageInstallResult {
  success: boolean;
  packageName: string;
  version?: string;
  error?: string;
}

interface PythonMemoryStats {
  heapUsed: number;
  heapTotal: number;
  executionsSinceCleanup: number;
  lastCleanupTime: number;
  pyObjects: number;
  executionCount: number;
}

interface PythonPackageManager {
  install: (packageName: string) => Promise<PythonPackageInstallResult>;
  listInstalled: () => Promise<{
    success: boolean;
    packages: string[];
    error?: string;
  }>;
  resetRuntime: () => Promise<{ success: boolean; error?: string }>;
  getMemoryStats: () => Promise<{
    success: boolean;
    stats?: PythonMemoryStats;
    error?: string;
  }>;
  cleanupNamespace: () => Promise<{ success: boolean; error?: string }>;
}

// ============================================================================
// RAG TYPES
// ============================================================================

interface RegisteredDocument {
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

type InjectionStrategy = 'auto' | 'always-retrieve' | 'always-inject';

interface RagConfig {
  retrievalLimit: number;
  retrievalThreshold: number;
  injectionStrategy: InjectionStrategy;
  maxContextTokens: number;
}

interface SearchOptions {
  limit?: number;
  threshold?: number;
  strategy?: 'auto' | 'retrieve' | 'inject-full';
  maxTokens?: number;
  documentIds?: string[];
}

interface SubStep {
  id: string;
  name: string;
  status: 'waiting' | 'loading' | 'done' | 'error';
  progress?: number;
  message?: string;
}

interface StrategyDecision {
  strategy: 'inject-full' | 'retrieve';
  reason: string;
  tokenCount?: number;
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

// ============================================================================
// WINDOW INTERFACE
// ============================================================================

interface Window {
  electronAPI: {
    closeApp: () => void;
    maximizeApp: () => void;
    unmaximizeApp: () => void;
    minimizeApp: () => void;
    showContextMenu: () => void;
    onToggleMagicComments: (callback: () => void) => void;
  };
  codeRunner: CodeRunner;
  packageManager: PackageManager;
  pythonPackageManager: PythonPackageManager;
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
    addFile: (
      filePath: string
    ) => Promise<{
      success: boolean;
      document?: RegisteredDocument;
      error?: string;
    }>;
    addUrl: (
      url: string
    ) => Promise<{
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

    // Strategy Decision
    decideStrategy: (
      documentIds: string[],
      query: string
    ) => Promise<{
      success: boolean;
      decision?: StrategyDecision;
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
