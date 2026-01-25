/**
 * WASM Dependency Resolver
 *
 * Manages WebAssembly module dependencies.
 * Handles downloading, caching, and validation of WASM dependencies.
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { createMainLogger } from '../core/logger.js';
import type { WasmDependency } from './WasmLanguageModule.js';

const log = createMainLogger('WasmDependencyResolver');

// ============================================================================
// TYPES
// ============================================================================

export interface ResolvedDependency {
  dependency: WasmDependency;
  filePath: string;
  checksum?: string;
  loadedAt: number;
}

export interface DependencyResolutionResult {
  success: boolean;
  dependencies: ResolvedDependency[];
  errors: Array<{ id: string; error: string }>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_VERSION = 1;
const DEPENDENCIES_FILE = 'dependencies.json';

// ============================================================================
// DEPENDENCY CACHE
// ============================================================================

interface DependencyCache {
  version: number;
  dependencies: Record<string, CachedDependency>;
}

interface CachedDependency {
  id: string;
  version?: string;
  filePath: string;
  checksum?: string;
  downloadedAt: number;
  expiresAt?: number;
}

// ============================================================================
// WASM DEPENDENCY RESOLVER CLASS
// ============================================================================

export class WasmDependencyResolver {
  private cache: Map<string, CachedDependency> = new Map();
  private cacheFilePath: string;

  constructor(cacheDir: string) {
    this.cacheFilePath = path.join(cacheDir, DEPENDENCIES_FILE);
  }

  /**
   * Initialize resolver
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      const cache: DependencyCache = JSON.parse(data);

      if (cache.version === CACHE_VERSION) {
        for (const [id, dep] of Object.entries(cache.dependencies)) {
          const now = Date.now();

          if (!dep.expiresAt || dep.expiresAt > now) {
            this.cache.set(id, dep);
          }
        }

        log.debug(
          `[WasmDependencyResolver] Loaded ${this.cache.size} cached dependencies`
        );
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        log.warn('[WasmDependencyResolver] Failed to load cache:', error);
      }
    }
  }

  /**
   * Resolve dependencies for a language
   */
  async resolveDependencies(
    languageId: string,
    dependencies: WasmDependency[],
    cacheDir: string
  ): Promise<DependencyResolutionResult> {
    const result: DependencyResolutionResult = {
      success: true,
      dependencies: [],
      errors: [],
    };

    log.info(
      `[WasmDependencyResolver] Resolving ${dependencies.length} dependencies for ${languageId}`
    );

    for (const dep of dependencies) {
      try {
        const resolved = await this.resolveDependency(dep, cacheDir);
        result.dependencies.push(resolved);
      } catch (error) {
        result.success = false;
        result.errors.push({
          id: dep.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (result.errors.length > 0) {
      log.error(
        `[WasmDependencyResolver] Failed to resolve ${result.errors.length} dependencies`,
        result.errors
      );
    }

    return result;
  }

  /**
   * Resolve a single dependency
   */
  private async resolveDependency(
    dependency: WasmDependency,
    cacheDir: string
  ): Promise<ResolvedDependency> {
    const { id, url, checksum } = dependency;

    if (this.cache.has(id)) {
      const cached = this.cache.get(id)!;
      log.debug(`[WasmDependencyResolver] Using cached dependency: ${id}`);

      return {
        dependency,
        filePath: cached.filePath,
        checksum: cached.checksum,
        loadedAt: cached.downloadedAt,
      };
    }

    if (!url) {
      throw new Error(`Dependency ${id} has no URL to download`);
    }

    log.info(`[WasmDependencyResolver] Downloading dependency: ${id}`);

    const fileName = path.basename(new URL(url).pathname);
    const filePath = path.join(cacheDir, fileName);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download ${id}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();

    if (checksum) {
      const computedChecksum = await this.computeChecksum(buffer);
      if (computedChecksum !== checksum) {
        throw new Error(
          `Checksum mismatch for ${id}: expected ${checksum}, got ${computedChecksum}`
        );
      }
    }

    await fs.writeFile(filePath, Buffer.from(buffer));

    const cached: CachedDependency = {
      id,
      version: dependency.version,
      filePath,
      checksum: dependency.checksum,
      downloadedAt: Date.now(),
    };

    this.cache.set(id, cached);
    await this.saveCache();

    log.info(`[WasmDependencyResolver] Downloaded and cached: ${id}`);

    return {
      dependency,
      filePath,
      checksum,
      loadedAt: cached.downloadedAt,
    };
  }

  /**
   * Compute SHA-256 checksum
   */
  private async computeChecksum(buffer: ArrayBuffer): Promise<string> {
    const data = new Uint8Array(buffer);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return hashHex;
  }

  /**
   * Save cache to disk
   */
  private async saveCache(): Promise<void> {
    const cache: DependencyCache = {
      version: CACHE_VERSION,
      dependencies: {},
    };

    for (const [id, dep] of this.cache.entries()) {
      cache.dependencies[id] = dep;
    }

    await fs.writeFile(this.cacheFilePath, JSON.stringify(cache, null, 2));
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();

    try {
      await fs.unlink(this.cacheFilePath);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        log.warn('[WasmDependencyResolver] Failed to clear cache:', error);
      }
    }

    log.info('[WasmDependencyResolver] Cache cleared');
  }

  /**
   * Get cached dependency
   */
  getCachedDependency(id: string): CachedDependency | undefined {
    return this.cache.get(id);
  }

  /**
   * Get all cached dependencies
   */
  getAllCached(): CachedDependency[] {
    return Array.from(this.cache.values());
  }

  /**
   * Remove expired dependencies
   */
  async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const expired: Array<{ id: string; filePath: string }> = [];

    // Collect expired dependencies with their file paths BEFORE deleting
    for (const [id, dep] of this.cache.entries()) {
      if (dep.expiresAt && dep.expiresAt < now) {
        expired.push({ id, filePath: dep.filePath });
      }
    }

    // Now delete from cache and filesystem
    for (const { id, filePath } of expired) {
      this.cache.delete(id);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        log.warn(
          `[WasmDependencyResolver] Failed to delete ${filePath}:`,
          error
        );
      }
    }

    if (expired.length > 0) {
      await this.saveCache();
      log.info(
        `[WasmDependencyResolver] Removed ${expired.length} expired dependencies`
      );
    }
  }
}

// Export singleton factory
const resolvers: Map<string, WasmDependencyResolver> = new Map();

export function getDependencyResolver(
  cacheDir: string
): WasmDependencyResolver {
  if (!resolvers.has(cacheDir)) {
    const resolver = new WasmDependencyResolver(cacheDir);
    resolvers.set(cacheDir, resolver);
    resolver.initialize();
  }
  return resolvers.get(cacheDir)!;
}

// Lazy singleton - uses app.getPath when first accessed
let _defaultResolver: WasmDependencyResolver | null = null;

export function getDefaultDependencyResolver(): WasmDependencyResolver {
  if (!_defaultResolver) {
    const userDataPath = app.getPath('userData');
    const cacheDir = path.join(userDataPath, 'wasm-cache');
    _defaultResolver = getDependencyResolver(cacheDir);
  }
  return _defaultResolver;
}

// For backward compatibility - lazy initialization
export const wasmDependencyResolver = new Proxy({} as WasmDependencyResolver, {
  get(_target, prop) {
    return Reflect.get(getDefaultDependencyResolver(), prop);
  },
});
