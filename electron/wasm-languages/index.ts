/**
 * WASM Languages Module
 *
 * Re-exports all WASM language functionality.
 */

export { WasmExecutor, wasmExecutor } from './WasmExecutor.js';
export {
  WasmInstancePool,
  wasmInstancePool,
  type PoolConfig,
  type PoolStats,
} from './WasmInstancePool.js';
export {
  WasmLanguageRegistry,
  wasmLanguageRegistry,
} from './WasmLanguageRegistry.js';
export {
  WasmDependencyResolver,
  getDependencyResolver,
  wasmDependencyResolver,
} from './WasmDependencyResolver.js';

export type {
  WasmLanguageConfig,
  WasmExecutionOptions,
  WasmExecutionResult,
  WasmInstance,
  WasmBindings,
  WasmDependency,
  MonacoLanguageConfig,
  WasmWorkerMessage,
  WasmWorkerResponse,
} from './WasmLanguageModule.js';

export type { RegisteredWasmLanguage } from './WasmLanguageRegistry.js';
