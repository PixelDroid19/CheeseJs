/**
 * WASM Instance Pool
 *
 * Manages a pool of WebAssembly instances for concurrent execution.
 * Implements instance reuse, resource limits, and automatic cleanup.
 */

import { createMainLogger } from '../core/logger.js';
import { wasmExecutor } from './WasmExecutor.js';
import type {
  WasmExecutionOptions,
  WasmExecutionResult,
  WasmInstance,
} from './WasmLanguageModule.js';

const log = createMainLogger('WasmInstancePool');

// ============================================================================
// TYPES
// ============================================================================

export interface PoolConfig {
  /** Maximum number of instances per language */
  maxInstances?: number;
  /** Maximum number of idle instances to keep */
  maxIdle?: number;
  /** Time before idle instance is recycled (ms) */
  idleTimeout?: number;
  /** Memory limit per instance (bytes) */
  memoryLimit?: number;
}

export interface PooledInstance {
  instance: WasmInstance;
  inUse: boolean;
  lastUsed: number;
  executionCount: number;
  languageId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_POOL_CONFIG: Required<PoolConfig> = {
  maxInstances: 4,
  maxIdle: 2,
  idleTimeout: 120000, // 2 minutes
  memoryLimit: 128 * 1024 * 1024, // 128MB
};

// ============================================================================
// WASM INSTANCE POOL CLASS
// ============================================================================

export class WasmInstancePool {
  private pools: Map<string, PooledInstance[]> = new Map();
  private config: Required<PoolConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: PoolConfig) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Acquire an instance from the pool
   */
  async acquire(languageId: string): Promise<PooledInstance> {
    const pool = this.getPool(languageId);

    let instance = pool.find((p) => !p.inUse);

    if (instance) {
      log.debug(`[WasmInstancePool] Reusing idle instance: ${languageId}`);
      instance.inUse = true;
      instance.lastUsed = Date.now();
      return instance;
    }

    if (pool.length >= this.config.maxInstances) {
      throw new Error(
        `Maximum instances (${this.config.maxInstances}) reached for language ${languageId}`
      );
    }

    log.debug(`[WasmInstancePool] Creating new instance: ${languageId}`);
    const wasmInstance = await wasmExecutor.createInstance(languageId);

    const pooledInstance: PooledInstance = {
      instance: wasmInstance,
      inUse: true,
      lastUsed: Date.now(),
      executionCount: 0,
      languageId,
    };

    pool.push(pooledInstance);
    return pooledInstance;
  }

  /**
   * Release an instance back to the pool
   */
  release(instance: PooledInstance): void {
    log.debug(`[WasmInstancePool] Releasing instance: ${instance.languageId}`);

    instance.inUse = false;
    instance.lastUsed = Date.now();

    const pool = this.getPool(instance.languageId);

    const idleCount = pool.filter((p) => !p.inUse).length;

    if (idleCount > this.config.maxIdle) {
      this.recycleInstance(instance);
    }
  }

  /**
   * Execute code using a pooled instance
   */
  async execute(
    languageId: string,
    code: string,
    options?: WasmExecutionOptions
  ): Promise<WasmExecutionResult> {
    const instance = await this.acquire(languageId);

    try {
      const result = await instance.instance.execute(code, options);
      instance.executionCount++;
      return result;
    } finally {
      this.release(instance);
    }
  }

  /**
   * Reset all instances for a language
   */
  resetLanguage(languageId: string): void {
    const pool = this.pools.get(languageId);
    if (!pool) return;

    for (const pooled of pool) {
      pooled.instance.reset();
    }

    log.debug(`[WasmInstancePool] Reset all instances for: ${languageId}`);
  }

  /**
   * Dispose all instances for a language
   */
  disposeLanguage(languageId: string): void {
    const pool = this.pools.get(languageId);
    if (!pool) return;

    for (const pooled of pool) {
      pooled.instance.dispose();
    }

    this.pools.delete(languageId);
    wasmExecutor.disposeLanguage(languageId);

    log.info(`[WasmInstancePool] Disposed pool for: ${languageId}`);
  }

  /**
   * Get pool for a language (create if needed)
   */
  private getPool(languageId: string): PooledInstance[] {
    let pool = this.pools.get(languageId);
    if (!pool) {
      pool = [];
      this.pools.set(languageId, pool);
    }
    return pool;
  }

  /**
   * Recycle an instance
   */
  private recycleInstance(instance: PooledInstance): void {
    const pool = this.getPool(instance.languageId);
    const index = pool.indexOf(instance);

    if (index !== -1) {
      pool.splice(index, 1);
      instance.instance.dispose();
      log.debug(`[WasmInstancePool] Recycled instance: ${instance.languageId}`);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Check every minute
  }

  /**
   * Cleanup idle instances
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [languageId, pool] of this.pools.entries()) {
      const idleInstances = pool.filter(
        (p) => !p.inUse && now - p.lastUsed > this.config.idleTimeout
      );

      if (idleInstances.length > 0) {
        log.info(
          `[WasmInstancePool] Cleaning up ${idleInstances.length} idle instances for ${languageId}`
        );

        for (const instance of idleInstances) {
          this.recycleInstance(instance);
        }
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Dispose all pools
   */
  dispose(): void {
    this.stop();

    // Convert to array first to avoid iterator invalidation
    const languageIds = Array.from(this.pools.keys());
    for (const languageId of languageIds) {
      this.disposeLanguage(languageId);
    }

    this.pools.clear();
    log.info('[WasmInstancePool] All pools disposed');
  }

  /**
   * Get pool statistics
   */
  getStats(): Record<string, PoolStats> {
    const stats: Record<string, PoolStats> = {};

    for (const [languageId, pool] of this.pools.entries()) {
      const inUse = pool.filter((p) => p.inUse).length;
      const idle = pool.filter((p) => !p.inUse).length;
      const totalExecutions = pool.reduce(
        (sum, p) => sum + p.executionCount,
        0
      );

      stats[languageId] = {
        total: pool.length,
        inUse,
        idle,
        totalExecutions,
        maxInstances: this.config.maxInstances,
      };
    }

    return stats;
  }
}

export interface PoolStats {
  total: number;
  inUse: number;
  idle: number;
  totalExecutions: number;
  maxInstances: number;
}

// Export default pool instance
export const wasmInstancePool = new WasmInstancePool();
