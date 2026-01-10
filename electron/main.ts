import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Disable security warnings in development
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// Import core modules
import {
  WorkerPoolManager,
  WindowManager,
  registerIPCHandlers,
  appLog,
  mainLogger,
} from './core/index.js';
import { transformCode } from './transpiler/tsTranspiler.js';
import {
  getNodeModulesPath,
  initPackagesDirectory,
} from './packages/packageManager.js';
import { setupRagHandlers } from './rag/ipc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure global paths
process.env.DIST = path.join(__dirname, '../dist');
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

// Configure global error handlers
process.on('uncaughtException', (error) => {
  appLog.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  appLog.error('Unhandled Rejection:', reason);
});

appLog.info('Starting CheeseJS...');

// Only ignore certificate errors in development
if (!app.isPackaged) {
  app.commandLine.appendSwitch('ignore-certificate-errors');
  app.commandLine.appendSwitch('allow-insecure-localhost');
}

// Global instances
let windowManager: WindowManager | null = null;
let workerPool: WorkerPoolManager | null = null;

async function initApp() {
  try {
    // 1. Initialize Worker Pool
    await initPackagesDirectory();
    const nodeModulesPath = getNodeModulesPath();
    // Pass __dirname as distElectronPath so workers are found in the same directory as main.js
    workerPool = new WorkerPoolManager(__dirname, nodeModulesPath);

    // Start workers early for performance (especially Python)
    Promise.all([
      workerPool.initializeCodeWorker(),
      workerPool.initializePythonWorker().catch((err) => {
        appLog.warn(
          'Python worker pre-init failed (will retry on demand):',
          err
        );
      }),
    ]);

    // 2. Initialize Window Manager
    windowManager = new WindowManager(
      {
        publicPath: process.env.PUBLIC as string,
        distPath: process.env.DIST as string,
        preloadPath: path.join(__dirname, 'preload.js'),
        devServerUrl: process.env.VITE_DEV_SERVER_URL,
      },
      {
        onWindowReady: (win) => {
          // Configure logger with main window for IPC forwarding
          mainLogger.setMainWindow(win);
          workerPool?.setMainWindow(win);
        },
        onWindowClosed: () => {
          // Cleanup if needed
          mainLogger.setMainWindow(null);
          workerPool?.setMainWindow(null);
        },
      }
    );

    // 3. Register IPC Handlers
    registerIPCHandlers({
      workerPool,
      transformCode,
    });
    setupRagHandlers();

    // 4. Create Main Window
    windowManager.createWindow();

    appLog.info('App initialized successfully');
  } catch (error) {
    appLog.error('Failed to initialize app:', error);
    app.quit();
  }
}

// App Lifecycle
app.on('window-all-closed', () => {
  // Terminate workers when app closes
  if (workerPool) {
    // We can't easily wait for this, but we should trigger it
    // The process exit will clean up threads anyway usually
  }

  // Quit on all platforms (even macOS) for this type of utility app
  app.quit();
});

app.whenReady().then(initApp);
