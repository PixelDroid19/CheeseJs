/**
 * Tests para WasmExecutor
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WasmExecutor } from './WasmExecutor.js';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
  readFile: vi.fn(),
}));

vi.mock('./WasmLanguageModule.js', async () => {
  const actual = await vi.importActual('./WasmLanguageModule.js');
  return {
    ...actual,
    DEFAULT_WASM_OPTIONS: {
      timeout: 5000,
      memoryLimit: 128 * 1024 * 1024,
      captureStdout: true,
      captureStderr: true,
      env: {},
    },
  };
});

describe('WasmExecutor', () => {
  let executor: WasmExecutor;
  const mockPluginPath = '/mock/plugins/test-lang';

  // Get the mock after the vi.mock has been applied
  const getMockReadFile = async () => {
    const fs = await import('fs/promises');
    return (fs as any).default.readFile;
  };

  beforeEach(() => {
    executor = new WasmExecutor();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    executor.dispose();
  });

  describe('loadModule', () => {
    it('should load WASM module successfully', async () => {
      const mockWasmBuffer = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
      const mockReadFile = await getMockReadFile();

      mockReadFile.mockResolvedValue(Buffer.from(mockWasmBuffer.buffer));

      const mockModule = {
        exports: { run: vi.fn() },
      } as unknown as WebAssembly.Module;

      vi.spyOn(WebAssembly, 'compile').mockResolvedValue(mockModule);

      const config = {
        id: 'test',
        name: 'Test',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const module = await executor.loadModule(mockPluginPath, config);

      expect(module).toBe(mockModule);
      expect(WebAssembly.compile).toHaveBeenCalled();
    });

    it('should throw if WASM file not found', async () => {
      const mockReadFile = await getMockReadFile();
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const config = {
        id: 'test',
        name: 'Test',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      await expect(
        executor.loadModule(mockPluginPath, config)
      ).rejects.toThrow();
    });
  });

  describe('createInstance', () => {
    it('should create WASM instance', async () => {
      const mockWasmBuffer = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
      const mockReadFile = await getMockReadFile();

      mockReadFile.mockResolvedValue(Buffer.from(mockWasmBuffer.buffer));

      const mockInstance = {
        exports: {
          run: vi.fn().mockReturnValue(0),
        },
      };

      const mockModule = {} as WebAssembly.Module;

      vi.spyOn(WebAssembly, 'compile').mockResolvedValue(mockModule);
      vi.spyOn(WebAssembly, 'instantiate').mockResolvedValue(
        mockInstance as any
      );

      const config = {
        id: 'test',
        name: 'Test',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      await executor.loadModule(mockPluginPath, config);

      const instance = await executor.createInstance('test');

      expect(instance).toBeDefined();
      expect(instance.languageId).toBe('test');
      expect(typeof instance.execute).toBe('function');
      expect(typeof instance.reset).toBe('function');
      expect(typeof instance.dispose).toBe('function');
    });
  });

  describe('execute', () => {
    it('should execute code successfully', async () => {
      const mockWasmBuffer = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
      const mockReadFile = await getMockReadFile();

      mockReadFile.mockResolvedValue(Buffer.from(mockWasmBuffer.buffer));

      const mockInstance = {
        exports: {
          run: vi.fn().mockReturnValue(0),
        },
      };

      const mockModule = {} as WebAssembly.Module;

      vi.spyOn(WebAssembly, 'compile').mockResolvedValue(mockModule);
      vi.spyOn(WebAssembly, 'instantiate').mockResolvedValue(
        mockInstance as any
      );

      const config = {
        id: 'test',
        name: 'Test',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      await executor.loadModule(mockPluginPath, config);
      const instance = await executor.createInstance('test');

      const result = await instance.execute('print("test")');

      expect(result.exitCode).toBe(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStats', () => {
    it('should return executor statistics', async () => {
      const stats = executor.getStats();

      expect(stats).toHaveProperty('loadedModules');
      expect(stats).toHaveProperty('activeInstances');
      expect(stats).toHaveProperty('languages');
      expect(Array.isArray(stats.languages)).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clean up old instances', async () => {
      const mockWasmBuffer = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
      const mockReadFile = await getMockReadFile();

      mockReadFile.mockResolvedValue(Buffer.from(mockWasmBuffer.buffer));

      const mockInstance = {
        exports: {
          run: vi.fn().mockReturnValue(0),
        },
      };

      const mockModule = {} as WebAssembly.Module;

      vi.spyOn(WebAssembly, 'compile').mockResolvedValue(mockModule);
      vi.spyOn(WebAssembly, 'instantiate').mockResolvedValue(
        mockInstance as any
      );

      const config = {
        id: 'test',
        name: 'Test',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      await executor.loadModule(mockPluginPath, config);
      await executor.createInstance('test');

      executor.cleanup();

      const stats = executor.getStats();
      expect(stats.activeInstances).toBe(1);
    });
  });
});
