/**
 * Execution Throttler - Adaptive Rate Limiting for Code Execution
 *
 * Features:
 * - Adaptive debounce based on execution history
 * - Automatic cancellation of obsolete requests
 * - Priority queue for urgent executions
 * - Metrics for monitoring
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ThrottlerConfig {
  minDelay: number; // Minimum delay between executions (ms)
  maxDelay: number; // Maximum delay before forcing execution (ms)
  adaptiveWeight: number; // Weight for adaptive delay calculation (0-1)
}

export interface ExecutionRequest<T> {
  id: string;
  execute: () => Promise<T>;
  priority?: 'normal' | 'high';
  timestamp: number;
}

interface ThrottlerMetrics {
  totalRequests: number;
  executedRequests: number;
  cancelledRequests: number;
  averageDelay: number;
  averageExecutionTime: number;
}

// ============================================================================
// EXECUTION THROTTLER
// ============================================================================

export class ExecutionThrottler<T = unknown> {
  private queue: ExecutionRequest<T>[] = [];
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentExecutionId: string | null = null;
  private isProcessing = false;

  // Execution time tracking for adaptive delay
  private executionTimes: number[] = [];
  private readonly maxHistorySize = 20;

  private config: ThrottlerConfig;
  private metrics: ThrottlerMetrics = {
    totalRequests: 0,
    executedRequests: 0,
    cancelledRequests: 0,
    averageDelay: 0,
    averageExecutionTime: 0,
  };

  constructor(config: Partial<ThrottlerConfig> = {}) {
    this.config = {
      minDelay: config.minDelay ?? 100,
      maxDelay: config.maxDelay ?? 1000,
      adaptiveWeight: config.adaptiveWeight ?? 0.3,
    };
  }

  /**
   * Calculate adaptive delay based on recent execution times
   */
  private calculateAdaptiveDelay(): number {
    if (this.executionTimes.length === 0) {
      return this.config.minDelay;
    }

    // Calculate average execution time
    const avgTime =
      this.executionTimes.reduce((a, b) => a + b, 0) /
      this.executionTimes.length;

    // Adaptive delay: longer executions = longer debounce
    // This prevents rapid re-executions when code takes time to run
    const adaptiveDelay =
      this.config.minDelay + avgTime * this.config.adaptiveWeight;

    return Math.min(
      Math.max(adaptiveDelay, this.config.minDelay),
      this.config.maxDelay
    );
  }

  /**
   * Record execution time for adaptive calculations
   */
  private recordExecutionTime(duration: number): void {
    this.executionTimes.push(duration);

    if (this.executionTimes.length > this.maxHistorySize) {
      this.executionTimes.shift();
    }

    // Update metrics
    this.metrics.averageExecutionTime =
      this.executionTimes.reduce((a, b) => a + b, 0) /
      this.executionTimes.length;
  }

  /**
   * Schedule an execution with throttling
   */
  async schedule(
    id: string,
    execute: () => Promise<T>,
    priority: 'normal' | 'high' = 'normal'
  ): Promise<T | null> {
    this.metrics.totalRequests++;

    const request: ExecutionRequest<T> = {
      id,
      execute,
      priority,
      timestamp: Date.now(),
    };

    // Clear pending timeout if exists
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    // Cancel non-high priority requests in queue
    const previousQueueSize = this.queue.length;
    this.queue = this.queue.filter((r) => r.priority === 'high');
    this.metrics.cancelledRequests += previousQueueSize - this.queue.length;

    // Add new request to queue
    this.queue.push(request);

    // If high priority, execute immediately
    if (priority === 'high') {
      return this.processQueue();
    }

    // Calculate delay and schedule
    const delay = this.calculateAdaptiveDelay();
    this.metrics.averageDelay =
      (this.metrics.averageDelay * (this.metrics.executedRequests || 1) +
        delay) /
      ((this.metrics.executedRequests || 1) + 1);

    return new Promise((resolve, reject) => {
      this.pendingTimeout = setTimeout(async () => {
        try {
          const result = await this.processQueue();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }

  /**
   * Process the queue and execute the latest request
   */
  private async processQueue(): Promise<T | null> {
    if (this.isProcessing || this.queue.length === 0) {
      return null;
    }

    this.isProcessing = true;

    // Get the latest request (last in queue)
    const request = this.queue[this.queue.length - 1];

    // Clear queue - only process latest
    const cancelledCount = this.queue.length - 1;
    this.metrics.cancelledRequests += cancelledCount;
    this.queue = [];

    this.currentExecutionId = request.id;

    try {
      const startTime = Date.now();
      const result = await request.execute();
      const duration = Date.now() - startTime;

      this.recordExecutionTime(duration);
      this.metrics.executedRequests++;

      return result;
    } finally {
      this.currentExecutionId = null;
      this.isProcessing = false;
    }
  }

  /**
   * Cancel all pending executions
   */
  cancelAll(): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    this.metrics.cancelledRequests += this.queue.length;
    this.queue = [];
  }

  /**
   * Cancel a specific execution by ID
   */
  cancel(id: string): boolean {
    const index = this.queue.findIndex((r) => r.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.metrics.cancelledRequests++;
      return true;
    }
    return false;
  }

  /**
   * Check if currently executing
   */
  isExecuting(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current execution ID
   */
  getCurrentExecutionId(): string | null {
    return this.currentExecutionId;
  }

  /**
   * Get throttler metrics
   */
  getMetrics(): ThrottlerMetrics & {
    executionRate: number;
    pendingCount: number;
  } {
    const totalHandled =
      this.metrics.executedRequests + this.metrics.cancelledRequests;
    return {
      ...this.metrics,
      executionRate:
        totalHandled > 0 ? this.metrics.executedRequests / totalHandled : 0,
      pendingCount: this.queue.length,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ThrottlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      executedRequests: 0,
      cancelledRequests: 0,
      averageDelay: 0,
      averageExecutionTime: 0,
    };
    this.executionTimes = [];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let throttlerInstance: ExecutionThrottler | null = null;

export function getExecutionThrottler(
  config?: Partial<ThrottlerConfig>
): ExecutionThrottler {
  if (!throttlerInstance) {
    throttlerInstance = new ExecutionThrottler(config);
  }
  return throttlerInstance;
}

export function resetExecutionThrottler(): void {
  if (throttlerInstance) {
    throttlerInstance.cancelAll();
    throttlerInstance = null;
  }
}
