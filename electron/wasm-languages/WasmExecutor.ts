/**
 * WASM Executor
 *
 * Generic executor for WebAssembly-based language modules.
 * Handles loading, execution, and lifecycle of WASM instances.
 */

import fs from 'fs/promises';
import path from 'path';
import { createMainLogger } from '../core/logger.js';
import type {
  WasmLanguageConfig,
  WasmExecutionOptions,
  WasmExecutionResult,
  WasmInstance,
  WasmBindings,
} from './WasmLanguageModule.js';

const log = createMainLogger('WasmExecutor');

// ============================================================================
// TYPES
// ============================================================================

interface LoadedWasmModule {
  module: WebAssembly.Module;
  config: WasmLanguageConfig;
  bindings?: WasmBindings;
  loadTime: number;
}

interface InstanceState {
  instance: WebAssembly.Instance | null;
  memory: WebAssembly.Memory;
  createdAt: number;
  lastUsed: number;
  executionCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MEMORY_LIMIT = 128 * 1024 * 1024;
const INSTANCE_TTL = 300000; // 5 minutes

// ============================================================================
// WASM EXECUTOR CLASS
// ============================================================================

export class WasmExecutor {
  private loadedModules: Map<string, LoadedWasmModule> = new Map();
  private activeInstances: Map<string, InstanceState> = new Map();
  private stdoutBuffers: Map<string, string[]> = new Map();
  private stderrBuffers: Map<string, string[]> = new Map();

  /**
   * Load a WASM language module
   */
  async loadModule(
    pluginPath: string,
    config: WasmLanguageConfig
  ): Promise<WebAssembly.Module> {
    const key = config.id;

    if (this.loadedModules.has(key)) {
      log.debug(`[WasmExecutor] Module ${key} already loaded`);
      return this.loadedModules.get(key)!.module;
    }

    try {
      log.info(
        `[WasmExecutor] Loading WASM module: ${config.name} (${config.version})`
      );

      const wasmPath = path.join(pluginPath, config.wasmPath);

      const wasmBuffer = await fs.readFile(wasmPath);

      const module = await WebAssembly.compile(wasmBuffer);

      let bindings: WasmBindings | undefined;
      if (config.bindingsPath) {
        const bindingsPath = path.join(pluginPath, config.bindingsPath);
        try {
          const bindingsModule = await import(bindingsPath);
          bindings = bindingsModule.default || bindingsModule;
          log.debug(
            `[WasmExecutor] Loaded bindings from ${config.bindingsPath}`
          );
        } catch (error) {
          log.warn(`[WasmExecutor] Failed to load bindings:`, error);
        }
      }

      this.loadedModules.set(key, {
        module,
        config,
        bindings,
        loadTime: Date.now(),
      });

      log.info(`[WasmExecutor] Successfully loaded WASM module: ${key}`);
      return module;
    } catch (error) {
      log.error(`[WasmExecutor] Failed to load WASM module ${key}:`, error);
      throw new Error(
        `Failed to load WASM module ${key}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a new WASM instance
   */
  async createInstance(languageId: string): Promise<WasmInstance> {
    const loaded = this.loadedModules.get(languageId);
    if (!loaded) {
      throw new Error(`WASM module ${languageId} not loaded`);
    }

    const { module, config, bindings } = loaded;

    log.debug(`[WasmExecutor] Creating instance for language: ${languageId}`);

    const instanceId = `${languageId}-${Date.now()}`;

    const memoryLimit = config.memoryLimit || DEFAULT_MEMORY_LIMIT;
    const memoryPages = Math.min(Math.ceil(memoryLimit / 65536), 2048);

    const memory = new WebAssembly.Memory({
      initial: memoryPages,
      maximum: memoryPages,
    });

    const stdout: string[] = [];
    const stderr: string[] = [];

    this.stdoutBuffers.set(instanceId, stdout);
    this.stderrBuffers.set(instanceId, stderr);

    const imports = this.createImports(instanceId, memory, config);

    let instance: WebAssembly.Instance;

    if (bindings && bindings.initialize) {
      instance = await bindings.initialize(memory, imports);
    } else {
      instance = await WebAssembly.instantiate(module, imports);
    }

    const instanceState: InstanceState = {
      instance,
      memory,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      executionCount: 0,
    };

    this.activeInstances.set(instanceId, instanceState as InstanceState);

    const wasmInstance: WasmInstance = {
      languageId,
      instance,
      memory,
      execute: async (code: string, options?: WasmExecutionOptions) => {
        return this.execute(instanceId, code, options);
      },
      reset: () => {
        this.resetInstance(instanceId);
      },
      dispose: () => {
        this.disposeInstance(instanceId);
      },
    };

    log.debug(`[WasmExecutor] Created instance: ${instanceId}`);
    return wasmInstance;
  }

  /**
   * Execute code in a WASM instance
   */
  async execute(
    instanceId: string,
    code: string,
    options?: WasmExecutionOptions
  ): Promise<WasmExecutionResult> {
    const state = this.activeInstances.get(instanceId);
    if (!state) {
      throw new Error(`WASM instance ${instanceId} not found`);
    }

    if (!state.instance) {
      throw new Error(`WASM instance ${instanceId} is null`);
    }

    const languageId = instanceId.split('-')[0];
    const loaded = this.loadedModules.get(languageId);
    if (!loaded) {
      throw new Error(`WASM module not found for language ${languageId}`);
    }

    const startTime = Date.now();
    state.lastUsed = startTime;
    state.executionCount++;

    const timeout = options?.timeout || DEFAULT_TIMEOUT;

    const stdout = this.stdoutBuffers.get(instanceId) || [];
    const stderr = this.stderrBuffers.get(instanceId) || [];

    stdout.length = 0;
    stderr.length = 0;

    try {
      let result: WasmExecutionResult;

      if (loaded.bindings) {
        const preparedCode = loaded.bindings.prepareCode
          ? loaded.bindings.prepareCode(code)
          : code;

        result = await this.executeWithBindings(
          loaded.bindings,
          state.instance,
          preparedCode,
          timeout,
          stdout,
          stderr
        );
      } else {
        result = await this.executeDirect(
          state.instance,
          code,
          timeout,
          stdout,
          stderr
        );
      }

      const executionTime = Date.now() - startTime;

      return {
        ...result,
        executionTime,
        memoryUsed: state.memory.buffer.byteLength,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      log.error(`[WasmExecutor] Execution error in ${instanceId}:`, error);

      return {
        exitCode: 1,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };
    }
  }

  /**
   * Execute using language bindings
   */
  private async executeWithBindings(
    bindings: WasmBindings,
    instance: WebAssembly.Instance,
    code: string,
    _timeout: number,
    stdout: string[],
    stderr: string[]
  ): Promise<WasmExecutionResult> {
    const originalHandleStdout = bindings.handleStdout;
    const originalHandleStderr = bindings.handleStderr;

    bindings.handleStdout = (text: string) => {
      stdout.push(text);
      if (originalHandleStdout) originalHandleStdout(text);
    };

    bindings.handleStderr = (text: string) => {
      stderr.push(text);
      if (originalHandleStderr) originalHandleStderr(text);
    };

    try {
      const result = await bindings.execute(instance, code);
      return result;
    } finally {
      bindings.handleStdout = originalHandleStdout;
      bindings.handleStderr = originalHandleStderr;
    }
  }

  /**
   * Execute directly without bindings
   */
  private async executeDirect(
    instance: WebAssembly.Instance,
    code: string,
    timeout: number,
    stdout: string[],
    stderr: string[]
  ): Promise<WasmExecutionResult> {
    const runFn = instance.exports.run as (code: string) => number;

    if (typeof runFn !== 'function') {
      throw new Error('WASM module does not export a "run" function');
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          exitCode: 1,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          error: `Execution timeout (${timeout}ms)`,
          executionTime: timeout,
        });
      }, timeout);

      try {
        const exitCode = runFn(code);
        clearTimeout(timer);

        resolve({
          exitCode,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          executionTime: timeout,
        });
      } catch (error) {
        clearTimeout(timer);
        resolve({
          exitCode: 1,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          error: error instanceof Error ? error.message : String(error),
          executionTime: timeout,
        });
      }
    });
  }

  /**
   * Reset instance state
   */
  resetInstance(instanceId: string): void {
    const state = this.activeInstances.get(instanceId);
    if (!state) {
      return;
    }

    const stdout = this.stdoutBuffers.get(instanceId);
    const stderr = this.stderrBuffers.get(instanceId);

    if (stdout) stdout.length = 0;
    if (stderr) stderr.length = 0;

    log.debug(`[WasmExecutor] Reset instance: ${instanceId}`);
  }

  /**
   * Dispose instance
   */
  disposeInstance(instanceId: string): void {
    const state = this.activeInstances.get(instanceId);
    if (!state) return;

    this.activeInstances.delete(instanceId);
    this.stdoutBuffers.delete(instanceId);
    this.stderrBuffers.delete(instanceId);

    log.debug(`[WasmExecutor] Disposed instance: ${instanceId}`);
  }

  /**
   * Dispose all instances for a language
   */
  disposeLanguage(languageId: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.activeInstances.entries()) {
      if (key.startsWith(languageId + '-')) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.disposeInstance(key);
    }

    this.loadedModules.delete(languageId);

    log.info(`[WasmExecutor] Disposed language: ${languageId}`);
  }

  /**
   * Create WASM imports
   */
  private createImports(
    instanceId: string,
    memory: WebAssembly.Memory,
    config: WasmLanguageConfig
  ): WebAssembly.Imports {
    const stdout = this.stdoutBuffers.get(instanceId) || [];
    const stderr = this.stderrBuffers.get(instanceId) || [];

    return {
      env: {
        memory,
        write_stdout: (ptr: number, len: number) => {
          const text = new TextDecoder().decode(
            new Uint8Array(memory.buffer, ptr, len)
          );
          stdout.push(text);
        },
        write_stderr: (ptr: number, len: number) => {
          const text = new TextDecoder().decode(
            new Uint8Array(memory.buffer, ptr, len)
          );
          stderr.push(text);
        },
        clock: () => {
          return Date.now();
        },
        log: (ptr: number, len: number) => {
          const text = new TextDecoder().decode(
            new Uint8Array(memory.buffer, ptr, len)
          );
          log.debug(`[WASM:${config.id}] ${text}`);
        },
      },
    };
  }

  /**
   * Clean up old instances
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, state] of this.activeInstances.entries()) {
      if (now - state.lastUsed > INSTANCE_TTL) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.disposeInstance(key);
    }

    if (keysToDelete.length > 0) {
      log.info(
        `[WasmExecutor] Cleaned up ${keysToDelete.length} old instances`
      );
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    loadedModules: number;
    activeInstances: number;
    languages: string[];
  } {
    const languages = new Set<string>();

    for (const loaded of this.loadedModules.values()) {
      languages.add(loaded.config.id);
    }

    return {
      loadedModules: this.loadedModules.size,
      activeInstances: this.activeInstances.size,
      languages: Array.from(languages),
    };
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.activeInstances.entries()) {
      keysToDelete.push(key);
    }

    for (const key of keysToDelete) {
      this.disposeInstance(key);
    }

    this.loadedModules.clear();
  }
}

// Export singleton instance
export const wasmExecutor = new WasmExecutor();
