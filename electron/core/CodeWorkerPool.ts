import { Worker } from 'node:worker_threads';
import path from 'node:path';

interface BrowserWindowLike {
  isDestroyed(): boolean;
  webContents: {
    send(channel: string, ...args: unknown[]): void;
  };
}

interface PoolOptions {
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeoutMs?: number;
  taskTimeoutMs?: number;
  jsInputBuffer?: SharedArrayBuffer | null;
  jsInputLock?: SharedArrayBuffer | null;
}

interface ExecutionRequest {
  id: string;
  options: {
    timeout?: number;
    showUndefined?: boolean;
  };
}

interface WorkerMessage {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete' | 'ready';
  id: string;
  data?: unknown;
}

interface PendingExecution {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class CodeWorkerPool {
  private worker: Worker | null = null;
  private ready = false;
  private mainWindow: BrowserWindowLike | null = null;
  private pendingExecutions = new Map<string, PendingExecution>();

  constructor(
    private readonly distElectronPath: string,
    private nodeModulesPath: string,
    private readonly options: PoolOptions
  ) {}

  setMainWindow(window: BrowserWindowLike | null): void {
    this.mainWindow = window;
  }

  setNodeModulesPath(newPath: string): void {
    this.nodeModulesPath = newPath;
  }

  isReady(): boolean {
    return this.ready;
  }

  getStats() {
    return {
      ready: this.ready,
      maxWorkers: this.options.maxWorkers ?? 1,
      pendingExecutions: this.pendingExecutions.size,
    };
  }

  clearCache(packageName?: string): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: 'clear-cache', packageName });
  }

  async initialize(): Promise<void> {
    if (this.worker && this.ready) return;

    const workerPath = path.join(this.distElectronPath, 'codeExecutor.js');
    this.worker = new Worker(workerPath, {
      workerData: {
        nodeModulesPath: this.nodeModulesPath,
        jsInputBuffer: this.options.jsInputBuffer,
        jsInputLock: this.options.jsInputLock,
      },
    });

    await new Promise<void>((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Code worker initialization failed'));
        return;
      }

      const handleMessage = (message: WorkerMessage) => {
        if (message.type === 'ready') {
          this.ready = true;
          this.worker?.off('message', handleMessage);
          resolve();
        }
      };

      this.worker.on('message', handleMessage);
      this.worker.on('error', (err) => {
        this.ready = false;
        reject(err);
      });
      this.worker.on('exit', (code) => {
        this.ready = false;
        if (code !== 0) {
          reject(new Error(`Code worker exited with code ${code}`));
        }
      });
    });

    this.worker.on('message', (message: WorkerMessage) => {
      if (message.type !== 'ready') {
        this.mainWindow?.webContents.send('code-execution-result', message);
      }

      if (message.type === 'complete' || message.type === 'error') {
        const pending = this.pendingExecutions.get(message.id);
        if (pending) {
          if (message.type === 'error') {
            const data = message.data as { message?: string } | undefined;
            pending.reject(new Error(data?.message || 'Execution error'));
          } else {
            pending.resolve(message.data);
          }
          this.pendingExecutions.delete(message.id);
        }
      }
    });

    this.worker.on('error', (error) => {
      this.ready = false;
      for (const [id, pending] of this.pendingExecutions) {
        pending.reject(
          error instanceof Error ? error : new Error(String(error))
        );
        this.pendingExecutions.delete(id);
      }
    });

    this.worker.on('exit', () => {
      this.ready = false;
      this.worker = null;
    });
  }

  async executeCode(
    request: ExecutionRequest,
    transformedCode: string
  ): Promise<unknown> {
    if (!this.worker || !this.ready) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error('Code worker not initialized');
    }

    return new Promise((resolve, reject) => {
      this.pendingExecutions.set(request.id, { resolve, reject });

      this.worker?.postMessage({
        type: 'execute',
        id: request.id,
        code: transformedCode,
        options: {
          timeout:
            request.options.timeout ?? this.options.taskTimeoutMs ?? 30000,
          showUndefined: request.options.showUndefined ?? false,
        },
      });
    });
  }

  cancelExecution(id: string): void {
    this.worker?.postMessage({ type: 'cancel', id });

    const pending = this.pendingExecutions.get(id);
    if (pending) {
      pending.reject(new Error('Execution cancelled'));
      this.pendingExecutions.delete(id);
    }
  }

  async terminate(): Promise<void> {
    if (!this.worker) return;

    await this.worker.terminate();
    this.worker = null;
    this.ready = false;
    this.pendingExecutions.clear();
  }
}
