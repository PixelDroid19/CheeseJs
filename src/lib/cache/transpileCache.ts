/**
 * Transpilation Cache
 * 
 * Provides persistent caching for transpiled code to avoid redundant
 * transpilation of unchanged code. Uses content hashing for cache keys.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CacheEntry {
  /** Hash of the original code */
  hash: string;
  /** Transpiled code output */
  output: string;
  /** Options used for transpilation */
  options: TranspileOptions;
  /** Timestamp when cached */
  timestamp: number;
  /** Number of times this entry was used */
  hitCount: number;
}

export interface TranspileOptions {
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
  magicComments?: boolean;
  showUndefined?: boolean;
  language?: 'javascript' | 'typescript';
}

export interface CacheStats {
  /** Total number of entries */
  size: number;
  /** Cache hit count */
  hits: number;
  /** Cache miss count */
  misses: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Total memory used (approximate) */
  memoryBytes: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_MAX_SIZE = 100; // Maximum cache entries
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = 'cheesejs-transpile-cache';

// ============================================================================
// TRANSPILE CACHE CLASS
// ============================================================================

export class TranspileCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private maxAgeMs: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = DEFAULT_MAX_SIZE, maxAgeMs: number = DEFAULT_MAX_AGE_MS) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.maxAgeMs = maxAgeMs;
    
    // Try to load from localStorage
    this.loadFromStorage();
  }

  /**
   * Generate a hash from code and options
   * Uses a fast string hash for performance
   */
  private generateHash(code: string, options: TranspileOptions): string {
    // Include relevant options in the hash
    const optionsStr = JSON.stringify({
      showTopLevelResults: options.showTopLevelResults,
      loopProtection: options.loopProtection,
      magicComments: options.magicComments,
      language: options.language,
    });
    
    const combined = code + '|' + optionsStr;
    return this.fastHash(combined);
  }

  /**
   * Fast string hash function (djb2)
   */
  private fastHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached transpiled code if available
   */
  get(code: string, options: TranspileOptions): string | null {
    const hash = this.generateHash(code, options);
    const entry = this.cache.get(hash);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.maxAgeMs) {
      this.cache.delete(hash);
      this.misses++;
      return null;
    }
    
    // Update hit count and access time
    entry.hitCount++;
    this.hits++;
    
    return entry.output;
  }

  /**
   * Store transpiled code in cache
   */
  set(code: string, output: string, options: TranspileOptions): void {
    const hash = this.generateHash(code, options);
    
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }
    
    this.cache.set(hash, {
      hash,
      output,
      options,
      timestamp: Date.now(),
      hitCount: 0,
    });
    
    // Persist to storage (debounced)
    this.scheduleStorageSave();
  }

  /**
   * Check if code is cached
   */
  has(code: string, options: TranspileOptions): boolean {
    const hash = this.generateHash(code, options);
    const entry = this.cache.get(hash);
    
    if (!entry) return false;
    
    // Check expiration
    if (Date.now() - entry.timestamp > this.maxAgeMs) {
      this.cache.delete(hash);
      return false;
    }
    
    return true;
  }

  /**
   * Invalidate cache entry for specific code
   */
  invalidate(code: string, options: TranspileOptions): boolean {
    const hash = this.generateHash(code, options);
    return this.cache.delete(hash);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.saveToStorage();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    let memoryBytes = 0;
    
    for (const entry of this.cache.values()) {
      // Rough estimate: hash + output + metadata
      memoryBytes += entry.hash.length * 2;
      memoryBytes += entry.output.length * 2;
      memoryBytes += 100; // metadata overhead
    }
    
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
      memoryBytes,
    };
  }

  /**
   * Evict least recently used / least hit entries
   */
  private evictLeastUsed(): void {
    // Find entry with lowest hit count and oldest timestamp
    let leastUsedHash: string | null = null;
    let leastUsedScore = Infinity;
    
    for (const [hash, entry] of this.cache) {
      // Score based on hit count and recency
      const age = Date.now() - entry.timestamp;
      const score = entry.hitCount - (age / this.maxAgeMs);
      
      if (score < leastUsedScore) {
        leastUsedScore = score;
        leastUsedHash = hash;
      }
    }
    
    if (leastUsedHash) {
      this.cache.delete(leastUsedHash);
    }
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [hash, entry] of this.cache) {
      if (now - entry.timestamp > this.maxAgeMs) {
        this.cache.delete(hash);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.scheduleStorageSave();
    }
    
    return removed;
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Schedule a debounced save to storage
   */
  private scheduleStorageSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveToStorage();
    }, 1000);
  }

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      
      const data = {
        version: 1,
        entries: Array.from(this.cache.entries()),
        stats: { hits: this.hits, misses: this.misses },
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // localStorage might be full or unavailable
      console.warn('[TranspileCache] Failed to save to storage:', e);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      
      if (data.version !== 1) {
        // Incompatible version, clear storage
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      
      // Restore entries
      this.cache = new Map(data.entries);
      this.hits = data.stats?.hits ?? 0;
      this.misses = data.stats?.misses ?? 0;
      
      // Cleanup expired entries
      this.cleanup();
      
      console.log(`[TranspileCache] Loaded ${this.cache.size} entries from storage`);
    } catch (e) {
      console.warn('[TranspileCache] Failed to load from storage:', e);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let cacheInstance: TranspileCache | null = null;

/**
 * Get the global transpile cache instance
 */
export function getTranspileCache(): TranspileCache {
  if (!cacheInstance) {
    cacheInstance = new TranspileCache();
  }
  return cacheInstance;
}

/**
 * Reset the cache instance (for testing)
 */
export function resetTranspileCache(): void {
  if (cacheInstance) {
    cacheInstance.clear();
  }
  cacheInstance = null;
}

