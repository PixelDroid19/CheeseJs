import { useCallback, useRef, useEffect } from 'react'
import { useCodeStore, type CodeState } from '../store/useCodeStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { detectLanguage, isLanguageExecutable } from '../lib/languageDetector'

// Type for execution results from the worker
interface ExecutionResultData {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete'
  id: string
  data?: unknown
  line?: number
  jsType?: string
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir'
}

// Error types for better error handling
class CodeRunnerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'CodeRunnerError'
  }
}

class WorkerUnavailableError extends CodeRunnerError {
  constructor() {
    super('Code runner not available. Please ensure you are running in Electron.', 'WORKER_UNAVAILABLE')
    this.name = 'WorkerUnavailableError'
  }
}

class ExecutionTimeoutError extends CodeRunnerError {
  constructor() {
    super('Code execution timed out.', 'EXECUTION_TIMEOUT')
    this.name = 'ExecutionTimeoutError'
  }
}

// Generate unique execution IDs
let executionCounter = 0
function generateExecutionId(): string {
  return `exec-${Date.now()}-${++executionCounter}`
}

export function useCodeRunner() {
  const code = useCodeStore((state: CodeState) => state.code)
  const setCode = useCodeStore((state: CodeState) => state.setCode)
  const setResult = useCodeStore((state: CodeState) => state.setResult)
  const appendResult = useCodeStore((state: CodeState) => state.appendResult)
  const clearResult = useCodeStore((state: CodeState) => state.clearResult)
  const language = useCodeStore((state: CodeState) => state.language)
  const setLanguage = useCodeStore((state: CodeState) => state.setLanguage)
  const setIsExecuting = useCodeStore((state: CodeState) => state.setIsExecuting)

  const { showTopLevelResults, loopProtection, showUndefined, magicComments } =
    useSettingsStore()

  const currentExecutionIdRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Clean up result listener on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [])

  const runCode = useCallback(
    async (codeToRun?: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(async () => {
        const sourceCode = codeToRun ?? code

        // Cancel any previous execution
        if (currentExecutionIdRef.current) {
          window.codeRunner?.cancel(currentExecutionIdRef.current)
          currentExecutionIdRef.current = null
        }

        // Clean up previous listener
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }

        // Detect language
        const detectedLang = detectLanguage(sourceCode)
        if (detectedLang !== language) {
          setLanguage(detectedLang)
        }

        // Validate that language is executable
        if (!isLanguageExecutable(detectedLang)) {
          setIsExecuting(false)
          setResult([
            {
              element: {
                content: `❌ Unsupported Language: ${detectedLang}\n\nThis editor can only execute JavaScript and TypeScript code.\n\nDetected language: ${detectedLang}\nSupported languages: javascript, typescript`
              },
              type: 'error'
            }
          ])
          return
        }

        clearResult()
        setIsExecuting(true)

        const executionId = generateExecutionId()
        currentExecutionIdRef.current = executionId

        try {
          // Check if codeRunner is available (Electron environment)
          if (!window.codeRunner) {
            throw new WorkerUnavailableError()
          }

          // Subscribe to results for this execution
          unsubscribeRef.current = window.codeRunner.onResult((result: ExecutionResultData) => {
            // Only process results for current execution
            if (result.id !== executionId) return

            if (result.type === 'debug') {
              // Line-numbered output
              appendResult({
                lineNumber: result.line,
                element: { 
                  content: (result.data as { content: string })?.content ?? String(result.data),
                  jsType: result.jsType
                },
                type: 'execution'
              })
            } else if (result.type === 'console') {
              // Console output (log, warn, error, etc.)
              const consolePrefix = result.consoleType === 'error' ? '❌ ' :
                                   result.consoleType === 'warn' ? '⚠️ ' : ''
              appendResult({
                element: { 
                  content: consolePrefix + ((result.data as { content: string })?.content ?? String(result.data)),
                  consoleType: result.consoleType
                },
                type: 'execution'
              })
            } else if (result.type === 'error') {
              // Execution error
              const errorData = result.data as { name?: string; message?: string; stack?: string }
              const errorMessage = errorData.message ?? String(result.data)
              appendResult({
                element: { content: `❌ ${errorData.name ?? 'Error'}: ${errorMessage}` },
                type: 'error'
              })
            } else if (result.type === 'complete') {
              // Execution completed
              setIsExecuting(false)
              currentExecutionIdRef.current = null
            }
          })

          // Execute code via IPC
          const response = await window.codeRunner.execute(executionId, sourceCode, {
            timeout: 30000,
            showUndefined,
            showTopLevelResults,
            loopProtection,
            magicComments
          })

          if (!response.success) {
            appendResult({
              element: { content: `❌ ${response.error ?? 'Unknown error'}` },
              type: 'error'
            })
          }
        } catch (error: unknown) {
          let errorMessage: string
          let errorIcon = '❌'
          
          if (error instanceof WorkerUnavailableError) {
            errorMessage = `${error.message}\n\nPlease restart the application.`
            errorIcon = '🔌'
          } else if (error instanceof ExecutionTimeoutError) {
            errorMessage = `${error.message}\n\nTry breaking your code into smaller chunks.`
            errorIcon = '⏱️'
          } else if (error instanceof CodeRunnerError) {
            errorMessage = error.message
          } else if (error instanceof Error) {
            errorMessage = error.message
          } else {
            errorMessage = 'An unknown error occurred'
          }
          
          setResult([{ element: { content: `${errorIcon} ${errorMessage}` }, type: 'error' }])
        } finally {
          setIsExecuting(false)
          currentExecutionIdRef.current = null
        }

        if (codeToRun !== undefined) {
          setCode(codeToRun)
        }
      }, 300)
    },
    [
      language,
      setResult,
      setCode,
      appendResult,
      clearResult,
      setLanguage,
      setIsExecuting,
      code,
      showTopLevelResults,
      loopProtection,
      showUndefined,
      magicComments
    ]
  )

  return {
    runCode
  }
}
