/**
 * Python Executor Worker Thread
 * 
 * Executes Python code using Pyodide (WebAssembly Python runtime) with:
 * - Custom print interception
 * - Debug function for line-numbered output
 * - Timeout protection
 * - Package installation via micropip
 */

import { parentPort } from 'worker_threads'
import path from 'path'
import { loadPyodide, type PyodideInterface } from 'pyodide'

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

interface InstallPackageMessage {
  type: 'install-package'
  id: string
  packageName: string
}

interface ListPackagesMessage {
  type: 'list-packages'
  id: string
}

interface InputResponseMessage {
  type: 'input-response'
  id: string
  value: string
}

type WorkerMessage = ExecuteMessage | CancelMessage | InstallPackageMessage | ListPackagesMessage | InputResponseMessage

interface ExecuteOptions {
  timeout?: number
  showUndefined?: boolean
}

interface ResultMessage {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete' | 'status'
  id: string
  data: unknown
  line?: number
  jsType?: string
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir'
}

// Pyodide instance (loaded lazily)
let pyodide: PyodideInterface | null = null
let isLoading = false
let currentExecutionId: string | null = null
let isInitializing = false // Flag to suppress init logs

// Input handling
interface PendingInput {
  resolve: (value: string) => void
  reject: (error: Error) => void
}
let pendingInputs: PendingInput[] = []

/**
 * Custom inspect function for formatting Python values
 */
function formatPythonValue(val: unknown): string {
  if (val === undefined || val === null) return 'None'
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)

  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

/**
 * Serialize value for IPC transfer
 */
function serializeValue(val: unknown): { content: string; jsType: string } {
  const jsType = val === null ? 'null' : typeof val
  const content = formatPythonValue(val)
  return { content, jsType }
}

/**
 * Load Pyodide runtime
 */
async function initializePyodide(): Promise<PyodideInterface> {
  if (pyodide) return pyodide
  if (isLoading) {
    // Wait for loading to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (pyodide) return pyodide
  }

  isLoading = true

  isInitializing = true

  try {
    parentPort?.postMessage({
      type: 'status',
      id: 'init',
      data: { message: 'Loading Python runtime...' }
    })

    // Find pyodide package location - use path directly without file:// prefix
    const pyodidePath = path.dirname(require.resolve('pyodide/package.json'))

    pyodide = await loadPyodide({
      indexURL: pyodidePath,
      stdout: (text: string) => {
        // Suppress init messages like "Loading micropip", "Loaded micropip"
        if (isInitializing && (text.includes('micropip') || text.includes('Loading') || text.includes('Loaded'))) {
          return // Suppress during init
        }
        if (currentExecutionId) {
          parentPort?.postMessage({
            type: 'console',
            id: currentExecutionId,
            consoleType: 'log',
            data: { content: text }
          } as ResultMessage)
        }
      },
      stderr: (text: string) => {
        if (currentExecutionId) {
          parentPort?.postMessage({
            type: 'console',
            id: currentExecutionId,
            consoleType: 'error',
            data: { content: text }
          } as ResultMessage)
        }
      }
    })

    // Load micropip for package installation
    await pyodide.loadPackage('micropip')

    // Set up debug function in Python
    pyodide.runPython(`
import sys
from io import StringIO

# Store for debug outputs
_debug_outputs = []

def debug(line, *args):
    """Debug function that captures line number and values"""
    result = ' '.join(repr(arg) if not isinstance(arg, str) else arg for arg in args)
    _debug_outputs.append({'line': line, 'content': result})
    return args[0] if len(args) == 1 else args

def _get_debug_outputs():
    """Get and clear debug outputs"""
    global _debug_outputs
    outputs = _debug_outputs.copy()
    _debug_outputs = []
    return outputs

# Make debug function available in the global namespace
# Using globals() for compatibility across Pyodide versions
import builtins
setattr(builtins, 'debug', debug)
setattr(builtins, '_get_debug_outputs', _get_debug_outputs)
`)

    // Set up custom input handler
    pyodide.globals.set('_js_request_input', (prompt: string, line: number) => {
      const promise = new Promise<string>((resolve, reject) => {
        pendingInputs.push({ resolve, reject })

        // Send input request to main process
        parentPort?.postMessage({
          type: 'input-request',
          id: currentExecutionId,
          data: { prompt, line }
        })
      })

      return promise
    })

    // Override Python's input function to use async JS integration
    // In Pyodide, we need to use a special pattern to await JS promises from Python
    pyodide.runPython(`
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
`)

    isInitializing = false
    parentPort?.postMessage({
      type: 'status',
      id: 'init',
      data: { message: 'Python runtime ready' }
    })

    return pyodide
  } finally {
    isLoading = false
  }
}

/**
 * Transform Python code to inject debug calls for expressions with #? comments
 * Also transforms code to support async input() for proper JS promise integration
 */
function transformPythonCode(code: string): string {
  const DEBUG_TRANSFORM = false // Set to true to see transformation logs

  const lines = code.split('\n')
  const result: string[] = []
  const hasInput = code.includes('input(')

  if (DEBUG_TRANSFORM) {
    console.log('\n' + '='.repeat(60))
    console.log('[PythonTransform] Starting code transformation')
    console.log('[PythonTransform] Has input():', hasInput)
    console.log('='.repeat(60))
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Check for magic comment: #? or # ?
    const magicMatch = line.match(/^(.+?)#\?\s*(.*)$/)

    if (magicMatch) {
      const codePart = magicMatch[1].trim()

      // Check if it's a variable assignment: x = value #?
      const varMatch = codePart.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/)

      if (varMatch) {
        const [, varName, value] = varMatch
        // Output: x = value; debug(line, x)
        result.push(`${varName} = ${value}`)
        result.push(`debug(${lineNumber}, ${varName})`)
      } else {
        // For expressions: expr #? -> debug(line, expr)
        result.push(`debug(${lineNumber}, ${codePart})`)
      }
    } else {
      result.push(line)
    }
  }

  let transformedCode = result.join('\n')

  // If code uses input(), we need to transform it for async execution
  // Pyodide's runPythonAsync supports top-level await, so we can use await directly
  // without wrapping in asyncio.run_until_complete (which doesn't work with JS promises)
  if (hasInput) {
    if (DEBUG_TRANSFORM) {
      console.log('\n[PythonTransform] Step 1: Replacing input() with await _async_input()')
    }

    // Step 1: Replace input( with await _async_input(
    const beforeStep1 = transformedCode
    transformedCode = transformedCode.replace(/\binput\s*\(/g, 'await _async_input(')

    if (DEBUG_TRANSFORM) {
      const inputMatches = beforeStep1.match(/\binput\s*\(/g)
      console.log('[PythonTransform]   Found input() calls:', inputMatches?.length ?? 0)
    }

    if (DEBUG_TRANSFORM) {
      console.log('\n[PythonTransform] Step 2: Converting def to async def')
    }

    // Step 2: Find all function definitions and make them async
    const beforeStep2 = transformedCode
    transformedCode = transformedCode.replace(/^(\s*)def\s+(\w+)\s*\(/gm, '$1async def $2(')

    if (DEBUG_TRANSFORM) {
      const defMatches = beforeStep2.match(/^(\s*)def\s+(\w+)\s*\(/gm)
      console.log('[PythonTransform]   Found def statements:', defMatches?.length ?? 0, defMatches)
    }

    // Step 3: Find all function calls to user-defined functions and await them
    const funcNames = [...transformedCode.matchAll(/async def (\w+)\s*\(/g)].map(m => m[1])

    if (DEBUG_TRANSFORM) {
      console.log('\n[PythonTransform] Step 3: Adding await to user function calls')
      console.log('[PythonTransform]   Detected async functions:', funcNames)
    }

    // Built-in functions that should NOT be awaited
    const builtins = ['print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set',
      'tuple', 'bool', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr',
      'open', 'input', 'sorted', 'reversed', 'enumerate', 'zip', 'map', 'filter',
      'sum', 'min', 'max', 'abs', 'round', 'pow', 'divmod', 'hex', 'oct', 'bin',
      'ord', 'chr', 'repr', 'format', 'iter', 'next', 'slice', 'super', '_async_input']

    // Await calls to user-defined functions
    for (const funcName of funcNames) {
      if (!builtins.includes(funcName)) {
        // Match function calls anywhere (not just at start of statement)
        // Use negative lookbehinds to:
        // 1. Avoid double-await ((?<!await\s))
        // 2. Avoid matching function definitions ((?<!def\s))
        const callPattern = new RegExp(`(?<!await\\s)(?<!def\\s)\\b${funcName}\\s*\\(`, 'g')
        const beforeAwait = transformedCode
        transformedCode = transformedCode.replace(callPattern, `await ${funcName}(`)

        if (DEBUG_TRANSFORM) {
          const callMatches = beforeAwait.match(callPattern)
          console.log(`[PythonTransform]   ${funcName}(): found ${callMatches?.length ?? 0} call(s) to await`)
        }
      }
    }

    // Step 4: Handle "if __name__ == '__main__':" - just use top-level await
    // Pyodide's runPythonAsync supports this natively!
    if (transformedCode.includes('if __name__')) {
      if (DEBUG_TRANSFORM) {
        console.log('\n[PythonTransform] Step 4: Transforming if __name__ block')
      }

      const beforeMainBlock = transformedCode
      // Replace the if __name__ block with top-level await call
      // Match: if __name__ == "__main__":\n    main() OR if __name__ == "__main__":\n    await main()
      // (Step 3 may have already added "await" before the function name)
      transformedCode = transformedCode.replace(
        /if\s+__name__\s*==\s*["']__main__["']\s*:\s*\n(\s+)(await\s+)?(\w+)\s*\(\)/g,
        '# Top-level await (transformed for async input)\nawait $3()'
      )

      if (DEBUG_TRANSFORM) {
        const didTransform = beforeMainBlock !== transformedCode
        console.log('[PythonTransform]   Transformed if __name__ block:', didTransform)
      }
    }

    if (DEBUG_TRANSFORM) {
      console.log('\n' + '='.repeat(60))
      console.log('[PythonTransform] FINAL TRANSFORMED CODE:')
      console.log('='.repeat(60))
      console.log(transformedCode)
      console.log('='.repeat(60) + '\n')
    }
  }

  return transformedCode
}


/**
 * Execute Python code
 */
async function executeCode(message: ExecuteMessage): Promise<void> {
  const { id, code, options } = message

  // Increase timeout if code uses input() - user needs time to respond
  const hasInput = code.includes('input(')
  const timeout = hasInput ? 300000 : (options.timeout ?? 30000) // 5 min for input, 30s default

  currentExecutionId = id

  try {
    // Initialize Pyodide if needed
    const py = await initializePyodide()

    // Transform code to handle magic comments
    const transformedCode = transformPythonCode(code)

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Execution timeout (${timeout}ms)`)), timeout)
    })

    // Execute code with timeout
    const result = await Promise.race([
      py.runPythonAsync(transformedCode),
      timeoutPromise
    ])

    // Flush Python stdout/stderr to ensure all output is captured
    // This is important because async operations might have buffered output
    try {
      py.runPython(`
import sys
sys.stdout.flush()
sys.stderr.flush()
`)
    } catch (flushError) {
      console.warn('[PythonExecutor] Error flushing output:', flushError)
    }

    // Get debug outputs (safely - the function might not exist in some edge cases)
    try {
      const hasDebugFn = py.runPython('hasattr(__builtins__, "_get_debug_outputs") if isinstance(__builtins__, dict) else hasattr(__builtins__, "_get_debug_outputs")')
      if (hasDebugFn) {
        const debugOutputs = py.runPython('_get_debug_outputs()').toJs() as Array<{ line: number, content: string }>

        // Send debug outputs
        for (const output of debugOutputs) {
          parentPort?.postMessage({
            type: 'debug',
            id,
            line: output.line,
            data: { content: output.content },
            jsType: 'python'
          } as ResultMessage)
        }
      }
    } catch (debugError) {
      // Debug function not available - this is not critical
      console.warn('[PythonExecutor] Debug outputs unavailable:', debugError)
    }

    // Send completion
    parentPort?.postMessage({
      type: 'complete',
      id,
      data: result !== undefined ? serializeValue(result) : null
    } as ResultMessage)

  } catch (error) {
    const errorMessage = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: 'PythonError', message: String(error) }

    parentPort?.postMessage({
      type: 'error',
      id,
      data: errorMessage
    } as ResultMessage)
  } finally {
    currentExecutionId = null
  }
}

/**
 * Install a Python package using micropip
 */
async function installPackage(message: InstallPackageMessage): Promise<void> {
  const { id, packageName } = message

  try {
    const py = await initializePyodide()

    parentPort?.postMessage({
      type: 'status',
      id,
      data: { message: `Installing ${packageName}...` }
    })

    await py.runPythonAsync(`
import micropip
await micropip.install('${packageName}')
`)

    parentPort?.postMessage({
      type: 'complete',
      id,
      data: { success: true, packageName }
    } as ResultMessage)

  } catch (error) {
    parentPort?.postMessage({
      type: 'error',
      id,
      data: {
        name: 'InstallError',
        message: `Failed to install ${packageName}: ${error instanceof Error ? error.message : String(error)}`
      }
    } as ResultMessage)
  }
}

/**
 * List installed Python packages
 */
async function listInstalledPackages(id: string): Promise<void> {
  try {
    const py = await initializePyodide()

    const result = await py.runPythonAsync(`
import micropip
list(micropip.list().keys())
`)

    const packages = result.toJs() as string[]

    parentPort?.postMessage({
      type: 'complete',
      id,
      data: { packages }
    } as ResultMessage)

  } catch (error) {
    parentPort?.postMessage({
      type: 'error',
      id,
      data: {
        name: 'ListError',
        message: `Failed to list packages: ${error instanceof Error ? error.message : String(error)}`
      }
    } as ResultMessage)
  }
}

// Message handler
parentPort?.on('message', async (message: WorkerMessage) => {
  if (message.type === 'execute') {
    await executeCode(message)
  } else if (message.type === 'cancel') {
    if (message.id === currentExecutionId) {
      // Reject any pending inputs
      pendingInputs.forEach(p => p.reject(new Error('Execution cancelled')))
      pendingInputs = []

      parentPort?.postMessage({
        type: 'error',
        id: message.id,
        data: { name: 'CancelError', message: 'Execution cancelled by user' }
      } as ResultMessage)
      currentExecutionId = null
    }
  } else if (message.type === 'install-package') {
    await installPackage(message)
  } else if (message.type === 'list-packages') {
    await listInstalledPackages(message.id)
  } else if (message.type === 'input-response') {
    // Resolve the pending input with the user's value
    const pending = pendingInputs.shift()
    if (pending) {
      pending.resolve(message.value)
    }
  }
})

// Signal ready
parentPort?.postMessage({ type: 'ready' })
