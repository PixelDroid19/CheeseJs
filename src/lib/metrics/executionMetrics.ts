/**
 * Execution Metrics System
 *
 * Provides structured logging and metrics collection for code execution,
 * transpilation, and worker performance monitoring.
 */

// ============================================================================
// TYPES
// ============================================================================

export enum MetricType {
  EXECUTION = 'execution',
  TRANSPILATION = 'transpilation',
  WORKER = 'worker',
  PACKAGE = 'package',
  CACHE = 'cache',
  ERROR = 'error',
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface MetricEvent {
  /** Unique event ID */
  id: string;
  /** Type of metric */
  type: MetricType;
  /** Event name */
  name: string;
  /** Timestamp */
  timestamp: number;
  /** Duration in ms (for timed events) */
  duration?: number;
  /** Detailed timing breakdown */
  timingBreakdown?: {
    compilation?: number;
    execution?: number;
    overhead?: number;
  };
  /** Memory usage (bytes) if available */
  memoryUsage?: number;
  /** Language being executed */
  language?: 'javascript' | 'typescript' | 'python';
  /** Success status */
  success?: boolean;
  /** Error category if failed */
  errorCategory?: 'syntax' | 'runtime' | 'timeout' | 'system' | 'unknown';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ExecutionMetrics {
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Cancelled executions */
  cancelledExecutions: number;
  /** Failed executions by category */
  errorsByCategory: Record<string, number>;
  /** Average execution time (ms) */
  averageExecutionTime: number;
  /** Maximum execution time (ms) */
  maxExecutionTime: number;
  /** Minimum execution time (ms) */
  minExecutionTime: number;
  /** Executions by language */
  byLanguage: Record<string, number>;
}

export interface TranspilationMetrics {
  /** Total transpilations */
  totalTranspilations: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses */
  cacheMisses: number;
  /** Average transpilation time (ms) */
  averageTranspileTime: number;
  /** Cache hit rate */
  cacheHitRate: number;
}

export interface WorkerMetrics {
  /** Worker restarts */
  restarts: number;
  /** Forced terminations */
  forcedTerminations: number;
  /** Health check failures */
  healthCheckFailures: number;
  /** Average queue wait time */
  averageQueueWaitTime: number;
}

export interface AggregatedMetrics {
  execution: ExecutionMetrics;
  transpilation: TranspilationMetrics;
  worker: WorkerMetrics;
  startTime: number;
  lastUpdated: number;
}

export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// METRICS COLLECTOR
// ============================================================================

const MAX_EVENTS = 1000;
const MAX_LOGS = 500;

class MetricsCollector {
  private events: MetricEvent[] = [];
  private logs: LogEntry[] = [];
  private eventIdCounter = 0;
  private startTime = Date.now();
  private logLevel: LogLevel = LogLevel.INFO;

  // Aggregated metrics
  private executionTimes: number[] = [];
  private transpileTimes: number[] = [];
  private queueWaitTimes: number[] = [];

  private metrics: AggregatedMetrics = {
    execution: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      cancelledExecutions: 0,
      errorsByCategory: {},
      averageExecutionTime: 0,
      maxExecutionTime: 0,
      minExecutionTime: Infinity,
      byLanguage: {},
    },
    transpilation: {
      totalTranspilations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageTranspileTime: 0,
      cacheHitRate: 0,
    },
    worker: {
      restarts: 0,
      forcedTerminations: 0,
      healthCheckFailures: 0,
      averageQueueWaitTime: 0,
    },
    startTime: this.startTime,
    lastUpdated: this.startTime,
  };

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  // ============================================================================
  // EVENT RECORDING
  // ============================================================================

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${++this.eventIdCounter}`;
  }

  /**
   * Record a metric event
   */
  recordEvent(event: Omit<MetricEvent, 'id' | 'timestamp'>): string {
    const fullEvent: MetricEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);

    // Trim old events if needed
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }

    // Update aggregated metrics
    this.updateMetrics(fullEvent);

    return fullEvent.id;
  }

  /**
   * Update aggregated metrics based on event
   */
  private updateMetrics(event: MetricEvent): void {
    this.metrics.lastUpdated = Date.now();

    switch (event.type) {
      case MetricType.EXECUTION:
        this.metrics.execution.totalExecutions++;

        if (event.success === true) {
          this.metrics.execution.successfulExecutions++;
        } else if (event.success === false) {
          if (event.name === 'execution_cancelled') {
            this.metrics.execution.cancelledExecutions++;
          } else {
            this.metrics.execution.failedExecutions++;
            if (event.errorCategory) {
              this.metrics.execution.errorsByCategory[event.errorCategory] =
                (this.metrics.execution.errorsByCategory[event.errorCategory] ||
                  0) + 1;
            }
          }
        }

        if (event.duration !== undefined) {
          this.executionTimes.push(event.duration);
          this.updateExecutionTimeStats();
        }

        if (event.language) {
          this.metrics.execution.byLanguage[event.language] =
            (this.metrics.execution.byLanguage[event.language] || 0) + 1;
        }
        break;

      case MetricType.TRANSPILATION: {
        this.metrics.transpilation.totalTranspilations++;

        if (event.name === 'cache_hit') {
          this.metrics.transpilation.cacheHits++;
        } else if (event.name === 'cache_miss') {
          this.metrics.transpilation.cacheMisses++;
        }

        if (event.duration !== undefined && event.name !== 'cache_hit') {
          this.transpileTimes.push(event.duration);
          this.metrics.transpilation.averageTranspileTime =
            this.calculateAverage(this.transpileTimes);
        }

        // Update cache hit rate
        const total =
          this.metrics.transpilation.cacheHits +
          this.metrics.transpilation.cacheMisses;
        this.metrics.transpilation.cacheHitRate =
          total > 0
            ? Math.round((this.metrics.transpilation.cacheHits / total) * 100)
            : 0;
        break;
      }

      case MetricType.WORKER:
        if (event.name === 'worker_restart') {
          this.metrics.worker.restarts++;
        } else if (event.name === 'forced_termination') {
          this.metrics.worker.forcedTerminations++;
        } else if (event.name === 'health_check_failed') {
          this.metrics.worker.healthCheckFailures++;
        }

        if (event.metadata?.queueWaitTime !== undefined) {
          this.queueWaitTimes.push(event.metadata.queueWaitTime as number);
          this.metrics.worker.averageQueueWaitTime = this.calculateAverage(
            this.queueWaitTimes
          );
        }
        break;

      default:
        break;
    }
  }

  /**
   * Update execution time statistics
   */
  private updateExecutionTimeStats(): void {
    const times = this.executionTimes;
    if (times.length === 0) return;

    this.metrics.execution.averageExecutionTime = this.calculateAverage(times);
    this.metrics.execution.maxExecutionTime = Math.max(...times);
    this.metrics.execution.minExecutionTime = Math.min(...times);
  }

  /**
   * Calculate average of array
   */
  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  // ============================================================================
  // TIMING HELPERS
  // ============================================================================

  /**
   * Start a timer and return a function to stop it and record the event
   */
  startTimer(
    type: MetricType,
    name: string,
    metadata?: Record<string, unknown>
  ): () => MetricEvent {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      const eventId = this.recordEvent({
        type,
        name,
        duration,
        metadata,
      });

      return this.events.find((e) => e.id === eventId)!;
    };
  }

  /**
   * Record an execution event with timing
   */
  recordExecution(options: {
    language: 'javascript' | 'typescript' | 'python';
    duration: number;
    success: boolean;
    error?: string;
    errorCategory?: 'syntax' | 'runtime' | 'timeout' | 'system' | 'unknown';
    codeLength?: number;
    memoryUsage?: number;
    timingBreakdown?: {
      compilation?: number;
      execution?: number;
      overhead?: number;
    };
  }): void {
    this.recordEvent({
      type: MetricType.EXECUTION,
      name: options.success ? 'execution_success' : 'execution_failed',
      duration: options.duration,
      language: options.language,
      success: options.success,
      errorCategory: options.errorCategory,
      memoryUsage: options.memoryUsage,
      timingBreakdown: options.timingBreakdown,
      metadata: {
        error: options.error,
        codeLength: options.codeLength,
      },
    });
  }

  /**
   * Record a transpilation event
   */
  recordTranspilation(options: {
    duration: number;
    cacheHit: boolean;
    language: 'javascript' | 'typescript';
  }): void {
    this.recordEvent({
      type: MetricType.TRANSPILATION,
      name: options.cacheHit ? 'cache_hit' : 'cache_miss',
      duration: options.duration,
      language: options.language,
    });
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  /**
   * Log a message
   */
  private log(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      category,
      message,
      data,
    };

    this.logs.push(entry);

    // Trim old logs if needed
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    // Also log to console in development
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV === 'development'
    ) {
      const prefix = `[${category}]`;
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(prefix, message, data);
          break;
        case LogLevel.INFO:
          console.info(prefix, message, data);
          break;
        case LogLevel.WARN:
          console.warn(prefix, message, data);
          break;
        case LogLevel.ERROR:
          console.error(prefix, message, data);
          break;
      }
    }
  }

  debug(
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  // ============================================================================
  // RETRIEVAL
  // ============================================================================

  /**
   * Get aggregated metrics
   */
  getMetrics(): AggregatedMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent events
   */
  getEvents(options?: {
    type?: MetricType;
    limit?: number;
    since?: number;
  }): MetricEvent[] {
    let filtered = this.events;

    if (options?.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }

    if (options?.since !== undefined) {
      filtered = filtered.filter((e) => e.timestamp >= options.since!);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Get recent logs
   */
  getLogs(options?: {
    level?: LogLevel;
    category?: string;
    limit?: number;
    since?: number;
  }): LogEntry[] {
    let filtered = this.logs;

    if (options?.level !== undefined) {
      filtered = filtered.filter((e) => e.level >= options.level!);
    }

    if (options?.category) {
      filtered = filtered.filter((e) => e.category === options.category);
    }

    if (options?.since !== undefined) {
      filtered = filtered.filter((e) => e.timestamp >= options.since!);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.events = [];
    this.logs = [];
    this.executionTimes = [];
    this.transpileTimes = [];
    this.queueWaitTimes = [];
    this.startTime = Date.now();

    this.metrics = {
      execution: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        cancelledExecutions: 0,
        errorsByCategory: {},
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        minExecutionTime: Infinity,
        byLanguage: {},
      },
      transpilation: {
        totalTranspilations: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageTranspileTime: 0,
        cacheHitRate: 0,
      },
      worker: {
        restarts: 0,
        forcedTerminations: 0,
        healthCheckFailures: 0,
        averageQueueWaitTime: 0,
      },
      startTime: this.startTime,
      lastUpdated: this.startTime,
    };
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        metrics: this.metrics,
        recentEvents: this.events.slice(-100),
        recentLogs: this.logs.slice(-100),
        exportedAt: Date.now(),
      },
      null,
      2
    );
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let metricsInstance: MetricsCollector | null = null;

/**
 * Get the global metrics collector instance
 */
export function getMetrics(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}

/**
 * Reset the metrics instance (for testing)
 */
export function resetMetrics(): void {
  if (metricsInstance) {
    metricsInstance.reset();
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export { MetricsCollector };
