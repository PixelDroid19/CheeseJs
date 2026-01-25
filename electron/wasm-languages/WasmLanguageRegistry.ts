/**
 * WASM Language Registry
 *
 * Dynamic registry for WebAssembly-based languages.
 * Handles language registration, discovery, and lifecycle management.
 * Emits events for hot-reload and monitoring.
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { createMainLogger } from '../core/logger.js';
import { wasmExecutor } from './WasmExecutor.js';
import { wasmInstancePool } from './WasmInstancePool.js';
import { wasmDependencyResolver } from './WasmDependencyResolver.js';
import type {
  WasmLanguageConfig,
  WasmExecutionOptions,
  WasmExecutionResult,
} from './WasmLanguageModule.js';

const log = createMainLogger('WasmLanguageRegistry');

// ============================================================================
// TYPES
// ============================================================================

export interface RegisteredWasmLanguage {
  config: WasmLanguageConfig;
  pluginId: string;
  pluginPath: string;
  loadedAt: number;
  isReady: boolean;
  status: 'loading' | 'ready' | 'error';
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_DIR_NAME = 'wasm-cache';

// ============================================================================
// WASM LANGUAGE REGISTRY CLASS
// ============================================================================

// Event types for the registry
export type WasmRegistryEventType =
  | 'language:registered'
  | 'language:unregistered'
  | 'language:ready'
  | 'language:error'
  | 'language:reloaded';

export interface WasmRegistryEventData {
  languageId: string;
  pluginId?: string;
  config?: WasmLanguageConfig;
  error?: string;
}

type WasmRegistryEventHandler = (data: WasmRegistryEventData) => void;

export class WasmLanguageRegistry {
  private languages: Map<string, RegisteredWasmLanguage> = new Map();
  private extensionMap: Map<string, string> = new Map();
  private cacheDir: string;
  private eventHandlers: Map<
    WasmRegistryEventType,
    Set<WasmRegistryEventHandler>
  > = new Map();

  constructor() {
    const userDataPath = app.getPath('userData');
    this.cacheDir = path.join(userDataPath, CACHE_DIR_NAME);
  }

  /**
   * Subscribe to registry events
   */
  on(
    event: WasmRegistryEventType,
    handler: WasmRegistryEventHandler
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Emit an event
   */
  private emit(
    event: WasmRegistryEventType,
    data: WasmRegistryEventData
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          log.error(
            `[WasmLanguageRegistry] Event handler error for ${event}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Initialize the registry
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      log.info(`[WasmLanguageRegistry] Cache directory: ${this.cacheDir}`);
    } catch (error) {
      log.error(
        '[WasmLanguageRegistry] Failed to create cache directory:',
        error
      );
    }
  }

  /**
   * Register a WASM language
   */
  async register(
    pluginId: string,
    pluginPath: string,
    config: WasmLanguageConfig
  ): Promise<void> {
    if (this.languages.has(config.id)) {
      log.warn(
        `[WasmLanguageRegistry] Language ${config.id} already registered, skipping`
      );
      return;
    }

    log.info(
      `[WasmLanguageRegistry] Registering language: ${config.name} (${config.id})`
    );

    const registered: RegisteredWasmLanguage = {
      config,
      pluginId,
      pluginPath,
      loadedAt: Date.now(),
      isReady: false,
      status: 'loading',
    };

    this.languages.set(config.id, registered);

    for (const ext of config.extensions) {
      const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
      this.extensionMap.set(normalizedExt, config.id);
    }

    try {
      await this.loadLanguage(registered);
      registered.isReady = true;
      registered.status = 'ready';

      log.info(
        `[WasmLanguageRegistry] Successfully registered: ${config.name} v${config.version}`
      );

      this.emit('language:ready', { languageId: config.id, pluginId, config });
    } catch (error) {
      registered.status = 'error';
      registered.error = error instanceof Error ? error.message : String(error);
      log.error(`[WasmLanguageRegistry] Failed to load ${config.id}:`, error);

      this.emit('language:error', {
        languageId: config.id,
        pluginId,
        config,
        error: registered.error,
      });
    }

    this.emit('language:registered', {
      languageId: config.id,
      pluginId,
      config,
    });
  }

  /**
   * Unregister a WASM language
   */
  async unregister(languageId: string): Promise<void> {
    const lang = this.languages.get(languageId);
    if (!lang) return;

    log.info(`[WasmLanguageRegistry] Unregistering language: ${languageId}`);

    for (const ext of lang.config.extensions) {
      const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
      this.extensionMap.delete(normalizedExt);
    }

    await wasmInstancePool.disposeLanguage(languageId);
    await wasmExecutor.disposeLanguage(languageId);

    this.languages.delete(languageId);

    log.info(`[WasmLanguageRegistry] Unregistered: ${languageId}`);

    this.emit('language:unregistered', { languageId, pluginId: lang.pluginId });
  }

  /**
   * Get language by extension
   */
  getLanguageByExtension(extension: string): string | undefined {
    const normalizedExt = extension.startsWith('.')
      ? extension
      : `.${extension}`;
    return this.extensionMap.get(normalizedExt);
  }

  /**
   * Get registered language by ID
   */
  getLanguage(languageId: string): RegisteredWasmLanguage | undefined {
    return this.languages.get(languageId);
  }

  /**
   * Get all registered languages
   */
  getAllLanguages(): RegisteredWasmLanguage[] {
    return Array.from(this.languages.values());
  }

  /**
   * Get ready languages
   */
  getReadyLanguages(): RegisteredWasmLanguage[] {
    return this.getAllLanguages().filter((l) => l.isReady);
  }

  /**
   * Check if a language is registered
   */
  hasLanguage(languageId: string): boolean {
    return this.languages.has(languageId);
  }

  /**
   * Execute code in a WASM language
   */
  async execute(
    languageId: string,
    code: string,
    options?: WasmExecutionOptions
  ): Promise<WasmExecutionResult> {
    const lang = this.languages.get(languageId);
    if (!lang) {
      throw new Error(`WASM language ${languageId} not registered`);
    }

    if (!lang.isReady) {
      throw new Error(
        `WASM language ${languageId} is not ready: ${lang.error}`
      );
    }

    log.debug(`[WasmLanguageRegistry] Executing code in ${languageId}`);

    return wasmInstancePool.execute(languageId, code, options);
  }

  /**
   * Get language config
   */
  getLanguageConfig(languageId: string): WasmLanguageConfig | undefined {
    return this.languages.get(languageId)?.config;
  }

  /**
   * Get Monaco configuration for a language
   */
  getMonacoConfig(languageId: string) {
    return this.languages.get(languageId)?.config.monacoConfig;
  }

  /**
   * Reset all instances for a language
   */
  resetLanguage(languageId: string): void {
    wasmInstancePool.resetLanguage(languageId);
    log.debug(`[WasmLanguageRegistry] Reset language: ${languageId}`);
  }

  /**
   * Reload a language (hot-reload)
   * Unregisters and re-registers the language with its current configuration
   */
  async reloadLanguage(languageId: string): Promise<boolean> {
    const lang = this.languages.get(languageId);
    if (!lang) {
      log.warn(
        `[WasmLanguageRegistry] Cannot reload unknown language: ${languageId}`
      );
      return false;
    }

    const { pluginId, config } = lang;

    log.info(`[WasmLanguageRegistry] Reloading language: ${languageId}`);

    // Unregister (but don't emit unregistered event for reload)
    await wasmInstancePool.disposeLanguage(languageId);
    await wasmExecutor.disposeLanguage(languageId);

    // Reset state
    lang.isReady = false;
    lang.status = 'loading';
    lang.error = undefined;
    lang.loadedAt = Date.now();

    try {
      await this.loadLanguage(lang);
      lang.isReady = true;
      lang.status = 'ready';

      log.info(`[WasmLanguageRegistry] Successfully reloaded: ${config.name}`);
      this.emit('language:reloaded', { languageId, pluginId, config });
      this.emit('language:ready', { languageId, pluginId, config });

      return true;
    } catch (error) {
      lang.status = 'error';
      lang.error = error instanceof Error ? error.message : String(error);
      log.error(
        `[WasmLanguageRegistry] Failed to reload ${languageId}:`,
        error
      );

      this.emit('language:error', {
        languageId,
        pluginId,
        config,
        error: lang.error,
      });

      return false;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalLanguages: number;
    readyLanguages: number;
    errorLanguages: number;
    languages: string[];
  } {
    const all = this.getAllLanguages();
    const ready = all.filter((l) => l.isReady);
    const error = all.filter((l) => l.status === 'error');

    return {
      totalLanguages: all.length,
      readyLanguages: ready.length,
      errorLanguages: error.length,
      languages: Array.from(this.languages.keys()),
    };
  }

  /**
   * Clear all registered languages
   */
  async clear(): Promise<void> {
    const languageIds = Array.from(this.languages.keys());

    for (const id of languageIds) {
      await this.unregister(id);
    }

    log.info('[WasmLanguageRegistry] Cleared all languages');
  }

  /**
   * Load language and dependencies
   */
  private async loadLanguage(
    registered: RegisteredWasmLanguage
  ): Promise<void> {
    const { config, pluginPath } = registered;

    if (config.dependencies && config.dependencies.length > 0) {
      log.debug(
        `[WasmLanguageRegistry] Resolving dependencies for ${config.id}`
      );
      await wasmDependencyResolver.resolveDependencies(
        config.id,
        config.dependencies,
        this.cacheDir
      );
    }

    await wasmExecutor.loadModule(pluginPath, config);
  }

  /**
   * Get cache directory
   */
  getCacheDir(): string {
    return this.cacheDir;
  }
}

// Export singleton instance
export const wasmLanguageRegistry = new WasmLanguageRegistry();
