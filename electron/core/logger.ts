/**
 * Electron Main Process Logger
 *
 * Centralized logging for the Electron main process using electron-log.
 * Extends BaseLogger from shared/logger-base.ts to avoid code duplication.
 *
 * Features:
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Namespaces for categorization (e.g., [Worker], [IPC])
 * - File persistence (logs to %APPDATA%/cheesejs/logs/)
 * - In-memory buffer for debugging
 * - IPC bridge to send logs to renderer
 */

import log from 'electron-log/main';
import {
  BaseLogger,
  BaseNamespacedLogger,
  type LogLevel,
  type LogEntry,
  type BaseLoggerConfig,
} from '../../shared/logger-base.js';

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

export interface MainLoggerConfig extends BaseLoggerConfig {
  /** Whether to write to file (default: true) */
  fileOutput: boolean;
}

// Re-export shared types for consumers
export type { LogLevel, LogEntry };

// ============================================================================
// CONSTANTS
// ============================================================================

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
log.transports.file.format =
  '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Configure console transport
log.transports.console.level = IS_DEV ? 'debug' : 'info';
log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';

// ============================================================================
// MAIN LOGGER CLASS
// ============================================================================

class MainLogger extends BaseLogger<MainLoggerConfig> {
  private mainWindow: BrowserWindowLike | null = null;

  constructor() {
    super(DEFAULT_CONFIG);
  }

  /**
   * React to config changes by updating electron-log transports
   */
  protected onConfigChange(): void {
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
   * Create a namespaced logger
   */
  createNamespace(namespace: string): NamespacedMainLogger {
    return new NamespacedMainLogger(this, namespace);
  }

  /**
   * Output entry via electron-log (file + console transports)
   */
  protected outputEntry(entry: LogEntry): void {
    const formattedMessage = `[${entry.namespace}] ${entry.message}`;
    const logData =
      entry.data !== undefined
        ? [formattedMessage, entry.data]
        : [formattedMessage];

    switch (entry.level) {
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
  }

  /**
   * Send log entry to renderer via IPC
   */
  protected sendToIpc(entry: LogEntry): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('main-log-entry', entry);
    }
  }

  // ===========================================================================
  // MAIN-PROCESS SPECIFIC METHODS
  // ===========================================================================

  /**
   * Get path to log file
   */
  getLogFilePath(): string {
    return log.transports.file.getFile()?.path || '';
  }

  /**
   * Export all logs as JSON (overrides base to include logFilePath)
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
}

// ============================================================================
// NAMESPACED LOGGER
// ============================================================================

/**
 * A logger instance bound to a specific namespace
 */
class NamespacedMainLogger extends BaseNamespacedLogger<MainLoggerConfig> {
  constructor(logger: MainLogger, namespace: string) {
    super(logger, namespace);
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
