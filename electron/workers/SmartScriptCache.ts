/**
 * Smart Script Cache - LRU-K Cache with Memory Limits
 *
 * Features:
 * - Memory-based limits instead of count-based
 * - LRU-K eviction (considers last K accesses)
 * - Metrics for monitoring cache performance
 * - SHA-256 hashing for cache keys
 */

import vm from 'vm';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface CachedScript {
  script: vm.Script;
  code: string;
  size: number; // Estimated memory size in bytes
  lastUsed: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalAccessTime: number;
  currentMemory: number;
  maxMemory: number;
}

interface SmartScriptCacheOptions {
  maxMemory?: number; // Max memory in bytes (default 50MB)
  k?: number; // K value for LRU-K (default 2)
}

export type { SmartScriptCacheOptions };

// ============================================================================
// SMART SCRIPT CACHE
// ============================================================================

export class SmartScriptCache {
  private cache: Map<string, CachedScript>;
  private accessHistory: Map<string, number[]>; // Track last K access times
  private readonly maxMemory: number;
  private readonly K: number;
  private currentMemory: number = 0;

  private metrics: CacheMetrics;

  constructor(options: SmartScriptCacheOptions = {}) {
    this.maxMemory = options.maxMemory ?? 50 * 1024 * 1024; // 50MB default
    this.K = options.k ?? 2;
    this.cache = new Map();
    this.accessHistory = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalAccessTime: 0,
      currentMemory: 0,
      maxMemory: this.maxMemory,
    };
  }

  /**
   * Generate SHA-256 hash for code string
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  }

  /**
   * Estimate memory size of a script (code length + overhead)
   */
  private estimateSize(code: string): number {
    // Rough estimate: code bytes + 2KB overhead for compiled script object
    return Buffer.byteLength(code, 'utf8') + 2048;
  }

  /**
   * Record access time for LRU-K algorithm
   */
  private recordAccess(key: string): void {
    const now = Date.now();
    const history = this.accessHistory.get(key) ?? [];
    history.push(now);

    // Keep only last K+1 accesses for K-th access calculation
    if (history.length > this.K + 1) {
      history.shift();
    }

    this.accessHistory.set(key, history);
  }

  /**
   * Get K-th access time for eviction decision
   */
  private getKthAccessTime(key: string): number {
    const history = this.accessHistory.get(key);
    if (!history || history.length < this.K) {
      return 0; // Not enough accesses, prioritize for eviction
    }
    return history[history.length - this.K];
  }

  /**
   * Get or create a compiled script from cache
   */
  getOrCreate(code: string): vm.Script {
    const startTime = performance.now();
    const key = this.hashCode(code);

    const cached = this.cache.get(key);
    if (cached && cached.code === code) {
      // Cache hit
      this.metrics.hits++;
      cached.lastUsed = Date.now();
      this.recordAccess(key);
      this.metrics.totalAccessTime += performance.now() - startTime;
      return cached.script;
    }

    // Cache miss - create new script
    this.metrics.misses++;

    const script = new vm.Script(code, {
      filename: 'usercode.js',
      lineOffset: -2,
      columnOffset: 0,
    });

    const size = this.estimateSize(code);

    // Ensure we have space for the new script
    this.ensureSpace(size);

    // Add to cache
    this.cache.set(key, {
      script,
      code,
      size,
      lastUsed: Date.now(),
    });

    this.currentMemory += size;
    this.metrics.currentMemory = this.currentMemory;
    this.recordAccess(key);

    this.metrics.totalAccessTime += performance.now() - startTime;

    return script;
  }

  /**
   * Ensure there's enough space for a new entry
   */
  private ensureSpace(neededSize: number): void {
    while (
      this.currentMemory + neededSize > this.maxMemory &&
      this.cache.size > 0
    ) {
      this.evictOne();
    }
  }

  /**
   * Evict one entry using LRU-K algorithm
   */
  private evictOne(): void {
    let minKthAccess = Infinity;
    let evictKey: string | null = null;

    // Find entry with oldest K-th access
    for (const [key] of this.cache) {
      const kthAccess = this.getKthAccessTime(key);
      if (kthAccess < minKthAccess) {
        minKthAccess = kthAccess;
        evictKey = key;
      }
    }

    if (evictKey) {
      const entry = this.cache.get(evictKey);
      if (entry) {
        this.currentMemory -= entry.size;
      }
      this.cache.delete(evictKey);
      this.accessHistory.delete(evictKey);
      this.metrics.evictions++;
      this.metrics.currentMemory = this.currentMemory;
    }
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessHistory.clear();
    this.currentMemory = 0;
    this.metrics.currentMemory = 0;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics & { hitRate: number; size: number } {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
      size: this.cache.size,
    };
  }

  /**
   * Log metrics summary
   */
  logMetrics(): void {
    // Metrics logging disabled for performance
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let scriptCacheInstance: SmartScriptCache | null = null;

export function getScriptCache(
  options?: SmartScriptCacheOptions
): SmartScriptCache {
  if (!scriptCacheInstance) {
    scriptCacheInstance = new SmartScriptCache(options);
  }
  return scriptCacheInstance;
}

export function clearScriptCache(): void {
  if (scriptCacheInstance) {
    scriptCacheInstance.clear();
  }
}
