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

interface PythonPackageManager {
  install: (packageName: string) => Promise<PythonPackageInstallResult>;
  listInstalled: () => Promise<{
    success: boolean;
    packages: string[];
    error?: string;
  }>;
  resetRuntime: () => Promise<{ success: boolean; error?: string }>;
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
}
