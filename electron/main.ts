import { app, BrowserWindow, ipcMain, nativeImage, Menu, MenuItemConstructorOptions, session } from 'electron'
import path from 'node:path'

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

function createWindow() {
  // Get the session for WebContainer partition
  const webContainerSession = session.fromPartition('persist:webcontainer')

  // Configure session for WebContainers - allow third-party cookies
  webContainerSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: details.requestHeaders })
  })

  // Set CSP and COOP/COEP headers for WebContainers
  webContainerSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }

    // Remove conflicting headers to ensure our strict/permissive combo works
    delete responseHeaders['content-security-policy']
    delete responseHeaders['Content-Security-Policy']
    delete responseHeaders['X-Content-Security-Policy']
    delete responseHeaders['cross-origin-embedder-policy']
    delete responseHeaders['Cross-Origin-Embedder-Policy']
    delete responseHeaders['cross-origin-opener-policy']
    delete responseHeaders['Cross-Origin-Opener-Policy']
    delete responseHeaders['cross-origin-resource-policy']
    delete responseHeaders['Cross-Origin-Resource-Policy']

    callback({
      responseHeaders: {
        ...responseHeaders,
        // Permissive CSP that allows all necessary WebContainer resources
        'Content-Security-Policy': [
          "default-src * 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' data: blob:; " +
          "script-src * 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; " +
          "style-src * 'self' 'unsafe-inline'; " +
          "font-src * 'self' data:; " +
          "img-src * 'self' data: blob:; " +
          "connect-src * 'self' ws: wss:; " +
          "frame-src * 'self' blob:; " +
          "child-src * 'self' blob:; " +
          "worker-src * 'self' blob:;"
        ],
        'Cross-Origin-Embedder-Policy': ['credentialless'],
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Resource-Policy': ['cross-origin']
      }
    })
  })

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
      sandbox: false,
      webSecurity: true, // Enable webSecurity to support crossOriginIsolated
      allowRunningInsecureContent: false,
      // Enable features needed for WebContainers
      experimentalFeatures: true,
      // Allow service workers and shared workers
      nodeIntegrationInWorker: false,
      // Partition for session to enable third-party cookies
      partition: 'persist:webcontainer'
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
  .then(createWindow)
