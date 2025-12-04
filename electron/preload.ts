import { contextBridge, ipcRenderer } from 'electron'
import { domReady, useLoading } from './utils'

// eslint-disable-next-line react-hooks/rules-of-hooks
const { appendLoading, removeLoading } = useLoading()

domReady().then(appendLoading).catch(console.error)

// ============================================================================
// TYPES
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

// ============================================================================
// CODE RUNNER API
// ============================================================================

const resultCallbacks = new Set<ResultCallback>()

// Listen for execution results from main process
ipcRenderer.on('code-execution-result', (_event, result: ExecutionResult) => {
  resultCallbacks.forEach(callback => callback(result))
})

contextBridge.exposeInMainWorld('electronAPI', {
  closeApp: () => ipcRenderer.send('close-me'),
  maximizeApp: () => ipcRenderer.send('maximize'),
  unmaximizeApp: () => ipcRenderer.send('unmaximize'),
  minimizeApp: () => ipcRenderer.send('minimize'),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  onToggleMagicComments: (callback: () => void) => ipcRenderer.on('toggle-magic-comments', () => callback())
})

contextBridge.exposeInMainWorld('codeRunner', {
  /**
   * Execute code in the sandboxed VM
   */
  execute: async (id: string, code: string, options: ExecutionOptions = {}) => {
    // Extract language from options and pass it at request level for routing
    const { language, ...restOptions } = options
    return ipcRenderer.invoke('execute-code', { id, code, language, options: restOptions })
  },
  
  /**
   * Cancel a running execution
   */
  cancel: (id: string) => {
    ipcRenderer.send('cancel-execution', id)
  },
  
  /**
   * Subscribe to execution results
   */
  onResult: (callback: ResultCallback) => {
    resultCallbacks.add(callback)
    return () => {
      resultCallbacks.delete(callback)
    }
  },
  
  /**
   * Remove result listener
   */
  removeResultListener: (callback: ResultCallback) => {
    resultCallbacks.delete(callback)
  }
})

// ============================================================================
// PACKAGE MANAGER API
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

contextBridge.exposeInMainWorld('packageManager', {
  /**
   * Install an npm package
   */
  install: async (packageName: string): Promise<PackageInstallResult> => {
    return ipcRenderer.invoke('install-package', packageName)
  },
  
  /**
   * Uninstall an npm package
   */
  uninstall: async (packageName: string): Promise<PackageInstallResult> => {
    return ipcRenderer.invoke('uninstall-package', packageName)
  },
  
  /**
   * List all installed packages
   */
  list: async (): Promise<{ success: boolean; packages: InstalledPackage[]; error?: string }> => {
    return ipcRenderer.invoke('list-packages')
  },
  
  /**
   * Get the node_modules path
   */
  getNodeModulesPath: async (): Promise<string> => {
    return ipcRenderer.invoke('get-node-modules-path')
  }
})

// ============================================================================
// PYTHON PACKAGE MANAGER API
// ============================================================================

interface PythonPackageInstallResult {
  success: boolean
  packageName: string
  version?: string
  error?: string
}

contextBridge.exposeInMainWorld('pythonPackageManager', {
  /**
   * Install a Python package using micropip
   */
  install: async (packageName: string): Promise<PythonPackageInstallResult> => {
    return ipcRenderer.invoke('install-python-package', packageName)
  },

  /**
   * List all installed Python packages
   */
  listInstalled: async (): Promise<{ success: boolean; packages: string[]; error?: string }> => {
    return ipcRenderer.invoke('list-python-packages')
  }
})

setTimeout(removeLoading, 1000)
