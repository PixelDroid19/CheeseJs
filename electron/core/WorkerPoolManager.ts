/**
 * Worker Pool Manager
 *
 * Handles the lifecycle and communication with code execution workers.
 * Provides a centralized interface for managing JavaScript/TypeScript
 * and Python code execution workers.
 */

import { Worker } from 'node:worker_threads';
import path from 'node:path';
import type { BrowserWindow } from 'electron';

import { createMainLogger } from './logger.js';

const log = createMainLogger('WorkerPoolManager');

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionRequest {
  id: string;
  code: string;
  language?: 'javascript' | 'typescript' | 'python';
  options: {
    timeout?: number;
    showUndefined?: boolean;
    showTopLevelResults?: boolean;
    loopProtection?: boolean;
    magicComments?: boolean;
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
  private codeWorker: Worker | null = null;
  private pythonWorker: Worker | null = null;
  private codeWorkerReady = false;
  private pythonWorkerReady = false;

  private pendingExecutions = new Map<string, PendingExecution>();
  private pendingCancellations = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private codeWorkerInitPromise: Promise<void> | null = null;
  private codeWorkerInitReject: ((error: Error) => void) | null = null;
  private pythonWorkerInitPromise: Promise<void> | null = null;
  private pythonWorkerInitReject: ((error: Error) => void) | null = null;

  // Interrupt buffer for Python execution cancellation
  private pythonInterruptBuffer: SharedArrayBuffer | null = null;

  // Input buffers for JS synchronous prompt
  private jsInputBuffer: SharedArrayBuffer | null = null;
  private jsInputLock: SharedArrayBuffer | null = null;

  // Reference to main window for IPC
  private mainWindow: BrowserWindow | null = null;

  // Worker paths
  private readonly distElectronPath: string;
  private nodeModulesPath: string;

  // Configuration
  private readonly FORCE_TERMINATION_TIMEOUT = 2000;

  constructor(distElectronPath: string, nodeModulesPath: string) {
    this.distElectronPath = distElectronPath;
    this.nodeModulesPath = nodeModulesPath;

    // Initialize shared buffers for JS input
    // 10KB for input string
    this.jsInputBuffer = new SharedArrayBuffer(10 * 1024);
    // 4 bytes for lock (0 = wait, 1 = ready)
    this.jsInputLock = new SharedArrayBuffer(4);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  setNodeModulesPath(path: string): void {
    this.nodeModulesPath = path;
  }

  isCodeWorkerReady(): boolean {
    return this.codeWorkerReady;
  }

  isPythonWorkerReady(): boolean {
    return this.pythonWorkerReady;
  }

  getCodeWorker(): Worker | null {
    return this.codeWorker;
  }

  getPythonWorker(): Worker | null {
    return this.pythonWorker;
  }

  getPythonInterruptBuffer(): SharedArrayBuffer | null {
    return this.pythonInterruptBuffer;
  }

  resolveJSInput(value: string): void {
    if (!this.jsInputBuffer || !this.jsInputLock) return;

    // Reset buffer
    const buffer = new Uint8Array(this.jsInputBuffer);
    buffer.fill(0);

    // Write string to buffer
    const encoder = new TextEncoder();
    const encoded = encoder.encode(value);

    // Check if it fits (leave 1 byte for null terminator if needed, though we track length implicitly or zero-fill)
    if (encoded.length > buffer.length) {
      // Truncate if too long
      buffer.set(encoded.slice(0, buffer.length));
    } else {
      buffer.set(encoded);
    }

    // Set lock to 1 (ready)
    const lock = new Int32Array(this.jsInputLock);
    Atomics.store(lock, 0, 1);

    // Notify worker
    Atomics.notify(lock, 0);
  }

  // ============================================================================
  // CODE WORKER MANAGEMENT
  // ============================================================================

  async initializeCodeWorker(): Promise<void> {
    if (this.codeWorkerInitPromise) {
      return this.codeWorkerInitPromise;
    }

    this.codeWorkerInitPromise = new Promise((resolve, reject) => {
      this.codeWorkerInitReject = reject;
      const workerPath = path.join(this.distElectronPath, 'codeExecutor.js');

      this.codeWorker = new Worker(workerPath, {
        workerData: {
          nodeModulesPath: this.nodeModulesPath,
          jsInputBuffer: this.jsInputBuffer,
          jsInputLock: this.jsInputLock,
        },
      });

      this.codeWorker.on(
        'message',
        (
          message:
            | WorkerResult
            | { type: 'prompt-request' | 'alert-request'; message: string }
        ) => {
          log.debug('[WorkerPool] Received message from code worker:', message);
          if (message.type === 'ready') {
            log.debug('[WorkerPool] Code executor worker ready');
            this.codeWorkerReady = true;
            resolve();
            this.codeWorkerInitPromise = null;
            this.codeWorkerInitReject = null;
            return;
          }

          // Handle prompt/alert requests (JS synchronous input)
          if (
            message.type === 'prompt-request' ||
            message.type === 'alert-request'
          ) {
            this.sendToRenderer('js-input-request', message);
            return;
          }

          // Forward all messages to renderer
          this.sendToRenderer('code-execution-result', message);

          // Handle completion
          if (message.type === 'complete' || message.type === 'error') {
            this.clearPendingCancellation(message.id);
            this.resolveExecution(message);
          }
        }
      );

      this.codeWorker.on('error', (error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        log.error('[WorkerPool] Code worker error:', err);
        this.codeWorkerReady = false;
        this.rejectAllPending(err);

        if (this.codeWorkerInitReject) {
          this.codeWorkerInitReject(err);
        }
        this.codeWorkerInitPromise = null;
        this.codeWorkerInitReject = null;
      });

      this.codeWorker.on('exit', (code) => {
        log.debug(`[WorkerPool] Code worker exited with code ${code}`);
        this.codeWorker = null;
        this.codeWorkerReady = false;

        const wasInitializing = !!this.codeWorkerInitPromise;
        if (wasInitializing && this.codeWorkerInitReject) {
          this.codeWorkerInitReject(
            new Error(`Code worker exited with code ${code}`)
          );
          this.codeWorkerInitPromise = null;
          this.codeWorkerInitReject = null;
          return;
        }

        // Reinitialize worker if it crashed after being ready
        if (code !== 0) {
          setTimeout(() => this.initializeCodeWorker(), 1000);
        }
      });
    });

    return this.codeWorkerInitPromise;
  }

  async executeCode(
    request: ExecutionRequest,
    transformedCode: string
  ): Promise<unknown> {
    if (!this.codeWorker || !this.codeWorkerReady) {
      await this.initializeCodeWorker();
    }

    const { id, options } = request;

    return new Promise((resolve, reject) => {
      if (!this.codeWorker) {
        reject(new Error('Code worker not initialized'));
        return;
      }

      this.pendingExecutions.set(id, { resolve, reject });

      this.codeWorker.postMessage({
        type: 'execute',
        id,
        code: transformedCode,
        options: {
          timeout: options.timeout ?? 30000,
          showUndefined: options.showUndefined ?? false,
        },
      });

      // Safety timeout
      const timeout = options.timeout ?? 30000;
      setTimeout(() => {
        if (this.pendingExecutions.has(id)) {
          this.pendingExecutions.delete(id);
          this.sendToRenderer('code-execution-result', {
            type: 'error',
            id,
            data: { name: 'TimeoutError', message: 'Execution timeout' },
          });
          reject(new Error('Execution timeout'));
        }
      }, timeout + 5000);
    });
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

      this.pythonWorker.on('error', (error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        log.error('[WorkerPool] Python worker error:', err);
        this.pythonWorkerReady = false;
        this.rejectAllPending(err);

        if (this.pythonWorkerInitReject) {
          this.pythonWorkerInitReject(err);
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

        if (code !== 0) {
          setTimeout(() => this.initializePythonWorker(), 1000);
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
      const timeout = options.timeout ?? 30000;
      setTimeout(() => {
        if (this.pendingExecutions.has(id)) {
          this.pendingExecutions.delete(id);
          this.sendToRenderer('code-execution-result', {
            type: 'error',
            id,
            data: { name: 'TimeoutError', message: 'Execution timeout' },
          });
          reject(new Error('Execution timeout'));
        }
      }, timeout + 10000);
    });
  }

  // ============================================================================
  // CANCELLATION
  // ============================================================================

  cancelExecution(id: string): void {
    // Try cooperative cancellation first
    if (this.codeWorker) {
      this.codeWorker.postMessage({ type: 'cancel', id });

      const forceTimeout = setTimeout(() => {
        this.forceTerminateCodeWorker(id);
      }, this.FORCE_TERMINATION_TIMEOUT);

      this.pendingCancellations.set(`js-${id}`, forceTimeout);
    }

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
    if (this.codeWorker) {
      await this.codeWorker.terminate();
      this.codeWorker = null;
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
      log.debug(`[WorkerPool] Sending to renderer channel=${channel}`, data);
      this.mainWindow.webContents.send(channel, data);
    } else {
      log.warn(
        `[WorkerPool] Cannot send to renderer (window destroyed or null)`
      );
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
    const jsKey = `js-${id}`;
    const pyKey = `py-${id}`;

    const jsTimeout = this.pendingCancellations.get(jsKey);
    if (jsTimeout) {
      clearTimeout(jsTimeout);
      this.pendingCancellations.delete(jsKey);
    }

    const pyTimeout = this.pendingCancellations.get(pyKey);
    if (pyTimeout) {
      clearTimeout(pyTimeout);
      this.pendingCancellations.delete(pyKey);
    }
  }

  private async forceTerminateCodeWorker(id: string): Promise<void> {
    log.debug(`[WorkerPool] Force terminating code worker for execution ${id}`);

    if (this.codeWorker) {
      try {
        await this.codeWorker.terminate();
      } catch (e) {
        log.error('[WorkerPool] Error during code worker termination:', e);
      }
      this.codeWorker = null;
      this.codeWorkerReady = false;
    }

    this.pendingCancellations.delete(`js-${id}`);

    this.sendToRenderer('code-execution-result', {
      type: 'error',
      id,
      data: { name: 'CancelError', message: 'Execution forcibly terminated' },
    });

    log.debug('[WorkerPool] Recreating code worker after forced termination');
    await this.initializeCodeWorker();
  }

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
