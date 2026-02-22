/**
 * Centralized Logger (Renderer Process)
 *
 * Extends the shared BaseLogger with browser-specific output:
 * - CSS-styled console output with emojis
 * - IPC bridge to Electron main process
 *
 * @see shared/logger-base.ts for shared types and base class
 */

import {
  BaseLogger,
  BaseNamespacedLogger,
  type LogLevel,
  type LogEntry,
  type BaseLoggerConfig,
} from '../../../shared/logger-base';

// Re-export shared types for consumers
export type { LogLevel, LogEntry };

// ============================================================================
// CONFIG
// ============================================================================

export interface LoggerConfig extends BaseLoggerConfig {
  /** Whether to include timestamps in console output */
  showTimestamp: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

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

class Logger extends BaseLogger<LoggerConfig> {
  constructor() {
    super(DEFAULT_CONFIG);
  }

  /**
   * Create a namespaced logger
   */
  createNamespace(namespace: string): NamespacedLogger {
    return new NamespacedLogger(this, namespace);
  }

  /**
   * Output to browser console with CSS formatting
   */
  protected outputEntry(entry: LogEntry): void {
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
   * Send log entry to Electron main process via IPC
   */
  protected sendToIpc(entry: LogEntry): void {
    if (
      typeof window !== 'undefined' &&
      (
        window as Window & {
          electron?: {
            ipcRenderer?: {
              send: (channel: string, ...args: unknown[]) => void;
            };
          };
        }
      ).electron?.ipcRenderer
    ) {
      (
        window as Window & {
          electron?: {
            ipcRenderer?: {
              send: (channel: string, ...args: unknown[]) => void;
            };
          };
        }
      ).electron!.ipcRenderer!.send('log-entry', entry);
    }
  }
}

// ============================================================================
// NAMESPACED LOGGER
// ============================================================================

/**
 * A logger instance bound to a specific namespace
 */
class NamespacedLogger extends BaseNamespacedLogger<LoggerConfig> {
  constructor(logger: Logger, namespace: string) {
    super(logger, namespace);
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
