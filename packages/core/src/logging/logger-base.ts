/**
 * Shared Logger Base
 *
 * Shared types and base class for the logging system.
 * Used by both the renderer Logger (src/lib/logging/logger.ts)
 * and the main process MainLogger (electron/core/logger.ts).
 *
 * Environment-specific concerns (console formatting, file output, IPC direction)
 * are handled by the subclasses.
 */

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  namespace: string;
  message: string;
  data?: unknown;
  stack?: string;
}

export interface BaseLoggerConfig {
  /** Minimum level to log */
  minLevel: LogLevel;
  /** Maximum entries to keep in memory */
  maxEntries: number;
  /** Whether to output to console/transport */
  consoleOutput: boolean;
  /** Whether to send logs via IPC */
  ipcEnabled: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================================================
// BASE LOGGER CLASS
// ============================================================================

/**
 * Abstract base class containing the shared logging logic.
 * Subclasses must implement `outputEntry()` and `sendToIpc()`.
 */
export abstract class BaseLogger<TConfig extends BaseLoggerConfig> {
  protected entries: LogEntry[] = [];
  protected config: TConfig;
  protected listeners: Set<(entry: LogEntry) => void> = new Set();

  constructor(defaultConfig: TConfig) {
    this.config = { ...defaultConfig };
  }

  /**
   * Configure the logger
   */
  configure(config: Partial<TConfig>): void {
    this.config = { ...this.config, ...config };
    this.onConfigChange();
  }

  /**
   * Hook for subclasses to react to config changes (e.g., update transports)
   */
  protected onConfigChange(): void {
    // Override in subclasses if needed
  }

  /**
   * Get current configuration
   */
  getConfig(): TConfig {
    return { ...this.config };
  }

  /**
   * Log a debug message
   */
  debug(namespace: string, message: string, data?: unknown): void {
    this.log('debug', namespace, message, data);
  }

  /**
   * Log an info message
   */
  info(namespace: string, message: string, data?: unknown): void {
    this.log('info', namespace, message, data);
  }

  /**
   * Log a warning message
   */
  warn(namespace: string, message: string, data?: unknown): void {
    this.log('warn', namespace, message, data);
  }

  /**
   * Log an error message
   */
  error(namespace: string, message: string, data?: unknown): void {
    this.log('error', namespace, message, data);
  }

  /**
   * Core log method
   */
  private log(
    level: LogLevel,
    namespace: string,
    message: string,
    data?: unknown
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      namespace,
      message,
      data,
      stack: level === 'error' ? new Error().stack : undefined,
    };

    // Store in memory
    this.entries.push(entry);
    this.trimEntries();

    // Output via environment-specific transport
    if (this.config.consoleOutput) {
      this.outputEntry(entry);
    }

    // Send via IPC if enabled
    if (this.config.ipcEnabled) {
      this.sendToIpc(entry);
    }

    // Notify listeners
    this.notifyListeners(entry);
  }

  /**
   * Environment-specific output (console, electron-log, etc.)
   * Must be implemented by subclasses.
   */
  protected abstract outputEntry(entry: LogEntry): void;

  /**
   * Environment-specific IPC send.
   * Must be implemented by subclasses.
   */
  protected abstract sendToIpc(entry: LogEntry): void;

  /**
   * Check if a level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return (
      LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel]
    );
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Trim entries to max limit
   */
  private trimEntries(): void {
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries);
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(entry: LogEntry): void {
    this.listeners.forEach((listener) => listener(entry));
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get all entries, optionally filtered
   */
  getEntries(filter?: {
    level?: LogLevel;
    namespace?: string;
    since?: number;
  }): LogEntry[] {
    let result = [...this.entries];

    if (filter?.level) {
      const minPriority = LOG_LEVEL_PRIORITY[filter.level];
      result = result.filter((e) => LOG_LEVEL_PRIORITY[e.level] >= minPriority);
    }

    if (filter?.namespace) {
      result = result.filter((e) => e.namespace === filter.namespace);
    }

    if (filter?.since !== undefined) {
      const since = filter.since;
      result = result.filter((e) => e.timestamp >= since);
    }

    return result;
  }

  /**
   * Get recent entries
   */
  getRecent(count: number = 50): LogEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get errors only
   */
  getErrors(): LogEntry[] {
    return this.entries.filter((e) => e.level === 'error');
  }

  /**
   * Get warnings and errors
   */
  getWarningsAndErrors(): LogEntry[] {
    return this.entries.filter(
      (e) => e.level === 'warn' || e.level === 'error'
    );
  }

  // ===========================================================================
  // SUBSCRIPTION
  // ===========================================================================

  /**
   * Subscribe to new log entries
   */
  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ===========================================================================
  // EXPORT & CLEAR
  // ===========================================================================

  /**
   * Export all logs as JSON
   */
  export(): string {
    return JSON.stringify(
      {
        config: this.config,
        entries: this.entries,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Export logs as formatted text
   */
  exportAsText(): string {
    return this.entries
      .map((e) => {
        const time = new Date(e.timestamp).toISOString();
        const data = e.data ? ` ${JSON.stringify(e.data)}` : '';
        return `[${time}] ${e.level.toUpperCase()} [${e.namespace}] ${e.message}${data}`;
      })
      .join('\n');
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get entry count
   */
  get count(): number {
    return this.entries.length;
  }
}

// ============================================================================
// BASE NAMESPACED LOGGER
// ============================================================================

/**
 * A logger wrapper bound to a specific namespace.
 */
export class BaseNamespacedLogger<TConfig extends BaseLoggerConfig> {
  constructor(
    protected logger: BaseLogger<TConfig>,
    protected namespace: string
  ) {}

  debug(message: string, data?: unknown): void {
    this.logger.debug(this.namespace, message, data);
  }

  info(message: string, data?: unknown): void {
    this.logger.info(this.namespace, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.logger.warn(this.namespace, message, data);
  }

  error(message: string, data?: unknown): void {
    this.logger.error(this.namespace, message, data);
  }
}
