import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerExecutionHandlers } from '../../electron/core/handlers/ExecutionHandlers';
import { WorkerPoolManager } from '../../electron/core/WorkerPoolManager';
import { ipcMain } from 'electron';

// Mock electron ipcMain
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
}));

// Mock WorkerPoolManager
const mockPostMessage = vi.fn();
const mockWorkerPool = {
  executeCode: vi.fn(),
  executePython: vi.fn(),
  cancelExecution: vi.fn(),
  isCodeWorkerReady: vi.fn(),
  isPythonWorkerReady: vi.fn(),
  getPythonWorker: vi.fn(),
  resolveJSInput: vi.fn(),
} as unknown as WorkerPoolManager;

// Mock transformCode
const mockTransformCode = vi.fn((code) => code);

// Helper: register handlers and extract a specific handler by channel name
function registerAndGetHandler(
  channel: string,
  type: 'handle' | 'on' = 'handle'
) {
  registerExecutionHandlers({
    workerPool: mockWorkerPool,
    transformCode: mockTransformCode,
  });
  const mock = type === 'handle' ? ipcMain.handle : ipcMain.on;
  const call = (mock as any).mock.calls.find((c: any[]) => c[0] === channel);
  if (!call) throw new Error(`Handler for '${channel}' not registered`);
  return call[1];
}

describe('ExecutionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register expected IPC handlers', () => {
    registerExecutionHandlers({
      workerPool: mockWorkerPool,
      transformCode: mockTransformCode,
    });

    expect(ipcMain.handle).toHaveBeenCalledWith(
      'execute-code',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'is-worker-ready',
      expect.any(Function)
    );
    expect(ipcMain.on).toHaveBeenCalledWith(
      'cancel-execution',
      expect.any(Function)
    );
    expect(ipcMain.on).toHaveBeenCalledWith(
      'python-input-response',
      expect.any(Function)
    );
    expect(ipcMain.on).toHaveBeenCalledWith(
      'js-input-response',
      expect.any(Function)
    );
  });

  it('should handle Javascript execution', async () => {
    const handler = registerAndGetHandler('execute-code');
    (mockWorkerPool.executeCode as any).mockResolvedValue('success');

    const result = await handler(
      {},
      {
        code: 'console.log("test")',
        language: 'javascript',
        id: 'test-id',
        options: {},
      }
    );

    expect(mockTransformCode).toHaveBeenCalled();
    expect(mockWorkerPool.executeCode).toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: 'success' });
  });

  it('should handle Python execution', async () => {
    const handler = registerAndGetHandler('execute-code');
    (mockWorkerPool.executePython as any).mockResolvedValue('success');

    const result = await handler(
      {},
      {
        code: 'print("test")',
        language: 'python',
        id: 'test-id',
        options: {},
      }
    );

    expect(mockTransformCode).not.toHaveBeenCalled();
    expect(mockWorkerPool.executePython).toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: 'success' });
  });

  it('should handle cancellation', () => {
    const handler = registerAndGetHandler('cancel-execution', 'on');
    handler({}, 'execution-id');
    expect(mockWorkerPool.cancelExecution).toHaveBeenCalledWith('execution-id');
  });

  // --- New tests below ---

  it('should default language to javascript when not specified', async () => {
    const handler = registerAndGetHandler('execute-code');
    (mockWorkerPool.executeCode as any).mockResolvedValue('ok');

    await handler(
      {},
      {
        code: 'let x = 1',
        // language intentionally omitted
        id: 'no-lang',
        options: {},
      }
    );

    // Should go through the JS path (transformCode + executeCode), not Python
    expect(mockTransformCode).toHaveBeenCalled();
    expect(mockWorkerPool.executeCode).toHaveBeenCalled();
    expect(mockWorkerPool.executePython).not.toHaveBeenCalled();
  });

  it('should apply default transform options when not provided', async () => {
    const handler = registerAndGetHandler('execute-code');
    (mockWorkerPool.executeCode as any).mockResolvedValue('ok');

    await handler(
      {},
      {
        code: 'let x = 1',
        language: 'javascript',
        id: 'defaults-test',
        options: {}, // all options omitted
      }
    );

    expect(mockTransformCode).toHaveBeenCalledWith('let x = 1', {
      showTopLevelResults: true,
      loopProtection: true,
      magicComments: false,
      showUndefined: false,
    });
  });

  it('should respect explicitly provided transform options', async () => {
    const handler = registerAndGetHandler('execute-code');
    (mockWorkerPool.executeCode as any).mockResolvedValue('ok');

    await handler(
      {},
      {
        code: 'let x = 1',
        language: 'javascript',
        id: 'explicit-opts',
        options: {
          showTopLevelResults: false,
          loopProtection: false,
          magicComments: true,
          showUndefined: true,
        },
      }
    );

    expect(mockTransformCode).toHaveBeenCalledWith('let x = 1', {
      showTopLevelResults: false,
      loopProtection: false,
      magicComments: true,
      showUndefined: true,
    });
  });

  it('should return error when transpilation fails', async () => {
    const handler = registerAndGetHandler('execute-code');
    mockTransformCode.mockImplementationOnce(() => {
      throw new Error('Unexpected token at line 3');
    });

    const result = await handler(
      {},
      {
        code: 'const x = {{{',
        language: 'typescript',
        id: 'bad-ts',
        options: {},
      }
    );

    expect(result).toEqual({
      success: false,
      error: 'Transpilation error: Unexpected token at line 3',
    });
    // Should NOT have attempted to execute the code
    expect(mockWorkerPool.executeCode).not.toHaveBeenCalled();
  });

  it('should return error when transpilation throws a non-Error', async () => {
    const handler = registerAndGetHandler('execute-code');
    mockTransformCode.mockImplementationOnce(() => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });

    const result = await handler(
      {},
      {
        code: 'bad code',
        language: 'javascript',
        id: 'non-error-throw',
        options: {},
      }
    );

    expect(result).toEqual({
      success: false,
      error: 'Transpilation error: string error',
    });
  });

  it('should return error when worker execution rejects', async () => {
    const handler = registerAndGetHandler('execute-code');
    (mockWorkerPool.executeCode as any).mockRejectedValue(
      new Error('Worker crashed')
    );

    const result = await handler(
      {},
      {
        code: 'while(true){}',
        language: 'javascript',
        id: 'crash-test',
        options: {},
      }
    );

    expect(result).toEqual({
      success: false,
      error: 'Worker crashed',
    });
  });

  it('should return error when Python execution rejects', async () => {
    const handler = registerAndGetHandler('execute-code');
    (mockWorkerPool.executePython as any).mockRejectedValue(
      new Error('Pyodide init failed')
    );

    const result = await handler(
      {},
      {
        code: 'import nonexistent',
        language: 'python',
        id: 'py-crash',
        options: {},
      }
    );

    expect(result).toEqual({
      success: false,
      error: 'Pyodide init failed',
    });
  });

  describe('is-worker-ready handler', () => {
    it('should return JS worker readiness', async () => {
      const handler = registerAndGetHandler('is-worker-ready');
      (mockWorkerPool.isCodeWorkerReady as any).mockReturnValue(true);

      const result = await handler({}, 'javascript');

      expect(mockWorkerPool.isCodeWorkerReady).toHaveBeenCalled();
      expect(mockWorkerPool.isPythonWorkerReady).not.toHaveBeenCalled();
      expect(result).toEqual({ ready: true });
    });

    it('should return Python worker readiness', async () => {
      const handler = registerAndGetHandler('is-worker-ready');
      (mockWorkerPool.isPythonWorkerReady as any).mockReturnValue(false);

      const result = await handler({}, 'python');

      expect(mockWorkerPool.isPythonWorkerReady).toHaveBeenCalled();
      expect(mockWorkerPool.isCodeWorkerReady).not.toHaveBeenCalled();
      expect(result).toEqual({ ready: false });
    });
  });

  describe('python-input-response handler', () => {
    it('should forward input response to Python worker', () => {
      const handler = registerAndGetHandler('python-input-response', 'on');
      const mockPythonWorker = { postMessage: mockPostMessage };
      (mockWorkerPool.getPythonWorker as any).mockReturnValue(mockPythonWorker);

      handler({}, { id: 'exec-1', value: 'user input', requestId: 'req-1' });

      expect(mockWorkerPool.getPythonWorker).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'input-response',
        id: 'exec-1',
        value: 'user input',
        requestId: 'req-1',
      });
    });

    it('should not crash when Python worker is unavailable', () => {
      const handler = registerAndGetHandler('python-input-response', 'on');
      (mockWorkerPool.getPythonWorker as any).mockReturnValue(null);

      // Should not throw
      expect(() => {
        handler({}, { id: 'exec-1', value: 'input' });
      }).not.toThrow();

      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('js-input-response handler', () => {
    it('should resolve JS input with provided value', () => {
      const handler = registerAndGetHandler('js-input-response', 'on');

      handler({}, { value: 'hello' });

      expect(mockWorkerPool.resolveJSInput).toHaveBeenCalledWith('hello');
    });
  });
});
