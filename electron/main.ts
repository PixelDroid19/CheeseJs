import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WorkerPoolManager,
  WindowManager,
  registerIPCHandlers,
  appLog,
  mainLogger,
} from './core/index.js';
import { transformCode } from './transpiler/swcTranspiler.js';
import {
  getNodeModulesPath,
  initPackagesDirectory,
} from './packages/packageManager.js';
import { registerAIProxy } from './aiProxy.js';
import { initWorkspace } from './core/handlers/FilesystemHandlers.js';
import { initializeDatabase } from './main/knowledge-base/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DIST = path.join(__dirname, '../dist');
process.env.PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

process.on('uncaughtException', (error) => {
  appLog.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  appLog.error('Unhandled Rejection:', reason);
});

appLog.info('Starting CheeseJS...');

// SECURITY NOTE: Certificate error handling removed for production safety
// If you need to work with self-signed certs in development, use proper
// certificate installation in your OS certificate store

let windowManager: WindowManager | null = null;
let workerPool: WorkerPoolManager | null = null;

async function initApp() {
  try {
    // Initialize secure workspace for filesystem operations
    initWorkspace();

    // Initialize RAG Database First
    await initializeDatabase().catch((err) => {
      appLog.warn('Failed to start RAG DB:', err);
    });

    // Initialize Worker Pool
    await initPackagesDirectory();
    const nodeModulesPath = getNodeModulesPath();
    workerPool = new WorkerPoolManager(__dirname, nodeModulesPath);

    // Start workers early for performance (especially Python)
    await Promise.all([
      workerPool.initializeCodeWorker(),
      workerPool.initializePythonWorker().catch((err) => {
        appLog.warn(
          'Python worker pre-init failed (will retry on demand):',
          err
        );
      }),
    ]);

    // Initialize Window Manager
    windowManager = new WindowManager(
      {
        publicPath: process.env.PUBLIC as string,
        distPath: process.env.DIST as string,
        preloadPath: path.join(__dirname, 'preload.js'),
        devServerUrl: process.env.VITE_DEV_SERVER_URL,
      },
      {
        onWindowReady: (win) => {
          mainLogger.setMainWindow(win);
          workerPool?.setMainWindow(win);
        },
        onWindowClosed: () => {
          mainLogger.setMainWindow(null);
          workerPool?.setMainWindow(null);
        },
      }
    );

    // Register IPC Handlers
    registerIPCHandlers({
      workerPool,
      transformCode,
    });

    // RAG handlers loaded lazily to avoid loading heavy deps at startup
    const { setupRagHandlers } = await import('./rag/ipc.js');
    setupRagHandlers();

    // AI Proxy with SSRF protection
    registerAIProxy();

    // Create Main Window
    windowManager.createWindow();

    appLog.info('App initialized successfully (security hardened)');
  } catch (error) {
    appLog.error('Failed to initialize app:', error);
    app.quit();
  }
}

// App Lifecycle
app.on('window-all-closed', () => {
  if (workerPool) {
    workerPool.terminate().catch((err) => {
      appLog.error('Error terminating worker pool:', err);
    });
  }

  app.quit();
});

app.whenReady().then(initApp);
