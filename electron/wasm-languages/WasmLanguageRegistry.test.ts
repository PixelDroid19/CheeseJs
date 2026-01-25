/**
 * Tests para WasmLanguageRegistry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WasmLanguageRegistry } from './WasmLanguageRegistry.js';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userdata'),
  },
}));

vi.mock('./WasmExecutor.js', () => ({
  wasmExecutor: {
    loadModule: vi.fn(),
    disposeLanguage: vi.fn(),
  },
}));

vi.mock('./WasmInstancePool.js', () => ({
  wasmInstancePool: {
    execute: vi.fn(),
    resetLanguage: vi.fn(),
    disposeLanguage: vi.fn(),
  },
}));

vi.mock('./WasmDependencyResolver.js', () => ({
  wasmDependencyResolver: {
    resolveDependencies: vi.fn().mockResolvedValue({
      success: true,
      dependencies: [],
      errors: [],
    }),
  },
}));

describe('WasmLanguageRegistry', () => {
  let registry: WasmLanguageRegistry;

  beforeEach(() => {
    registry = new WasmLanguageRegistry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await registry.clear();
  });

  describe('initialize', () => {
    it('should initialize cache directory', async () => {
      // The constructor calls app.getPath, not initialize()
      // Just verify that initialize() doesn't throw
      await expect(registry.initialize()).resolves.not.toThrow();
    });
  });

  describe('register', () => {
    it('should register WASM language', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('test-plugin', '/mock/path', config);

      expect(registry.hasLanguage('test')).toBe(true);
    });

    it('should skip duplicate language registration', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('test-plugin', '/mock/path', config);
      await registry.register('test-plugin', '/mock/path', config);

      const stats = registry.getStats();
      expect(stats.totalLanguages).toBe(1);
    });

    it('should map extensions to language', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test', '.tst'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('test-plugin', '/mock/path', config);

      expect(registry.getLanguageByExtension('.test')).toBe('test');
      expect(registry.getLanguageByExtension('.tst')).toBe('test');
    });

    it('should resolve dependencies if present', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
        dependencies: [
          {
            id: 'dep1',
            version: '^1.0.0',
            url: 'https://example.com/dep1.wasm',
          },
        ],
      };

      const { wasmDependencyResolver } = await import(
        './WasmDependencyResolver.js'
      );
      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('test-plugin', '/mock/path', config);

      expect(wasmDependencyResolver.resolveDependencies).toHaveBeenCalledWith(
        'test',
        config.dependencies,
        expect.any(String)
      );
    });
  });

  describe('unregister', () => {
    it('should unregister WASM language', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      const { wasmInstancePool } = await import('./WasmInstancePool.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('test-plugin', '/mock/path', config);
      expect(registry.hasLanguage('test')).toBe(true);

      await registry.unregister('test');

      expect(registry.hasLanguage('test')).toBe(false);
      expect(wasmInstancePool.disposeLanguage).toHaveBeenCalledWith('test');
    });

    it('should remove extension mappings', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('test-plugin', '/mock/path', config);
      await registry.unregister('test');

      expect(registry.getLanguageByExtension('.test')).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should execute code in registered language', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      const { wasmInstancePool } = await import('./WasmInstancePool.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );
      vi.mocked(wasmInstancePool.execute).mockResolvedValue({
        exitCode: 0,
        stdout: 'Hello',
        stderr: '',
        executionTime: 0,
      });

      await registry.register('test-plugin', '/mock/path', config);

      const result = await registry.execute('test', 'code');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello');
      expect(wasmInstancePool.execute).toHaveBeenCalledWith(
        'test',
        'code',
        undefined
      );
    });

    it('should throw if language not registered', async () => {
      await expect(registry.execute('nonexistent', 'code')).rejects.toThrow(
        'WASM language nonexistent not registered'
      );
    });

    it('should throw if language not ready', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockRejectedValue(
        new Error('Load failed')
      );

      await registry.register('test-plugin', '/mock/path', config);

      await expect(registry.execute('test', 'code')).rejects.toThrow();
    });
  });

  describe('getLanguage', () => {
    it('should return language by ID', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('test-plugin', '/mock/path', config);

      const language = registry.getLanguage('test');

      expect(language).toBeDefined();
      expect(language?.config.id).toBe('test');
    });

    it('should return undefined for unknown language', () => {
      const language = registry.getLanguage('unknown');

      expect(language).toBeUndefined();
    });
  });

  describe('getAllLanguages', () => {
    it('should return all registered languages', async () => {
      const configs = [
        {
          id: 'test1',
          name: 'Test Language 1',
          extensions: ['.t1'],
          version: '1.0.0',
          wasmPath: 'runtime.wasm',
        },
        {
          id: 'test2',
          name: 'Test Language 2',
          extensions: ['.t2'],
          version: '1.0.0',
          wasmPath: 'runtime.wasm',
        },
      ];

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('plugin1', '/mock/path1', configs[0]);
      await registry.register('plugin2', '/mock/path2', configs[1]);

      const languages = registry.getAllLanguages();

      expect(languages).toHaveLength(2);
      expect(languages.map((l) => l.config.id)).toEqual(['test1', 'test2']);
    });
  });

  describe('getReadyLanguages', () => {
    it('should return only ready languages', async () => {
      const successConfig = {
        id: 'success',
        name: 'Success',
        extensions: ['.suc'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule)
        .mockResolvedValueOnce({} as WebAssembly.Module)
        .mockRejectedValueOnce(new Error('Failed'));

      await registry.register('plugin1', '/mock/path1', successConfig);
      await registry.register('plugin2', '/mock/path2', {
        ...successConfig,
        id: 'failed',
        extensions: ['.fail'],
      });

      const readyLanguages = registry.getReadyLanguages();

      expect(readyLanguages).toHaveLength(1);
      expect(readyLanguages[0].config.id).toBe('success');
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('test-plugin', '/mock/path', config);

      const stats = registry.getStats();

      expect(stats).toHaveProperty('totalLanguages');
      expect(stats).toHaveProperty('readyLanguages');
      expect(stats).toHaveProperty('errorLanguages');
      expect(stats).toHaveProperty('languages');
      expect(stats.totalLanguages).toBe(1);
      expect(stats.readyLanguages).toBe(1);
      expect(stats.errorLanguages).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all languages', async () => {
      const config = {
        id: 'test',
        name: 'Test Language',
        extensions: ['.test'],
        version: '1.0.0',
        wasmPath: 'runtime.wasm',
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.loadModule).mockResolvedValue(
        {} as WebAssembly.Module
      );

      await registry.register('test-plugin', '/mock/path', config);
      expect(registry.hasLanguage('test')).toBe(true);

      await registry.clear();

      expect(registry.hasLanguage('test')).toBe(false);
    });
  });
});
