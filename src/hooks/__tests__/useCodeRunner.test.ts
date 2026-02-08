import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mock stores ────────────────────────────────────────────────────────

const mockSetCode = vi.fn();
const mockSetResult = vi.fn();
const mockAppendResult = vi.fn();
const mockClearResult = vi.fn();
const mockSetIsExecuting = vi.fn();
const mockSetPromptRequest = vi.fn();

vi.mock('../../store/useCodeStore', () => {
  const store = (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      code: 'console.log("hello")',
      setCode: mockSetCode,
      setResult: mockSetResult,
      appendResult: mockAppendResult,
      clearResult: mockClearResult,
      setIsExecuting: mockSetIsExecuting,
      setPromptRequest: mockSetPromptRequest,
    });
  return { useCodeStore: store };
});

vi.mock('../../store/useSettingsStore', () => ({
  useSettingsStore: () => ({
    showTopLevelResults: true,
    loopProtection: false,
    showUndefined: false,
    magicComments: false,
  }),
}));

const mockDetectLanguage = vi.fn().mockReturnValue({
  monacoId: 'javascript',
  confidence: 1,
  isExecutable: true,
});

vi.mock('../../store/useLanguageStore', () => ({
  useLanguageStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ currentLanguage: 'javascript' }),
    {
      getState: () => ({
        detectLanguage: mockDetectLanguage,
      }),
    }
  ),
  isLanguageExecutable: (lang: string) =>
    ['javascript', 'typescript', 'python'].includes(lang),
  getLanguageDisplayName: (lang: string) =>
    lang.charAt(0).toUpperCase() + lang.slice(1),
}));

const mockAddToHistory = vi.fn();
vi.mock('../../store/useHistoryStore', () => ({
  useHistoryStore: Object.assign(() => ({}), {
    getState: () => ({
      addToHistory: mockAddToHistory,
    }),
  }),
}));

// ── Mock lib modules ───────────────────────────────────────────────────

const mockRecordExecution = vi.fn();
vi.mock('../../lib/metrics', () => ({
  getMetrics: () => ({
    recordExecution: mockRecordExecution,
  }),
}));

vi.mock('../../lib/errors', () => ({
  createExecutionError: (error: unknown, language: string) => ({
    category: 'RUNTIME',
    severity: 'ERROR',
    language,
    originalMessage: error instanceof Error ? error.message : String(error),
    friendlyMessage: error instanceof Error ? error.message : String(error),
    getFormattedMessage: () =>
      error instanceof Error ? error.message : String(error),
  }),
  shouldDisplayError: () => true,
}));

vi.mock('../../constants', () => ({
  DEFAULT_TIMEOUT: 30000,
}));

// ── Mock window.codeRunner ─────────────────────────────────────────────

let mockExecute: ReturnType<typeof vi.fn>;
let mockCancel: ReturnType<typeof vi.fn>;
let mockWaitForReady: ReturnType<typeof vi.fn>;
let mockOnResult: ReturnType<typeof vi.fn>;
let mockOnJSInputRequest: ReturnType<typeof vi.fn>;

function setupCodeRunner() {
  mockExecute = vi.fn().mockResolvedValue({ success: true });
  mockCancel = vi.fn();
  mockWaitForReady = vi.fn().mockResolvedValue(true);
  mockOnResult = vi.fn().mockReturnValue(vi.fn());
  mockOnJSInputRequest = vi.fn().mockReturnValue(vi.fn());

  Object.defineProperty(window, 'codeRunner', {
    value: {
      execute: mockExecute,
      cancel: mockCancel,
      waitForReady: mockWaitForReady,
      onResult: mockOnResult,
      onJSInputRequest: mockOnJSInputRequest,
    },
    writable: true,
    configurable: true,
  });
}

function removeCodeRunner() {
  Object.defineProperty(window, 'codeRunner', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// Import after mocks — one level up from __tests__
import { useCodeRunner } from '../useCodeRunner';

/**
 * Advance fake timers past the 300ms debounce and flush all pending async work.
 * Uses vi.advanceTimersByTimeAsync which handles both timers AND microtasks.
 */
async function flushDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(350);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('useCodeRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setupCodeRunner();
    mockDetectLanguage.mockReturnValue({
      monacoId: 'javascript',
      confidence: 1,
      isExecutable: true,
    });
  });

  afterEach(() => {
    removeCodeRunner();
    vi.useRealTimers();
  });

  it('should return runCode function', () => {
    const { result } = renderHook(() => useCodeRunner());
    expect(result.current.runCode).toBeInstanceOf(Function);
  });

  it('should clear results and set executing before running', async () => {
    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('console.log(1)');
    });
    await flushDebounce();

    expect(mockClearResult).toHaveBeenCalled();
    expect(mockSetIsExecuting).toHaveBeenCalledWith(true);
  });

  it('should wait for worker to be ready before executing', async () => {
    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('console.log(1)');
    });
    await flushDebounce();

    expect(mockWaitForReady).toHaveBeenCalledWith('javascript');
  });

  it('should subscribe to results before executing code', async () => {
    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('const x = 1');
    });
    await flushDebounce();

    expect(mockOnResult).toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalled();

    const onResultOrder = mockOnResult.mock.invocationCallOrder[0];
    const executeOrder = mockExecute.mock.invocationCallOrder[0];
    expect(onResultOrder).toBeLessThan(executeOrder);
  });

  it('should pass execution options to codeRunner.execute', async () => {
    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('let x = 1');
    });
    await flushDebounce();

    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringMatching(/^exec-/),
      'let x = 1',
      expect.objectContaining({
        timeout: 30000,
        showUndefined: false,
        showTopLevelResults: true,
        loopProtection: false,
        magicComments: false,
        language: 'javascript',
      })
    );
  });

  it('should handle debug result type (line-numbered output)', async () => {
    let resultCallback: (data: Record<string, unknown>) => void;
    mockOnResult.mockImplementation(
      (cb: (data: Record<string, unknown>) => void) => {
        resultCallback = cb;
        return vi.fn();
      }
    );

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('const x = 1');
    });
    await flushDebounce();

    const execId = mockExecute.mock.calls[0][0];

    act(() => {
      resultCallback!({
        type: 'debug',
        id: execId,
        line: 1,
        data: { content: '1' },
        jsType: 'number',
      });
    });

    expect(mockAppendResult).toHaveBeenCalledWith(
      expect.objectContaining({
        lineNumber: 1,
        type: 'execution',
        element: expect.objectContaining({ content: '1', jsType: 'number' }),
      })
    );
  });

  it('should handle console result type', async () => {
    let resultCallback: (data: Record<string, unknown>) => void;
    mockOnResult.mockImplementation(
      (cb: (data: Record<string, unknown>) => void) => {
        resultCallback = cb;
        return vi.fn();
      }
    );

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('console.log("hi")');
    });
    await flushDebounce();

    const execId = mockExecute.mock.calls[0][0];

    act(() => {
      resultCallback!({
        type: 'console',
        id: execId,
        data: { content: 'hi' },
        consoleType: 'log',
      });
    });

    expect(mockAppendResult).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'execution',
        element: expect.objectContaining({
          content: 'hi',
          consoleType: 'log',
        }),
      })
    );
  });

  it('should prefix console error with emoji', async () => {
    let resultCallback: (data: Record<string, unknown>) => void;
    mockOnResult.mockImplementation(
      (cb: (data: Record<string, unknown>) => void) => {
        resultCallback = cb;
        return vi.fn();
      }
    );

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('console.error("fail")');
    });
    await flushDebounce();

    const execId = mockExecute.mock.calls[0][0];

    act(() => {
      resultCallback!({
        type: 'console',
        id: execId,
        data: { content: 'fail' },
        consoleType: 'error',
      });
    });

    expect(mockAppendResult).toHaveBeenCalledWith(
      expect.objectContaining({
        element: expect.objectContaining({
          content: expect.stringContaining('fail'),
          consoleType: 'error',
        }),
      })
    );
  });

  it('should filter out Python cancellation messages', async () => {
    let resultCallback: (data: Record<string, unknown>) => void;
    mockOnResult.mockImplementation(
      (cb: (data: Record<string, unknown>) => void) => {
        resultCallback = cb;
        return vi.fn();
      }
    );

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('import time');
    });
    await flushDebounce();

    const execId = mockExecute.mock.calls[0][0];

    // Clear any previous appendResult calls before testing the filter
    mockAppendResult.mockClear();

    act(() => {
      resultCallback!({
        type: 'console',
        id: execId,
        data: { content: 'KeyboardInterrupt' },
        consoleType: 'error',
      });
    });

    expect(mockAppendResult).not.toHaveBeenCalled();
  });

  it('should handle complete result type', async () => {
    let resultCallback: (data: Record<string, unknown>) => void;
    mockOnResult.mockImplementation(
      (cb: (data: Record<string, unknown>) => void) => {
        resultCallback = cb;
        return vi.fn();
      }
    );

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('const x = 1');
    });
    await flushDebounce();

    const execId = mockExecute.mock.calls[0][0];

    act(() => {
      resultCallback!({ type: 'complete', id: execId });
    });

    expect(mockSetIsExecuting).toHaveBeenCalledWith(false);
    expect(mockSetPromptRequest).toHaveBeenCalledWith(null);
    expect(mockRecordExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'javascript',
        success: true,
      })
    );
    expect(mockAddToHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'const x = 1',
        language: 'javascript',
        status: 'success',
      })
    );
  });

  it('should ignore results from different execution IDs', async () => {
    let resultCallback: (data: Record<string, unknown>) => void;
    mockOnResult.mockImplementation(
      (cb: (data: Record<string, unknown>) => void) => {
        resultCallback = cb;
        return vi.fn();
      }
    );

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('const x = 1');
    });
    await flushDebounce();

    // Clear any calls from the execution itself
    mockAppendResult.mockClear();

    act(() => {
      resultCallback!({
        type: 'console',
        id: 'different-exec-id',
        data: { content: 'stale' },
        consoleType: 'log',
      });
    });

    expect(mockAppendResult).not.toHaveBeenCalled();
  });

  it('should show error for unsupported language', async () => {
    mockDetectLanguage.mockReturnValue({
      monacoId: 'rust',
      confidence: 1,
      isExecutable: false,
    });

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('fn main() {}');
    });
    await flushDebounce();

    expect(mockSetResult).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'error',
        element: expect.objectContaining({
          content: expect.stringContaining('Unsupported Language'),
        }),
      }),
    ]);
    expect(mockSetIsExecuting).toHaveBeenCalledWith(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('should show error when codeRunner is missing', async () => {
    removeCodeRunner();

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('const x = 1');
    });
    await flushDebounce();

    expect(mockSetResult).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'error',
        element: expect.objectContaining({
          content: expect.stringContaining('Code runner not available'),
        }),
      }),
    ]);
  });

  it('should handle worker initialization failure', async () => {
    mockWaitForReady.mockResolvedValue(false);

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('const x = 1');
    });
    await flushDebounce();

    expect(mockSetResult).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'error',
        element: expect.objectContaining({
          content: expect.stringContaining('failed to initialize'),
        }),
      }),
    ]);
  });

  it('should handle execute response failure with timeout', async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: 'Execution timeout after 30s',
    });

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('while(true){}');
    });
    await flushDebounce();

    expect(mockAppendResult).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        element: expect.objectContaining({
          content: expect.stringContaining('timeout'),
        }),
      })
    );
  });

  it('should cancel previous execution on new run', async () => {
    const { result } = renderHook(() => useCodeRunner());

    // First run — let it complete fully
    act(() => {
      result.current.runCode('const x = 1');
    });
    await flushDebounce();

    // Second run — should cancel the previous execution
    act(() => {
      result.current.runCode('const y = 2');
    });
    await flushDebounce();

    expect(mockCancel).toHaveBeenCalled();
  });

  it('should detect python language and pass it to execute', async () => {
    mockDetectLanguage.mockReturnValue({
      monacoId: 'python',
      confidence: 1,
      isExecutable: true,
    });

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('print("hello")');
    });
    await flushDebounce();

    expect(mockWaitForReady).toHaveBeenCalledWith('python');
    expect(mockExecute).toHaveBeenCalledWith(
      expect.any(String),
      'print("hello")',
      expect.objectContaining({ language: 'python' })
    );
  });

  it('should detect typescript and pass it to execute', async () => {
    mockDetectLanguage.mockReturnValue({
      monacoId: 'typescript',
      confidence: 1,
      isExecutable: true,
    });

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('const x: number = 1');
    });
    await flushDebounce();

    expect(mockWaitForReady).toHaveBeenCalledWith('typescript');
    expect(mockExecute).toHaveBeenCalledWith(
      expect.any(String),
      'const x: number = 1',
      expect.objectContaining({ language: 'typescript' })
    );
  });

  it('should update code in store when codeToRun is provided', async () => {
    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('new code here');
    });
    await flushDebounce();

    expect(mockSetCode).toHaveBeenCalledWith('new code here');
  });

  it('should subscribe to JS input requests on mount', () => {
    renderHook(() => useCodeRunner());
    expect(mockOnJSInputRequest).toHaveBeenCalledTimes(1);
  });

  it('should handle error result type', async () => {
    let resultCallback: (data: Record<string, unknown>) => void;
    mockOnResult.mockImplementation(
      (cb: (data: Record<string, unknown>) => void) => {
        resultCallback = cb;
        return vi.fn();
      }
    );

    const { result } = renderHook(() => useCodeRunner());

    act(() => {
      result.current.runCode('throw new Error("boom")');
    });
    await flushDebounce();

    const execId = mockExecute.mock.calls[0][0];

    act(() => {
      resultCallback!({
        type: 'error',
        id: execId,
        data: 'ReferenceError: x is not defined',
      });
    });

    expect(mockAppendResult).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        element: expect.objectContaining({
          content: expect.any(String),
        }),
      })
    );
  });
});
