import { ipcMain } from 'electron';
import type { WorkerPoolManager } from '../WorkerPoolManager';

export interface PythonHandlersConfig {
  workerPool: WorkerPoolManager;
}

export function registerPythonHandlers({
  workerPool,
}: PythonHandlersConfig): void {
  // ============================================================================
  // PYTHON PACKAGE MANAGEMENT HANDLERS
  // ============================================================================

  ipcMain.handle(
    'install-python-package',
    async (_event: unknown, packageName: string) => {
      try {
        if (!workerPool.isPythonWorkerReady()) {
          await workerPool.initializePythonWorker();
        }

        const id = `python-install-${Date.now()}`;
        const pythonWorker = workerPool.getPythonWorker();

        return new Promise((resolve) => {
          if (!pythonWorker) {
            resolve({
              success: false,
              packageName,
              error: 'Python worker not available',
            });
            return;
          }

          const handleMessage = (message: {
            type: string;
            id: string;
            data?: unknown;
          }) => {
            if (message.id !== id) return;

            if (message.type === 'complete') {
              pythonWorker.off('message', handleMessage);
              resolve({ success: true, packageName });
            } else if (message.type === 'error') {
              pythonWorker.off('message', handleMessage);
              const errorData = message.data as { message: string };
              resolve({
                success: false,
                packageName,
                error: errorData.message,
              });
            }
          };

          pythonWorker.on('message', handleMessage);
          pythonWorker.postMessage({
            type: 'install-package',
            id,
            packageName,
          });

          setTimeout(() => {
            pythonWorker.off('message', handleMessage);
            resolve({
              success: false,
              packageName,
              error: 'Installation timeout',
            });
          }, 60000);
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return { success: false, packageName, error: errorMessage };
      }
    }
  );

  ipcMain.handle('list-python-packages', async () => {
    try {
      if (!workerPool.isPythonWorkerReady()) {
        await workerPool.initializePythonWorker();
      }

      const id = `python-list-${Date.now()}`;
      const pythonWorker = workerPool.getPythonWorker();

      return new Promise((resolve) => {
        if (!pythonWorker) {
          resolve({
            success: false,
            packages: [],
            error: 'Python worker not available',
          });
          return;
        }

        const handleMessage = (message: {
          type: string;
          id: string;
          data?: unknown;
        }) => {
          if (message.id !== id) return;

          if (message.type === 'complete') {
            pythonWorker.off('message', handleMessage);
            const data = message.data as { packages: string[] };
            resolve({ success: true, packages: data.packages || [] });
          } else if (message.type === 'error') {
            pythonWorker.off('message', handleMessage);
            const errorData = message.data as { message: string };
            resolve({ success: false, packages: [], error: errorData.message });
          }
        };

        pythonWorker.on('message', handleMessage);
        pythonWorker.postMessage({ type: 'list-packages', id });

        setTimeout(() => {
          pythonWorker.off('message', handleMessage);
          resolve({
            success: false,
            packages: [],
            error: 'List packages timeout',
          });
        }, 10000);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, packages: [], error: errorMessage };
    }
  });

  // ============================================================================
  // PYTHON RUNTIME MANAGEMENT HANDLERS
  // ============================================================================

  ipcMain.handle('get-python-memory-stats', async () => {
    try {
      if (!workerPool.isPythonWorkerReady()) {
        return { success: false, error: 'Python worker not available' };
      }

      const id = `python-memory-${Date.now()}`;
      const pythonWorker = workerPool.getPythonWorker();

      return new Promise((resolve) => {
        if (!pythonWorker) {
          resolve({ success: false, error: 'Python worker not available' });
          return;
        }

        const handleMessage = (message: {
          type: string;
          id: string;
          data?: unknown;
        }) => {
          if (message.id !== id) return;

          if (message.type === 'complete') {
            pythonWorker.off('message', handleMessage);
            resolve({ success: true, stats: message.data });
          } else if (message.type === 'error') {
            pythonWorker.off('message', handleMessage);
            const errorData = message.data as { message: string };
            resolve({ success: false, error: errorData.message });
          }
        };

        pythonWorker.on('message', handleMessage);
        pythonWorker.postMessage({ type: 'get-memory-stats', id });

        setTimeout(() => {
          pythonWorker.off('message', handleMessage);
          resolve({ success: false, error: 'Timeout getting memory stats' });
        }, 5000);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('cleanup-python-namespace', async () => {
    try {
      if (!workerPool.isPythonWorkerReady()) {
        return { success: false, error: 'Python worker not available' };
      }

      const id = `python-cleanup-${Date.now()}`;
      const pythonWorker = workerPool.getPythonWorker();

      return new Promise((resolve) => {
        if (!pythonWorker) {
          resolve({ success: false, error: 'Python worker not available' });
          return;
        }

        const handleMessage = (message: {
          type: string;
          id: string;
          data?: unknown;
        }) => {
          if (message.id !== id) return;

          if (message.type === 'complete') {
            pythonWorker.off('message', handleMessage);
            resolve({ success: true });
          } else if (message.type === 'error') {
            pythonWorker.off('message', handleMessage);
            const errorData = message.data as { message: string };
            resolve({ success: false, error: errorData.message });
          }
        };

        pythonWorker.on('message', handleMessage);
        pythonWorker.postMessage({ type: 'cleanup-namespace', id });

        setTimeout(() => {
          pythonWorker.off('message', handleMessage);
          resolve({ success: false, error: 'Cleanup timeout' });
        }, 10000);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('reset-python-runtime', async () => {
    try {
      if (!workerPool.isPythonWorkerReady()) {
        await workerPool.initializePythonWorker();
      }

      const id = `python-reset-${Date.now()}`;
      const pythonWorker = workerPool.getPythonWorker();

      return new Promise((resolve) => {
        if (!pythonWorker) {
          resolve({ success: false, error: 'Python worker not available' });
          return;
        }

        const handleMessage = (message: {
          type: string;
          id: string;
          data?: unknown;
        }) => {
          if (message.id !== id) return;

          if (message.type === 'complete') {
            pythonWorker.off('message', handleMessage);
            resolve({ success: true });
          } else if (message.type === 'error') {
            pythonWorker.off('message', handleMessage);
            const errorData = message.data as { message: string };
            resolve({ success: false, error: errorData.message });
          }
        };

        pythonWorker.on('message', handleMessage);
        pythonWorker.postMessage({ type: 'reset-runtime', id });

        setTimeout(() => {
          pythonWorker.off('message', handleMessage);
          resolve({ success: false, error: 'Reset timeout' });
        }, 30000);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });
}
