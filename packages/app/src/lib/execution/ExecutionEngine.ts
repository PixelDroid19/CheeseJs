import { DEFAULT_TIMEOUT } from '../../constants';
import {
  createExecutionEngine,
  ExecutionEngine,
  type ExecutionCallbacks,
  type ExecutionEngineDependencies,
} from '@cheesejs/execution/engine/ExecutionEngine';
import { hostBridge } from '../../host/hostBridge';

const browserExecutionEngineDeps: ExecutionEngineDependencies = {
  getCodeRunner: () => hostBridge.codeRunner,
  defaultTimeout: DEFAULT_TIMEOUT,
};

export type { ExecutionCallbacks, ExecutionEngineDependencies };
export { createExecutionEngine, ExecutionEngine };

export const executionEngine = createExecutionEngine(
  browserExecutionEngineDeps
);
