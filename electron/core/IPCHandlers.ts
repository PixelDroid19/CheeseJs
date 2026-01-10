/**
 * IPC Handlers Module
 *
 * Centralized IPC (Inter-Process Communication) handler registration.
 * Separates IPC logic from the main process for better maintainability.
 */

// NO IMPORTS NEEDED
import type { WorkerPoolManager } from './WorkerPoolManager';
import type { TransformOptions } from '../transpiler/tsTranspiler';
import { registerExecutionHandlers } from './handlers/ExecutionHandlers';
import { registerPackageHandlers } from './handlers/PackageHandlers';
import { registerPythonHandlers } from './handlers/PythonHandlers';
import { registerCaptureHandlers } from './handlers/CaptureHandlers';

// ============================================================================
// TYPES
// ============================================================================

interface IPCHandlersConfig {
  workerPool: WorkerPoolManager;
  transformCode: (code: string, options: TransformOptions) => string;
}

// ============================================================================
// IPC HANDLER REGISTRATION
// ============================================================================

export function registerIPCHandlers(config: IPCHandlersConfig): void {
  const { workerPool, transformCode } = config;

  // Register modular handlers
  registerExecutionHandlers({ workerPool, transformCode });
  registerPackageHandlers({ workerPool });
  registerPythonHandlers({ workerPool });
  registerCaptureHandlers();
}
