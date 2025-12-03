import { app, BrowserWindow, ipcMain, nativeImage, Menu, MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { transformCode, type TransformOptions } from './transpiler/tsTranspiler'
import { 
  initPackagesDirectory, 
  installPackage, 
  uninstallPackage, 
  listInstalledPackages,
  getNodeModulesPath
} from './packages/packageManager'

process.env.DIST = path.join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

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
const pendingExecutions = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()

/**
 * Initialize the code executor worker
 */
function initializeCodeWorker(): void {
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
      return
    }
    
    // Forward all messages to renderer
    if (win && !win.isDestroyed()) {
      win.webContents.send('code-execution-result', message)
    }
    
    // Handle completion
    if (message.type === 'complete' || message.type === 'error') {
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
    // Reject all pending executions
    for (const [id, pending] of pendingExecutions) {
      pending.reject(error)
      pendingExecutions.delete(id)
    }
  })
  
  codeWorker.on('exit', (code) => {
    console.log(`Worker exited with code ${code}`)
    codeWorker = null
    // Reinitialize worker if it crashed
    if (code !== 0) {
      setTimeout(initializeCodeWorker, 1000)
    }
  })
}

/**
 * Execute code in the worker
 */
async function executeCode(request: ExecutionRequest): Promise<unknown> {
  if (!codeWorker) {
    initializeCodeWorker()
    // Wait for worker to be ready
    await new Promise(resolve => setTimeout(resolve, 100))
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
    pendingExecutions.set(id, { resolve, reject })
    
    codeWorker!.postMessage({
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
        reject(new Error('Execution timeout'))
      }
    }, (options.timeout ?? 30000) + 5000)
  })
}

/**
 * Cancel a running execution
 */
function cancelExecution(id: string): void {
  if (codeWorker) {
    codeWorker.postMessage({ type: 'cancel', id })
  }
  if (pythonWorker) {
    pythonWorker.postMessage({ type: 'cancel', id })
  }
  
  const pending = pendingExecutions.get(id)
  if (pending) {
    pending.reject(new Error('Execution cancelled'))
    pendingExecutions.delete(id)
  }
}

// ============================================================================
// PYTHON WORKER MANAGEMENT
// ============================================================================

/**
 * Initialize the Python executor worker
 */
function initializePythonWorker(): void {
  const workerPath = path.join(__dirname, 'pythonExecutor.js')
  
  pythonWorker = new Worker(workerPath)
  
  pythonWorker.on('message', (message: WorkerResult) => {
    if (message.type === 'ready') {
      console.log('Python executor worker ready')
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
    
    // Forward all messages to renderer
    if (win && !win.isDestroyed()) {
      win.webContents.send('code-execution-result', message)
    }
    
    // Handle completion
    if (message.type === 'complete' || message.type === 'error') {
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
    for (const [id, pending] of pendingExecutions) {
      pending.reject(error)
      pendingExecutions.delete(id)
    }
  })
  
  pythonWorker.on('exit', (code) => {
    console.log(`Python worker exited with code ${code}`)
    pythonWorker = null
    if (code !== 0) {
      setTimeout(initializePythonWorker, 1000)
    }
  })
}

/**
 * Execute Python code in the worker
 */
async function executePython(request: ExecutionRequest): Promise<unknown> {
  if (!pythonWorker) {
    initializePythonWorker()
    // Wait for worker to be ready (Pyodide takes longer to load)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  const { id, code, options } = request
  
  return new Promise((resolve, reject) => {
    pendingExecutions.set(id, { resolve, reject })
    
    pythonWorker!.postMessage({
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
        reject(new Error('Execution timeout'))
      }
    }, (options.timeout ?? 30000) + 10000)
  })
}

// ============================================================================
// IPC HANDLERS FOR CODE EXECUTION
// ============================================================================

ipcMain.handle('execute-code', async (_event, request: ExecutionRequest) => {
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

ipcMain.on('cancel-execution', (_event, id: string) => {
  cancelExecution(id)
})

// ============================================================================
// IPC HANDLERS FOR PACKAGE MANAGEMENT
// ============================================================================

ipcMain.handle('install-package', async (_event, packageName: string) => {
  try {
    const result = await installPackage(packageName)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, packageName, error: errorMessage }
  }
})

ipcMain.handle('uninstall-package', async (_event, packageName: string) => {
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
      webSecurity: true
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

  const template: MenuItemConstructorOptions[] = [
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
  // Terminate worker when app closes
  if (codeWorker) {
    codeWorker.terminate()
    codeWorker = null
  }
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
    // Initialize the code worker before creating window
    initializeCodeWorker()
  })
  .then(createWindow)
