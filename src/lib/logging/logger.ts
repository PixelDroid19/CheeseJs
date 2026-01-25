/**
 * Centralized Logger
 *
 * A unified logging system for CheeseJS that replaces console.* calls.
 * Provides structured logging with levels, namespaces, and optional persistence.
 *
 * Features:
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Namespaces for categorization (e.g., [Editor], [Detection])
 * - In-memory buffer with configurable limit
 * - Production mode filtering
 * - Log export for debugging
 * - Optional IPC bridge to Electron main process
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

export interface LoggerConfig {
  /** Minimum level to log (default: 'debug' in dev, 'warn' in prod) */
  minLevel: LogLevel;
  /** Maximum entries to keep in memory (default: 500) */
  maxEntries: number;
  /** Whether to output to console (default: true in dev) */
  consoleOutput: boolean;
  /** Whether to include timestamps in console output */
  showTimestamp: boolean;
  /** Whether to send logs to Electron main process via IPC */
  ipcEnabled: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#6b7280', // gray
  info: '#3b82f6', // blue
  warn: '#f59e0b', // amber
  error: '#ef4444', // red
};

const LOG_LEVEL_EMOJI: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

const IS_DEV =
  typeof process !== 'undefined'
    ? process.env.NODE_ENV === 'development'
    : !import.meta.env?.PROD;

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: IS_DEV ? 'debug' : 'warn',
  maxEntries: 500,
  consoleOutput: IS_DEV,
  showTimestamp: true,
  ipcEnabled: false,
};

// ============================================================================
// LOGGER CLASS
// ============================================================================

class Logger {
  private entries: LogEntry[] = [];
  private config: LoggerConfig = { ...DEFAULT_CONFIG };
  private listeners: Set<(entry: LogEntry) => void> = new Set();

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Create a namespaced logger
   */
  createNamespace(namespace: string): NamespacedLogger {
    return new NamespacedLogger(this, namespace);
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

    // Output to console
    if (this.config.consoleOutput) {
      this.consoleOutput(entry);
    }

    // Send to IPC if enabled
    if (
      this.config.ipcEnabled &&
      typeof window !== 'undefined' &&
      (
        window as unknown as {
          electron?: {
            ipcRenderer?: { send: (channel: string, data: unknown) => void };
          };
        }
      ).electron?.ipcRenderer
    ) {
      (
        window as unknown as {
          electron: {
            ipcRenderer: { send: (channel: string, data: unknown) => void };
          };
        }
      ).electron.ipcRenderer.send('log-entry', entry);
    }

    // Notify listeners
    this.notifyListeners(entry);
  }

  /**
   * Output to console with formatting
   */
  private consoleOutput(entry: LogEntry): void {
    const { level, namespace, message, data, timestamp } = entry;
    const emoji = LOG_LEVEL_EMOJI[level];
    const color = LOG_LEVEL_COLORS[level];

    let prefix = `${emoji} [${namespace}]`;
    if (this.config.showTimestamp) {
      const time = new Date(timestamp).toLocaleTimeString();
      prefix = `${time} ${prefix}`;
    }

    const args: unknown[] = [
      `%c${prefix}%c ${message}`,
      `color: ${color}; font-weight: bold`,
      'color: inherit',
    ];

    if (data !== undefined) {
      args.push(data);
    }

    switch (level) {
      case 'debug':
        // Use console.debug which can be filtered in DevTools

        console.debug(...args);
        break;
      case 'info':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
  }

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
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
      result = result.filter((e) => e.timestamp >= filter.since!);
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
   * Safe JSON stringify that handles circular references
   */
  private safeStringify(value: unknown, space?: number): string {
    const cache = new Set();
    return JSON.stringify(
      value,
      (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value)) {
            return '[Circular]';
          }
          cache.add(value);
        }
        return value;
      },
      space
    );
  }

  /**
   * Export all logs as JSON
   */
  export(): string {
    return this.safeStringify(
      {
        config: this.config,
        entries: this.entries,
        exportedAt: new Date().toISOString(),
      },
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
        const data = e.data ? ` ${this.safeStringify(e.data)}` : '';
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
// NAMESPACED LOGGER
// ============================================================================

/**
 * A logger instance bound to a specific namespace
 */
class NamespacedLogger {
  constructor(
    private logger: Logger,
    private namespace: string
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

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const logger = new Logger();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Create a namespaced logger for a specific module
 * @example
 * const log = createLogger('Editor');
 * log.info('File opened');
 */
export function createLogger(namespace: string): NamespacedLogger {
  return logger.createNamespace(namespace);
}

// Re-export types
export { Logger, NamespacedLogger };
