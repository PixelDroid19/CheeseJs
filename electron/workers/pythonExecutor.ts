/**
 * Python Executor Worker Thread
 *
 * Executes Python code using Pyodide (WebAssembly Python runtime) with:
 * - Custom print interception
 * - Debug function for line-numbered output
 * - Timeout protection
 * - Package installation via micropip
 */

import { parentPort } from 'worker_threads';
import path from 'path';
import { createRequire } from 'module';
import { loadPyodide, type PyodideInterface } from 'pyodide';

const require = createRequire(import.meta.url);

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

interface InstallPackageMessage {
  type: 'install-package';
  id: string;
  packageName: string;
}

interface ListPackagesMessage {
  type: 'list-packages';
  id: string;
}

interface InputResponseMessage {
  type: 'input-response';
  id: string;
  value: string;
  requestId?: string;
}

interface SetInterruptBufferMessage {
  type: 'set-interrupt-buffer';
  buffer: SharedArrayBuffer;
}

interface ResetRuntimeMessage {
  type: 'reset-runtime';
  id: string;
}

interface GetMemoryStatsMessage {
  type: 'get-memory-stats';
  id: string;
}

interface CleanupNamespaceMessage {
  type: 'cleanup-namespace';
  id: string;
}

type WorkerMessage =
  | ExecuteMessage
  | CancelMessage
  | InstallPackageMessage
  | ListPackagesMessage
  | InputResponseMessage
  | SetInterruptBufferMessage
  | ResetRuntimeMessage
  | GetMemoryStatsMessage
  | CleanupNamespaceMessage;

interface ExecuteOptions {
  timeout?: number;
  showUndefined?: boolean;
}

interface ResultMessage {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete' | 'status';
  id: string;
  data: unknown;
  line?: number;
  jsType?: string;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

// Pyodide instance (loaded lazily)
let pyodide: PyodideInterface | null = null;
let isLoading = false;
let currentExecutionId: string | null = null;
let isInitializing = false; // Flag to suppress init logs
const PYODIDE_INIT_TIMEOUT_MS = 60000;
let pyodideLoadPromise: Promise<PyodideInterface> | null = null;

// Interrupt buffer for execution cancellation (P2)
let interruptBuffer: Uint8Array | null = null;

// ============================================================================
// MEMORY MANAGEMENT
// ============================================================================

// Execution counter for automatic cleanup
let executionCounter = 0;
const AUTO_CLEANUP_INTERVAL = 10; // Clean up namespace every N executions
const GC_INTERVAL = 5; // Force garbage collection every N executions

// Memory usage tracking
interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  executionsSinceCleanup: number;
  lastCleanupTime: number;
}

let memoryStats: MemoryStats = {
  heapUsed: 0,
  heapTotal: 0,
  executionsSinceCleanup: 0,
  lastCleanupTime: Date.now(),
};

// Memory warning threshold (in bytes) - 500MB
const MEMORY_WARNING_THRESHOLD = 500 * 1024 * 1024;

// Input handling
interface PendingInput {
  executionId: string;
  requestId: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}
const pendingInputs = new Map<string, PendingInput[]>();
let inputRequestCounter = 0;

function addPendingInput(executionId: string, pending: PendingInput) {
  const queue = pendingInputs.get(executionId) ?? [];
  queue.push(pending);
  pendingInputs.set(executionId, queue);
}

function resolvePendingInput(
  executionId: string,
  requestId: string | undefined,
  value: string
): boolean {
  const queue = pendingInputs.get(executionId);
  if (!queue || queue.length === 0) {
    return false;
  }

  let index = 0;
  if (requestId) {
    index = queue.findIndex((item) => item.requestId === requestId);
  }

  if (index < 0) {
    return false;
  }

  const [pending] = queue.splice(index, 1);

  if (queue.length === 0) {
    pendingInputs.delete(executionId);
  } else {
    pendingInputs.set(executionId, queue);
  }

  pending.resolve(value);
  return true;
}

function rejectPendingInputs(executionId: string, error: Error) {
  const queue = pendingInputs.get(executionId);
  if (!queue) return;

  queue.forEach((item) => item.reject(error));
  pendingInputs.delete(executionId);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

// ============================================================================
// MEMORY MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Clean up user-defined variables from Python namespace
 * Preserves system functions and our custom utilities
 */
async function cleanupPythonNamespace(py: PyodideInterface): Promise<void> {
  try {
    py.runPython(`
import sys
import gc

# Names to preserve (system and our custom functions)
_preserve = {
    'sys', 'gc', 'builtins', 'ast', 'asyncio', 'traceback', 'io',
    '_debug_outputs', 'debug', '_get_debug_outputs',
    '_async_input', '_js_request_input', '_original_input',
    '_transform_for_async_input', '_AsyncTransformer', '_AwaitTransformer',
    '_CallGraphBuilder', '_compute_async_functions', '_SYNC_DECORATORS',
    '_code_to_transform', 'micropip', 'StringIO'
}

# Get all current global names
_all_names = list(globals().keys())

# Delete user-defined variables
for _name in _all_names:
    if (_name not in _preserve and
        not _name.startswith('_') and
        _name not in sys.builtin_module_names):
        try:
            del globals()[_name]
        except:
            pass

# Clear any remaining references
del _all_names
del _name
`);
  } catch (error) {
    console.warn('[PythonExecutor] Namespace cleanup error:', error);
  }
}

/**
 * Force garbage collection in Python
 */
async function forceGarbageCollection(py: PyodideInterface): Promise<void> {
  try {
    py.runPython(`
import gc
gc.collect()
gc.collect()  # Run twice to collect circular references
`);
    // Collected count captured for potential future use
  } catch (error) {
    console.warn('[PythonExecutor] GC error:', error);
  }
}

/**
 * Get current memory usage estimate from Python
 */
async function getMemoryUsage(
  py: PyodideInterface
): Promise<{ pyObjects: number }> {
  try {
    const result = py.runPython(`
import sys
import gc

# Count live Python objects
_obj_count = len(gc.get_objects())
_obj_count
`);
    return { pyObjects: result as number };
  } catch {
    return { pyObjects: 0 };
  }
}

/**
 * Check if memory cleanup is needed and perform it
 */
async function checkAndCleanMemory(py: PyodideInterface): Promise<void> {
  executionCounter++;
  memoryStats.executionsSinceCleanup++;

  // Force GC periodically
  if (executionCounter % GC_INTERVAL === 0) {
    await forceGarbageCollection(py);
  }

  // Full namespace cleanup periodically
  if (executionCounter % AUTO_CLEANUP_INTERVAL === 0) {
    await cleanupPythonNamespace(py);
    await forceGarbageCollection(py);
    memoryStats.executionsSinceCleanup = 0;
    memoryStats.lastCleanupTime = Date.now();
  }

  // Check memory usage
  await getMemoryUsage(py);

  // Update memory stats
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage();
    memoryStats.heapUsed = mem.heapUsed;
    memoryStats.heapTotal = mem.heapTotal;
  }

  // Warn if memory is high
  if (memoryStats.heapUsed > MEMORY_WARNING_THRESHOLD) {
    console.warn(
      `[PythonExecutor] High memory usage: ${Math.round(memoryStats.heapUsed / 1024 / 1024)}MB`
    );
    parentPort?.postMessage({
      type: 'status',
      id: 'memory-warning',
      data: {
        message: `High memory usage detected (${Math.round(memoryStats.heapUsed / 1024 / 1024)}MB). Consider resetting the Python runtime.`,
        memoryStats,
      },
    });
  }
}

/**
 * Custom inspect function for formatting Python values
 */
function formatPythonValue(val: unknown): string {
  if (val === undefined || val === null) return 'None';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);

  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

/**
 * Serialize value for IPC transfer
 */
function serializeValue(val: unknown): { content: string; jsType: string } {
  const jsType = val === null ? 'null' : typeof val;
  const content = formatPythonValue(val);
  return { content, jsType };
}

/**
 * Load Pyodide runtime
 */
async function initializePyodide(): Promise<PyodideInterface> {
  if (pyodide) return pyodide;

  if (isLoading && !pyodideLoadPromise) {
    throw new Error('Pyodide initialization already in progress');
  }

  if (pyodideLoadPromise) {
    return withTimeout(
      pyodideLoadPromise,
      PYODIDE_INIT_TIMEOUT_MS,
      'Pyodide initialization timed out'
    );
  }

  isLoading = true;
  isInitializing = true;

  pyodideLoadPromise = (async () => {
    try {
      parentPort?.postMessage({
        type: 'status',
        id: 'init',
        data: { message: 'Loading Python runtime...' },
      });

      // Find pyodide package location - use path directly without file:// prefix
      const pyodidePath = path.dirname(require.resolve('pyodide/package.json'));

      const instance = await loadPyodide({
        indexURL: pyodidePath,
        stdout: (text: string) => {
          // Suppress init messages like "Loading micropip", "Loaded micropip"
          if (
            isInitializing &&
            (text.includes('micropip') ||
              text.includes('Loading') ||
              text.includes('Loaded'))
          ) {
            return; // Suppress during init
          }
          if (currentExecutionId) {
            parentPort?.postMessage({
              type: 'console',
              id: currentExecutionId,
              consoleType: 'log',
              data: { content: text },
            } as ResultMessage);
          }
        },
        stderr: (_text: string) => {
          // Suppress ALL stderr output during execution
          // All Python errors/tracebacks will be captured and shown via the error handler
          // This prevents duplicate error messages in the output
          // (Regular warning output would also be suppressed, but this is acceptable trade-off)
          return;
        },
      });

      // Load micropip for package installation
      await instance.loadPackage('micropip');

      // Set up debug function in Python
      // We provide both 'debug' (legacy) and '__pyDebug' (language-specific) for compatibility
      instance.runPython(`
import sys
from io import StringIO

# Store for debug outputs
_debug_outputs = []

def debug(line, *args):
    """Debug function that captures line number and values"""
    result = ' '.join(repr(arg) if not isinstance(arg, str) else arg for arg in args)
    _debug_outputs.append({'line': line, 'content': result})
    return args[0] if len(args) == 1 else args

# Alias for language-specific debug function
__pyDebug = debug

def _get_debug_outputs():
    """Get and clear debug outputs"""
    global _debug_outputs
    outputs = _debug_outputs.copy()
    _debug_outputs = []
    return outputs

# Make debug functions available in the global namespace
# Using builtins for compatibility across Pyodide versions
import builtins
setattr(builtins, 'debug', debug)
setattr(builtins, '__pyDebug', __pyDebug)
setattr(builtins, '_get_debug_outputs', _get_debug_outputs)
`);

      // Set up custom input handler
      instance.globals.set(
        '_js_request_input',
        (prompt: string, line: number) => {
          const executionId = currentExecutionId;
          if (!executionId) {
            return Promise.reject(
              new Error('Input requested without active execution')
            );
          }

          const requestId = `${executionId}-${Date.now()}-${inputRequestCounter++}`;

          const promise = new Promise<string>((resolve, reject) => {
            addPendingInput(executionId, {
              executionId,
              requestId,
              resolve,
              reject,
            });

            // Send input request to main process
            parentPort?.postMessage({
              type: 'input-request',
              id: executionId,
              data: { prompt, line, requestId },
            });
          });

          return promise;
        }
      );

      // Override Python's input function to use async JS integration
      // In Pyodide, we need to use a special pattern to await JS promises from Python
      instance.runPython(`
import builtins
import asyncio
import sys

_original_input = builtins.input

async def _async_input(prompt=""):
    """Async input that communicates with the editor"""
    import traceback

    # Get the line number from the call stack
    stack = traceback.extract_stack()
    line = stack[-3].lineno if len(stack) > 2 else 0

    # Print the prompt so user sees it (before waiting)
    if prompt:
        print(prompt, end="", flush=True)

    # Request input from JS and await the result
    # The JS function returns a Promise, which Pyodide converts to a Future
    result = await _js_request_input(str(prompt), line)

    # Flush stdout to ensure any print statements are captured
    sys.stdout.flush()

    return result

# Don't define sync wrapper - we'll use async directly in transformed code
# builtins.input = input
`);

      // Set up AST-based transformer for smart async conversion (P1-A)
      // This respects decorators like @property, @staticmethod, etc.
      instance.runPython(`
import ast
import builtins

# Decorators that should NOT have their functions made async
_SYNC_DECORATORS = {'property', 'staticmethod', 'classmethod', 'cached_property', 'abstractmethod'}

class _CallGraphBuilder(ast.NodeVisitor):
    """Build a call graph: which functions call which other functions"""

    def __init__(self):
        self.current_function = None
        self.calls = {}  # function_name -> set of called functions
        self.uses_input = set()  # functions that directly use input()
        self.all_functions = set()  # all defined function names
        self.sync_decorated = set()  # functions with @property etc

    def visit_FunctionDef(self, node):
        self.all_functions.add(node.name)

        # Check for sync decorators
        for dec in node.decorator_list:
            if isinstance(dec, ast.Name) and dec.id in _SYNC_DECORATORS:
                self.sync_decorated.add(node.name)
            elif isinstance(dec, ast.Attribute) and dec.attr in _SYNC_DECORATORS:
                self.sync_decorated.add(node.name)
            elif isinstance(dec, ast.Call):
                if isinstance(dec.func, ast.Name) and dec.func.id in _SYNC_DECORATORS:
                    self.sync_decorated.add(node.name)
                elif isinstance(dec.func, ast.Attribute) and dec.func.attr in _SYNC_DECORATORS:
                    self.sync_decorated.add(node.name)

        old_function = self.current_function
        self.current_function = node.name
        self.calls[node.name] = set()
        self.generic_visit(node)
        self.current_function = old_function

    def visit_AsyncFunctionDef(self, node):
        # Treat same as FunctionDef
        self.visit_FunctionDef(node)

    def visit_Call(self, node):
        if self.current_function:
            # Check if calling input()
            if isinstance(node.func, ast.Name):
                if node.func.id == 'input':
                    self.uses_input.add(self.current_function)
                else:
                    self.calls[self.current_function].add(node.func.id)
        self.generic_visit(node)

def _compute_async_functions(calls, uses_input, all_functions, sync_decorated):
    """Compute which functions need to be async (transitive closure)"""
    async_funcs = set(uses_input) - sync_decorated

    # Iteratively add functions that call async functions
    changed = True
    while changed:
        changed = False
        for func, called in calls.items():
            if func in async_funcs or func in sync_decorated:
                continue
            # If this function calls any async function, it must also be async
            if called & async_funcs:
                async_funcs.add(func)
                changed = True

    return async_funcs

class _AsyncTransformer(ast.NodeTransformer):
    """Transform functions to async based on precomputed set"""

    def __init__(self, async_functions):
        self.async_functions = async_functions

    def visit_FunctionDef(self, node):
        # First recurse
        self.generic_visit(node)

        if node.name in self.async_functions:
            new_node = ast.AsyncFunctionDef(
                name=node.name,
                args=node.args,
                body=node.body,
                decorator_list=node.decorator_list,
                returns=node.returns,
                type_comment=getattr(node, 'type_comment', None)
            )
            ast.copy_location(new_node, node)
            return new_node
        return node

class _AwaitTransformer(ast.NodeTransformer):
    """Add await to input() calls and calls to async user functions"""

    def __init__(self, async_functions):
        self.async_functions = async_functions

    def visit_Call(self, node):
        # First transform children
        self.generic_visit(node)

        if isinstance(node.func, ast.Name):
            # Replace input() with await _async_input()
            if node.func.id == 'input':
                node.func.id = '_async_input'
                await_node = ast.Await(value=node)
                ast.copy_location(await_node, node)
                return await_node

            # Await calls to async user functions
            if node.func.id in self.async_functions:
                await_node = ast.Await(value=node)
                ast.copy_location(await_node, node)
                return await_node

        return node

def _transform_for_async_input(code):
    """Main entry point for AST-based async transformation"""
    if 'input(' not in code:
        return code  # No transformation needed

    try:
        tree = ast.parse(code)

        # Step 1: Build call graph and find functions using input
        builder = _CallGraphBuilder()
        builder.visit(tree)

        # Step 2: Compute transitive closure of async requirement
        async_functions = _compute_async_functions(
            builder.calls,
            builder.uses_input,
            builder.all_functions,
            builder.sync_decorated
        )

        # Step 3: Transform functions to async
        async_transformer = _AsyncTransformer(async_functions)
        tree = async_transformer.visit(tree)

        # Step 4: Add await to calls
        await_transformer = _AwaitTransformer(async_functions)
        tree = await_transformer.visit(tree)

        ast.fix_missing_locations(tree)
        return ast.unparse(tree)
    except SyntaxError:
        # If AST parsing fails, return original code
        return code

setattr(builtins, '_transform_for_async_input', _transform_for_async_input)
`);

      // Set up interrupt buffer if available (P2)
      if (interruptBuffer) {
        instance.setInterruptBuffer(interruptBuffer);
      }

      isInitializing = false;
      pyodide = instance;
      parentPort?.postMessage({
        type: 'status',
        id: 'init',
        data: { message: 'Python runtime ready' },
      });

      return instance;
    } finally {
      isLoading = false;
      isInitializing = false;
    }
  })();

  try {
    const instance = await withTimeout(
      pyodideLoadPromise,
      PYODIDE_INIT_TIMEOUT_MS,
      'Pyodide initialization timed out'
    );
    pyodideLoadPromise = null;
    return instance;
  } catch (error) {
    pyodide = null;
    pyodideLoadPromise = null;
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Transform Python code to inject debug calls for expressions with #? comments
 * Also transforms code to support async input() using AST-based transformation (P1-A)
 */
async function transformPythonCode(
  py: PyodideInterface,
  code: string
): Promise<string> {
  const DEBUG_TRANSFORM = false; // Set to true to see transformation logs

  // Step 1: Handle magic comments (#?) - keep this in TypeScript
  const lines = code.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for magic comment: #? or # ?
    const magicMatch = line.match(/^(.+?)#\?\s*(.*)$/);

    if (magicMatch) {
      const codePart = magicMatch[1].trim();

      // Check if it's a variable assignment: x = value #?
      const varMatch = codePart.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);

      if (varMatch) {
        const [, varName, value] = varMatch;
        // Output: x = value; debug(line, x)
        result.push(`${varName} = ${value}`);
        result.push(`debug(${lineNumber}, ${varName})`);
      } else {
        // For expressions: expr #? -> debug(line, expr)
        result.push(`debug(${lineNumber}, ${codePart})`);
      }
    } else {
      result.push(line);
    }
  }

  let transformedCode = result.join('\n');

  // Step 2: If code uses input(), use AST-based transformation (P1-A)
  // This respects decorators like @property, @staticmethod, etc.
  const hasInput = code.includes('input(');

  if (hasInput) {
    if (DEBUG_TRANSFORM) {
      // Debug logging disabled
    }

    try {
      // Use the Python AST transformer we set up during initialization
      py.globals.set('_code_to_transform', transformedCode);
      const astTransformed = py.runPython(
        '_transform_for_async_input(_code_to_transform)'
      );
      transformedCode = astTransformed as string;

      if (DEBUG_TRANSFORM) {
        // Debug logging disabled
      }
    } catch (astError) {
      // Fallback to regex-based transformation if AST fails
      console.warn(
        '[PythonTransform] AST transformation failed, using regex fallback:',
        astError
      );
      transformedCode = regexFallbackTransform(transformedCode);
    }
  }

  return transformedCode;
}

/**
 * Clean up Python traceback to hide internal Pyodide frames
 */
function cleanPythonError(error: Error): {
  name: string;
  message: string;
  stack?: string;
} {
  const originalMessage = error.message;
  let cleanedMessage = originalMessage;

  if (cleanedMessage.includes('Traceback (most recent call last):')) {
    const lines = cleanedMessage.split('\n');
    const result: string[] = [];
    let skipping = false;

    for (const line of lines) {
      // Always keep the header
      if (line.trim() === 'Traceback (most recent call last):') {
        result.push(line);
        continue;
      }

      // Check for File line
      if (line.trim().startsWith('File "')) {
        // Filter out internal Pyodide files
        if (
          line.includes('/lib/python') ||
          line.includes('_pyodide') ||
          line.includes('pyodide-internal')
        ) {
          skipping = true;
        } else {
          skipping = false;
        }
      }
      // If line is not indented, it's likely the final error message (e.g. NameError: ...)
      // so we should stop skipping
      else if (!line.startsWith(' ') && line.trim().length > 0) {
        skipping = false;
      }

      if (!skipping) {
        result.push(line);
      }
    }

    // Remove extra newlines that might result from filtering
    cleanedMessage = result.join('\n').trim();
  }

  return {
    name: error.name,
    message: cleanedMessage,
    stack: error.stack,
  };
}

/**
 * Fallback regex-based transformation (legacy, used if AST fails)
 */
function regexFallbackTransform(code: string): string {
  let transformedCode = code;

  // Step 1: Replace input( with await _async_input(
  transformedCode = transformedCode.replace(
    /\binput\s*\(/g,
    'await _async_input('
  );

  // Step 2: Find all function definitions and make them async
  transformedCode = transformedCode.replace(
    /^(\s*)def\s+(\w+)\s*\(/gm,
    '$1async def $2('
  );

  // Step 3: Find all function calls to user-defined functions and await them
  const funcNames = [...transformedCode.matchAll(/async def (\w+)\s*\(/g)].map(
    (m) => m[1]
  );

  // Built-in functions that should NOT be awaited
  const builtins = [
    'print',
    'len',
    'range',
    'str',
    'int',
    'float',
    'list',
    'dict',
    'set',
    'tuple',
    'bool',
    'type',
    'isinstance',
    'hasattr',
    'getattr',
    'setattr',
    'open',
    'input',
    'sorted',
    'reversed',
    'enumerate',
    'zip',
    'map',
    'filter',
    'sum',
    'min',
    'max',
    'abs',
    'round',
    'pow',
    'divmod',
    'hex',
    'oct',
    'bin',
    'ord',
    'chr',
    'repr',
    'format',
    'iter',
    'next',
    'slice',
    'super',
    '_async_input',
  ];

  // Await calls to user-defined functions
  for (const funcName of funcNames) {
    if (!builtins.includes(funcName)) {
      const callPattern = new RegExp(
        `(?<!await\\s)(?<!def\\s)\\b${funcName}\\s*\\(`,
        'g'
      );
      transformedCode = transformedCode.replace(
        callPattern,
        `await ${funcName}(`
      );
    }
  }

  // Step 4: Handle "if __name__ == '__main__':"
  if (transformedCode.includes('if __name__')) {
    transformedCode = transformedCode.replace(
      /if\s+__name__\s*==\s*["']__main__["']\s*:\s*\n(\s+)(await\s+)?(\w+)\s*\(\)/g,
      '# Top-level await (transformed for async input)\nawait $3()'
    );
  }

  return transformedCode;
}

/**
 * Execute Python code
 */
async function executeCode(message: ExecuteMessage): Promise<void> {
  const { id, code, options } = message;

  // Increase timeout if code uses input() - user needs time to respond
  const hasInput = code.includes('input(');
  const timeout = hasInput ? 300000 : (options.timeout ?? 30000); // 5 min for input, 30s default

  currentExecutionId = id;

  try {
    // Initialize Pyodide if needed
    const py = await initializePyodide();

    // Clear interrupt buffer before execution (P2)
    if (interruptBuffer) {
      interruptBuffer[0] = 0;
    }

    // Transform code to handle magic comments and async input (P1-A)
    const transformedCode = await transformPythonCode(py, code);

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Execution timeout (${timeout}ms)`)),
        timeout
      );
    });

    // Execute code with timeout
    const result = await Promise.race([
      py.runPythonAsync(transformedCode),
      timeoutPromise,
    ]);

    // Flush Python stdout/stderr to ensure all output is captured
    // This is important because async operations might have buffered output
    try {
      py.runPython(`
import sys
sys.stdout.flush()
sys.stderr.flush()
`);
    } catch (flushError) {
      console.warn('[PythonExecutor] Error flushing output:', flushError);
    }

    // Get debug outputs (safely - the function might not exist in some edge cases)
    try {
      const hasDebugFn = py.runPython(
        'hasattr(__builtins__, "_get_debug_outputs") if isinstance(__builtins__, dict) else hasattr(__builtins__, "_get_debug_outputs")'
      );
      if (hasDebugFn) {
        const debugOutputs = py
          .runPython('_get_debug_outputs()')
          .toJs() as Array<{ line: number; content: string }>;

        // Send debug outputs
        for (const output of debugOutputs) {
          parentPort?.postMessage({
            type: 'debug',
            id,
            line: output.line,
            data: { content: output.content },
            jsType: 'python',
          } as ResultMessage);
        }
      }
    } catch (debugError) {
      // Debug function not available - this is not critical
      console.warn('[PythonExecutor] Debug outputs unavailable:', debugError);
    }

    // Check and clean memory after execution
    await checkAndCleanMemory(py);

    // Send completion
    parentPort?.postMessage({
      type: 'complete',
      id,
      data: result !== undefined ? serializeValue(result) : null,
    } as ResultMessage);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? cleanPythonError(error)
        : { name: 'PythonError', message: String(error) };

    parentPort?.postMessage({
      type: 'error',
      id,
      data: errorMessage,
    } as ResultMessage);
  } finally {
    currentExecutionId = null;
  }
}

/**
 * Install a Python package using micropip
 */
async function installPackage(message: InstallPackageMessage): Promise<void> {
  const { id, packageName } = message;

  try {
    const py = await initializePyodide();
    const safePackageLiteral = JSON.stringify(packageName);

    parentPort?.postMessage({
      type: 'status',
      id,
      data: { message: `Installing ${packageName}...` },
    });

    await py.runPythonAsync(`
import micropip
await micropip.install(${safePackageLiteral})
`);

    parentPort?.postMessage({
      type: 'complete',
      id,
      data: { success: true, packageName },
    } as ResultMessage);
  } catch (error) {
    parentPort?.postMessage({
      type: 'error',
      id,
      data: {
        name: 'InstallError',
        message: `Failed to install ${packageName}: ${error instanceof Error ? error.message : String(error)}`,
      },
    } as ResultMessage);
  }
}

/**
 * List installed Python packages
 */
async function listInstalledPackages(id: string): Promise<void> {
  try {
    const py = await initializePyodide();

    const result = await py.runPythonAsync(`
import micropip
list(micropip.list().keys())
`);

    const packages = result.toJs() as string[];

    parentPort?.postMessage({
      type: 'complete',
      id,
      data: { packages },
    } as ResultMessage);
  } catch (error) {
    parentPort?.postMessage({
      type: 'error',
      id,
      data: {
        name: 'ListError',
        message: `Failed to list packages: ${error instanceof Error ? error.message : String(error)}`,
      },
    } as ResultMessage);
  }
}

/**
 * Reset Pyodide runtime - clears all state (P1-B)
 * This helps prevent memory accumulation and variable persistence
 */
async function resetPyodide(id: string): Promise<void> {
  try {
    if (pyodide) {
      // Clear all user-defined globals
      try {
        pyodide.runPython(`
# Get list of user-defined names (exclude builtins and system modules)
import sys
import gc

# Names to preserve (system and our custom functions)
_preserve = {
    'sys', 'gc', 'builtins', 'ast', 'asyncio', 'traceback',
    '_debug_outputs', 'debug', '_get_debug_outputs',
    '_async_input', '_js_request_input', '_original_input',
    '_transform_for_async_input', '_AsyncTransformer', '_AwaitTransformer', '_InputUsageVisitor',
    '_SYNC_DECORATORS', '_code_to_transform'
}

# Delete user-defined variables from globals
_to_delete = [
    name for name in list(globals().keys())
    if not name.startswith('_')
    and name not in _preserve
    and name not in sys.builtin_module_names
]

for name in _to_delete:
    try:
        del globals()[name]
    except:
        pass

# Force garbage collection
gc.collect()
`);
      } catch (e) {
        console.warn('[PythonExecutor] Error clearing globals:', e);
      }
    }

    // Full reset: null the instance and reinitialize
    pyodide = null;
    pyodideLoadPromise = null;
    isLoading = false;

    // Reinitialize
    await initializePyodide();

    parentPort?.postMessage({
      type: 'complete',
      id,
      data: { success: true, message: 'Python runtime reset successfully' },
    } as ResultMessage);
  } catch (error) {
    parentPort?.postMessage({
      type: 'error',
      id,
      data: {
        name: 'ResetError',
        message: `Failed to reset Python runtime: ${error instanceof Error ? error.message : String(error)}`,
      },
    } as ResultMessage);
  }
}

// Message handler
parentPort?.on('message', async (message: WorkerMessage) => {
  // Handle interrupt buffer setup (P2)
  if (message.type === 'set-interrupt-buffer') {
    const bufferMessage = message as SetInterruptBufferMessage;
    interruptBuffer = new Uint8Array(bufferMessage.buffer);

    // If Pyodide is already initialized, set the interrupt buffer
    if (pyodide) {
      pyodide.setInterruptBuffer(interruptBuffer);
    }
    return;
  }

  if (message.type === 'execute') {
    await executeCode(message);
  } else if (message.type === 'cancel') {
    if (message.id === currentExecutionId) {
      // Signal interrupt via SharedArrayBuffer (SIGINT = 2) (P2)
      if (interruptBuffer) {
        interruptBuffer[0] = 2; // SIGINT - will raise KeyboardInterrupt in Python
      }

      // Reject any pending inputs
      rejectPendingInputs(message.id, new Error('Execution cancelled'));

      // Send error response after short delay to allow interrupt to process
      setTimeout(() => {
        parentPort?.postMessage({
          type: 'error',
          id: message.id,
          data: { name: 'CancelError', message: 'Execution cancelled by user' },
        } as ResultMessage);
        currentExecutionId = null;
      }, 100);
    }
  } else if (message.type === 'install-package') {
    await installPackage(message);
  } else if (message.type === 'list-packages') {
    await listInstalledPackages(message.id);
  } else if (message.type === 'reset-runtime') {
    // Reset Pyodide runtime (P1-B)
    await resetPyodide(message.id);
  } else if (message.type === 'input-response') {
    // Resolve the pending input with the user's value, matching by execution and request
    const resolved = resolvePendingInput(
      message.id,
      message.requestId,
      message.value
    );
    if (!resolved) {
      console.warn(
        '[PythonExecutor] Received input response with no pending request',
        { id: message.id, requestId: message.requestId }
      );
    }
  } else if (message.type === 'get-memory-stats') {
    // Return current memory statistics
    const pyObjects = pyodide ? (await getMemoryUsage(pyodide)).pyObjects : 0;
    parentPort?.postMessage({
      type: 'complete',
      id: message.id,
      data: {
        ...memoryStats,
        pyObjects,
        executionCount: executionCounter,
      },
    } as ResultMessage);
  } else if (message.type === 'cleanup-namespace') {
    // Manual namespace cleanup request
    try {
      if (pyodide) {
        await cleanupPythonNamespace(pyodide);
        await forceGarbageCollection(pyodide);
        memoryStats.executionsSinceCleanup = 0;
        memoryStats.lastCleanupTime = Date.now();
      }
      parentPort?.postMessage({
        type: 'complete',
        id: message.id,
        data: { success: true, message: 'Namespace cleanup completed' },
      } as ResultMessage);
    } catch (error) {
      parentPort?.postMessage({
        type: 'error',
        id: message.id,
        data: {
          name: 'CleanupError',
          message: `Failed to cleanup namespace: ${error instanceof Error ? error.message : String(error)}`,
        },
      } as ResultMessage);
    }
  }
});

// Signal ready
parentPort?.postMessage({ type: 'ready' });
