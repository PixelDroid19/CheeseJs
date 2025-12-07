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

import { parentPort, workerData } from 'worker_threads'
import vm from 'vm'
import util from 'util'
import path from 'path'
import Module from 'module'

// Get node_modules path from worker data
const nodeModulesPath: string | undefined = workerData?.nodeModulesPath

// Message types
interface ExecuteMessage {
  type: 'execute'
  id: string
  code: string
  options: ExecuteOptions
}

interface CancelMessage {
  type: 'cancel'
  id: string
}

interface ClearCacheMessage {
  type: 'clear-cache'
  packageName?: string
}

type WorkerMessage = ExecuteMessage | CancelMessage | ClearCacheMessage

interface ExecuteOptions {
  timeout?: number
  showUndefined?: boolean
}

interface ResultMessage {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete'
  id: string
  data: unknown
  line?: number
  jsType?: string
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir'
}

// Active execution tracking for cancellation
let currentExecutionId: string | null = null
let isExecuting = false

// ============================================================================
// SCRIPT CACHE - LRU cache for compiled vm.Script objects
// Reusing compiled scripts saves ~10-20ms per execution for repeated code
// ============================================================================

interface CachedScript {
  script: vm.Script
  lastUsed: number
}

const SCRIPT_CACHE_MAX_SIZE = 50
const scriptCache = new Map<string, CachedScript>()

/**
 * Simple hash function for code strings
 */
function hashCode(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

/**
 * Get or create a compiled script from cache
 */
function getOrCreateScript(code: string): vm.Script {
  const cacheKey = hashCode(code)
  const cached = scriptCache.get(cacheKey)

  if (cached) {
    cached.lastUsed = Date.now()
    return cached.script
  }

  // Create new script
  const script = new vm.Script(code, {
    filename: 'usercode.js',
    lineOffset: -2, // Adjust for wrapper
    columnOffset: 0
  })

  // Evict oldest if cache is full
  if (scriptCache.size >= SCRIPT_CACHE_MAX_SIZE) {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, value] of scriptCache) {
      if (value.lastUsed < oldestTime) {
        oldestTime = value.lastUsed
        oldestKey = key
      }
    }

    if (oldestKey) {
      scriptCache.delete(oldestKey)
    }
  }

  scriptCache.set(cacheKey, { script, lastUsed: Date.now() })
  return script
}

/**
 * Custom inspect function for formatting values
 */
function customInspect(val: unknown, depth: number = 4): string {
  if (val === undefined) return 'undefined'
  if (val === null) return 'null'
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'symbol') return val.toString()
  if (typeof val === 'bigint') return `${val}n`
  if (typeof val === 'function') {
    const name = val.name || 'anonymous'
    return `[Function: ${name}]`
  }

  // Handle Error objects specially
  if (val instanceof Error) {
    return `${val.name}: ${val.message}${val.stack ? '\n' + val.stack : ''}`
  }

  // Handle Promise
  if (val instanceof Promise) {
    return 'Promise { <pending> }'
  }

  // Handle built-in objects
  if (val === Math) return '[object Math]'
  if (val === JSON) return '[object JSON]'
  if (val === console) return '[object console]'
  if (val === Reflect) return '[object Reflect]'
  if (val === Intl) return '[object Intl]'

  // Handle Timeout objects (from setTimeout)
  if (val && typeof val === 'object' && val.constructor?.name === 'Timeout') {
    return '[Timeout]'
  }

  // Use util.inspect for complex objects
  try {
    return util.inspect(val, {
      colors: false,
      depth: depth,
      maxArrayLength: 100,
      maxStringLength: 10000,
      breakLength: 80,
      compact: 3  // Keep arrays/objects compact up to 3 levels deep
    })
  } catch {
    return '[Object]'
  }
}

/**
 * Serialize value for IPC transfer
 */
function serializeValue(val: unknown): { content: string; jsType: string } {
  const jsType = val === null ? 'null' : typeof val
  const content = customInspect(val)
  return { content, jsType }
}

/**
 * Create a sandboxed console that forwards to parent
 */
function createSandboxConsole(executionId: string): Console {
  const sendConsole = (type: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir', args: unknown[]) => {
    const content = args.map(arg => customInspect(arg)).join(' ')
    parentPort?.postMessage({
      type: 'console',
      id: executionId,
      consoleType: type,
      data: { content }
    } as ResultMessage)
  }

  return {
    log: (...args: unknown[]) => sendConsole('log', args),
    warn: (...args: unknown[]) => sendConsole('warn', args),
    error: (...args: unknown[]) => sendConsole('error', args),
    info: (...args: unknown[]) => sendConsole('info', args),
    debug: (...args: unknown[]) => sendConsole('log', args),
    table: (data: unknown) => {
      // Format table as ASCII
      if (Array.isArray(data) || (typeof data === 'object' && data !== null)) {
        sendConsole('table', [customInspect(data)])
      } else {
        sendConsole('log', [data])
      }
    },
    dir: (obj: unknown) => sendConsole('dir', [obj]),
    trace: (...args: unknown[]) => {
      const err = new Error()
      sendConsole('log', [...args, err.stack])
    },
    assert: (condition: boolean, ...args: unknown[]) => {
      if (!condition) {
        sendConsole('error', ['Assertion failed:', ...args])
      }
    },
    clear: () => { /* no-op */ },
    count: () => { /* simplified */ },
    countReset: () => { /* simplified */ },
    group: () => { /* no-op */ },
    groupCollapsed: () => { /* no-op */ },
    groupEnd: () => { /* no-op */ },
    time: () => { /* simplified */ },
    timeEnd: () => { /* simplified */ },
    timeLog: () => { /* simplified */ },
    timeStamp: () => { /* no-op */ },
    profile: () => { /* no-op */ },
    profileEnd: () => { /* no-op */ }
  } as Console
}

/**
 * Create the debug function for line-numbered output
 */
function createDebugFunction(executionId: string, showUndefined: boolean) {
  return (line: number, ...args: unknown[]) => {
    // Filter undefined if not showing
    if (!showUndefined && args.length === 1 && args[0] === undefined) {
      return args[0]
    }

    // Skip Timeout objects
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      const obj = args[0] as Record<string, unknown>
      if (obj.constructor?.name === 'Timeout') {
        return args[0]
      }
    }

    const serialized = args.map(arg => serializeValue(arg))
    const content = serialized.map(s => s.content).join(' ')
    const jsType = args.length === 1 ? serialized[0].jsType : 'string'

    parentPort?.postMessage({
      type: 'debug',
      id: executionId,
      line,
      data: { content },
      jsType
    } as ResultMessage)

    // Return the value for chaining
    return args.length === 1 ? args[0] : args
  }
}

/**
 * Create a require function for installed packages
 */
function createRequireFunction() {
  if (!nodeModulesPath) {
    // Return a function that throws if no packages directory
    return (moduleName: string) => {
      throw new Error(`Cannot find module '${moduleName}'. Package installation not configured.`)
    }
  }

  // Create a require function that looks in our packages node_modules
  const packagesDir = path.dirname(nodeModulesPath)
  const customRequire = Module.createRequire(path.join(packagesDir, 'index.js'))

  return (moduleName: string) => {
    try {
      return customRequire(moduleName)
    } catch (error) {
      // SECURITY: Don't expose system paths in error messages
      throw new Error(`Cannot find module '${moduleName}'. Please install it first.`)
    }
  }
}

/**
 * Clear require cache for a specific package or all packages
 * This is needed when packages are uninstalled to ensure
 * the next require() call fails properly
 */
function clearRequireCache(packageName?: string): void {
  if (!nodeModulesPath) return

  const cacheKeys = Object.keys(require.cache)

  for (const key of cacheKeys) {
    // Clear cache entries that are in our packages node_modules
    if (key.includes(nodeModulesPath)) {
      if (!packageName || key.includes(`node_modules${path.sep}${packageName}`)) {
        delete require.cache[key]
      }
    }
  }

  console.log(`[CodeExecutor] Cleared require cache${packageName ? ` for ${packageName}` : ''}`)
}

/**
 * Create the sandboxed context with safe globals
 */
function createSandboxContext(executionId: string, options: ExecuteOptions): vm.Context {
  const console = createSandboxConsole(executionId)
  const debug = createDebugFunction(executionId, options.showUndefined ?? false)
  const require = createRequireFunction()

  // CommonJS module support
  const moduleExports = {}
  const moduleObj = { exports: moduleExports }

  // Safe globals whitelist
  const globals: Record<string, unknown> = {
    // Console and debug
    console,
    debug,

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

    // Standard constructors
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
    Function,  // Needed for dynamic function creation
    Int8Array,
    Int16Array,
    Int32Array,
    Map,
    Number,
    Object,
    Promise,
    Proxy,
    RangeError,
    ReferenceError,
    Reflect,
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
    // WeakRef and FinalizationRegistry (available in Node.js 14.6+ / ES2021)
    // Access via globalThis since target is ES2020
    WeakRef: 'WeakRef' in globalThis ? (globalThis as Record<string, unknown>).WeakRef : undefined,
    FinalizationRegistry: 'FinalizationRegistry' in globalThis ? (globalThis as Record<string, unknown>).FinalizationRegistry : undefined,

    // WebAssembly
    WebAssembly,

    // Built-in objects
    Math,
    JSON,
    Intl,
    Atomics,

    // Global functions
    eval,
    isNaN,
    isFinite,
    parseFloat,
    parseInt,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    escape,
    unescape,

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

    // Blob and File (if available)
    Blob: typeof Blob !== 'undefined' ? Blob : undefined,

    // Structured clone
    structuredClone: typeof structuredClone !== 'undefined' ? structuredClone : undefined,

    // Performance
    performance: typeof performance !== 'undefined' ? performance : undefined,

    // queueMicrotask
    queueMicrotask,

    // globalThis reference (safe, points to sandbox)
    globalThis: null, // Will be set to context itself

    // Undefined and NaN
    undefined,
    NaN,
    Infinity
  }

  const context = vm.createContext(globals)

  // Set globalThis to point to the context itself
  context.globalThis = context
  context.global = context
  context.self = context

  return context
}

/**
 * Execute code in the sandbox
 */
async function executeCode(message: ExecuteMessage): Promise<void> {
  const { id, code, options } = message
  const timeout = options.timeout ?? 30000

  currentExecutionId = id
  isExecuting = true

  try {
    const context = createSandboxContext(id, options)

    // Wrap code in async IIFE to support top-level await
    const wrappedCode = `
      (async () => {
        ${code}
      })()
    `

    // Get cached or create new compiled script
    const script = getOrCreateScript(wrappedCode)

    // Run with timeout
    const result = await Promise.race([
      script.runInContext(context, {
        timeout,
        displayErrors: true,
        breakOnSigint: true
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Execution timeout (${timeout}ms)`)), timeout + 100)
      })
    ])

    // Send completion
    parentPort?.postMessage({
      type: 'complete',
      id,
      data: result !== undefined ? serializeValue(result) : null
    } as ResultMessage)

  } catch (error) {
    const errorMessage = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: 'Error', message: String(error) }

    parentPort?.postMessage({
      type: 'error',
      id,
      data: errorMessage
    } as ResultMessage)
  } finally {
    currentExecutionId = null
    isExecuting = false
  }
}

// Message handler
parentPort?.on('message', async (message: WorkerMessage) => {
  if (message.type === 'execute') {
    await executeCode(message)
  } else if (message.type === 'cancel') {
    if (message.id === currentExecutionId && isExecuting) {
      // Force termination - the main process will handle this
      parentPort?.postMessage({
        type: 'error',
        id: message.id,
        data: { name: 'CancelError', message: 'Execution cancelled by user' }
      } as ResultMessage)
    }
  } else if (message.type === 'clear-cache') {
    clearRequireCache(message.packageName)
  }
})

// Signal ready
parentPort?.postMessage({ type: 'ready' })
