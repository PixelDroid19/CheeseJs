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

// Worker Pool
export {
  WorkerPool,
  type WorkerPoolConfig,
  type PoolStats,
  type PooledTask,
  type WorkerState,
  type WorkerMessage,
} from './WorkerPool';
export {
  CodeWorkerPool,
  type ExecuteMessage,
  type CodeWorkerResult,
} from './CodeWorkerPool';

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
