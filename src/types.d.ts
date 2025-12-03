declare module 'json-cycle'
declare module 'stringify-object'

// ============================================================================
// CODE RUNNER TYPES
// ============================================================================

interface ExecutionOptions {
  timeout?: number
  showUndefined?: boolean
  showTopLevelResults?: boolean
  loopProtection?: boolean
  magicComments?: boolean
  language?: 'javascript' | 'typescript' | 'python'
}

interface ExecutionResult {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete'
  id: string
  data?: unknown
  line?: number
  jsType?: string
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir'
}

type ResultCallback = (result: ExecutionResult) => void

interface CodeRunner {
  execute: (id: string, code: string, options?: ExecutionOptions) => Promise<{ success: boolean; data?: unknown; error?: string }>
  cancel: (id: string) => void
  onResult: (callback: ResultCallback) => () => void
  removeResultListener: (callback: ResultCallback) => void
}

// ============================================================================
// PACKAGE MANAGER TYPES
// ============================================================================

interface PackageInstallResult {
  success: boolean
  packageName: string
  version?: string
  error?: string
}

interface InstalledPackage {
  name: string
  version: string
  path: string
}

interface PackageManager {
  install: (packageName: string) => Promise<PackageInstallResult>
  uninstall: (packageName: string) => Promise<PackageInstallResult>
  list: () => Promise<{ success: boolean; packages: InstalledPackage[]; error?: string }>
  getNodeModulesPath: () => Promise<string>
}

// ============================================================================
// WINDOW INTERFACE
// ============================================================================

interface Window {
  electronAPI: {
    closeApp: () => void
    maximizeApp: () => void
    unmaximizeApp: () => void
    minimizeApp: () => void
    showContextMenu: () => void
    onToggleMagicComments: (callback: () => void) => void
  }
  codeRunner: CodeRunner
  packageManager: PackageManager
}
