import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkerPoolManager } from '../../electron/core/WorkerPoolManager';
import {
  DEFAULT_RUNTIME_PROVIDER_ID,
  getRuntimeExecutionProvider,
  resolveRuntimeExecutionProvider,
} from '../../electron/core/runtimeProviderRegistry';

const { mockGetRuntimeProviderId } = vi.hoisted(() => ({
  mockGetRuntimeProviderId: vi.fn((language: string) => {
    if (language === 'python') return 'pyodide';
    if (language === 'c' || language === 'cpp') return 'wasi-clang';
    return 'node-vm';
  }),
}));

vi.mock('@cheesejs/languages', () => ({
  getRuntimeProviderId: mockGetRuntimeProviderId,
}));

const mockWorkerPool = {
  executeCode: vi.fn(),
  executePython: vi.fn(),
  executeWasi: vi.fn(),
  isCodeWorkerReady: vi.fn(),
  isPythonWorkerReady: vi.fn(),
  isWasiWorkerReady: vi.fn(),
} as unknown as WorkerPoolManager;

const mockTransformCode = vi.fn((code: string) => `transformed:${code}`);

describe('runtimeProviderRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeProviderId.mockImplementation((language: string) => {
      if (language === 'python') return 'pyodide';
      if (language === 'c' || language === 'cpp') return 'wasi-clang';
      return 'node-vm';
    });
  });

  it('should expose the node runtime as the default provider', () => {
    const provider = getRuntimeExecutionProvider(DEFAULT_RUNTIME_PROVIDER_ID);

    expect(provider?.id).toBe('node-vm');
  });

  it('should execute node-vm requests through transformed code', async () => {
    const provider = getRuntimeExecutionProvider('node-vm');
    (mockWorkerPool.executeCode as any).mockResolvedValue('ok');

    const result = await provider?.execute({
      request: {
        id: 'js-test',
        code: 'const x = 1',
        language: 'javascript',
        options: {},
      },
      workerPool: mockWorkerPool,
      transformCode: mockTransformCode,
    });

    expect(mockTransformCode).toHaveBeenCalledWith('const x = 1', {
      showTopLevelResults: true,
      loopProtection: true,
      magicComments: false,
      showUndefined: false,
    });
    expect(mockWorkerPool.executeCode).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'javascript' }),
      'transformed:const x = 1'
    );
    expect(result).toBe('ok');
  });

  it('should execute pyodide requests without code transformation', async () => {
    const provider = getRuntimeExecutionProvider('pyodide');
    (mockWorkerPool.executePython as any).mockResolvedValue('py-ok');

    const result = await provider?.execute({
      request: {
        id: 'py-test',
        code: 'print("hello")',
        language: 'python',
        options: {},
      },
      workerPool: mockWorkerPool,
      transformCode: mockTransformCode,
    });

    expect(mockTransformCode).not.toHaveBeenCalled();
    expect(mockWorkerPool.executePython).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'python' })
    );
    expect(result).toBe('py-ok');
  });

  it('should resolve providers from the language registry', () => {
    expect(resolveRuntimeExecutionProvider('python')?.id).toBe('pyodide');
    expect(resolveRuntimeExecutionProvider('c')?.id).toBe('wasi-clang');
    expect(resolveRuntimeExecutionProvider('javascript')?.id).toBe('node-vm');
  });

  it('should execute WASI requests without code transformation', async () => {
    const provider = getRuntimeExecutionProvider('wasi-clang');
    (mockWorkerPool.executeWasi as any).mockResolvedValue('wasi-ok');

    const result = await provider?.execute({
      request: {
        id: 'cpp-test',
        code: '#include <iostream>\nint main(){return 0;}',
        language: 'cpp',
        options: {},
      },
      workerPool: mockWorkerPool,
      transformCode: mockTransformCode,
    });

    expect(mockTransformCode).not.toHaveBeenCalled();
    expect(mockWorkerPool.executeWasi).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'cpp' })
    );
    expect(result).toBe('wasi-ok');
  });

  it('should fall back to the default provider when no runtime is declared', () => {
    mockGetRuntimeProviderId.mockReturnValueOnce(undefined);

    expect(resolveRuntimeExecutionProvider('markdown')?.id).toBe('node-vm');
  });
});
