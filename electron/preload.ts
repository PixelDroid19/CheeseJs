import { contextBridge, ipcRenderer } from 'electron';
import { domReady, useLoading } from './utils/index.js';

// eslint-disable-next-line react-hooks/rules-of-hooks
const { appendLoading, removeLoading } = useLoading();

domReady().then(appendLoading).catch(console.error);

// ============================================================================
// TYPES
// ============================================================================

interface ExecutionOptions {
  timeout?: number;
  showUndefined?: boolean;
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
  magicComments?: boolean;
  language?: 'javascript' | 'typescript' | 'python';
}

interface ExecutionResult {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete';
  id: string;
  data?: unknown;
  line?: number;
  jsType?: string;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

type ResultCallback = (result: ExecutionResult) => void;

// Input request types
interface InputRequest {
  id: string;
  data: { prompt: string; line: number; requestId?: string };
}
// JS Input request type (from worker)
interface JSInputRequest {
  type: 'prompt-request';
  message: string;
}

type InputRequestCallback = (request: InputRequest) => void;
type JSInputRequestCallback = (request: JSInputRequest) => void;

// ============================================================================
// CODE RUNNER API
// ============================================================================

const resultCallbacks = new Set<ResultCallback>();
const inputRequestCallbacks = new Set<InputRequestCallback>();
const jsInputRequestCallbacks = new Set<JSInputRequestCallback>();

// Listen for execution results from main process
ipcRenderer.on(
  'code-execution-result',
  (_event: unknown, result: ExecutionResult) => {
    console.log(
      '[Preload] code-execution-result received:',
      result.id,
      result.type
    );
    resultCallbacks.forEach((callback) => callback(result));
  }
);

// Listen for Python input requests
ipcRenderer.on(
  'python-input-request',
  (_event: unknown, request: InputRequest) => {
    inputRequestCallbacks.forEach((callback) => callback(request));
  }
);

// Listen for JS input requests
ipcRenderer.on(
  'js-input-request',
  (_event: unknown, request: JSInputRequest) => {
    jsInputRequestCallbacks.forEach((callback) => callback(request));
  }
);

contextBridge.exposeInMainWorld('electronAPI', {
  closeApp: () => ipcRenderer.send('close-me'),
  maximizeApp: () => ipcRenderer.send('maximize'),
  unmaximizeApp: () => ipcRenderer.send('unmaximize'),
  minimizeApp: () => ipcRenderer.send('minimize'),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  onToggleMagicComments: (callback: () => void) =>
    ipcRenderer.on('toggle-magic-comments', () => callback()),
});

contextBridge.exposeInMainWorld('codeRunner', {
  /**
   * Execute code in the sandboxed VM
   */
  execute: async (id: string, code: string, options: ExecutionOptions = {}) => {
    // Extract language from options and pass it at request level for routing
    const { language, ...restOptions } = options;
    console.log('[Preload] execute called:', id, language);
    return ipcRenderer.invoke('execute-code', {
      id,
      code,
      language,
      options: restOptions,
    });
  },

  /**
   * Cancel a running execution
   */
  cancel: (id: string) => {
    ipcRenderer.send('cancel-execution', id);
  },

  /**
   * Check if worker is ready
   */
  isReady: async (language: string = 'javascript'): Promise<boolean> => {
    const result = await ipcRenderer.invoke('is-worker-ready', language);
    return result.ready;
  },

  /**
   * Wait for worker to be ready (polls every 100ms, max 10s)
   */
  waitForReady: async (language: string = 'javascript'): Promise<boolean> => {
    const maxWait = 10000;
    const interval = 100;
    let waited = 0;

    while (waited < maxWait) {
      const result = await ipcRenderer.invoke('is-worker-ready', language);
      if (result.ready) return true;
      await new Promise((r) => setTimeout(r, interval));
      waited += interval;
    }
    return false;
  },

  /**
   * Subscribe to execution results
   */
  onResult: (callback: ResultCallback) => {
    resultCallbacks.add(callback);
    return () => {
      resultCallbacks.delete(callback);
    };
  },

  /**
   * Remove result listener
   */
  removeResultListener: (callback: ResultCallback) => {
    resultCallbacks.delete(callback);
  },

  /**
   * Subscribe to Python input requests
   */
  onInputRequest: (callback: InputRequestCallback) => {
    inputRequestCallbacks.add(callback);
    return () => {
      inputRequestCallbacks.delete(callback);
    };
  },

  /**
   * Send input response back to Python
   */
  sendInputResponse: (id: string, value: string, requestId?: string) => {
    ipcRenderer.send('python-input-response', { id, value, requestId });
  },

  /**
   * Subscribe to JS input requests
   */
  onJSInputRequest: (callback: JSInputRequestCallback) => {
    jsInputRequestCallbacks.add(callback);
    return () => {
      jsInputRequestCallbacks.delete(callback);
    };
  },

  /**
   * Send input response back to JS worker
   */
  sendJSInputResponse: (value: string) => {
    ipcRenderer.send('js-input-response', { value });
  },
});

// ============================================================================
// PACKAGE MANAGER API
// ============================================================================

interface PackageInstallResult {
  success: boolean;
  packageName: string;
  version?: string;
  error?: string;
}

interface InstalledPackage {
  name: string;
  version: string;
  path: string;
}

contextBridge.exposeInMainWorld('packageManager', {
  /**
   * Install an npm package
   */
  install: async (packageName: string): Promise<PackageInstallResult> => {
    return ipcRenderer.invoke('install-package', packageName);
  },

  /**
   * Uninstall an npm package
   */
  uninstall: async (packageName: string): Promise<PackageInstallResult> => {
    return ipcRenderer.invoke('uninstall-package', packageName);
  },

  /**
   * List all installed packages
   */
  list: async (): Promise<{
    success: boolean;
    packages: InstalledPackage[];
    error?: string;
  }> => {
    return ipcRenderer.invoke('list-packages');
  },

  /**
   * Get the node_modules path
   */
  getNodeModulesPath: async (): Promise<string> => {
    return ipcRenderer.invoke('get-node-modules-path');
  },
});

// ============================================================================
// PYTHON PACKAGE MANAGER API
// ============================================================================

interface PythonPackageInstallResult {
  success: boolean;
  packageName: string;
  version?: string;
  error?: string;
}

// Memory stats interface
interface PythonMemoryStats {
  heapUsed: number;
  heapTotal: number;
  executionsSinceCleanup: number;
  lastCleanupTime: number;
  pyObjects: number;
  executionCount: number;
}

contextBridge.exposeInMainWorld('pythonPackageManager', {
  /**
   * Install a Python package using micropip
   */
  install: async (packageName: string): Promise<PythonPackageInstallResult> => {
    return ipcRenderer.invoke('install-python-package', packageName);
  },

  /**
   * List all installed Python packages
   */
  listInstalled: async (): Promise<{
    success: boolean;
    packages: string[];
    error?: string;
  }> => {
    return ipcRenderer.invoke('list-python-packages');
  },

  /**
   * Reset the Python runtime - clears all state and reinitializes (P1-B)
   * Use this to free memory or clear variables between executions
   */
  resetRuntime: async (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('reset-python-runtime');
  },

  /**
   * Get Python memory statistics
   * Useful for monitoring memory usage and debugging memory leaks
   */
  getMemoryStats: async (): Promise<{
    success: boolean;
    stats?: PythonMemoryStats;
    error?: string;
  }> => {
    return ipcRenderer.invoke('get-python-memory-stats');
  },

  /**
   * Manually cleanup Python namespace
   * Removes user-defined variables while preserving system functions
   */
  cleanupNamespace: async (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('cleanup-python-namespace');
  },
});

// ============================================================================
// AI PROXY API
// ============================================================================

interface AIProxyRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface AIProxyResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

// Store for active stream listeners
const streamListeners = new Map<
  string,
  {
    onChunk: (chunk: string) => void;
    onEnd: () => void;
    onError: (error: {
      status: number;
      statusText: string;
      body: string;
    }) => void;
  }
>();

contextBridge.exposeInMainWorld('aiProxy', {
  /**
   * Make a proxied fetch request through the main process (CORS-free)
   */
  fetch: async (request: AIProxyRequest): Promise<AIProxyResponse> => {
    return ipcRenderer.invoke('ai:proxy', request);
  },

  /**
   * Start a streaming request through the main process
   */
  streamFetch: async (
    request: AIProxyRequest,
    onChunk: (chunk: string) => void,
    onEnd: () => void,
    onError: (error: {
      status: number;
      statusText: string;
      body: string;
    }) => void
  ): Promise<{ streamId: string; abort: () => void }> => {
    const { streamId } = await ipcRenderer.invoke('ai:proxy:stream', request);

    // Store listeners
    streamListeners.set(streamId, { onChunk, onEnd, onError });

    // Setup IPC listeners for this stream
    const chunkHandler = (_event: unknown, chunk: string) => {
      const listener = streamListeners.get(streamId);
      listener?.onChunk(chunk);
    };

    const endHandler = () => {
      const listener = streamListeners.get(streamId);
      listener?.onEnd();
      cleanup();
    };

    const errorHandler = (
      _event: unknown,
      error: { status: number; statusText: string; body: string }
    ) => {
      const listener = streamListeners.get(streamId);
      listener?.onError(error);
      cleanup();
    };

    const cleanup = () => {
      streamListeners.delete(streamId);
      ipcRenderer.removeListener(`ai:stream:chunk:${streamId}`, chunkHandler);
      ipcRenderer.removeListener(`ai:stream:end:${streamId}`, endHandler);
      ipcRenderer.removeListener(`ai:stream:error:${streamId}`, errorHandler);
    };

    ipcRenderer.on(`ai:stream:chunk:${streamId}`, chunkHandler);
    ipcRenderer.on(`ai:stream:end:${streamId}`, endHandler);
    ipcRenderer.on(`ai:stream:error:${streamId}`, errorHandler);

    return {
      streamId,
      abort: cleanup,
    };
  },
});

setTimeout(removeLoading, 1000);
