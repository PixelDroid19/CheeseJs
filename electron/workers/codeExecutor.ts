/**
 * Code Executor Worker Thread
 *
 * Executes user code in a sandboxed vm context with:
 * - Custom console interception
 * - Debug function for line-numbered output
 * - Timeout protection
 * - Safe globals whitelist
 * - Package require support
 */

import { parentPort, workerData } from 'worker_threads';
import vm from 'vm';
import util from 'util';
import path from 'path';
import Module from 'module';
import { createRequire } from 'module';
import { config as dotenvConfig } from 'dotenv';
import { expand as dotenvExpand } from 'dotenv-expand';

const require = createRequire(import.meta.url);

// Get node_modules path from worker data
const nodeModulesPath: string | undefined = workerData?.nodeModulesPath;
const jsInputBuffer: SharedArrayBuffer | undefined = workerData?.jsInputBuffer;
const jsInputLock: SharedArrayBuffer | undefined = workerData?.jsInputLock;

// Message types
interface ExecuteMessage {
  type: 'execute';
  id: string;
  code: string;
  options: ExecuteOptions;
}

interface CancelMessage {
  type: 'cancel';
  id: string;
}

interface ClearCacheMessage {
  type: 'clear-cache';
  packageName?: string;
}

type WorkerMessage = ExecuteMessage | CancelMessage | ClearCacheMessage;

interface ExecuteOptions {
  timeout?: number;
  showUndefined?: boolean;
  workingDirectory?: string;
}

interface ResultMessage {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete';
  id: string;
  data: unknown;
  line?: number;
  jsType?: string;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

// Active execution tracking for cancellation
let currentExecutionId: string | null = null;
let isExecuting = false;
let cancellationRequested = false;

// ============================================================================
// SCRIPT CACHE - Using SmartScriptCache for intelligent memory management
// ============================================================================

import { getScriptCache } from './SmartScriptCache.js';
import { isBlockedSandboxModule } from './sandboxRequirePolicy.js';

// Get singleton script cache instance
const scriptCache = getScriptCache({
  maxMemory: 50 * 1024 * 1024, // 50MB max
  k: 2, // LRU-2 algorithm
});

/**
 * Get or create a compiled script from cache
 */
function getOrCreateScript(code: string): vm.Script {
  return scriptCache.getOrCreate(code);
}

/**
 * Custom inspect function for formatting values
 */
function customInspect(val: unknown, depth: number = 4): string {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'symbol') return val.toString();
  if (typeof val === 'bigint') return `${val}n`;
  if (typeof val === 'function') {
    const name = val.name || 'anonymous';
    return `[Function: ${name}]`;
  }

  // Handle Error objects specially
  if (val instanceof Error) {
    return `${val.name}: ${val.message}${val.stack ? '\n' + val.stack : ''}`;
  }

  // Handle Promise
  if (val instanceof Promise) {
    return 'Promise { <pending> }';
  }

  // Handle built-in objects
  if (val === Math) return '[object Math]';
  if (val === JSON) return '[object JSON]';
  if (val === console) return '[object console]';
  if (val === Reflect) return '[object Reflect]';
  if (val === Intl) return '[object Intl]';

  // Handle Timeout objects (from setTimeout)
  if (val && typeof val === 'object' && val.constructor?.name === 'Timeout') {
    return '[Timeout]';
  }

  // Use util.inspect for complex objects
  try {
    return util.inspect(val, {
      colors: false,
      depth: depth,
      maxArrayLength: 100,
      maxStringLength: 10000,
      breakLength: 80,
      compact: 3, // Keep arrays/objects compact up to 3 levels deep
    });
  } catch {
    return '[Object]';
  }
}

/**
 * Serialize value for IPC transfer
 */
function serializeValue(val: unknown): { content: string; jsType: string } {
  const jsType = val === null ? 'null' : typeof val;
  const content = customInspect(val);
  return { content, jsType };
}

/**
 * Create a sandboxed console that forwards to parent
 */
function createSandboxConsole(executionId: string): typeof console {
  const sendConsole = (
    type: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir',
    args: unknown[]
  ) => {
    const content = args.map((arg) => customInspect(arg)).join(' ');
    parentPort?.postMessage({
      type: 'console',
      id: executionId,
      consoleType: type,
      data: { content },
    } as ResultMessage);
  };

  return {
    log: (...args: unknown[]) => sendConsole('log', args),
    warn: (...args: unknown[]) => sendConsole('warn', args),
    error: (...args: unknown[]) => sendConsole('error', args),
    info: (...args: unknown[]) => sendConsole('info', args),
    debug: (...args: unknown[]) => sendConsole('log', args),
    table: (data: unknown) => {
      // Format table as ASCII
      if (Array.isArray(data) || (typeof data === 'object' && data !== null)) {
        sendConsole('table', [customInspect(data)]);
      } else {
        sendConsole('log', [data]);
      }
    },
    dir: (obj: unknown) => sendConsole('dir', [obj]),
    trace: (...args: unknown[]) => {
      const err = new Error();
      sendConsole('log', [...args, err.stack]);
    },
    assert: (condition: boolean, ...args: unknown[]) => {
      if (!condition) {
        sendConsole('error', ['Assertion failed:', ...args]);
      }
    },
    clear: () => {
      /* no-op */
    },
    count: () => {
      /* simplified */
    },
    countReset: () => {
      /* simplified */
    },
    group: () => {
      /* no-op */
    },
    groupCollapsed: () => {
      /* no-op */
    },
    groupEnd: () => {
      /* no-op */
    },
    time: () => {
      /* simplified */
    },
    timeEnd: () => {
      /* simplified */
    },
    timeLog: () => {
      /* simplified */
    },
    timeStamp: () => {
      /* no-op */
    },
    profile: () => {
      /* no-op */
    },
    profileEnd: () => {
      /* no-op */
    },
  } as typeof console;
}

/**
 * Create the debug function for line-numbered output
 */
function createDebugFunction(executionId: string, showUndefined: boolean) {
  return (line: number, ...args: unknown[]) => {
    // Filter undefined if not showing
    if (!showUndefined && args.length === 1 && args[0] === undefined) {
      return args[0];
    }

    // Skip Timeout objects
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      const obj = args[0] as Record<string, unknown>;
      if (obj.constructor?.name === 'Timeout') {
        return args[0];
      }
    }

    const serialized = args.map((arg) => serializeValue(arg));
    const content = serialized.map((s) => s.content).join(' ');
    const jsType = args.length === 1 ? serialized[0].jsType : 'string';

    parentPort?.postMessage({
      type: 'debug',
      id: executionId,
      line,
      data: { content },
      jsType,
    } as ResultMessage);

    // Return the value for chaining
    return args.length === 1 ? args[0] : args;
  };
}

/**
 * Create a require function for installed packages
 */
function createRequireFunction() {
  if (!nodeModulesPath) {
    // Return a function that throws if no packages directory
    return (moduleName: string) => {
      throw new Error(
        `Cannot find module '${moduleName}'. Package installation not configured.`
      );
    };
  }

  // Create a require function that looks in our packages node_modules
  const packagesDir = path.dirname(nodeModulesPath);
  const customRequire = Module.createRequire(
    path.join(packagesDir, 'index.js')
  );

  return (moduleName: string) => {
    if (isBlockedSandboxModule(moduleName)) {
      throw new Error(
        `Module '${moduleName}' is not available in this sandboxed runtime.`
      );
    }

    try {
      return customRequire(moduleName);
    } catch {
      // SECURITY: Don't expose system paths in error messages
      throw new Error(
        `Cannot find module '${moduleName}'. Please install it first.`
      );
    }
  };
}

/**
 * Clear require cache for a specific package or all packages
 * This is needed when packages are uninstalled to ensure
 * the next require() call fails properly
 */
function clearRequireCache(packageName?: string): void {
  if (!nodeModulesPath) return;

  const cacheKeys = Object.keys(require.cache);

  for (const key of cacheKeys) {
    // Clear cache entries that are in our packages node_modules
    if (key.includes(nodeModulesPath)) {
      if (
        !packageName ||
        key.includes(`node_modules${path.sep}${packageName}`)
      ) {
        delete require.cache[key];
      }
    }
  }
}

/**
 * Create cancellation check function for cooperative cancellation
 * This is called periodically by loop-protected code to check if execution should stop
 */
function createCancellationCheckFunction(): () => boolean {
  return () => {
    return cancellationRequested;
  };
}

/**
 * Synchronous prompt implementation using SharedArrayBuffer and Atomics
 */
function promptImplementation(message?: string): string | null {
  if (!jsInputBuffer || !jsInputLock || !parentPort) {
    throw new Error('Prompt is not supported in this environment');
  }

  // 1. Reset lock (0 = wait)
  const lock = new Int32Array(jsInputLock);
  Atomics.store(lock, 0, 0);

  // 2. Send request
  parentPort.postMessage({
    type: 'prompt-request',
    message: message || '',
  });

  // 3. Wait for input (blocking)
  // This blocks the thread until the main process sets lock[0] to 1 and notifies
  Atomics.wait(lock, 0, 0);

  // 4. Read result
  const buffer = new Uint8Array(jsInputBuffer);
  // Find first null byte
  let end = 0;
  while (end < buffer.length && buffer[end] !== 0) {
    end++;
  }

  const decoder = new TextDecoder();
  return decoder.decode(buffer.slice(0, end));
}

/**
 * Synchronous alert implementation using SharedArrayBuffer and Atomics
 */
function alertImplementation(message?: unknown): void {
  if (!jsInputBuffer || !jsInputLock || !parentPort) {
    throw new Error('Alert is not supported in this environment');
  }

  // 1. Reset lock (0 = wait)
  const lock = new Int32Array(jsInputLock);
  Atomics.store(lock, 0, 0);

  // 2. Send request
  parentPort.postMessage({
    type: 'alert-request',
    message: String(message),
  });

  // 3. Wait for acknowledgement (blocking)
  Atomics.wait(lock, 0, 0);
}

/**
 * Create the sandboxed context with safe globals
 *
 * SECURITY: The following dangerous globals have been removed:
 * - eval: Allows arbitrary code execution from strings
 * - Function: Constructor can execute arbitrary code
 * - Proxy: Can be used to intercept and modify behavior
 * - Reflect: Low-level operations can bypass security
 *
 * These removalals prevent common VM escape vectors.
 */
function createSandboxContext(
  executionId: string,
  options: ExecuteOptions
): vm.Context {
  const sandboxConsole = createSandboxConsole(executionId);
  const debugFunc = createDebugFunction(
    executionId,
    options.showUndefined ?? false
  );
  const require = createRequireFunction();
  const checkCancellation = createCancellationCheckFunction();

  // CommonJS module support
  const moduleExports = {};
  const moduleObj = { exports: moduleExports };

  // Safe globals whitelist
  // NOTE: eval, Function, Proxy, and Reflect are intentionally excluded for security
  const globals: Record<string, unknown> = {
    // Console and debug functions
    console: sandboxConsole,
    debug: debugFunc,
    __jsDebug: debugFunc,

    // Cancellation checkpoint for cooperative cancellation
    __checkCancellation__: checkCancellation,

    // Synchronous prompt
    prompt: promptImplementation,
    alert: alertImplementation,

    // Package require and CommonJS module support
    require,
    exports: moduleExports,
    module: moduleObj,

    // Timing functions
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    setImmediate,
    clearImmediate,

    // ========================================================================
    // STANDARD CONSTRUCTORS (ES5-ES2021) - Safe to expose
    // ========================================================================
    Array,
    ArrayBuffer,
    BigInt,
    BigInt64Array,
    BigUint64Array,
    Boolean,
    DataView,
    Date,
    Error,
    EvalError,
    Float32Array,
    Float64Array,
    // Function constructor REMOVED - security risk (can execute arbitrary strings)
    Int8Array,
    Int16Array,
    Int32Array,
    Map,
    Number,
    Object,
    Promise,
    // Proxy REMOVED - can be used for VM escape
    RangeError,
    ReferenceError,
    // Reflect REMOVED - low-level operations can bypass security
    RegExp,
    Set,
    SharedArrayBuffer,
    String,
    Symbol,
    SyntaxError,
    TypeError,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    URIError,
    WeakMap,
    WeakSet,
    // ES2021
    WeakRef:
      'WeakRef' in globalThis
        ? (globalThis as Record<string, unknown>).WeakRef
        : undefined,
    FinalizationRegistry:
      'FinalizationRegistry' in globalThis
        ? (globalThis as Record<string, unknown>).FinalizationRegistry
        : undefined,
    AggregateError:
      'AggregateError' in globalThis
        ? (globalThis as Record<string, unknown>).AggregateError
        : undefined,

    // ========================================================================
    // ES2025 FEATURES (Node.js 22+)
    // ========================================================================
    Iterator:
      'Iterator' in globalThis
        ? (globalThis as Record<string, unknown>).Iterator
        : undefined,
    Float16Array:
      'Float16Array' in globalThis
        ? (globalThis as Record<string, unknown>).Float16Array
        : undefined,

    // ========================================================================
    // RESOURCE MANAGEMENT (Explicit Resource Management - Stage 3+)
    // ========================================================================
    DisposableStack:
      'DisposableStack' in globalThis
        ? (globalThis as Record<string, unknown>).DisposableStack
        : undefined,
    AsyncDisposableStack:
      'AsyncDisposableStack' in globalThis
        ? (globalThis as Record<string, unknown>).AsyncDisposableStack
        : undefined,

    // WebAssembly - SAFE: sandboxed by design
    WebAssembly,

    // Built-in objects
    Math,
    JSON,
    Intl,
    Atomics,

    // Safe global functions (eval REMOVED)
    isNaN,
    isFinite,
    parseFloat,
    parseInt,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    // escape/unescape REMOVED - deprecated and rarely needed

    // Fetch API (if available in Node.js)
    fetch: typeof fetch !== 'undefined' ? fetch : undefined,
    Headers: typeof Headers !== 'undefined' ? Headers : undefined,
    Request: typeof Request !== 'undefined' ? Request : undefined,
    Response: typeof Response !== 'undefined' ? Response : undefined,

    // Text encoding
    TextEncoder,
    TextDecoder,

    // URL API
    URL,
    URLSearchParams,

    // Blob (if available)
    Blob: typeof Blob !== 'undefined' ? Blob : undefined,

    // Structured clone
    structuredClone:
      typeof structuredClone !== 'undefined' ? structuredClone : undefined,

    // Performance
    performance: typeof performance !== 'undefined' ? performance : undefined,

    // queueMicrotask
    queueMicrotask,

    // globalThis reference (safe, points to sandbox)
    globalThis: null,

    // Undefined and NaN
    undefined,
    NaN,
    Infinity,
  };

  const context = vm.createContext(globals);

  // Set globalThis to point to the context itself
  context.globalThis = context;
  context.global = context;
  context.self = context;

  // Dotenv loading feature when working directory is provided
  let processEnv = { ...process.env };
  if (options.workingDirectory) {
    try {
      const parsedEnv = dotenvConfig({ path: path.join(options.workingDirectory, '.env') });
      if (parsedEnv.parsed) {
        dotenvExpand(parsedEnv);
        processEnv = { ...processEnv, ...parsedEnv.parsed };
      }
    } catch (err) {
      console.warn('Failed to parse .env from working directory:', err);
    }
  }

  // Provide a rudimentary process object for env access
  context.process = { env: processEnv };

  return context;
}

/**
 * Execute code in the sandbox
 */
async function executeCode(message: ExecuteMessage): Promise<void> {
  const { id, code, options } = message;
  const timeout = options.timeout ?? 30000;

  currentExecutionId = id;
  isExecuting = true;
  cancellationRequested = false; // Reset cancellation flag

  try {
    const context = createSandboxContext(id, options);

    // Wrap code in async IIFE to support top-level await
    const wrappedCode = '(async () => {\n' + code + '\n})()';

    // Get cached or create new compiled script
    const script = getOrCreateScript(wrappedCode);

    // Run with timeout
    const result = await Promise.race([
      script.runInContext(context, {
        timeout,
        displayErrors: true,
        breakOnSigint: true,
      }),
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`Execution timeout(${timeout}ms)`)),
          timeout + 100
        );
      }),
    ]);

    // Send completion
    parentPort?.postMessage({
      type: 'complete',
      id,
      data: result !== undefined ? serializeValue(result) : null,
    } as ResultMessage);
  } catch (error) {
    // Enhance SyntaxError messages that might be caused by the wrapper
    if (error instanceof SyntaxError && error.stack) {
      // If the error is "Unexpected end of input" or similar, it often means unclosed blocks
      if (
        error.message.includes('Unexpected token') ||
        error.message.includes('end of input')
      ) {
        error.message += ' (Check for unclosed parentheses, braces, or quotes)';
      }
    }

    const errorMessage =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { name: 'Error', message: String(error) };

    parentPort?.postMessage({
      type: 'error',
      id,
      data: errorMessage,
    } as ResultMessage);
  } finally {
    currentExecutionId = null;
    isExecuting = false;
  }
}

// Message handler
parentPort?.on('message', async (message: WorkerMessage) => {
  if (message.type === 'execute') {
    await executeCode(message);
  } else if (message.type === 'cancel') {
    if (message.id === currentExecutionId && isExecuting) {
      // Set cancellation flag for cooperative cancellation via checkpoints
      cancellationRequested = true;

      // Send cancellation response
      // The loop-protection checkpoints will throw an error when they detect cancellation
      parentPort?.postMessage({
        type: 'error',
        id: message.id,
        data: { name: 'CancelError', message: 'Execution cancelled by user' },
      } as ResultMessage);

      // Reset state
      currentExecutionId = null;
      isExecuting = false;
    }
  } else if (message.type === 'clear-cache') {
    clearRequireCache(message.packageName);
  }
});

// Signal ready
parentPort?.postMessage({ type: 'ready' });
