import { app, BrowserWindow, ipcMain, nativeImage, Menu } from 'electron'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
// Use TypeScript transpiler by default - SWC available as performance option once node_modules issue is resolved
import { transformCode, type TransformOptions } from './transpiler/tsTranspiler.js'
import {
  initPackagesDirectory,
  installPackage,
  uninstallPackage,
  listInstalledPackages,
  getNodeModulesPath
} from './packages/packageManager.js'
import { registerAIProxy } from './aiProxy.js'

process.env.DIST = path.join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: any | null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// Only ignore certificate errors in development
// Production should use valid certificates
if (!app.isPackaged) {
  app.commandLine.appendSwitch('ignore-certificate-errors')
  app.commandLine.appendSwitch('allow-insecure-localhost')
}

// ============================================================================
// WORKER THREAD POOL MANAGEMENT
// ============================================================================

interface ExecutionRequest {
  id: string
  code: string
  language?: 'javascript' | 'typescript' | 'python'
  options: {
    timeout?: number
    showUndefined?: boolean
    showTopLevelResults?: boolean
    loopProtection?: boolean
    magicComments?: boolean
  }
}

interface WorkerResult {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete' | 'ready'
  id: string
  data?: unknown
  line?: number
  jsType?: string
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir'
}

let codeWorker: Worker | null = null
let pythonWorker: Worker | null = null
let codeWorkerReady = false
let pythonWorkerReady = false
const pendingExecutions = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
let codeWorkerInitPromise: Promise<void> | null = null
let codeWorkerInitReject: ((error: Error) => void) | null = null
let pythonWorkerInitPromise: Promise<void> | null = null
let pythonWorkerInitReject: ((error: Error) => void) | null = null

// Interrupt buffer for Python execution cancellation (P2)
let pythonInterruptBuffer: SharedArrayBuffer | null = null

/**
 * Initialize the code executor worker
 */
function initializeCodeWorker(): Promise<void> {
  if (codeWorkerInitPromise) {
    return codeWorkerInitPromise
  }

  codeWorkerInitPromise = new Promise((resolve, reject) => {
    codeWorkerInitReject = reject
    const workerPath = path.join(__dirname, 'codeExecutor.js')

    // Pass node_modules path to worker for package require support
    codeWorker = new Worker(workerPath, {
      workerData: {
        nodeModulesPath: getNodeModulesPath()
      }
    })

    codeWorker.on('message', (message: WorkerResult) => {
      if (message.type === 'ready') {
        console.log('Code executor worker ready')
        codeWorkerReady = true
        resolve()
        codeWorkerInitPromise = null
        codeWorkerInitReject = null
        return
      }

      // Forward all messages to renderer
      if (win && !win.isDestroyed()) {
        win.webContents.send('code-execution-result', message)
      }

      // Handle completion
      if (message.type === 'complete' || message.type === 'error') {
        // Clear any pending forced cancellation timeout
        clearPendingCancellation(message.id)
        
        const pending = pendingExecutions.get(message.id)
        if (pending) {
          if (message.type === 'error') {
            pending.reject(new Error((message.data as { message: string }).message))
          } else {
            pending.resolve(message.data)
          }
          pendingExecutions.delete(message.id)
        }
      }
    })

    codeWorker.on('error', (error) => {
      console.error('Worker error:', error)
      codeWorkerReady = false
      // Reject all pending executions
      for (const [id, pending] of pendingExecutions) {
        pending.reject(error)
        pendingExecutions.delete(id)
      }
      if (codeWorkerInitReject) {
        codeWorkerInitReject(error)
      }
      codeWorkerInitPromise = null
      codeWorkerInitReject = null
    })

    codeWorker.on('exit', (code) => {
      console.log(`Worker exited with code ${code}`)
      codeWorker = null
      codeWorkerReady = false
      const wasInitializing = !!codeWorkerInitPromise

      if (wasInitializing && codeWorkerInitReject) {
        codeWorkerInitReject(new Error(`Code worker exited with code ${code}`))
        codeWorkerInitPromise = null
        codeWorkerInitReject = null
        return
      }

      // Reinitialize worker if it crashed after being ready
      if (code !== 0) {
        setTimeout(() => initializeCodeWorker(), 1000)
      }
    })
  })

  return codeWorkerInitPromise
}

/**
 * Execute code in the worker
 */
async function executeCode(request: ExecutionRequest): Promise<unknown> {
  if (!codeWorker || !codeWorkerReady) {
    await initializeCodeWorker()
  }

  const { id, code, options } = request

  // Transform code using SWC before sending to worker
  const transformOptions: TransformOptions = {
    showTopLevelResults: options.showTopLevelResults ?? true,
    loopProtection: options.loopProtection ?? true,
    magicComments: options.magicComments ?? false,
    showUndefined: options.showUndefined ?? false
  }

  let transformedCode: string
  try {
    transformedCode = transformCode(code, transformOptions)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Transpilation error: ${errorMessage}`)
  }

  return new Promise((resolve, reject) => {
    if (!codeWorker) {
      reject(new Error('Code worker not initialized'))
      return
    }

    pendingExecutions.set(id, { resolve, reject })

    codeWorker.postMessage({
      type: 'execute',
      id,
      code: transformedCode,
      options: {
        timeout: options.timeout ?? 30000,
        showUndefined: options.showUndefined ?? false
      }
    })

    // Safety timeout
    setTimeout(() => {
      if (pendingExecutions.has(id)) {
        pendingExecutions.delete(id)

        // Send error result event to renderer so UI components can clean up
        if (win && !win.isDestroyed()) {
          win.webContents.send('code-execution-result', {
            type: 'error',
            id,
            data: { name: 'TimeoutError', message: 'Execution timeout' }
          })
        }

        reject(new Error('Execution timeout'))
      }
    }, (options.timeout ?? 30000) + 5000)
  })
}

// Track pending cancellations for forced termination
const pendingCancellations = new Map<string, NodeJS.Timeout>()

// Timeout before forcing worker termination (ms)
const FORCE_TERMINATION_TIMEOUT = 2000

/**
 * Cancel a running execution
 * Uses cooperative cancellation first, then falls back to forced termination
 */
function cancelExecution(id: string): void {
  // First, try cooperative cancellation
  if (codeWorker) {
    codeWorker.postMessage({ type: 'cancel', id })
    
    // Set up forced termination fallback
    const forceTimeout = setTimeout(() => {
      forceTerminateCodeWorker(id)
    }, FORCE_TERMINATION_TIMEOUT)
    
    pendingCancellations.set(`js-${id}`, forceTimeout)
  }

  if (pythonWorker) {
    // Signal interrupt via SharedArrayBuffer first (SIGINT = 2)
    // This allows Python code to be interrupted even in tight loops
    if (pythonInterruptBuffer) {
      const view = new Uint8Array(pythonInterruptBuffer)
      view[0] = 2  // SIGINT - will raise KeyboardInterrupt in Python
    }

    pythonWorker.postMessage({ type: 'cancel', id })
    
    // Set up forced termination fallback for Python
    const forceTimeout = setTimeout(() => {
      forceTerminatePythonWorker(id)
    }, FORCE_TERMINATION_TIMEOUT)
    
    pendingCancellations.set(`py-${id}`, forceTimeout)
  }

  const pending = pendingExecutions.get(id)
  if (pending) {
    pending.reject(new Error('Execution cancelled'))
    pendingExecutions.delete(id)
  }
}

/**
 * Clear pending cancellation timeout when execution completes or errors
 */
function clearPendingCancellation(id: string): void {
  const jsKey = `js-${id}`
  const pyKey = `py-${id}`
  
  const jsTimeout = pendingCancellations.get(jsKey)
  if (jsTimeout) {
    clearTimeout(jsTimeout)
    pendingCancellations.delete(jsKey)
  }
  
  const pyTimeout = pendingCancellations.get(pyKey)
  if (pyTimeout) {
    clearTimeout(pyTimeout)
    pendingCancellations.delete(pyKey)
  }
}

/**
 * Force terminate the code worker and recreate it
 * Called when cooperative cancellation fails
 */
async function forceTerminateCodeWorker(id: string): Promise<void> {
  console.log(`[CodeWorker] Force terminating worker for execution ${id}`)
  
  if (codeWorker) {
    try {
      await codeWorker.terminate()
    } catch (e) {
      console.error('[CodeWorker] Error during termination:', e)
    }
    codeWorker = null
    codeWorkerReady = false
  }
  
  pendingCancellations.delete(`js-${id}`)
  
  // Send error to renderer
  if (win && !win.isDestroyed()) {
    win.webContents.send('code-execution-result', {
      type: 'error',
      id,
      data: { name: 'CancelError', message: 'Execution forcibly terminated' }
    })
  }
  
  // Recreate the worker
  console.log('[CodeWorker] Recreating worker after forced termination')
  await initializeCodeWorker()
}

/**
 * Force terminate the Python worker and recreate it
 * Called when cooperative cancellation fails
 */
async function forceTerminatePythonWorker(id: string): Promise<void> {
  console.log(`[PythonWorker] Force terminating worker for execution ${id}`)
  
  if (pythonWorker) {
    try {
      await pythonWorker.terminate()
    } catch (e) {
      console.error('[PythonWorker] Error during termination:', e)
    }
    pythonWorker = null
    pythonWorkerReady = false
    pythonInterruptBuffer = null
  }
  
  pendingCancellations.delete(`py-${id}`)
  
  // Send error to renderer
  if (win && !win.isDestroyed()) {
    win.webContents.send('code-execution-result', {
      type: 'error',
      id,
      data: { name: 'CancelError', message: 'Execution forcibly terminated' }
    })
  }
  
  // Recreate the worker (lazy initialization on next Python execution)
  console.log('[PythonWorker] Worker will be recreated on next Python execution')
}

// ============================================================================
// PYTHON WORKER MANAGEMENT
// ============================================================================

/**
 * Initialize the Python executor worker
 */
function initializePythonWorker(): Promise<void> {
  if (pythonWorkerInitPromise) {
    return pythonWorkerInitPromise
  }

  pythonWorkerInitPromise = new Promise((resolve, reject) => {
    pythonWorkerInitReject = reject
    const workerPath = path.join(__dirname, 'pythonExecutor.js')

    pythonWorker = new Worker(workerPath)

    // Create and share interrupt buffer for execution cancellation (P2)
    pythonInterruptBuffer = new SharedArrayBuffer(1)
    pythonWorker.postMessage({
      type: 'set-interrupt-buffer',
      buffer: pythonInterruptBuffer
    })

    pythonWorker.on('message', (message: WorkerResult) => {
      if (message.type === 'ready') {
        console.log('Python executor worker ready')
        pythonWorkerReady = true
        resolve()
        pythonWorkerInitPromise = null
        pythonWorkerInitReject = null
        return
      }

      // Forward status messages
      if (message.type === 'status' as WorkerResult['type']) {
        console.log('Python status:', (message.data as { message: string }).message)
        if (win && !win.isDestroyed()) {
          win.webContents.send('code-execution-result', message)
        }
        return
      }

      // Handle input requests - forward to renderer
      if ((message as { type: string }).type === 'input-request') {
        if (win && !win.isDestroyed()) {
          win.webContents.send('python-input-request', message)
        }
        return
      }

      // Forward all messages to renderer
      if (win && !win.isDestroyed()) {
        win.webContents.send('code-execution-result', message)
      }

      // Handle completion
      if (message.type === 'complete' || message.type === 'error') {
        // Clear any pending forced cancellation timeout
        clearPendingCancellation(message.id)
        
        const pending = pendingExecutions.get(message.id)
        if (pending) {
          if (message.type === 'error') {
            pending.reject(new Error((message.data as { message: string }).message))
          } else {
            pending.resolve(message.data)
          }
          pendingExecutions.delete(message.id)
        }
      }
    })

    pythonWorker.on('error', (error) => {
      console.error('Python worker error:', error)
      pythonWorkerReady = false
      for (const [id, pending] of pendingExecutions) {
        pending.reject(error)
        pendingExecutions.delete(id)
      }
      if (pythonWorkerInitReject) {
        pythonWorkerInitReject(error)
      }
      pythonWorkerInitPromise = null
      pythonWorkerInitReject = null
    })

    pythonWorker.on('exit', (code) => {
      console.log(`Python worker exited with code ${code}`)
      pythonWorker = null
      pythonWorkerReady = false
      const wasInitializing = !!pythonWorkerInitPromise

      if (wasInitializing && pythonWorkerInitReject) {
        pythonWorkerInitReject(new Error(`Python worker exited with code ${code}`))
        pythonWorkerInitPromise = null
        pythonWorkerInitReject = null
        return
      }

      if (code !== 0) {
        setTimeout(() => initializePythonWorker(), 1000)
      }
    })
  })

  return pythonWorkerInitPromise
}

/**
 * Execute Python code in the worker
 */
async function executePython(request: ExecutionRequest): Promise<unknown> {
  if (!pythonWorker || !pythonWorkerReady) {
    await initializePythonWorker()
  }

  const { id, code, options } = request

  return new Promise((resolve, reject) => {
    if (!pythonWorker) {
      reject(new Error('Python worker not initialized'))
      return
    }

    pendingExecutions.set(id, { resolve, reject })

    pythonWorker.postMessage({
      type: 'execute',
      id,
      code,
      options: {
        timeout: options.timeout ?? 30000,
        showUndefined: options.showUndefined ?? false
      }
    })

    // Safety timeout (longer for Python due to Pyodide loading)
    setTimeout(() => {
      if (pendingExecutions.has(id)) {
        pendingExecutions.delete(id)

        // Send error result event to renderer so UI components (e.g., InputTooltip) can clean up
        if (win && !win.isDestroyed()) {
          win.webContents.send('code-execution-result', {
            type: 'error',
            id,
            data: { name: 'TimeoutError', message: 'Execution timeout' }
          })
        }

        reject(new Error('Execution timeout'))
      }
    }, (options.timeout ?? 30000) + 10000)
  })
}

// ============================================================================
// IPC HANDLERS FOR CODE EXECUTION
// ============================================================================

ipcMain.handle('execute-code', async (_event: unknown, request: ExecutionRequest) => {
  try {
    // Route to appropriate executor based on language
    const language = request.language || 'javascript'
    console.log('[execute-code] Language:', language, 'Request keys:', Object.keys(request))

    let result: unknown
    if (language === 'python') {
      console.log('[execute-code] Routing to Python executor')
      result = await executePython(request)
    } else {
      // JavaScript/TypeScript use the same code executor
      console.log('[execute-code] Routing to JS/TS executor')
      result = await executeCode(request)
    }

    return { success: true, data: result }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
})

ipcMain.on('cancel-execution', (_event: unknown, id: string) => {
  cancelExecution(id)
})

// Check if workers are ready for execution
ipcMain.handle('is-worker-ready', async (_event: unknown, language: string) => {
  if (language === 'python') {
    return { ready: pythonWorkerReady }
  }
  return { ready: codeWorkerReady }
})

// Handle input response from renderer to Python worker
ipcMain.on('python-input-response', (_event: unknown, { id, value, requestId }: { id: string; value: string; requestId?: string }) => {
  if (pythonWorker) {
    pythonWorker.postMessage({
      type: 'input-response',
      id,
      value,
      requestId
    })
  }
})

// ============================================================================
// IPC HANDLERS FOR PACKAGE MANAGEMENT
// ============================================================================

ipcMain.handle('install-package', async (_event: unknown, packageName: string) => {
  try {
    const result = await installPackage(packageName)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, packageName, error: errorMessage }
  }
})

ipcMain.handle('uninstall-package', async (_event: unknown, packageName: string) => {
  try {
    const result = await uninstallPackage(packageName)

    // Clear the require cache in the worker so the package is no longer available
    if (result.success && codeWorker) {
      codeWorker.postMessage({ type: 'clear-cache', packageName })
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, packageName, error: errorMessage }
  }
})

ipcMain.handle('list-packages', async () => {
  try {
    const packages = await listInstalledPackages()
    return { success: true, packages }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, packages: [], error: errorMessage }
  }
})

ipcMain.handle('get-node-modules-path', () => {
  return getNodeModulesPath()
})

// ============================================================================
// IPC HANDLERS FOR PYTHON PACKAGE MANAGEMENT
// ============================================================================

ipcMain.handle('install-python-package', async (_event: unknown, packageName: string) => {
  try {
    // Ensure Python worker is initialized
    if (!pythonWorker || !pythonWorkerReady) {
      await initializePythonWorker()
    }

    const id = `python-install-${Date.now()}`

    return new Promise((resolve) => {
      if (!pythonWorker) {
        resolve({ success: false, packageName, error: 'Python worker not available' })
        return
      }

      const handleMessage = (message: WorkerResult) => {
        if (message.id !== id) return

        if (message.type === 'complete') {
          pythonWorker?.off('message', handleMessage)
          resolve({ success: true, packageName })
        } else if (message.type === 'error') {
          pythonWorker?.off('message', handleMessage)
          const errorData = message.data as { message: string }
          resolve({ success: false, packageName, error: errorData.message })
        }
      }

      pythonWorker.on('message', handleMessage)
      pythonWorker.postMessage({ type: 'install-package', id, packageName })

      // Timeout after 60 seconds
      setTimeout(() => {
        pythonWorker?.off('message', handleMessage)
        resolve({ success: false, packageName, error: 'Installation timeout' })
      }, 60000)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, packageName, error: errorMessage }
  }
})

ipcMain.handle('list-python-packages', async () => {
  try {
    // Ensure Python worker is initialized
    if (!pythonWorker || !pythonWorkerReady) {
      await initializePythonWorker()
    }

    const id = `python-list-${Date.now()}`

    return new Promise((resolve) => {
      if (!pythonWorker) {
        resolve({ success: false, packages: [], error: 'Python worker not available' })
        return
      }

      const handleMessage = (message: WorkerResult) => {
        if (message.id !== id) return

        if (message.type === 'complete') {
          pythonWorker?.off('message', handleMessage)
          const data = message.data as { packages: string[] }
          resolve({ success: true, packages: data.packages || [] })
        } else if (message.type === 'error') {
          pythonWorker?.off('message', handleMessage)
          const errorData = message.data as { message: string }
          resolve({ success: false, packages: [], error: errorData.message })
        }
      }

      pythonWorker.on('message', handleMessage)
      pythonWorker.postMessage({ type: 'list-packages', id })

      // Timeout after 10 seconds
      setTimeout(() => {
        pythonWorker?.off('message', handleMessage)
        resolve({ success: false, packages: [], error: 'List packages timeout' })
      }, 10000)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, packages: [], error: errorMessage }
  }
})

// Get Python memory statistics
ipcMain.handle('get-python-memory-stats', async () => {
  try {
    if (!pythonWorker || !pythonWorkerReady) {
      return { success: false, error: 'Python worker not available' }
    }

    const id = `python-memory-${Date.now()}`

    return new Promise((resolve) => {
      if (!pythonWorker) {
        resolve({ success: false, error: 'Python worker not available' })
        return
      }

      const handleMessage = (message: WorkerResult) => {
        if (message.id !== id) return

        if (message.type === 'complete') {
          pythonWorker?.off('message', handleMessage)
          resolve({ success: true, stats: message.data })
        } else if (message.type === 'error') {
          pythonWorker?.off('message', handleMessage)
          const errorData = message.data as { message: string }
          resolve({ success: false, error: errorData.message })
        }
      }

      pythonWorker.on('message', handleMessage)
      pythonWorker.postMessage({ type: 'get-memory-stats', id })

      setTimeout(() => {
        pythonWorker?.off('message', handleMessage)
        resolve({ success: false, error: 'Timeout getting memory stats' })
      }, 5000)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
})

// Cleanup Python namespace manually
ipcMain.handle('cleanup-python-namespace', async () => {
  try {
    if (!pythonWorker || !pythonWorkerReady) {
      return { success: false, error: 'Python worker not available' }
    }

    const id = `python-cleanup-${Date.now()}`

    return new Promise((resolve) => {
      if (!pythonWorker) {
        resolve({ success: false, error: 'Python worker not available' })
        return
      }

      const handleMessage = (message: WorkerResult) => {
        if (message.id !== id) return

        if (message.type === 'complete') {
          pythonWorker?.off('message', handleMessage)
          resolve({ success: true })
        } else if (message.type === 'error') {
          pythonWorker?.off('message', handleMessage)
          const errorData = message.data as { message: string }
          resolve({ success: false, error: errorData.message })
        }
      }

      pythonWorker.on('message', handleMessage)
      pythonWorker.postMessage({ type: 'cleanup-namespace', id })

      setTimeout(() => {
        pythonWorker?.off('message', handleMessage)
        resolve({ success: false, error: 'Cleanup timeout' })
      }, 10000)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
})

// Reset Python runtime (P1-B) - clears all state and reinitializes
ipcMain.handle('reset-python-runtime', async () => {
  try {
    // Ensure Python worker is initialized
    if (!pythonWorker || !pythonWorkerReady) {
      await initializePythonWorker()
    }

    const id = `python-reset-${Date.now()}`

    return new Promise((resolve) => {
      if (!pythonWorker) {
        resolve({ success: false, error: 'Python worker not available' })
        return
      }

      const handleMessage = (message: WorkerResult) => {
        if (message.id !== id) return

        if (message.type === 'complete') {
          pythonWorker?.off('message', handleMessage)
          resolve({ success: true })
        } else if (message.type === 'error') {
          pythonWorker?.off('message', handleMessage)
          const errorData = message.data as { message: string }
          resolve({ success: false, error: errorData.message })
        }
      }

      pythonWorker.on('message', handleMessage)
      pythonWorker.postMessage({ type: 'reset-runtime', id })

      // Timeout after 30 seconds
      setTimeout(() => {
        pythonWorker?.off('message', handleMessage)
        resolve({ success: false, error: 'Reset timeout' })
      }, 30000)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
})

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.PUBLIC, 'cheesejs.png'),
    frame: false,
    show: false, // Don't show the window until it's ready
    backgroundColor: '#1e1e1e', // Set a dark background color
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: true, // Enable devTools for debugging
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for preload script functionality
      // Disable web security in development to allow AI API calls (CORS)
      // In production, API calls are made from the main process
      webSecurity: app.isPackaged
    }
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  ipcMain.on('close-me', () => {
    app.quit()
  })
  ipcMain.on('maximize', () => {
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.on('unmaximize', () => {
    win?.unmaximize()
  })
  ipcMain.on('minimize', () => {
    win?.minimize()
  })
  ipcMain.on('show-context-menu', () => {
    const menu = Menu.getApplicationMenu()
    menu?.popup({ window: win || undefined })
  })

  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        {
          label: 'Toggle Magic Comments',
          click: () => {
            win?.webContents.send('toggle-magic-comments')
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  // Terminate workers when app closes
  if (codeWorker) {
    codeWorker.terminate()
    codeWorker = null
  }
  if (pythonWorker) {
    pythonWorker.terminate()
    pythonWorker = null
  }
  // Clear any pending executions to prevent memory leaks
  pendingExecutions.clear()
  win = null
})
app
  .whenReady()
  .then(() => {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(
        nativeImage.createFromPath(path.join(process.env.PUBLIC, 'cheesejs.png'))
      )
    }
  })
  .then(async () => {
    // Initialize packages directory
    await initPackagesDirectory()

    // Register AI API proxy for CORS-free API calls
    registerAIProxy()

    // Initialize BOTH workers in parallel for faster cold start
    // Python worker takes 3-5s to load Pyodide, so start it early
    const workerInitPromises = [
      initializeCodeWorker(),
      initializePythonWorker().catch(err => {
        console.warn('Python worker pre-init failed (will retry on demand):', err)
      })
    ]

    // Wait for JS worker (required), Python can continue in background
    await workerInitPromises[0]
  })
  .then(createWindow)
