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
      return new Promise<string>((resolve, reject) => {
        pendingInputs.push({ resolve, reject })

        // Send input request to main process
        parentPort?.postMessage({
          type: 'input-request',
          id: currentExecutionId,
          data: { prompt, line }
        })
      })
    })

    // Override Python's input function
    pyodide.runPython(`
import builtins
import asyncio

_original_input = builtins.input

async def _async_input(prompt=""):
    """Async input that communicates with the editor"""
    import js
    # Get the line number from the call stack
    import traceback
    stack = traceback.extract_stack()
    line = stack[-2].lineno if len(stack) > 1 else 0
    
    # Request input from JS
    result = await _js_request_input(prompt, line)
    return result

def input(prompt=""):
    """Synchronous wrapper for async input"""
    import asyncio
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_async_input(prompt))

# Override builtins
builtins.input = input
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
 */
function transformPythonCode(code: string): string {
  const lines = code.split('\n')
  const result: string[] = []

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

  return result.join('\n')
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
