import { ipcMain } from 'electron';
import type { WorkerPoolManager, ExecutionRequest } from '../WorkerPoolManager';
import type { TransformOptions } from '../../transpiler/codeTransforms';

export interface ExecutionHandlersConfig {
  workerPool: WorkerPoolManager;
  transformCode: (code: string, options: TransformOptions) => string;
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

        let result: unknown;
        if (language === 'python') {
          result = await workerPool.executePython(request);
        } else {
          // Transform code before execution
          const transformOptions: TransformOptions = {
            showTopLevelResults: request.options.showTopLevelResults ?? true,
            loopProtection: request.options.loopProtection ?? true,
            magicComments: request.options.magicComments ?? false,
            showUndefined: request.options.showUndefined ?? false,
          };

          let transformedCode: string;
          try {
            transformedCode = transformCode(request.code, transformOptions);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            throw new Error(`Transpilation error: ${errorMessage}`);
          }

          result = await workerPool.executeCode(request, transformedCode);
        }

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
      if (language === 'python') {
        return { ready: workerPool.isPythonWorkerReady() };
      }
      return { ready: workerPool.isCodeWorkerReady() };
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
      const pythonWorker = workerPool.getPythonWorker();
      if (pythonWorker) {
        pythonWorker.postMessage({
          type: 'input-response',
          id,
          value,
          requestId,
        });
      }
    }
  );

  // Handle input response from renderer to JS worker
  ipcMain.on(
    'js-input-response',
    (_event: unknown, { value }: { value: string }) => {
      workerPool.resolveJSInput(value);
    }
  );
}
