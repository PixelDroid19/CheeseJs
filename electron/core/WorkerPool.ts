/**
 * Generic Worker Pool
 *
 * Manages a pool of worker threads for concurrent task execution.
 * Features:
 * - Dynamic scaling based on load
 * - Priority-based task queue
 * - Idle worker cleanup
 * - Crash recovery
 */

import { Worker } from 'node:worker_threads';
import os from 'node:os';
import { createMainLogger } from './logger.js';

const log = createMainLogger('WorkerPool');

// ============================================================================
// TYPES
// ============================================================================

export interface WorkerPoolConfig {
  /** Minimum workers to keep warm (default: 1) */
  minWorkers: number;
  /** Maximum concurrent workers (default: CPU cores - 1) */
  maxWorkers: number;
  /** Time in ms before idle worker is terminated (default: 30000) */
  idleTimeoutMs: number;
  /** Default task timeout in ms (default: 30000) */
  taskTimeoutMs: number;
  /** Maximum queue size before rejecting new tasks (default: 100) */
  maxQueueSize: number;
}

export interface PooledTask<T> {
  id: string;
  priority: number;
  data: T;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  createdAt: number;
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

export interface PoolStats {
  totalWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
}

export interface WorkerState {
  worker: Worker;
  busy: boolean;
  currentTaskId: string | null;
  lastActiveAt: number;
  idleTimeout?: ReturnType<typeof setTimeout>;
}

export interface WorkerMessage {
  type: string;
  id?: string;
  data?: unknown;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: WorkerPoolConfig = {
  minWorkers: 1,
  maxWorkers: Math.max(2, os.cpus().length - 1),
  idleTimeoutMs: 30000,
  taskTimeoutMs: 30000,
  maxQueueSize: 100,
};

// ============================================================================
// WORKER POOL CLASS
// ============================================================================

export class WorkerPool<TTask extends { id: string }, TResult> {
  private config: WorkerPoolConfig;
  private workers: Map<number, WorkerState> = new Map();
  private taskQueue: PooledTask<TTask>[] = [];
  private pendingTasks: Map<string, PooledTask<TTask>> = new Map();
  private workerIdCounter = 0;
  private isShuttingDown = false;

  // Statistics
  private stats = {
    completedTasks: 0,
    failedTasks: 0,
  };

  // Callbacks
  private workerFactory: () => Worker;
  private taskHandler: (worker: Worker, task: TTask) => void;
  private messageHandler: (
    taskId: string,
    message: WorkerMessage,
    resolve: (result: unknown) => void,
    reject: (error: Error) => void
  ) => boolean; // Returns true if task is complete

  constructor(
    config: Partial<WorkerPoolConfig>,
    workerFactory: () => Worker,
    taskHandler: (worker: Worker, task: TTask) => void,
    messageHandler: (
      taskId: string,
      message: WorkerMessage,
      resolve: (result: unknown) => void,
      reject: (error: Error) => void
    ) => boolean
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workerFactory = workerFactory;
    this.taskHandler = taskHandler;
    this.messageHandler = messageHandler;

    log.debug(
      `[WorkerPool] Created with config: min=${this.config.minWorkers}, max=${this.config.maxWorkers}`
    );
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the pool with minimum workers
   */
  async initialize(): Promise<void> {
    log.debug(
      `[WorkerPool] Initializing with ${this.config.minWorkers} workers`
    );

    const initPromises: Promise<void>[] = [];
    for (let i = 0; i < this.config.minWorkers; i++) {
      initPromises.push(this.spawnWorker());
    }

    await Promise.all(initPromises);
    log.debug(`[WorkerPool] Initialized with ${this.workers.size} workers`);
  }

  /**
   * Submit a task to the pool
   */
  submit(task: TTask, priority = 0): Promise<TResult> {
    if (this.isShuttingDown) {
      return Promise.reject(new Error('Worker pool is shutting down'));
    }

    if (this.taskQueue.length >= this.config.maxQueueSize) {
      return Promise.reject(
        new Error(`Task queue full (max: ${this.config.maxQueueSize})`)
      );
    }

    return new Promise((resolve, reject) => {
      const pooledTask: PooledTask<TTask> = {
        id: task.id,
        priority,
        data: task,
        resolve: resolve as (result: unknown) => void,
        reject,
        createdAt: Date.now(),
      };

      // Set task timeout
      pooledTask.timeoutHandle = setTimeout(() => {
        this.handleTaskTimeout(task.id);
      }, this.config.taskTimeoutMs);

      this.pendingTasks.set(task.id, pooledTask);
      this.enqueue(pooledTask);
      this.processQueue();
    });
  }

  /**
   * Cancel a specific task
   */
  cancel(taskId: string): boolean {
    // Check if task is in queue
    const queueIndex = this.taskQueue.findIndex((t) => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.taskQueue.splice(queueIndex, 1)[0];
      if (task.timeoutHandle) clearTimeout(task.timeoutHandle);
      task.reject(new Error('Task cancelled'));
      this.pendingTasks.delete(taskId);
      return true;
    }

    // Check if task is being executed
    for (const [, state] of this.workers) {
      if (state.currentTaskId === taskId) {
        state.worker.postMessage({ type: 'cancel', id: taskId });
        return true;
      }
    }

    return false;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    let idleWorkers = 0;
    let busyWorkers = 0;

    for (const [, state] of this.workers) {
      if (state.busy) {
        busyWorkers++;
      } else {
        idleWorkers++;
      }
    }

    return {
      totalWorkers: this.workers.size,
      idleWorkers,
      busyWorkers,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.stats.completedTasks,
      failedTasks: this.stats.failedTasks,
    };
  }

  /**
   * Check if pool is ready
   */
  isReady(): boolean {
    return this.workers.size > 0 && !this.isShuttingDown;
  }

  /**
   * Gracefully terminate all workers
   */
  async terminate(): Promise<void> {
    this.isShuttingDown = true;

    // Reject all queued tasks
    for (const task of this.taskQueue) {
      if (task.timeoutHandle) clearTimeout(task.timeoutHandle);
      task.reject(new Error('Worker pool terminated'));
    }
    this.taskQueue = [];

    // Terminate all workers
    const terminatePromises: Promise<number>[] = [];
    for (const [id, state] of this.workers) {
      if (state.idleTimeout) clearTimeout(state.idleTimeout);
      terminatePromises.push(state.worker.terminate());
      this.workers.delete(id);
    }

    await Promise.all(terminatePromises);
    log.debug('[WorkerPool] All workers terminated');
  }

  /**
   * Broadcast a message to all active workers
   */
  broadcast(message: unknown): void {
    for (const [, state] of this.workers) {
      try {
        state.worker.postMessage(message);
      } catch (error) {
        log.warn('[WorkerPool] Failed to broadcast to worker:', error);
      }
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async spawnWorker(): Promise<void> {
    const workerId = this.workerIdCounter++;
    const worker = this.workerFactory();

    const state: WorkerState = {
      worker,
      busy: false,
      currentTaskId: null,
      lastActiveAt: Date.now(),
    };

    // Set up message handler
    worker.on('message', (message: WorkerMessage) => {
      this.handleWorkerMessage(workerId, message);
    });

    // Set up error handler
    worker.on('error', (error: Error) => {
      log.error(`[WorkerPool] Worker ${workerId} error:`, error);
      this.handleWorkerCrash(workerId, error);
    });

    // Set up exit handler
    worker.on('exit', (code) => {
      if (code !== 0 && !this.isShuttingDown) {
        log.warn(`[WorkerPool] Worker ${workerId} exited with code ${code}`);
        this.handleWorkerCrash(
          workerId,
          new Error(`Worker exited with code ${code}`)
        );
      }
    });

    this.workers.set(workerId, state);

    // Wait for worker to be ready
    await new Promise<void>((resolve) => {
      const readyHandler = (message: WorkerMessage) => {
        if (message.type === 'ready') {
          worker.off('message', readyHandler);
          resolve();
        }
      };
      worker.on('message', readyHandler);
    });

    log.debug(`[WorkerPool] Worker ${workerId} ready`);
  }

  private handleWorkerMessage(workerId: number, message: WorkerMessage): void {
    const state = this.workers.get(workerId);
    if (!state) return;

    const taskId = message.id || state.currentTaskId;
    if (!taskId) return;

    const pendingTask = this.pendingTasks.get(taskId);
    if (!pendingTask) return;

    // Let the message handler process the message
    const isComplete = this.messageHandler(
      taskId,
      message,
      pendingTask.resolve,
      pendingTask.reject
    );

    if (isComplete) {
      // Task completed
      if (pendingTask.timeoutHandle) clearTimeout(pendingTask.timeoutHandle);
      this.pendingTasks.delete(taskId);

      if (message.type === 'error') {
        this.stats.failedTasks++;
      } else {
        this.stats.completedTasks++;
      }

      // Mark worker as idle
      state.busy = false;
      state.currentTaskId = null;
      state.lastActiveAt = Date.now();

      // Schedule idle cleanup if above min workers
      this.scheduleIdleCleanup(workerId);

      // Process next task
      this.processQueue();
    }
  }

  private handleWorkerCrash(workerId: number, error: Error): void {
    const state = this.workers.get(workerId);
    if (!state) return;

    // Reject current task if any
    if (state.currentTaskId) {
      const task = this.pendingTasks.get(state.currentTaskId);
      if (task) {
        if (task.timeoutHandle) clearTimeout(task.timeoutHandle);
        task.reject(error);
        this.pendingTasks.delete(state.currentTaskId);
        this.stats.failedTasks++;
      }
    }

    // Clean up idle timeout
    if (state.idleTimeout) clearTimeout(state.idleTimeout);

    // Remove crashed worker
    this.workers.delete(workerId);

    // Spawn replacement if below minimum
    if (this.workers.size < this.config.minWorkers && !this.isShuttingDown) {
      log.debug('[WorkerPool] Spawning replacement worker');
      this.spawnWorker().then(() => this.processQueue());
    }
  }

  private handleTaskTimeout(taskId: string): void {
    const task = this.pendingTasks.get(taskId);
    if (!task) return;

    // Try to cancel in worker
    this.cancel(taskId);

    task.reject(new Error('Task execution timed out'));
    this.pendingTasks.delete(taskId);
    this.stats.failedTasks++;
  }

  private enqueue(task: PooledTask<TTask>): void {
    // Insert in priority order (higher priority first, then FIFO)
    let inserted = false;
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (task.priority > this.taskQueue[i].priority) {
        this.taskQueue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.taskQueue.push(task);
    }
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    // Find an idle worker
    let idleWorker: [number, WorkerState] | undefined;
    for (const entry of this.workers) {
      if (!entry[1].busy) {
        idleWorker = entry;
        break;
      }
    }

    if (idleWorker) {
      // Assign task to idle worker
      const task = this.taskQueue.shift()!;
      const [workerId, state] = idleWorker;

      state.busy = true;
      state.currentTaskId = task.id;
      state.lastActiveAt = Date.now();

      // Clear idle timeout
      if (state.idleTimeout) {
        clearTimeout(state.idleTimeout);
        state.idleTimeout = undefined;
      }

      log.debug(`[WorkerPool] Assigning task ${task.id} to worker ${workerId}`);
      this.taskHandler(state.worker, task.data);
    } else if (this.workers.size < this.config.maxWorkers) {
      // Spawn new worker to handle the task
      log.debug('[WorkerPool] Spawning new worker for queued task');
      this.spawnWorker().then(() => this.processQueue());
    }
    // Otherwise, task stays in queue until a worker is available
  }

  private scheduleIdleCleanup(workerId: number): void {
    const state = this.workers.get(workerId);
    if (!state) return;

    // Don't clean up if we're at minimum workers
    if (this.workers.size <= this.config.minWorkers) return;

    // Cancel existing timeout
    if (state.idleTimeout) {
      clearTimeout(state.idleTimeout);
    }

    // Schedule cleanup
    state.idleTimeout = setTimeout(() => {
      // Double-check conditions
      if (
        !state.busy &&
        this.workers.size > this.config.minWorkers &&
        !this.isShuttingDown
      ) {
        log.debug(`[WorkerPool] Terminating idle worker ${workerId}`);
        state.worker.terminate();
        this.workers.delete(workerId);
      }
    }, this.config.idleTimeoutMs);
  }
}
