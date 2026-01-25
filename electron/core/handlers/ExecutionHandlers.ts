import { ipcMain } from 'electron';
import type { WorkerPoolManager, ExecutionRequest } from '../WorkerPoolManager';
import type { TransformOptions } from '../../transpiler/tsTranspiler';
import { wasmLanguageRegistry } from '../../wasm-languages/WasmLanguageRegistry.js';
import type { RegisteredWasmLanguage } from '../../wasm-languages/WasmLanguageRegistry.js';

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
      try {
        const language = request.language || 'javascript';

        let result: unknown;
        if (language === 'python') {
          result = await workerPool.executePython(request);
        } else if (wasmLanguageRegistry.hasLanguage(language)) {
          result = await wasmLanguageRegistry.execute(language, request.code, {
            timeout: request.options.timeout,
            memoryLimit: request.options.memoryLimit,
            captureStdout: true,
            captureStderr: true,
          });
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
      } else if (wasmLanguageRegistry.hasLanguage(language)) {
        const lang = wasmLanguageRegistry.getLanguage(language);
        return { ready: lang?.isReady ?? false };
      }
      return { ready: workerPool.isCodeWorkerReady() };
    }
  );

  ipcMain.handle('get-wasm-languages', async () => {
    const languages: RegisteredWasmLanguage[] =
      wasmLanguageRegistry.getReadyLanguages();
    return {
      success: true,
      languages: languages.map((l) => ({
        id: l.config.id,
        name: l.config.name,
        version: l.config.version,
        extensions: l.config.extensions,
        status: l.status,
      })),
    };
  });

  ipcMain.handle(
    'get-wasm-monaco-config',
    async (_event: unknown, languageId: string) => {
      const lang = wasmLanguageRegistry.getLanguage(languageId);
      if (!lang) {
        return { success: false, error: `Language ${languageId} not found` };
      }
      return {
        success: true,
        config: lang.config.monacoConfig || {},
      };
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
}
