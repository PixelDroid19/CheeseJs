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
  // Set CSP and COOP/COEP headers for WebContainers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }

    // Remove conflicting headers to ensure our strict/permissive combo works
    delete responseHeaders['content-security-policy']
    delete responseHeaders['Content-Security-Policy']
    delete responseHeaders['X-Content-Security-Policy']
    delete responseHeaders['cross-origin-embedder-policy']
    delete responseHeaders['Cross-Origin-Embedder-Policy']
    delete responseHeaders['cross-origin-opener-policy']
    delete responseHeaders['Cross-Origin-Opener-Policy']

    callback({
      responseHeaders: {
        ...responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://*.stackblitz.com https://*.webcontainer.io https://*.staticblitz.com https://w-corp-staticblitz.com https://*.w-corp-staticblitz.com https://local.webcontainer.io https://*.webcontainer-api.io https://*.stackblitz.io; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:*; frame-src 'self' https://stackblitz.com https://*.stackblitz.com https://*.webcontainer.io https://*.staticblitz.com https://w-corp-staticblitz.com https://*.w-corp-staticblitz.com https://local.webcontainer.io https://*.webcontainer-api.io https://*.stackblitz.io; child-src 'self' https://stackblitz.com https://*.stackblitz.com https://*.webcontainer.io https://*.staticblitz.com https://w-corp-staticblitz.com https://*.w-corp-staticblitz.com https://local.webcontainer.io https://*.webcontainer-api.io https://*.stackblitz.io; worker-src 'self' blob: https://*.staticblitz.com https://*.webcontainer.io https://w-corp-staticblitz.com https://*.w-corp-staticblitz.com https://local.webcontainer.io https://*.webcontainer-api.io https://*.stackblitz.io;"],
        'Cross-Origin-Embedder-Policy': ['credentialless'],
        'Cross-Origin-Opener-Policy': ['same-origin']
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
      devTools: !app.isPackaged, // Disable devTools in production
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true, // Enable webSecurity to support crossOriginIsolated
      allowRunningInsecureContent: false
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
    if (process.platform === 'darwin') {
      app.dock.setIcon(
        nativeImage.createFromPath(path.join(process.env.PUBLIC, 'cheesejs.png'))
      )
    }
  })
  .then(createWindow)
