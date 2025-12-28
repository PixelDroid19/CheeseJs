/**
 * Window Manager Module
 *
 * Handles BrowserWindow creation, configuration, and window-related IPC.
 * Provides a centralized interface for window management in the main process.
 */

import { BrowserWindow, ipcMain, Menu, nativeImage, app } from 'electron';
import path from 'node:path';

// ============================================================================
// TYPES
// ============================================================================

export interface WindowManagerConfig {
  publicPath: string;
  distPath: string;
  preloadPath: string;
  devServerUrl?: string;
}

export interface WindowManagerCallbacks {
  onWindowReady?: (window: InstanceType<typeof BrowserWindow>) => void;
  onWindowClosed?: () => void;
}

// ============================================================================
// WINDOW MANAGER CLASS
// ============================================================================

export class WindowManager {
  private mainWindow: InstanceType<typeof BrowserWindow> | null = null;
  private config: WindowManagerConfig;
  private callbacks: WindowManagerCallbacks;

  constructor(
    config: WindowManagerConfig,
    callbacks: WindowManagerCallbacks = {}
  ) {
    this.config = config;
    this.callbacks = callbacks;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getWindow(): InstanceType<typeof BrowserWindow> | null {
    return this.mainWindow;
  }

  createWindow(): InstanceType<typeof BrowserWindow> {
    this.mainWindow = new BrowserWindow({
      icon: path.join(this.config.publicPath, 'cheesejs.png'),
      frame: false,
      show: false,
      backgroundColor: '#1e1e1e',
      webPreferences: {
        preload: this.config.preloadPath,
        devTools: true,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: true,
      },
    });

    this.setupWindowEvents();
    this.setupWindowIPC();
    this.setupApplicationMenu();
    this.loadContent();

    return this.mainWindow!;
  }

  destroy(): void {
    if (this.mainWindow) {
      this.mainWindow.destroy();
      this.mainWindow = null;
    }
  }

  // ============================================================================
  // PRIVATE SETUP METHODS
  // ============================================================================

  private setupWindowEvents(): void {
    if (!this.mainWindow) return;

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      this.callbacks.onWindowReady?.(this.mainWindow!);
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      this.mainWindow?.webContents.send(
        'main-process-message',
        new Date().toLocaleString()
      );
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.callbacks.onWindowClosed?.();
    });
  }

  private setupWindowIPC(): void {
    ipcMain.on('close-me', () => {
      app.quit();
    });

    ipcMain.on('maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.on('unmaximize', () => {
      this.mainWindow?.unmaximize();
    });

    ipcMain.on('minimize', () => {
      this.mainWindow?.minimize();
    });

    ipcMain.on('show-context-menu', () => {
      const menu = Menu.getApplicationMenu();
      menu?.popup({ window: this.mainWindow || undefined });
    });
  }

  private setupApplicationMenu(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template: any[] = [
      {
        label: 'File',
        submenu: [{ role: 'quit' }],
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
              this.mainWindow?.webContents.send('toggle-magic-comments');
            },
          },
        ],
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
          { role: 'togglefullscreen' },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private loadContent(): void {
    if (!this.mainWindow) return;

    if (this.config.devServerUrl) {
      this.mainWindow.loadURL(this.config.devServerUrl);
    } else {
      this.mainWindow.loadFile(path.join(this.config.distPath, 'index.html'));
    }
  }

  // ============================================================================
  // STATIC HELPERS
  // ============================================================================

  static setDockIcon(publicPath: string): void {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(
        nativeImage.createFromPath(path.join(publicPath, 'cheesejs.png'))
      );
    }
  }
}
