/**
 * WASM Language Module
 *
 * Core interfaces for WebAssembly-based language modules.
 * Defines the contract that language plugins must implement.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface WasmLanguageConfig {
  /** Unique language identifier (e.g., 'rust', 'go', 'cpp') */
  id: string;
  /** Display name (e.g., 'Rust', 'Go', 'C++') */
  name: string;
  /** File extensions (e.g., ['.rs', '.go', '.cpp']) */
  extensions: string[];
  /** Version of the language runtime */
  version: string;
  /** Path to WASM module (relative to plugin directory) */
  wasmPath: string;
  /** Path to JS bindings (relative to plugin directory) */
  bindingsPath?: string;
  /** Language configuration for Monaco editor */
  monacoConfig?: MonacoLanguageConfig;
  /** Dependencies required by this language */
  dependencies?: WasmDependency[];
  /** Memory limit in bytes (default: 128MB) */
  memoryLimit?: number;
  /** Maximum execution time in ms (default: 30000) */
  timeout?: number;
}

export interface MonacoLanguageConfig {
  comments?: {
    lineComment?: string;
    blockComment?: [string, string];
  };
  brackets?: [string, string][];
  autoClosingPairs?: { open: string; close: string }[];
  surroundingPairs?: { open: string; close: string }[];
}

export interface WasmDependency {
  /** Dependency identifier */
  id: string;
  /** Version constraint (e.g., '^1.0.0') */
  version?: string;
  /** URL to download the WASM module */
  url?: string;
  /** Optional checksum for validation */
  checksum?: string;
}

export interface WasmLanguageContribution {
  /** Unique language identifier (e.g., 'rust', 'go', 'cpp') */
  id: string;
  /** Display name */
  name: string;
  /** File extensions (e.g., ['.rs', '.go', '.cpp']) */
  extensions: string[];
  /** Version of the language runtime */
  version: string;
  /** Path to WASM module (relative to plugin directory) */
  wasmPath: string;
  /** Path to JS bindings (relative to plugin directory) */
  bindingsPath?: string;
  /** Monaco language configuration */
  monacoConfig?: MonacoLanguageConfig;
  /** Dependencies required by this language */
  dependencies?: WasmDependency[];
  /** Memory limit in bytes (default: 128MB) */
  memoryLimit?: number;
  /** Maximum execution time in ms (default: 30000) */
  timeout?: number;
}

export interface WasmExecutionOptions {
  /** Execution timeout in milliseconds */
  timeout?: number;
  /** Memory limit in bytes */
  memoryLimit?: number;
  /** Enable stdout capture */
  captureStdout?: boolean;
  /** Enable stderr capture */
  captureStderr?: boolean;
  /** Custom environment variables */
  env?: Record<string, string>;
}

export interface WasmExecutionResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Captured stdout output */
  stdout: string;
  /** Captured stderr output */
  stderr: string;
  /** Execution error if any */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Memory usage peak in bytes */
  memoryUsed?: number;
}

export interface WasmInstance {
  /** Language identifier */
  languageId: string;
  /** WebAssembly.Instance */
  instance: WebAssembly.Instance;
  /** WebAssembly.Memory */
  memory: WebAssembly.Memory;
  /** Execute code in this instance */
  execute: (
    code: string,
    options?: WasmExecutionOptions
  ) => Promise<WasmExecutionResult>;
  /** Reset instance state */
  reset: () => void;
  /** Dispose instance */
  dispose: () => void;
}

export interface WasmBindings {
  /** Initialize the WASM instance */
  initialize: (
    memory: WebAssembly.Memory,
    imports: WebAssembly.Imports
  ) => Promise<WebAssembly.Instance>;
  /** Prepare code for execution */
  prepareCode: (code: string) => string;
  /** Execute prepared code */
  execute: (
    instance: WebAssembly.Instance,
    code: string
  ) => Promise<WasmExecutionResult>;
  /** Handle stdout output */
  handleStdout: (text: string) => void;
  /** Handle stderr output */
  handleStderr: (text: string) => void;
}

export interface WasmLanguageModule {
  /** Language configuration */
  config: WasmLanguageConfig;
  /** Load WASM module */
  load: () => Promise<WebAssembly.Module>;
  /** Create a new WASM instance */
  createInstance: () => Promise<WasmInstance>;
  /** Validate configuration */
  validate: () => boolean;
  /** Cleanup resources */
  dispose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_WASM_OPTIONS: Required<WasmExecutionOptions> = {
  timeout: 30000,
  memoryLimit: 128 * 1024 * 1024,
  captureStdout: true,
  captureStderr: true,
  env: {},
};

export const WASM_MEMORY_PAGE_SIZE = 65536; // 64KB per page
export const MAX_WASM_MEMORY_PAGES = 2048; // 128MB maximum

// ============================================================================
// WORKER MESSAGE TYPES
// ============================================================================

export interface WasmWorkerMessage {
  type: 'init' | 'execute' | 'reset' | 'dispose' | 'status';
  languageId: string;
  code?: string;
  options?: WasmExecutionOptions;
  id?: string;
}

export interface WasmWorkerResponse {
  type: 'result' | 'error' | 'status' | 'ready';
  languageId: string;
  id?: string;
  data?: WasmExecutionResult | { status: string };
  error?: string;
}

// ============================================================================
// EXPORTS
// ============================================================================
