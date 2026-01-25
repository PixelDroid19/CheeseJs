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
  visualExecution?: boolean;
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
// PLUGIN API TYPES
// ============================================================================

interface PluginInfoBase {
  manifest: {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: string | { name: string; email?: string; url?: string };
    main: string;
    renderer?: string;
    sandboxed?: boolean;
    permissions?: string[];
  };
  status: 'installed' | 'active' | 'disabled' | 'error';
  error?: string;
}

// ============================================================================
// WASM LANGUAGES TYPES
// ============================================================================

interface WasmLanguageInfo {
  id: string;
  name: string;
  version: string;
  extensions: string[];
  status: 'loading' | 'ready' | 'error';
  error?: string;
}

interface WasmLanguagesAPI {
  getAll: () => Promise<{ success: boolean; languages: WasmLanguageInfo[] }>;
  isReady: (languageId: string) => Promise<boolean>;
  getMonacoConfig: (
    languageId: string
  ) => Promise<{ success: boolean; config?: Record<string, unknown> }>;
  onChanged: (callback: (languages: WasmLanguageInfo[]) => void) => () => void;
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
    // Shell operations
    // Shell operations
    showItemInFolder: (path: string) => Promise<void>;
    // Capture operations
    saveImage: (
      buffer: ArrayBuffer,
      filename: string
    ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  };
  pluginAPI: {
    list: () => Promise<PluginInfoBase[]>;
    activate: (id: string) => Promise<{ success: boolean }>;
    deactivate: (id: string) => Promise<{ success: boolean }>;
    install: (
      sourcePath: string
    ) => Promise<{ success: boolean; plugin: PluginInfoBase }>;
    installFromUrl: (
      url: string,
      pluginId?: string
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    uninstall: (id: string) => Promise<{ success: boolean }>;
    getPath: () => Promise<string>;
    readFile: (path: string) => Promise<string>;
    onStateChanged: (
      callback: (plugins: PluginInfoBase[]) => void
    ) => () => void;
  };
  codeRunner: CodeRunner;
  packageManager: PackageManager;
  pythonPackageManager: PythonPackageManager;
  wasmLanguages: WasmLanguagesAPI;
  // E2E testing properties
  monaco?: unknown;
  editor?: unknown;
  useCodeStore?: unknown;
}
