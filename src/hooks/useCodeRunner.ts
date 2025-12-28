import { useCallback, useRef, useEffect } from 'react';
import { useCodeStore, type CodeState } from '../store/useCodeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  useLanguageStore,
  isLanguageExecutable,
  getLanguageDisplayName,
} from '../store/useLanguageStore';
import { createExecutionError, shouldDisplayError } from '../lib/errors';
import { getMetrics } from '../lib/metrics';
import { useHistoryStore } from '../store/useHistoryStore';

// Type for execution results from the worker
interface ExecutionResultData {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete';
  id: string;
  data?: unknown;
  line?: number;
  jsType?: string;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

// Error types for better error handling
class CodeRunnerError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'CodeRunnerError';
  }
}

class WorkerUnavailableError extends CodeRunnerError {
  constructor() {
    super(
      'Code runner not available. Please ensure you are running in Electron.',
      'WORKER_UNAVAILABLE'
    );
    this.name = 'WorkerUnavailableError';
  }
}

// Unused error class - can be removed
// class ExecutionTimeoutError extends CodeRunnerError {}

/**
 * Format execution error for display using unified error system
 */
function formatExecutionError(
  error: unknown,
  language: 'javascript' | 'typescript' | 'python'
): { message: string; shouldDisplay: boolean } {
  const execError = createExecutionError(error, language);

  if (!shouldDisplayError(execError)) {
    return { message: '', shouldDisplay: false };
  }

  return {
    message: execError.getFormattedMessage(),
    shouldDisplay: true,
  };
}

// Generate unique execution IDs
let executionCounter = 0;
function generateExecutionId(): string {
  return `exec-${Date.now()}-${++executionCounter}`;
}

export function useCodeRunner() {
  const code = useCodeStore((state: CodeState) => state.code);
  const setCode = useCodeStore((state: CodeState) => state.setCode);
  const setResult = useCodeStore((state: CodeState) => state.setResult);
  const appendResult = useCodeStore((state: CodeState) => state.appendResult);
  const clearResult = useCodeStore((state: CodeState) => state.clearResult);
  const setIsExecuting = useCodeStore(
    (state: CodeState) => state.setIsExecuting
  );

  const { showTopLevelResults, loopProtection, showUndefined, magicComments } =
    useSettingsStore();

  const currentExecutionIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Clean up result listener on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const runCode = useCallback(
    async (codeToRun?: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        const sourceCode = codeToRun ?? code;

        // Cancel any previous execution
        if (currentExecutionIdRef.current) {
          window.codeRunner?.cancel(currentExecutionIdRef.current);
          currentExecutionIdRef.current = null;
        }

        // Clean up previous listener
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        // IMPORTANT: Detect language directly from source code to avoid race conditions
        // The store language might not be updated yet when auto-run triggers
        const detectLanguage = useLanguageStore.getState().detectLanguage;
        const detected = detectLanguage(sourceCode);
        const currentLang = detected.monacoId;

        // Validate that language is executable
        if (!isLanguageExecutable(currentLang)) {
          setIsExecuting(false);
          setResult([
            {
              element: {
                content: `❌ Unsupported Language: ${getLanguageDisplayName(currentLang)}\n\nThis editor can execute JavaScript, TypeScript and Python code.\n\nDetected language: ${currentLang}\nSupported languages: javascript, typescript, python`,
              },
              type: 'error',
            },
          ]);
          return;
        }

        clearResult();
        setIsExecuting(true);

        const executionId = generateExecutionId();
        currentExecutionIdRef.current = executionId;

        // Start metrics timer
        const metrics = getMetrics();
        const executionStartTime = Date.now();

        try {
          // Check if codeRunner is available (Electron environment)
          if (!window.codeRunner) {
            throw new WorkerUnavailableError();
          }

          // Wait for worker to be ready before executing
          const execLanguage =
            currentLang === 'python'
              ? 'python'
              : currentLang === 'typescript'
                ? 'typescript'
                : 'javascript';

          const isReady = await window.codeRunner.waitForReady(execLanguage);
          if (!isReady) {
            throw new Error(`Worker for ${execLanguage} failed to initialize`);
          }

          // Subscribe to results BEFORE executing to avoid race condition
          unsubscribeRef.current = window.codeRunner.onResult(
            (result: ExecutionResultData) => {
              // Only process results for current execution
              if (result.id !== executionId) return;

              if (result.type === 'debug') {
                // Line-numbered output
                appendResult({
                  lineNumber: result.line,
                  element: {
                    content:
                      (result.data as { content: string })?.content ??
                      String(result.data),
                    jsType: result.jsType,
                  },
                  type: 'execution',
                });
              } else if (result.type === 'console') {
                // Console output (log, warn, error, etc.)
                const consoleContent =
                  (result.data as { content: string })?.content ??
                  String(result.data);

                // Filter out Python cancellation-related console messages
                const isCancellationMessage =
                  consoleContent.includes('KeyboardInterrupt') ||
                  consoleContent.includes('Execution cancelled') ||
                  consoleContent.includes('_pyodide/_future_helper.py') ||
                  consoleContent.includes('pyodide/webloop.py') ||
                  (consoleContent.includes('Traceback') &&
                    consoleContent.includes('cancelled'));

                if (!isCancellationMessage) {
                  const consolePrefix =
                    result.consoleType === 'error'
                      ? '❌ '
                      : result.consoleType === 'warn'
                        ? '⚠️ '
                        : '';
                  appendResult({
                    element: {
                      content: consolePrefix + consoleContent,
                      consoleType: result.consoleType,
                    },
                    type: 'execution',
                  });
                }
              } else if (result.type === 'error') {
                // Use unified error handling system
                const { message, shouldDisplay } = formatExecutionError(
                  result.data,
                  execLanguage
                );

                if (shouldDisplay) {
                  appendResult({
                    element: {
                      content: message,
                    },
                    type: 'error',
                  });
                }
              } else if (result.type === 'complete') {
                // Record successful execution metrics
                metrics.recordExecution({
                  language: execLanguage,
                  duration: Date.now() - executionStartTime,
                  success: true,
                  codeLength: sourceCode.length,
                });

                // Execution completed - clean up listener
                if (unsubscribeRef.current) {
                  unsubscribeRef.current();
                  unsubscribeRef.current = null;
                }

                useHistoryStore.getState().addToHistory({
                  code: sourceCode,
                  language: execLanguage,
                  status: 'success',
                  executionTime: Date.now() - executionStartTime,
                });

                setIsExecuting(false);
                currentExecutionIdRef.current = null;
              }
            }
          );

          // Execute code via IPC - language already determined above

          const response = await window.codeRunner.execute(
            executionId,
            sourceCode,
            {
              timeout: 30000,
              showUndefined,
              showTopLevelResults,
              loopProtection,
              magicComments,
              language: execLanguage,
            }
          );

          if (!response.success) {
            appendResult({
              element: { content: `❌ ${response.error ?? 'Unknown error'}` },
              type: 'error',
            });
          }
        } catch (error: unknown) {
          // Get language for error context
          const detectLanguage = useLanguageStore.getState().detectLanguage;
          const detected = detectLanguage(sourceCode);
          const errorLang =
            detected.monacoId === 'python' ? 'python' : 'javascript';

          // Record failed execution metrics
          const execError = createExecutionError(error, errorLang);
          metrics.recordExecution({
            language: errorLang,
            duration: Date.now() - executionStartTime,
            success: false,
            error: execError.originalMessage,
            codeLength: sourceCode.length,
          });

          // Use unified error handling system
          const { message, shouldDisplay } = formatExecutionError(
            error,
            errorLang
          );

          if (shouldDisplay) {
            setResult([
              {
                element: { content: message },
                type: 'error',
              },
            ]);

            useHistoryStore.getState().addToHistory({
              code: sourceCode,
              language: errorLang,
              status: 'error',
              executionTime: Date.now() - executionStartTime,
            });
          }
        } finally {
          // DON'T clean up listener here - it will be cleaned up when 'complete' message arrives
          // This prevents race condition where messages arrive after execute() returns but before 'complete'
          // The listener cleanup happens in the onResult callback when type === 'complete'

          // Only set isExecuting to false if we didn't set up a listener
          // (e.g., if an error occurred before setting up the listener)
          if (!unsubscribeRef.current) {
            setIsExecuting(false);
            currentExecutionIdRef.current = null;
          }
        }

        if (codeToRun !== undefined) {
          setCode(codeToRun);
        }
      }, 300);
    },
    [
      setResult,
      setCode,
      appendResult,
      clearResult,
      setIsExecuting,
      code,
      showTopLevelResults,
      loopProtection,
      showUndefined,
      magicComments,
    ]
  );

  return {
    runCode,
  };
}
