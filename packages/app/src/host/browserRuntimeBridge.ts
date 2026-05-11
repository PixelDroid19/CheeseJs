import type {
  CodeRunner,
  ExecutionOptions,
  ExecutionResult,
  PackageManager,
  PythonPackageManager,
  ResultCallback,
} from '@cheesejs/core';
import type { PyodideAPI } from 'pyodide';

const executableLanguages = new Set(['javascript', 'typescript', 'python']);
const pyodideIndexUrl = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';

type WorkerRecord = {
  worker: Worker;
  objectUrl: string;
};

let pyodidePromise: Promise<PyodideAPI> | undefined;

async function getPyodide(): Promise<PyodideAPI> {
  pyodidePromise ??= import('pyodide').then(({ loadPyodide }) =>
    loadPyodide({ indexURL: pyodideIndexUrl })
  );
  return pyodidePromise;
}

function stripTypeScriptForBrowser(code: string): string {
  return code
    .replace(/^\s*import\s+type\s+[^;]+;?\s*$/gm, '')
    .replace(/^\s*export\s+type\s+[^;]+;?\s*$/gm, '')
    .replace(/^\s*interface\s+\w+\s*{[^}]*}\s*$/gm, '')
    .replace(/:\s*[A-Za-z_$][\w$<>,\s[\]{}|&?.]*(?=[,)=;])/g, '')
    .replace(/\s+as\s+[A-Za-z_$][\w$<>,\s[\]{}|&?.]*/g, '');
}

function createWorkerSource(code: string): string {
  return `
const emit = (type, data, extra = {}) => self.postMessage({ type, data, ...extra });
const serialize = (value) => {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};
const nativeConsole = self.console;
self.console = {
  log: (...args) => emit("console", { content: args.map(serialize).join(" ") }, { consoleType: "log" }),
  warn: (...args) => emit("console", { content: args.map(serialize).join(" ") }, { consoleType: "warn" }),
  error: (...args) => emit("console", { content: args.map(serialize).join(" ") }, { consoleType: "error" }),
  info: (...args) => emit("console", { content: args.map(serialize).join(" ") }, { consoleType: "info" }),
  table: (...args) => emit("console", { content: args.map(serialize).join(" ") }, { consoleType: "table" }),
  dir: (...args) => emit("console", { content: args.map(serialize).join(" ") }, { consoleType: "dir" }),
};
self.debug = (value) => emit("debug", { content: serialize(value) });
(async () => {
  try {
    const result = await (async () => {
${code}
    })();
    if (result !== undefined) emit("debug", { content: serialize(result) }, { jsType: typeof result });
    emit("complete", {});
  } catch (error) {
    emit("error", {
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : undefined
    });
    emit("complete", {});
  } finally {
    self.console = nativeConsole;
  }
})();
`;
}

async function runPythonCode(
  id: string,
  code: string,
  options: ExecutionOptions,
  emit: (id: string, result: Omit<ExecutionResult, 'id'>) => void
): Promise<{ success: boolean; error?: string }> {
  const timeoutMs = options.timeout ?? 30000;
  let timeoutId: number | undefined;

  try {
    const pyodide = await Promise.race([
      getPyodide(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () =>
            reject(new Error(`Python runtime timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);

    if (timeoutId !== undefined) window.clearTimeout(timeoutId);

    pyodide.setStdout({
      batched: (content) => {
        if (content) {
          emit(id, {
            type: 'console',
            data: { content },
            consoleType: 'log',
          });
        }
      },
    });
    pyodide.setStderr({
      batched: (content) => {
        if (content) {
          emit(id, {
            type: 'console',
            data: { content },
            consoleType: 'error',
          });
        }
      },
    });

    await pyodide.loadPackagesFromImports(code);
    const result = await Promise.race([
      pyodide.runPythonAsync(code),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error(`Execution timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);

    if (timeoutId !== undefined) window.clearTimeout(timeoutId);

    if (result !== undefined) {
      emit(id, {
        type: 'debug',
        data: { content: String(result) },
        jsType: typeof result,
      });
    }
    emit(id, { type: 'complete' });
    return { success: true };
  } catch (error) {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : String(error);
    emit(id, { type: 'error', data: { message } });
    emit(id, { type: 'complete' });
    return { success: false, error: message };
  }
}

export function createBrowserCodeRunner(): CodeRunner {
  const callbacks = new Set<ResultCallback>();
  const workers = new Map<string, WorkerRecord>();

  function emit(id: string, result: Omit<ExecutionResult, 'id'>) {
    callbacks.forEach((callback) => callback({ id, ...result }));
  }

  function cancel(id: string) {
    const record = workers.get(id);
    if (!record) return;

    record.worker.terminate();
    URL.revokeObjectURL(record.objectUrl);
    workers.delete(id);
    emit(id, {
      type: 'error',
      data: { message: 'Execution cancelled' },
    });
    emit(id, { type: 'complete' });
  }

  return {
    async execute(id: string, code: string, options: ExecutionOptions = {}) {
      const language = options.language ?? 'javascript';
      if (!executableLanguages.has(language)) {
        return {
          success: false,
          error: `${language} execution is not available in the browser runtime yet.`,
        };
      }

      if (language === 'python') {
        return runPythonCode(id, code, options, emit);
      }

      if (typeof Worker === 'undefined') {
        return {
          success: false,
          error: 'Code runner not available in this environment.',
        };
      }

      cancel(id);

      const source =
        language === 'typescript' ? stripTypeScriptForBrowser(code) : code;
      const blob = new Blob([createWorkerSource(source)], {
        type: 'text/javascript',
      });
      const objectUrl = URL.createObjectURL(blob);
      const worker = new Worker(objectUrl);
      workers.set(id, { worker, objectUrl });

      const timeoutMs = options.timeout ?? 30000;
      const timeout = window.setTimeout(() => {
        cancel(id);
        emit(id, {
          type: 'error',
          data: { message: `Execution timed out after ${timeoutMs}ms` },
        });
      }, timeoutMs);

      worker.onmessage = (event: MessageEvent<Omit<ExecutionResult, 'id'>>) => {
        const result = event.data;
        emit(id, result);
        if (result.type === 'complete') {
          window.clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          workers.delete(id);
        }
      };

      worker.onerror = (event) => {
        window.clearTimeout(timeout);
        emit(id, { type: 'error', data: { message: event.message } });
        emit(id, { type: 'complete' });
        URL.revokeObjectURL(objectUrl);
        workers.delete(id);
      };

      return { success: true };
    },
    cancel,
    async isReady(language = 'javascript') {
      return executableLanguages.has(language);
    },
    async waitForReady(language = 'javascript') {
      return executableLanguages.has(language);
    },
    onResult(callback: ResultCallback) {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
    removeResultListener(callback: ResultCallback) {
      callbacks.delete(callback);
    },
    onInputRequest() {
      return () => undefined;
    },
    sendInputResponse() {
      return undefined;
    },
    onJSInputRequest() {
      return () => undefined;
    },
    sendJSInputResponse() {
      return undefined;
    },
  };
}

export function createUnavailablePackageManager(): PackageManager {
  return {
    async install(packageName: string) {
      return {
        success: false,
        packageName,
        error:
          'Package installation requires a native package-manager extension.',
      };
    },
    async uninstall(packageName: string) {
      return {
        success: false,
        packageName,
        error: 'Package removal requires a native package-manager extension.',
      };
    },
    async list() {
      return { success: true, packages: [] };
    },
    async getNodeModulesPath() {
      return '';
    },
  };
}

export function createUnavailablePythonPackageManager(): PythonPackageManager {
  return {
    async install(packageName: string) {
      try {
        const pyodide = await getPyodide();
        await pyodide.loadPackage('micropip');
        await pyodide.runPythonAsync(
          `import micropip\nawait micropip.install(${JSON.stringify(packageName)})`
        );
        return { success: true, packageName };
      } catch (error) {
        return {
          success: false,
          packageName,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async listInstalled() {
      try {
        const pyodide = await getPyodide();
        return { success: true, packages: Object.keys(pyodide.loadedPackages) };
      } catch (error) {
        return {
          success: false,
          packages: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async resetRuntime() {
      pyodidePromise = undefined;
      return { success: true };
    },
    async getMemoryStats() {
      return {
        success: true,
        stats: {
          heapUsed: 0,
          heapTotal: 0,
          executionsSinceCleanup: 0,
          lastCleanupTime: Date.now(),
          pyObjects: 0,
          executionCount: 0,
        },
      };
    },
    async cleanupNamespace() {
      try {
        const pyodide = await getPyodide();
        await pyodide.runPythonAsync(
          `for _name in [n for n in globals() if not n.startswith('_') and n not in {'micropip'}]:\n    globals().pop(_name, None)`
        );
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
