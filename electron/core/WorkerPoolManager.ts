/**
 * Worker Pool Manager
 *
 * Handles the lifecycle and communication with code execution workers.
 * Provides a scalable pool interface for JS/TS (up to 4) and Python (up to 2).
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
    workingDirectory?: string;
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
  | 'status'
  | 'prompt-request'
  | 'alert-request'
  | 'input-request';
  id: string;
  data?: unknown;
  line?: number;
  jsType?: string;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

interface QueuedExecution {
  request: ExecutionRequest;
  transformedCode?: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface CodeWorkerInstance {
  worker: Worker;
  isReady: boolean;
  activeExecutionId: string | null;
  jsInputBuffer: SharedArrayBuffer;
  jsInputLock: SharedArrayBuffer;
}

interface PythonWorkerInstance {
  worker: Worker;
  isReady: boolean;
  activeExecutionId: string | null;
  interruptBuffer: SharedArrayBuffer;
}

// ============================================================================
// WORKER POOL MANAGER CLASS
// ============================================================================

export class WorkerPoolManager {
  private codeWorkers: CodeWorkerInstance[] = [];
  private pythonWorkers: PythonWorkerInstance[] = [];

  private jsQueue: QueuedExecution[] = [];
  private pythonQueue: QueuedExecution[] = [];

  private pendingExecutions = new Map<string, QueuedExecution>();
  private pendingCancellations = new Map<string, ReturnType<typeof setTimeout>>();
  private executionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  // Reference to main window for IPC
  private mainWindow: BrowserWindow | null = null;

  // Worker paths
  private readonly distElectronPath: string;
  private nodeModulesPath: string;

  // Configuration
  private readonly FORCE_TERMINATION_TIMEOUT = 2000;
  private readonly MAX_CODE_WORKERS = 4;
  private readonly MAX_PYTHON_WORKERS = 2;

  constructor(distElectronPath: string, nodeModulesPath: string) {
    this.distElectronPath = distElectronPath;
    this.nodeModulesPath = nodeModulesPath;
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
    return this.codeWorkers.some(w => w.isReady) || this.codeWorkers.length < this.MAX_CODE_WORKERS;
  }

  isPythonWorkerReady(): boolean {
    return this.pythonWorkers.some(w => w.isReady) || this.pythonWorkers.length < this.MAX_PYTHON_WORKERS;
  }

  resolveJSInput(id: string, value: string): void {
    // Find the worker executing this ID
    const worker = this.codeWorkers.find(w => w.activeExecutionId === id);
    if (!worker || !worker.jsInputBuffer || !worker.jsInputLock) return;

    // Reset buffer
    const buffer = new Uint8Array(worker.jsInputBuffer);
    buffer.fill(0);

    // Write string to buffer
    const encoder = new TextEncoder();
    const encoded = encoder.encode(value);

    if (encoded.length > buffer.length) {
      buffer.set(encoded.slice(0, buffer.length));
    } else {
      buffer.set(encoded);
    }

    // Set lock to 1 (ready)
    const lock = new Int32Array(worker.jsInputLock);
    Atomics.store(lock, 0, 1);

    // Notify worker
    Atomics.notify(lock, 0);
  }

  resolvePythonInput(id: string, value: string, requestId?: string): void {
    const worker = this.pythonWorkers.find(w => w.activeExecutionId === id);
    if (worker && worker.worker) {
      worker.worker.postMessage({
        type: 'input-response',
        id,
        value,
        requestId
      });
    }
  }

  // ============================================================================
  // BACKWARDS COMPATIBILITY & ADMIN API
  // ============================================================================

  clearRequireCache(packageName?: string): void {
    for (const instance of this.codeWorkers) {
      instance.worker.postMessage({ type: 'clear-cache', packageName });
    }
  }

  getCodeWorker(): Worker | null {
    if (this.codeWorkers.length === 0) this.spawnCodeWorker();
    return this.codeWorkers[0]?.worker || null;
  }

  getPythonWorker(): Worker | null {
    if (this.pythonWorkers.length === 0) this.spawnPythonWorker();
    return this.pythonWorkers[0]?.worker || null;
  }

  async initializeCodeWorker(): Promise<void> {
    if (this.codeWorkers.length === 0) this.spawnCodeWorker();
    while (!this.codeWorkers.some(w => w.isReady)) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  async initializePythonWorker(): Promise<void> {
    if (this.pythonWorkers.length === 0) this.spawnPythonWorker();
    while (!this.pythonWorkers.some(w => w.isReady)) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // ============================================================================
  // CODE WORKER MANAGEMENT
  // ============================================================================

  private spawnCodeWorker() {
    log.debug('[WorkerPool] Spawning new code worker. Current count:', this.codeWorkers.length);

    // Initialize shared buffers for JS input for this specific worker
    // 10KB for input string, 4 bytes for lock (0 = wait, 1 = ready)
    const jsInputBuffer = new SharedArrayBuffer(10 * 1024);
    const jsInputLock = new SharedArrayBuffer(4);

    const workerPath = path.join(this.distElectronPath, 'codeExecutor.js');
    const worker = new Worker(workerPath, {
      workerData: {
        nodeModulesPath: this.nodeModulesPath,
        jsInputBuffer,
        jsInputLock,
      },
    });

    const instance: CodeWorkerInstance = {
      worker,
      isReady: false,
      activeExecutionId: null,
      jsInputBuffer,
      jsInputLock
    };

    this.codeWorkers.push(instance);

    worker.on('message', (message: WorkerResult) => {
      if (message.type === 'ready') {
        log.debug('[WorkerPool] Code executor worker ready');
        instance.isReady = true;
        this.processJsQueue();
        return;
      }

      // Handle prompt/alert requests
      if (message.type === 'prompt-request' || message.type === 'alert-request') {
        // Already includes id from worker
        this.sendToRenderer('js-input-request', message);
        return;
      }

      // Forward all other messages to renderer
      this.sendToRenderer('code-execution-result', message);

      if (message.type === 'complete' || message.type === 'error') {
        this.clearPendingCancellation(message.id);
        this.resolveExecution(message.id, message);
        instance.activeExecutionId = null;
        this.processJsQueue();
      }
    });

    worker.on('error', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error('[WorkerPool] Code worker error:', err);
      this.handleCodeWorkerCrash(instance, err);
    });

    worker.on('exit', (code) => {
      log.debug(`[WorkerPool] Code worker exited with code ${code}`);
      if (code !== 0) {
        this.handleCodeWorkerCrash(instance, new Error(`Worker exited: ${code}`));
      } else {
        // Clean exit, remove from pool
        this.codeWorkers = this.codeWorkers.filter(w => w !== instance);
      }
    });
  }

  private handleCodeWorkerCrash(instance: CodeWorkerInstance, error: Error) {
    if (instance.activeExecutionId) {
      this.resolveExecution(instance.activeExecutionId, {
        type: 'error',
        id: instance.activeExecutionId,
        data: { name: 'WorkerCrash', message: error.message }
      });
    }
    this.codeWorkers = this.codeWorkers.filter(w => w !== instance);
    this.processJsQueue(); // might spawn a new one to replace it
  }

  async executeCode(request: ExecutionRequest, transformedCode: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.jsQueue.push({ request, transformedCode, resolve, reject });
      this.processJsQueue();
    });
  }

  private processJsQueue() {
    // 1. Replenish workers if there is demand and capacity
    if (this.jsQueue.length > 0) {
      const idleWorkers = this.codeWorkers.filter(w => !w.activeExecutionId);
      if (idleWorkers.length === 0 && this.codeWorkers.length < this.MAX_CODE_WORKERS) {
        this.spawnCodeWorker(); // async startup
      }
    }

    // 2. Assign tasks to idle ready workers
    for (const worker of this.codeWorkers) {
      if (worker.isReady && !worker.activeExecutionId && this.jsQueue.length > 0) {
        const task = this.jsQueue.shift()!;
        this.startJsExecution(worker, task);
      }
    }
  }

  private startJsExecution(worker: CodeWorkerInstance, task: QueuedExecution) {
    const { id, options } = task.request;
    worker.activeExecutionId = id;
    this.pendingExecutions.set(id, task);

    worker.worker.postMessage({
      type: 'execute',
      id,
      code: task.transformedCode,
      options: {
        timeout: options.timeout ?? 30000,
        showUndefined: options.showUndefined ?? false,
        workingDirectory: options.workingDirectory
      },
    });

    // Safety fallback timeout
    const timeoutMs = (options.timeout ?? 30000) + 5000;
    const fallbackTimeout = setTimeout(() => {
      if (worker.activeExecutionId === id) {
        log.warn(`[WorkerPool] Code execution timeout reached for ${id}, force terminating.`);
        this.forceTerminateCodeWorker(worker);
      }
    }, timeoutMs);
    this.executionTimeouts.set(id, fallbackTimeout);
  }

  // ============================================================================
  // PYTHON WORKER MANAGEMENT
  // ============================================================================

  private spawnPythonWorker() {
    log.debug('[WorkerPool] Spawning new Python worker. Current count:', this.pythonWorkers.length);

    const workerPath = path.join(this.distElectronPath, 'pythonExecutor.js');
    const worker = new Worker(workerPath);
    const interruptBuffer = new SharedArrayBuffer(1);

    worker.postMessage({
      type: 'set-interrupt-buffer',
      buffer: interruptBuffer,
    });

    const instance: PythonWorkerInstance = {
      worker,
      isReady: false,
      activeExecutionId: null,
      interruptBuffer
    };

    this.pythonWorkers.push(instance);

    worker.on('message', (message: WorkerResult) => {
      if (message.type === 'ready') {
        log.debug('[WorkerPool] Python executor worker ready');
        instance.isReady = true;
        this.processPythonQueue();
        return;
      }

      if (message.type === 'status') {
        this.sendToRenderer('code-execution-result', message);
        return;
      }

      if (message.type === 'input-request') {
        this.sendToRenderer('python-input-request', message);
        return;
      }

      this.sendToRenderer('code-execution-result', message);

      if (message.type === 'complete' || message.type === 'error') {
        this.clearPendingCancellation(message.id);
        this.resolveExecution(message.id, message);
        instance.activeExecutionId = null;
        this.processPythonQueue();
      }
    });

    worker.on('error', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error('[WorkerPool] Python worker error:', err);
      this.handlePythonWorkerCrash(instance, err);
    });

    worker.on('exit', (code) => {
      log.debug(`[WorkerPool] Python worker exited with code ${code}`);
      if (code !== 0) {
        this.handlePythonWorkerCrash(instance, new Error(`Worker exited: ${code}`));
      } else {
        this.pythonWorkers = this.pythonWorkers.filter(w => w !== instance);
      }
    });
  }

  private handlePythonWorkerCrash(instance: PythonWorkerInstance, error: Error) {
    if (instance.activeExecutionId) {
      this.resolveExecution(instance.activeExecutionId, {
        type: 'error',
        id: instance.activeExecutionId,
        data: { name: 'WorkerCrash', message: error.message }
      });
    }
    this.pythonWorkers = this.pythonWorkers.filter(w => w !== instance);
    this.processPythonQueue();
  }

  async executePython(request: ExecutionRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.pythonQueue.push({ request, resolve, reject });
      this.processPythonQueue();
    });
  }

  private processPythonQueue() {
    if (this.pythonQueue.length > 0) {
      const idleWorkers = this.pythonWorkers.filter(w => !w.activeExecutionId);
      if (idleWorkers.length === 0 && this.pythonWorkers.length < this.MAX_PYTHON_WORKERS) {
        this.spawnPythonWorker();
      }
    }

    for (const worker of this.pythonWorkers) {
      if (worker.isReady && !worker.activeExecutionId && this.pythonQueue.length > 0) {
        const task = this.pythonQueue.shift()!;
        this.startPythonExecution(worker, task);
      }
    }
  }

  private startPythonExecution(worker: PythonWorkerInstance, task: QueuedExecution) {
    const { id, options, code } = task.request;
    worker.activeExecutionId = id;
    this.pendingExecutions.set(id, task);

    worker.worker.postMessage({
      type: 'execute',
      id,
      code,
      options: {
        timeout: options.timeout ?? 30000,
        showUndefined: options.showUndefined ?? false,
        workingDirectory: options.workingDirectory
      },
    });

    // Python initialization can be slow
    const timeoutMs = (options.timeout ?? 30000) + 15000;
    const fallbackTimeout = setTimeout(() => {
      if (worker.activeExecutionId === id) {
        log.warn(`[WorkerPool] Python execution timeout reached for ${id}, force terminating.`);
        this.forceTerminatePythonWorker(worker);
      }
    }, timeoutMs);
    this.executionTimeouts.set(id, fallbackTimeout);
  }

  // ============================================================================
  // CANCELLATION
  // ============================================================================

  cancelExecution(id: string): void {
    // 1. Is it still in the queue?
    const jsIdx = this.jsQueue.findIndex(q => q.request.id === id);
    if (jsIdx >= 0) {
      const task = this.jsQueue.splice(jsIdx, 1)[0];
      task.reject(new Error('Execution cancelled'));
      return;
    }

    const pyIdx = this.pythonQueue.findIndex(q => q.request.id === id);
    if (pyIdx >= 0) {
      const task = this.pythonQueue.splice(pyIdx, 1)[0];
      task.reject(new Error('Execution cancelled'));
      return;
    }

    // 2. Is it running?
    const jsWorker = this.codeWorkers.find(w => w.activeExecutionId === id);
    if (jsWorker) {
      jsWorker.worker.postMessage({ type: 'cancel', id });
      const forceTimeout = setTimeout(() => {
        this.forceTerminateCodeWorker(jsWorker);
      }, this.FORCE_TERMINATION_TIMEOUT);
      this.pendingCancellations.set(`js-${id}`, forceTimeout);
    }

    const pyWorker = this.pythonWorkers.find(w => w.activeExecutionId === id);
    if (pyWorker) {
      if (pyWorker.interruptBuffer) {
        const view = new Uint8Array(pyWorker.interruptBuffer);
        view[0] = 2; // SIGINT
      }
      pyWorker.worker.postMessage({ type: 'cancel', id });
      const forceTimeout = setTimeout(() => {
        this.forceTerminatePythonWorker(pyWorker);
      }, this.FORCE_TERMINATION_TIMEOUT);
      this.pendingCancellations.set(`py-${id}`, forceTimeout);
    }

    const pending = this.pendingExecutions.get(id);
    if (pending) {
      pending.reject(new Error('Execution cancelled'));
      this.cleanupExecutionTracking(id);
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async terminate(): Promise<void> {
    for (const worker of this.codeWorkers) {
      worker.worker.terminate();
    }
    for (const worker of this.pythonWorkers) {
      worker.worker.terminate();
    }
    this.codeWorkers = [];
    this.pythonWorkers = [];
    this.jsQueue = [];
    this.pythonQueue = [];
    this.pendingExecutions.clear();
    this.pendingCancellations.clear();
    for (const timeout of this.executionTimeouts.values()) clearTimeout(timeout);
    this.executionTimeouts.clear();
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    } else {
      log.warn(`[WorkerPool] Cannot send to renderer (window destroyed or null)`);
    }
  }

  private resolveExecution(id: string, message: WorkerResult): void {
    const pending = this.pendingExecutions.get(id);
    if (pending) {
      if (message.type === 'error') {
        pending.reject(new Error((message.data as { message: string }).message));
      } else {
        pending.resolve(message.data);
      }
      this.cleanupExecutionTracking(id);
    }
  }

  private clearPendingCancellation(id: string): void {
    const jsTimeout = this.pendingCancellations.get(`js-${id}`);
    if (jsTimeout) {
      clearTimeout(jsTimeout);
      this.pendingCancellations.delete(`js-${id}`);
    }

    const pyTimeout = this.pendingCancellations.get(`py-${id}`);
    if (pyTimeout) {
      clearTimeout(pyTimeout);
      this.pendingCancellations.delete(`py-${id}`);
    }
  }

  private cleanupExecutionTracking(id: string) {
    this.pendingExecutions.delete(id);
    const exTimer = this.executionTimeouts.get(id);
    if (exTimer) {
      clearTimeout(exTimer);
      this.executionTimeouts.delete(id);
    }
  }

  private async forceTerminateCodeWorker(instance: CodeWorkerInstance): Promise<void> {
    const id = instance.activeExecutionId;
    if (id) {
      this.sendToRenderer('code-execution-result', {
        type: 'error',
        id,
        data: { name: 'CancelError', message: 'Execution forcibly terminated' },
      });
      this.pendingCancellations.delete(`js-${id}`);
    }

    try { await instance.worker.terminate(); } catch (_e) { /* ignore */ }
    this.codeWorkers = this.codeWorkers.filter(w => w !== instance);

    // Attempt to process queue (will spawn new worker if needed)
    this.processJsQueue();
  }

  private async forceTerminatePythonWorker(instance: PythonWorkerInstance): Promise<void> {
    const id = instance.activeExecutionId;
    if (id) {
      this.sendToRenderer('code-execution-result', {
        type: 'error',
        id,
        data: { name: 'CancelError', message: 'Execution forcibly terminated' },
      });
      this.pendingCancellations.delete(`py-${id}`);
    }

    try { await instance.worker.terminate(); } catch (_e) { /* ignore */ }
    this.pythonWorkers = this.pythonWorkers.filter(w => w !== instance);

    // Attempt to process queue (will spawn new worker if needed)
    this.processPythonQueue();
  }
}
