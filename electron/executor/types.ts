/**
 * Language Executor Types and Interfaces
 * 
 * Defines the contract for all language executors in CheeseJS.
 * This allows for scalable architecture supporting multiple languages
 * without collision or tight coupling.
 */

// ============================================================================
// LANGUAGE IDENTIFIERS
// ============================================================================

/**
 * Supported language identifiers
 * Using const assertion for type safety and autocomplete
 */
export const SUPPORTED_LANGUAGES = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  PYTHON: 'python',
} as const

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[keyof typeof SUPPORTED_LANGUAGES]

/**
 * Check if a language ID is supported
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return Object.values(SUPPORTED_LANGUAGES).includes(lang as SupportedLanguage)
}

// ============================================================================
// EXECUTION INTERFACES
// ============================================================================

/**
 * Options passed to code transformation/transpilation
 * 
 * Supports modern ECMAScript and TypeScript features:
 * - ES2024: Object.groupBy, Map.groupBy, Promise.withResolvers, RegExp v flag
 * - ES2025: Iterator helpers, Set methods, Float16Array, RegExp.escape
 * - TypeScript 5.8+: Import attributes, granular return checks
 * - Import attributes: `import data from './file.json' with { type: 'json' }`
 */
export interface TransformOptions {
  /** Wrap top-level expressions with debug() for inline results */
  showTopLevelResults?: boolean
  /** Add loop protection to prevent infinite loops */
  loopProtection?: boolean
  /** Process //? magic comments for debug output */
  magicComments?: boolean
  /** Show undefined values in output */
  showUndefined?: boolean
  /** 
   * Target ECMAScript version for transpilation
   * - ES2022: Baseline modern features (class fields, private methods, top-level await)
   * - ES2024: Object.groupBy, Promise.withResolvers, well-formed Unicode strings
   * - ESNext: Latest stage 4 features
   */
  targetVersion?: 'ES2022' | 'ES2024' | 'ESNext'
  /** Enable experimental decorators (legacy) vs modern decorators (Stage 3 2022-03) */
  experimentalDecorators?: boolean
  /** Parse JSX/TSX syntax */
  jsx?: boolean
  /** 
   * Enable support for import attributes (with clause)
   * @example import data from './config.json' with { type: 'json' }
   * @default true
   */
  importAttributes?: boolean
}

/**
 * Options for code execution
 */
export interface ExecuteOptions {
  /** Maximum execution time in milliseconds */
  timeout?: number
  /** Show undefined return values */
  showUndefined?: boolean
}

/**
 * Complete execution request
 */
export interface ExecutionRequest {
  /** Unique execution ID */
  id: string
  /** Source code to execute */
  code: string
  /** Source language */
  language: SupportedLanguage
  /** Transform options */
  transformOptions: TransformOptions
  /** Execute options */
  executeOptions: ExecuteOptions
}

// ============================================================================
// RESULT INTERFACES
// ============================================================================

/**
 * Result types from execution
 */
export type ResultType = 'result' | 'console' | 'debug' | 'error' | 'complete' | 'ready'

/**
 * Console output types
 */
export type ConsoleType = 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir' | 'trace'

/**
 * Execution result message
 */
export interface ExecutionResult {
  type: ResultType
  id: string
  data?: unknown
  line?: number
  jsType?: string
  consoleType?: ConsoleType
}

/**
 * Serialized value for IPC transfer
 */
export interface SerializedValue {
  content: string
  jsType: string
}

/**
 * Error result with details
 */
export interface ErrorResult {
  name: string
  message: string
  stack?: string
  line?: number
  column?: number
}

// ============================================================================
// EXECUTOR INTERFACE
// ============================================================================

/**
 * Language-specific transformer interface
 * Handles code transformation before execution
 */
export interface LanguageTransformer {
  /** Language this transformer handles */
  readonly language: SupportedLanguage
  
  /** Transform source code for execution */
  transform(code: string, options: TransformOptions): string
  
  /** Check if code is valid syntax (quick parse check) */
  validateSyntax?(code: string): { valid: boolean; error?: string }
}

/**
 * Language executor interface
 * Handles actual code execution in isolated context
 */
export interface LanguageExecutor {
  /** Language(s) this executor handles */
  readonly languages: SupportedLanguage[]
  
  /** Initialize the executor (load WASM, create workers, etc.) */
  initialize(): Promise<void>
  
  /** Execute transformed code */
  execute(code: string, options: ExecuteOptions): Promise<unknown>
  
  /** Cancel a running execution */
  cancel(executionId: string): void
  
  /** Cleanup resources */
  dispose(): void
  
  /** Check if executor is ready */
  isReady(): boolean
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Feature flags for experimental/new ECMAScript features
 */
export interface LanguageFeatureFlags {
  // ES2024 Features
  arrayGrouping: boolean        // Object.groupBy, Map.groupBy
  promiseWithResolvers: boolean // Promise.withResolvers
  resizableArrayBuffer: boolean // Resizable ArrayBuffer/SharedArrayBuffer
  regexpVFlag: boolean          // RegExp v flag for set notation
  
  // ES2025 Features (Stage 4)
  iteratorHelpers: boolean      // Iterator.prototype methods
  setMethods: boolean           // Set.prototype.union, intersection, etc.
  jsonModules: boolean          // import json from './data.json' with { type: 'json' }
  regexpEscape: boolean         // RegExp.escape
  promiseTry: boolean           // Promise.try
  float16Array: boolean         // Float16Array and Math.f16round
  
  // TypeScript-specific
  decorators: boolean           // Stage 3 decorators (2022-03)
  satisfiesOperator: boolean    // satisfies operator
  constTypeParams: boolean      // const type parameters
  
  // Experimental
  disposableStack: boolean      // using/await using declarations
  importAttributes: boolean     // import ... with { type: 'json' }
}

/**
 * Default feature flags (ES2024 baseline)
 */
export const DEFAULT_FEATURE_FLAGS: LanguageFeatureFlags = {
  // ES2024 - all enabled
  arrayGrouping: true,
  promiseWithResolvers: true,
  resizableArrayBuffer: true,
  regexpVFlag: true,
  
  // ES2025 - enabled (Node 22+)
  iteratorHelpers: true,
  setMethods: true,
  jsonModules: true,
  regexpEscape: true,
  promiseTry: true,
  float16Array: true,
  
  // TypeScript
  decorators: true,
  satisfiesOperator: true,
  constTypeParams: true,
  
  // Experimental - disabled by default
  disposableStack: false,
  importAttributes: true,
}

// ============================================================================
// ECMASCRIPT VERSION MAPPING
// ============================================================================

/**
 * Map ECMAScript targets to TypeScript ScriptTarget values
 */
export const ES_TARGET_MAP = {
  'ES2022': 9,  // ts.ScriptTarget.ES2022
  'ES2024': 9,  // Use ES2022 as base, add polyfills
  'ESNext': 99, // ts.ScriptTarget.ESNext
} as const

export type ESTarget = keyof typeof ES_TARGET_MAP
