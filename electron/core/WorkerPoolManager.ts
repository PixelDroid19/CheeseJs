/**
 * Worker Pool Manager
 *
 * Handles the lifecycle and communication with code execution workers.
 * Provides a centralized interface for managing JavaScript/TypeScript
 * and Python code execution workers.
 *
 * JS/TS: Uses CodeWorkerPool for concurrent execution
 * Python: Uses single worker (Pyodide is memory-heavy)
 */

import { Worker } from 'node:worker_threads';
import path from 'node:path';

import { createMainLogger } from './logger.js';
import { CodeWorkerPool } from './CodeWorkerPool.js';

const log = createMainLogger('WorkerPoolManager');

// Minimal interface to avoid direct Electron dependency in type checking
interface BrowserWindowLike {
  isDestroyed(): boolean;
  webContents: {
    send(channel: string, ...args: unknown[]): void;
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionRequest {
  id: string;
  code: string;
  language?: string;
  options: {
    timeout?: number;
    showUndefined?: boolean;
    showTopLevelResults?: boolean;
    loopProtection?: boolean;
    magicComments?: boolean;
    memoryLimit?: number;
  };
}

export interface WorkerResult {
  type:
    | 'result'
    | 'console'
    | 'debug'
    | 'error'
    | 'complete'
    | 'ready'
    | 'status';
  id: string;
  data?: unknown;
  line?: number;
  jsType?: string;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

interface PendingExecution {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

// ============================================================================
// WORKER POOL MANAGER CLASS
// ============================================================================

export class WorkerPoolManager {
  // Code execution pool (for JS/TS - supports concurrent execution)
  private codeWorkerPool: CodeWorkerPool | null = null;
  private codeWorkerPoolInitPromise: Promise<void> | null = null;

  // Python worker (single worker - Pyodide is memory-heavy)
  private pythonWorker: Worker | null = null;
  private pythonWorkerReady = false;

  private pendingExecutions = new Map<string, PendingExecution>();
  private pendingCancellations = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private pythonWorkerInitPromise: Promise<void> | null = null;
  private pythonWorkerInitReject: ((error: Error) => void) | null = null;

  // Interrupt buffer for Python execution cancellation
  private pythonInterruptBuffer: SharedArrayBuffer | null = null;

  // Reference to main window for IPC
  private mainWindow: BrowserWindowLike | null = null;

  // Worker paths
  private readonly distElectronPath: string;
  private nodeModulesPath: string;

  // Reinitialization guards to prevent concurrent reinitializations
  private isReinitializingPythonWorker = false;

  // Configuration
  private readonly FORCE_TERMINATION_TIMEOUT = 2000;

  constructor(distElectronPath: string, nodeModulesPath: string) {
    this.distElectronPath = distElectronPath;
    this.nodeModulesPath = nodeModulesPath;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  setMainWindow(window: BrowserWindowLike | null): void {
    this.mainWindow = window;
    // Forward main window to code worker pool
    this.codeWorkerPool?.setMainWindow(window);
  }

  setNodeModulesPath(newPath: string): void {
    this.nodeModulesPath = newPath;
    // Forward to code worker pool
    this.codeWorkerPool?.setNodeModulesPath(newPath);
  }

  /**
   * Clear require cache for a package in all code workers
   */
  clearCodeCache(packageName: string): void {
    this.codeWorkerPool?.clearCache(packageName);
  }

  isCodeWorkerReady(): boolean {
    return this.codeWorkerPool?.isReady() ?? false;
  }

  isPythonWorkerReady(): boolean {
    return this.pythonWorkerReady;
  }

  /**
   * Get pool statistics for monitoring
   */
  getCodeWorkerPoolStats() {
    return this.codeWorkerPool?.getStats() ?? null;
  }

  getPythonWorker(): Worker | null {
    return this.pythonWorker;
  }

  getPythonInterruptBuffer(): SharedArrayBuffer | null {
    return this.pythonInterruptBuffer;
  }

  // ============================================================================
  // CODE WORKER POOL MANAGEMENT
  // ============================================================================

  async initializeCodeWorker(): Promise<void> {
    if (this.codeWorkerPoolInitPromise) {
      return this.codeWorkerPoolInitPromise;
    }

    if (this.codeWorkerPool?.isReady()) {
      return;
    }

    this.codeWorkerPoolInitPromise = (async () => {
      try {
        log.debug('[WorkerPool] Initializing code worker pool');

        this.codeWorkerPool = new CodeWorkerPool(
          this.distElectronPath,
          this.nodeModulesPath,
          {
            minWorkers: 1,
            maxWorkers: 4, // Reasonable concurrency limit
            idleTimeoutMs: 30000,
            taskTimeoutMs: 30000,
          }
        );

        // Set main window if already available
        if (this.mainWindow) {
          this.codeWorkerPool.setMainWindow(this.mainWindow);
        }

        await this.codeWorkerPool.initialize();
        log.debug('[WorkerPool] Code worker pool ready');
      } finally {
        this.codeWorkerPoolInitPromise = null;
      }
    })();

    return this.codeWorkerPoolInitPromise;
  }

  async executeCode(
    request: ExecutionRequest,
    transformedCode: string
  ): Promise<unknown> {
    if (!this.codeWorkerPool?.isReady()) {
      await this.initializeCodeWorker();
    }

    if (!this.codeWorkerPool) {
      throw new Error('Code worker pool not initialized');
    }

    return this.codeWorkerPool.executeCode(request, transformedCode);
  }

  // ============================================================================
  // PYTHON WORKER MANAGEMENT
  // ============================================================================

  async initializePythonWorker(): Promise<void> {
    if (this.pythonWorkerInitPromise) {
      return this.pythonWorkerInitPromise;
    }

    this.pythonWorkerInitPromise = new Promise((resolve, reject) => {
      this.pythonWorkerInitReject = reject;
      const workerPath = path.join(this.distElectronPath, 'pythonExecutor.js');

      this.pythonWorker = new Worker(workerPath);

      // Create and share interrupt buffer for execution cancellation
      this.pythonInterruptBuffer = new SharedArrayBuffer(1);
      this.pythonWorker.postMessage({
        type: 'set-interrupt-buffer',
        buffer: this.pythonInterruptBuffer,
      });

      this.pythonWorker.on('message', (message: WorkerResult) => {
        if (message.type === 'ready') {
          log.debug('[WorkerPool] Python executor worker ready');
          this.pythonWorkerReady = true;
          resolve();
          this.pythonWorkerInitPromise = null;
          this.pythonWorkerInitReject = null;
          return;
        }

        // Forward status messages
        if (message.type === 'status') {
          log.debug(
            '[WorkerPool] Python status:',
            (message.data as { message: string }).message
          );
          this.sendToRenderer('code-execution-result', message);
          return;
        }

        // Handle input requests
        if ((message as { type: string }).type === 'input-request') {
          this.sendToRenderer('python-input-request', message);
          return;
        }

        // Forward all messages to renderer
        this.sendToRenderer('code-execution-result', message);

        // Handle completion
        if (message.type === 'complete' || message.type === 'error') {
          this.clearPendingCancellation(message.id);
          this.resolveExecution(message);
        }
      });

      this.pythonWorker.on('error', (error: Error) => {
        log.error('[WorkerPool] Python worker error:', error);
        this.pythonWorkerReady = false;
        this.rejectAllPending(error);

        if (this.pythonWorkerInitReject) {
          this.pythonWorkerInitReject(error);
        }
        this.pythonWorkerInitPromise = null;
        this.pythonWorkerInitReject = null;
      });

      this.pythonWorker.on('exit', (code) => {
        log.debug(`[WorkerPool] Python worker exited with code ${code}`);
        this.pythonWorker = null;
        this.pythonWorkerReady = false;

        const wasInitializing = !!this.pythonWorkerInitPromise;
        if (wasInitializing && this.pythonWorkerInitReject) {
          this.pythonWorkerInitReject(
            new Error(`Python worker exited with code ${code}`)
          );
          this.pythonWorkerInitPromise = null;
          this.pythonWorkerInitReject = null;
          return;
        }

        // Prevent concurrent reinitializations
        if (code !== 0 && !this.isReinitializingPythonWorker) {
          this.isReinitializingPythonWorker = true;
          setTimeout(async () => {
            try {
              await this.initializePythonWorker();
            } finally {
              this.isReinitializingPythonWorker = false;
            }
          }, 1000);
        }
      });
    });

    return this.pythonWorkerInitPromise;
  }

  async executePython(request: ExecutionRequest): Promise<unknown> {
    if (!this.pythonWorker || !this.pythonWorkerReady) {
      await this.initializePythonWorker();
    }

    const { id, code, options } = request;

    return new Promise((resolve, reject) => {
      if (!this.pythonWorker) {
        reject(new Error('Python worker not initialized'));
        return;
      }

      this.pendingExecutions.set(id, { resolve, reject });

      this.pythonWorker.postMessage({
        type: 'execute',
        id,
        code,
        options: {
          timeout: options.timeout ?? 30000,
          showUndefined: options.showUndefined ?? false,
        },
      });

      // Safety timeout (longer for Python due to Pyodide loading)
      // Store the timeout so we can clean it up when execution completes
      const timeout = options.timeout ?? 30000;
      const safetyTimeout = setTimeout(() => {
        if (this.pendingExecutions.has(id)) {
          this.pendingExecutions.delete(id);
          this.pendingCancellations.delete(`timeout-${id}`);
          this.sendToRenderer('code-execution-result', {
            type: 'error',
            id,
            data: { name: 'TimeoutError', message: 'Execution timeout' },
          });
          reject(new Error('Execution timeout'));
        }
      }, timeout + 10000);

      // Store timeout for cleanup when execution completes
      this.pendingCancellations.set(`timeout-${id}`, safetyTimeout);
    });
  }

  // ============================================================================
  // CANCELLATION
  // ============================================================================

  cancelExecution(id: string): void {
    // Cancel in code worker pool
    if (this.codeWorkerPool) {
      this.codeWorkerPool.cancelExecution(id);
    }

    // Cancel in Python worker
    if (this.pythonWorker) {
      // Signal interrupt via SharedArrayBuffer first (SIGINT = 2)
      if (this.pythonInterruptBuffer) {
        const view = new Uint8Array(this.pythonInterruptBuffer);
        view[0] = 2; // SIGINT - will raise KeyboardInterrupt in Python
      }

      this.pythonWorker.postMessage({ type: 'cancel', id });

      const forceTimeout = setTimeout(() => {
        this.forceTerminatePythonWorker(id);
      }, this.FORCE_TERMINATION_TIMEOUT);

      this.pendingCancellations.set(`py-${id}`, forceTimeout);
    }

    const pending = this.pendingExecutions.get(id);
    if (pending) {
      pending.reject(new Error('Execution cancelled'));
      this.pendingExecutions.delete(id);
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async terminate(): Promise<void> {
    if (this.codeWorkerPool) {
      await this.codeWorkerPool.terminate();
      this.codeWorkerPool = null;
    }
    if (this.pythonWorker) {
      await this.pythonWorker.terminate();
      this.pythonWorker = null;
    }
    this.pendingExecutions.clear();
    this.pendingCancellations.clear();
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private resolveExecution(message: WorkerResult): void {
    const pending = this.pendingExecutions.get(message.id);
    if (pending) {
      if (message.type === 'error') {
        pending.reject(
          new Error((message.data as { message: string }).message)
        );
      } else {
        pending.resolve(message.data);
      }
      this.pendingExecutions.delete(message.id);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingExecutions) {
      pending.reject(error);
      this.pendingExecutions.delete(id);
    }
  }

  private clearPendingCancellation(id: string): void {
    // Clear Python force termination timeout
    const pyKey = `py-${id}`;
    const pyTimeout = this.pendingCancellations.get(pyKey);
    if (pyTimeout) {
      clearTimeout(pyTimeout);
      this.pendingCancellations.delete(pyKey);
    }

    // Clear execution safety timeout (prevents memory leak)
    const timeoutKey = `timeout-${id}`;
    const execTimeout = this.pendingCancellations.get(timeoutKey);
    if (execTimeout) {
      clearTimeout(execTimeout);
      this.pendingCancellations.delete(timeoutKey);
    }
  }

  // Note: forceTerminateCodeWorker is no longer needed as the pool handles this internally

  private async forceTerminatePythonWorker(id: string): Promise<void> {
    log.debug(
      `[WorkerPool] Force terminating Python worker for execution ${id}`
    );

    if (this.pythonWorker) {
      try {
        await this.pythonWorker.terminate();
      } catch (e) {
        log.error('[WorkerPool] Error during Python worker termination:', e);
      }
      this.pythonWorker = null;
      this.pythonWorkerReady = false;
      this.pythonInterruptBuffer = null;
    }

    this.pendingCancellations.delete(`py-${id}`);

    this.sendToRenderer('code-execution-result', {
      type: 'error',
      id,
      data: { name: 'CancelError', message: 'Execution forcibly terminated' },
    });

    log.debug('[WorkerPool] Python worker will be recreated on next execution');
  }
}
