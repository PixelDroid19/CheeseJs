/**
 * Electron Main Process Logger
 *
 * Centralized logging for the Electron main process using electron-log.
 * Provides structured logging with file persistence and IPC bridge.
 *
 * Features:
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Namespaces for categorization (e.g., [Worker], [IPC])
 * - File persistence (logs to %APPDATA%/cheesejs/logs/)
 * - In-memory buffer for debugging
 * - IPC bridge to send logs to renderer
 */

import log from 'electron-log/main';

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

export interface MainLoggerConfig {
  /** Minimum level to log (default: 'debug' in dev, 'info' in prod) */
  minLevel: LogLevel;
  /** Maximum entries to keep in memory (default: 1000) */
  maxEntries: number;
  /** Whether to output to console (default: true) */
  consoleOutput: boolean;
  /** Whether to write to file (default: true) */
  fileOutput: boolean;
  /** Whether to send logs to renderer via IPC */
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

const IS_DEV = process.env.NODE_ENV !== 'production';

const DEFAULT_CONFIG: MainLoggerConfig = {
  minLevel: IS_DEV ? 'debug' : 'info',
  maxEntries: 1000,
  consoleOutput: IS_DEV,
  fileOutput: true,
  ipcEnabled: false,
};

// ============================================================================
// CONFIGURE ELECTRON-LOG
// ============================================================================

// Configure file transport
log.transports.file.level = IS_DEV ? 'debug' : 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Configure console transport
log.transports.console.level = IS_DEV ? 'debug' : 'info';
log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';

// ============================================================================
// MAIN LOGGER CLASS
// ============================================================================

class MainLogger {
  private entries: LogEntry[] = [];
  private config: MainLoggerConfig = { ...DEFAULT_CONFIG };
  private mainWindow: BrowserWindowLike | null = null;
  private listeners: Set<(entry: LogEntry) => void> = new Set();

  /**
   * Configure the logger
   */
  configure(config: Partial<MainLoggerConfig>): void {
    this.config = { ...this.config, ...config };

    // Update electron-log config
    log.transports.file.level = this.config.fileOutput
      ? this.config.minLevel
      : false;
    log.transports.console.level = this.config.consoleOutput
      ? this.config.minLevel
      : false;
  }

  /**
   * Set the main window for IPC communication
   */
  setMainWindow(window: BrowserWindowLike | null): void {
    this.mainWindow = window;
  }

  /**
   * Get current configuration
   */
  getConfig(): MainLoggerConfig {
    return { ...this.config };
  }

  /**
   * Create a namespaced logger
   */
  createNamespace(namespace: string): NamespacedMainLogger {
    return new NamespacedMainLogger(this, namespace);
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

    // Format message for electron-log
    const formattedMessage = `[${namespace}] ${message}`;
    const logData =
      data !== undefined ? [formattedMessage, data] : [formattedMessage];

    // Output via electron-log
    switch (level) {
      case 'debug':
        log.debug(...logData);
        break;
      case 'info':
        log.info(...logData);
        break;
      case 'warn':
        log.warn(...logData);
        break;
      case 'error':
        log.error(...logData);
        break;
    }

    // Send to renderer via IPC if enabled
    if (
      this.config.ipcEnabled &&
      this.mainWindow &&
      !this.mainWindow.isDestroyed()
    ) {
      this.mainWindow.webContents.send('main-log-entry', entry);
    }

    // Notify listeners
    this.notifyListeners(entry);
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
   * Get path to log file
   */
  getLogFilePath(): string {
    return log.transports.file.getFile()?.path || '';
  }

  /**
   * Export all logs as JSON
   */
  export(): string {
    return JSON.stringify(
      {
        config: this.config,
        entries: this.entries,
        logFilePath: this.getLogFilePath(),
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
// NAMESPACED LOGGER
// ============================================================================

/**
 * A logger instance bound to a specific namespace
 */
class NamespacedMainLogger {
  constructor(
    private logger: MainLogger,
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

export const mainLogger = new MainLogger();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Create a namespaced logger for a specific module
 * @example
 * const log = createMainLogger('Worker');
 * log.info('Worker started');
 */
export function createMainLogger(namespace: string): NamespacedMainLogger {
  return mainLogger.createNamespace(namespace);
}

// Pre-created loggers for common namespaces
export const workerLog = createMainLogger('Worker');
export const ipcLog = createMainLogger('IPC');
export const appLog = createMainLogger('App');
export const packageLog = createMainLogger('Package');

// Re-export types
export { MainLogger, NamespacedMainLogger };
