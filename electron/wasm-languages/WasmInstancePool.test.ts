/**
 * Tests para WasmInstancePool
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WasmInstancePool } from './WasmInstancePool.js';

vi.mock('./WasmExecutor.js', async () => {
  const actual = await vi.importActual('./WasmExecutor.js');
  return {
    ...actual,
    wasmExecutor: {
      createInstance: vi.fn(),
      disposeLanguage: vi.fn(),
    },
  };
});

describe('WasmInstancePool', () => {
  let pool: WasmInstancePool;

  beforeEach(() => {
    pool = new WasmInstancePool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    pool.dispose();
  });

  describe('acquire', () => {
    it('should acquire instance from pool', async () => {
      const mockInstance = {
        languageId: 'test',
        instance: {} as any,
        execute: vi.fn().mockResolvedValue({ exitCode: 0 }),
        reset: vi.fn(),
        dispose: vi.fn(),
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.createInstance).mockResolvedValue(
        mockInstance as any
      );

      const pooled = await pool.acquire('test');

      expect(pooled.languageId).toBe('test');
      expect(pooled.inUse).toBe(true);
      expect(pooled.executionCount).toBe(0);
    });

    it('should reuse idle instance', async () => {
      const mockInstance = {
        languageId: 'test',
        instance: {} as any,
        execute: vi.fn().mockResolvedValue({ exitCode: 0 }),
        reset: vi.fn(),
        dispose: vi.fn(),
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.createInstance).mockResolvedValue(
        mockInstance as any
      );

      const pooled1 = await pool.acquire('test');
      pool.release(pooled1);

      const pooled2 = await pool.acquire('test');

      expect(pooled2).toBe(pooled1);
      expect(wasmExecutor.createInstance).toHaveBeenCalledTimes(1);
    });

    it('should throw when max instances reached', async () => {
      const mockInstance = {
        languageId: 'test',
        instance: {} as any,
        execute: vi.fn().mockResolvedValue({ exitCode: 0 }),
        reset: vi.fn(),
        dispose: vi.fn(),
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.createInstance).mockResolvedValue(
        mockInstance as any
      );

      const poolConfig = { maxInstances: 2 };
      const smallPool = new WasmInstancePool(poolConfig);

      await smallPool.acquire('test');
      await smallPool.acquire('test');

      await expect(smallPool.acquire('test')).rejects.toThrow(
        'Maximum instances'
      );

      smallPool.dispose();
    });
  });

  describe('release', () => {
    it('should release instance back to pool', async () => {
      const mockInstance = {
        languageId: 'test',
        instance: {} as any,
        execute: vi.fn().mockResolvedValue({ exitCode: 0 }),
        reset: vi.fn(),
        dispose: vi.fn(),
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.createInstance).mockResolvedValue(
        mockInstance as any
      );

      const pooled = await pool.acquire('test');
      expect(pooled.inUse).toBe(true);

      pool.release(pooled);

      expect(pooled.inUse).toBe(false);
    });

    it('should recycle excess idle instances', async () => {
      const mockInstance = {
        languageId: 'test',
        instance: {} as any,
        execute: vi.fn().mockResolvedValue({ exitCode: 0 }),
        reset: vi.fn(),
        dispose: vi.fn(),
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.createInstance).mockResolvedValue(
        mockInstance as any
      );

      const poolConfig = { maxIdle: 1 };
      const smallPool = new WasmInstancePool(poolConfig);

      await smallPool.acquire('test');
      const p1 = await smallPool.acquire('test');
      const p2 = await smallPool.acquire('test');
      const p3 = await smallPool.acquire('test');

      smallPool.release(p1);
      smallPool.release(p2);
      smallPool.release(p3);

      expect(mockInstance.dispose).toHaveBeenCalledTimes(2);

      smallPool.dispose();
    });
  });

  describe('execute', () => {
    it('should execute code using pooled instance', async () => {
      const mockInstance = {
        languageId: 'test',
        instance: {} as any,
        execute: vi.fn().mockResolvedValue({
          exitCode: 0,
          stdout: 'Hello',
          stderr: '',
        }),
        reset: vi.fn(),
        dispose: vi.fn(),
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.createInstance).mockResolvedValue(
        mockInstance as any
      );

      const result = await pool.execute('test', 'code');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello');
      expect(mockInstance.execute).toHaveBeenCalledWith('code', undefined);
    });
  });

  describe('getStats', () => {
    it('should return pool statistics', async () => {
      const mockInstance = {
        languageId: 'test',
        instance: {} as any,
        execute: vi.fn().mockResolvedValue({ exitCode: 0 }),
        reset: vi.fn(),
        dispose: vi.fn(),
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.createInstance).mockResolvedValue(
        mockInstance as any
      );

      await pool.acquire('test');

      const stats = pool.getStats();

      expect(stats).toHaveProperty('test');
      expect(stats.test).toHaveProperty('total');
      expect(stats.test).toHaveProperty('inUse');
      expect(stats.test).toHaveProperty('idle');
      expect(stats.test).toHaveProperty('totalExecutions');
      expect(stats.test).toHaveProperty('maxInstances');
    });
  });

  describe('dispose', () => {
    it('should dispose all instances', async () => {
      const mockInstance = {
        languageId: 'test',
        instance: {} as any,
        execute: vi.fn().mockResolvedValue({ exitCode: 0 }),
        reset: vi.fn(),
        dispose: vi.fn(),
      };

      const { wasmExecutor } = await import('./WasmExecutor.js');
      vi.mocked(wasmExecutor.createInstance).mockResolvedValue(
        mockInstance as any
      );

      await pool.acquire('test');
      await pool.acquire('test');

      pool.dispose();

      expect(mockInstance.dispose).toHaveBeenCalledTimes(2);
    });
  });
});
