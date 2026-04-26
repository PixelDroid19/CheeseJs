import { DEFAULT_TIMEOUT } from '../../constants';
import {
  createExecutionEngine,
  ExecutionEngine,
  type ExecutionCallbacks,
  type ExecutionEngineDependencies,
} from '@cheesejs/execution/engine/ExecutionEngine';

const browserExecutionEngineDeps: ExecutionEngineDependencies = {
  getCodeRunner: () => window.codeRunner,
  defaultTimeout: DEFAULT_TIMEOUT,
};

export type { ExecutionCallbacks, ExecutionEngineDependencies };
export { createExecutionEngine, ExecutionEngine };

export const executionEngine = createExecutionEngine(
  browserExecutionEngineDeps
);
