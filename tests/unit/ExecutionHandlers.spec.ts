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
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userdata'),
  },
}));

// Mock WorkerPoolManager
const mockWorkerPool = {
  executeCode: vi.fn(),
  executePython: vi.fn(),
  cancelExecution: vi.fn(),
  isCodeWorkerReady: vi.fn(),
  isPythonWorkerReady: vi.fn(),
  getPythonWorker: vi.fn(),
} as unknown as WorkerPoolManager;

// Mock transformCode
const mockTransformCode = vi.fn((code) => code);

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
  });

  it('should handle Javascript execution', async () => {
    registerExecutionHandlers({
      workerPool: mockWorkerPool,
      transformCode: mockTransformCode,
    });

    const handler = (ipcMain.handle as any).mock.calls.find(
      (call: any[]) => call[0] === 'execute-code'
    )[1];

    // Mock execution result
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
    registerExecutionHandlers({
      workerPool: mockWorkerPool,
      transformCode: mockTransformCode,
    });

    const handler = (ipcMain.handle as any).mock.calls.find(
      (call: any[]) => call[0] === 'execute-code'
    )[1];

    // Mock execution result
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

    expect(mockTransformCode).not.toHaveBeenCalled(); // Python code is not transformed
    expect(mockWorkerPool.executePython).toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: 'success' });
  });

  it('should handle cancellation', () => {
    registerExecutionHandlers({
      workerPool: mockWorkerPool,
      transformCode: mockTransformCode,
    });

    const handler = (ipcMain.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'cancel-execution'
    )[1];

    handler({}, 'execution-id');

    expect(mockWorkerPool.cancelExecution).toHaveBeenCalledWith('execution-id');
  });
});
