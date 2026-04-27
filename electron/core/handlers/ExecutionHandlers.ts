import { ipcMain } from 'electron';
import {
  getRuntimeProviderId,
  type RuntimeProviderId,
} from '@cheesejs/languages';
import type { WorkerPoolManager, ExecutionRequest } from '../WorkerPoolManager';
import type { TransformOptions } from '../../transpiler/codeTransforms';
import {
  DEFAULT_RUNTIME_PROVIDER_ID,
  getRuntimeExecutionProvider,
} from '../runtimeProviderRegistry';

export interface ExecutionHandlersConfig {
  workerPool: WorkerPoolManager;
  transformCode: (code: string, options: TransformOptions) => string;
}

function resolveExecutionProvider(language: string) {
  const providerId = getRuntimeProviderId(language);
  const runtimeProvider = providerId
    ? getRuntimeExecutionProvider(providerId as RuntimeProviderId)
    : getRuntimeExecutionProvider(DEFAULT_RUNTIME_PROVIDER_ID);

  if (!runtimeProvider) {
    throw new Error(
      `No runtime execution provider registered for ${providerId ?? DEFAULT_RUNTIME_PROVIDER_ID}`
    );
  }

  return runtimeProvider;
}

export function registerExecutionHandlers({
  workerPool,
  transformCode,
}: ExecutionHandlersConfig): void {
  // ============================================================================
  // CODE EXECUTION HANDLERS
  // ============================================================================

  ipcMain.handle(
    'execute-code',
    async (_event: unknown, request: ExecutionRequest) => {
      console.log(
        '[Main] execute-code handler called:',
        request.id,
        request.language
      );
      try {
        const language = request.language || 'javascript';
        const normalizedRequest: ExecutionRequest = { ...request, language };
        const runtimeProvider = resolveExecutionProvider(language);

        const result = await runtimeProvider.execute({
          request: normalizedRequest,
          workerPool,
          transformCode,
        });

        return { success: true, data: result };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.on('cancel-execution', (_event: unknown, id: string) => {
    workerPool.cancelExecution(id);
  });

  ipcMain.handle(
    'is-worker-ready',
    async (_event: unknown, language: string) => {
      const runtimeProvider = resolveExecutionProvider(language);
      return { ready: runtimeProvider.isReady(workerPool) };
    }
  );

  // Handle input response from renderer to Python worker
  ipcMain.on(
    'python-input-response',
    (
      _event: unknown,
      {
        id,
        value,
        requestId,
      }: { id: string; value: string; requestId?: string }
    ) => {
      workerPool.resolvePythonInput(id, value, requestId);
    }
  );

  // Handle input response from renderer to JS worker
  ipcMain.on(
    'js-input-response',
    (_event: unknown, { id, value }: { id: string; value: string }) => {
      workerPool.resolveJSInput(id, value);
    }
  );
}
