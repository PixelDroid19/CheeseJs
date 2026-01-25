/**
 * Code Worker Pool
 *
 * Specialized worker pool for JavaScript/TypeScript code execution.
 * Wraps the generic WorkerPool with code execution-specific logic.
 */

import { Worker } from 'node:worker_threads';
import path from 'node:path';

import { WorkerPool, WorkerPoolConfig } from './WorkerPool.js';
import { createMainLogger } from './logger.js';

const log = createMainLogger('CodeWorkerPool');

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

export interface ExecuteMessage {
  type: 'execute';
  id: string;
  code: string;
  options: {
    timeout?: number;
    showUndefined?: boolean;
  };
}

export interface CodeWorkerResult {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete' | 'ready';
  id: string;
  data?: unknown;
  line?: number;
  jsType?: string;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

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
  };
}

// ============================================================================
// CODE WORKER POOL CLASS
// ============================================================================

export class CodeWorkerPool {
  private pool: WorkerPool<ExecuteMessage, unknown>;
  private distElectronPath: string;
  private nodeModulesPath: string;
  private mainWindow: BrowserWindowLike | null = null;

  // Track intermediate messages for forwarding
  private messageCallbacks: Map<
    string,
    {
      onMessage: (message: CodeWorkerResult) => void;
      onComplete: (result: unknown) => void;
      onError: (error: Error) => void;
    }
  > = new Map();

  constructor(
    distElectronPath: string,
    nodeModulesPath: string,
    config?: Partial<WorkerPoolConfig>
  ) {
    this.distElectronPath = distElectronPath;
    this.nodeModulesPath = nodeModulesPath;

    this.pool = new WorkerPool<ExecuteMessage, unknown>(
      {
        minWorkers: 1,
        maxWorkers: config?.maxWorkers ?? 4,
        idleTimeoutMs: config?.idleTimeoutMs ?? 30000,
        taskTimeoutMs: config?.taskTimeoutMs ?? 30000,
        maxQueueSize: config?.maxQueueSize ?? 100,
        ...config,
      },
      () => this.createWorker(),
      (worker, task) => this.sendTask(worker, task),
      (taskId, message, resolve, reject) =>
        this.handleMessage(taskId, message as CodeWorkerResult, resolve, reject)
    );
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the pool
   */
  async initialize(): Promise<void> {
    await this.pool.initialize();
    log.info('[CodeWorkerPool] Initialized');
  }

  /**
   * Set the main window for IPC forwarding
   */
  setMainWindow(window: BrowserWindowLike | null): void {
    this.mainWindow = window;
  }

  /**
   * Execute code in the pool
   */
  async executeCode(
    request: ExecutionRequest,
    transformedCode: string
  ): Promise<unknown> {
    const { id, options } = request;

    // Set up message forwarding for this execution
    return new Promise((resolve, reject) => {
      this.messageCallbacks.set(id, {
        onMessage: (message) =>
          this.sendToRenderer('code-execution-result', message),
        onComplete: resolve,
        onError: reject,
      });

      const task: ExecuteMessage = {
        type: 'execute',
        id,
        code: transformedCode,
        options: {
          timeout: options.timeout ?? 30000,
          showUndefined: options.showUndefined ?? false,
        },
      };

      this.pool
        .submit(task, 0)
        .then((result) => {
          this.messageCallbacks.delete(id);
          resolve(result);
        })
        .catch((error) => {
          this.messageCallbacks.delete(id);
          reject(error);
        });
    });
  }

  /**
   * Cancel a specific execution
   */
  cancelExecution(id: string): void {
    this.pool.cancel(id);
    this.messageCallbacks.delete(id);
  }

  /**
   * Check if the pool is ready
   */
  isReady(): boolean {
    return this.pool.isReady();
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.pool.getStats();
  }

  /**
   * Update node_modules path
   */
  setNodeModulesPath(newPath: string): void {
    this.nodeModulesPath = newPath;
  }

  /**
   * Clear require cache for a specific package in all workers
   */
  clearCache(packageName: string): void {
    this.pool.broadcast({ type: 'clear-cache', packageName });
    log.debug(`[CodeWorkerPool] Broadcasted cache clear for ${packageName}`);
  }

  /**
   * Terminate the pool
   */
  async terminate(): Promise<void> {
    await this.pool.terminate();
    this.messageCallbacks.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private createWorker(): Worker {
    const workerPath = path.join(this.distElectronPath, 'codeExecutor.js');

    log.debug(`[CodeWorkerPool] Creating worker at ${workerPath}`);

    return new Worker(workerPath, {
      workerData: {
        nodeModulesPath: this.nodeModulesPath,
      },
    });
  }

  private sendTask(worker: Worker, task: ExecuteMessage): void {
    worker.postMessage(task);
  }

  private handleMessage(
    taskId: string,
    message: CodeWorkerResult,
    resolve: (result: unknown) => void,
    reject: (error: Error) => void
  ): boolean {
    const callbacks = this.messageCallbacks.get(taskId);

    // Forward intermediate messages to renderer
    if (callbacks && message.type !== 'complete' && message.type !== 'ready') {
      callbacks.onMessage(message);
    }

    // Handle completion
    if (message.type === 'complete') {
      resolve(message.data);
      return true;
    }

    // Handle errors
    if (message.type === 'error') {
      const errorData = message.data as { message: string; name?: string };
      reject(new Error(errorData.message || 'Execution error'));
      return true;
    }

    // Not complete yet
    return false;
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
