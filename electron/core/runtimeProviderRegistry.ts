import {
  getRuntimeProviderId,
  type RuntimeProviderId,
} from '@cheesejs/languages';
import type { TransformOptions } from '../transpiler/codeTransforms';
import type { ExecutionRequest, WorkerPoolManager } from './WorkerPoolManager';

export const DEFAULT_RUNTIME_PROVIDER_ID: RuntimeProviderId = 'node-vm';

export interface RuntimeExecutionContext {
  request: ExecutionRequest;
  workerPool: WorkerPoolManager;
  transformCode: (code: string, options: TransformOptions) => string;
}

export interface RuntimeExecutionProvider {
  id: RuntimeProviderId;
  execute: (context: RuntimeExecutionContext) => Promise<unknown>;
  isReady: (workerPool: WorkerPoolManager) => boolean;
}

function buildTransformOptions(request: ExecutionRequest): TransformOptions {
  return {
    showTopLevelResults: request.options.showTopLevelResults ?? true,
    loopProtection: request.options.loopProtection ?? true,
    magicComments: request.options.magicComments ?? false,
    showUndefined: request.options.showUndefined ?? false,
  };
}

function transformExecutionCode(
  request: ExecutionRequest,
  transformCode: RuntimeExecutionContext['transformCode']
): string {
  try {
    return transformCode(request.code, buildTransformOptions(request));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Transpilation error: ${errorMessage}`);
  }
}

const RUNTIME_EXECUTION_PROVIDERS: Record<
  RuntimeProviderId,
  RuntimeExecutionProvider
> = {
  'node-vm': {
    id: 'node-vm',
    async execute({ request, workerPool, transformCode }) {
      const transformedCode = transformExecutionCode(request, transformCode);
      return workerPool.executeCode(request, transformedCode);
    },
    isReady(workerPool) {
      return workerPool.isCodeWorkerReady();
    },
  },
  pyodide: {
    id: 'pyodide',
    async execute({ request, workerPool }) {
      return workerPool.executePython(request);
    },
    isReady(workerPool) {
      return workerPool.isPythonWorkerReady();
    },
  },
  'wasi-clang': {
    id: 'wasi-clang',
    async execute({ request, workerPool }) {
      return workerPool.executeWasi(request);
    },
    isReady(workerPool) {
      return workerPool.isWasiWorkerReady();
    },
  },
};

export function getRuntimeExecutionProvider(
  providerId: RuntimeProviderId
): RuntimeExecutionProvider | undefined {
  return RUNTIME_EXECUTION_PROVIDERS[providerId];
}

export function resolveRuntimeExecutionProvider(
  languageId: string
): RuntimeExecutionProvider | undefined {
  const providerId = getRuntimeProviderId(languageId);
  return providerId
    ? getRuntimeExecutionProvider(providerId)
    : getRuntimeExecutionProvider(DEFAULT_RUNTIME_PROVIDER_ID);
}
