/**
 * Electron Core Module
 *
 * Re-exports all core modules for centralized access.
 */

export {
  WorkerPoolManager,
  type ExecutionRequest,
  type WorkerResult,
} from './WorkerPoolManager';
export { registerIPCHandlers } from './IPCHandlers';
export {
  WindowManager,
  type WindowManagerConfig,
  type WindowManagerCallbacks,
} from './WindowManager';

// Centralized logging
export {
  mainLogger,
  createMainLogger,
  workerLog,
  ipcLog,
  appLog,
  packageLog,
  MainLogger,
  NamespacedMainLogger,
  type LogLevel,
  type LogEntry,
  type MainLoggerConfig,
} from './logger';
