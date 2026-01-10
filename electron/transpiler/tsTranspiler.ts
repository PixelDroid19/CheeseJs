/**
 * TypeScript-based Code Transpiler
 *
 * Provides TypeScript/JSX transpilation using the TypeScript Compiler API
 * for code transformations (debug injection, loop protection, etc.)
 *
 * Supports:
 * - ES2024/2025 features (Iterator helpers, Set methods, Promise.withResolvers)
 * - TypeScript 5.8+ features (granular return checks, erasable syntax)
 * - Modern decorators (Stage 3 - 2022-03)
 * - JSX/TSX support
 */

import ts from 'typescript';
import {
  transformConsoleTodebug,
  wrapTopLevelExpressions,
  applyMagicComments,
} from './codeTransforms.js';

export interface TransformOptions {
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
  magicComments?: boolean;
  showUndefined?: boolean;
  /** Target ECMAScript version */
  targetVersion?: 'ES2022' | 'ES2024' | 'ESNext';
  /** Enable experimental decorators (legacy) or use modern decorators */
  experimentalDecorators?: boolean;
  /** Enable JSX parsing */
  jsx?: boolean;
  /** Enable visual execution (line tracking) */
  visualExecution?: boolean;
}

/**
 * Get TypeScript compiler options for modern ECMAScript
 *
 * TypeScript 5.8+ Features:
 * - Import attributes (with { type: 'json' }) - requires moduleResolution: NodeNext
 * - Granular return type checks
 * - Erasable syntax for type-only constructs
 */
function getCompilerOptions(options?: TransformOptions): ts.CompilerOptions {
  // Use ES2022 as base since TypeScript doesn't have ES2024 target yet
  // Node.js 22+ supports ES2024 features natively
  const target =
    options?.targetVersion === 'ESNext'
      ? ts.ScriptTarget.ESNext
      : ts.ScriptTarget.ES2022;

  return {
    // Module system - CommonJS for require() support in worker sandbox
    module: ts.ModuleKind.CommonJS,
    // Enable Node16/NodeNext module resolution for import attributes support
    // This allows: import data from './data.json' with { type: 'json' }
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target,
    jsx: options?.jsx !== false ? ts.JsxEmit.React : ts.JsxEmit.None,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    // Import attributes support (TypeScript 5.3+)
    // Allows: import attributes in static/dynamic imports
    resolveJsonModule: true,
    // Decorators
    experimentalDecorators: options?.experimentalDecorators ?? true,
    emitDecoratorMetadata: false,
    useDefineForClassFields: true, // Modern class fields behavior
    strict: false,
    skipLibCheck: true,
    noEmit: false,
    sourceMap: false,
    // Modern features support
    downlevelIteration: true, // Support for iterators
    importHelpers: false, // Don't require tslib
    // Verbatim module syntax for cleaner ESM/CJS interop (TS 5.0+)
    verbatimModuleSyntax: false, // Keep false for CJS output compatibility
    // Allow importing from .ts extensions directly
    allowImportingTsExtensions: false,
  };
}

import { createLoopProtectionTransformer } from './loopProtection.js';
import { createVisualExecutionTransformer } from './visualExecution.js';

/**
 * Transform code using TypeScript Compiler
 */
export function transpileWithTypeScript(
  code: string,
  options?: TransformOptions
): string {
  const compilerOptions = getCompilerOptions(options);

  const transformers: ts.CustomTransformers = {
    before: [],
  };

  // Add visual execution transformer if enabled (before loop protection)
  // We want to track lines before loop protection adds its own logic
  if (options?.visualExecution) {
    transformers.before?.push(createVisualExecutionTransformer());
  }

  // Add loop protection transformer if enabled
  if (options?.loopProtection) {
    transformers.before?.push(
      createLoopProtectionTransformer({
        includeCancellationCheck: true,
        // Allow higher limits for higher performance if needed, keeping defaults for now
      })
    );
  }

  const result = ts.transpileModule(code, {
    compilerOptions,
    fileName: 'index.tsx',
    transformers,
  });

  return result.outputText;
}

/**
 * Simple regex-based transformations for code injection
 * These run after TypeScript transpilation
 */
export function applyCodeTransforms(
  code: string,
  options: TransformOptions = {}
): string {
  let transformed = code;

  // Apply
  transformed = transformConsoleTodebug(transformed);

  // Loop protection is now handled by AST transformer in transpileWithTypeScript
  // We do NOT call addLoopProtection here anymore

  // Apply stray expression wrapping if enabled
  if (options.showTopLevelResults !== false) {
    transformed = wrapTopLevelExpressions(transformed);
  }

  return transformed;
}

/**
 * Full transform pipeline
 */
export function transformCode(
  code: string,
  options: TransformOptions = {}
): string {
  if (!code.trim()) return '';

  try {
    // Step 1: Apply magic comments BEFORE transpilation (they get removed by TS)
    let processedCode = code;
    if (options.magicComments) {
      processedCode = applyMagicComments(code);
    }

    // Step 2: Transpile TS/JSX with TypeScript (passing options for ES target)
    const transpiled = transpileWithTypeScript(processedCode, options);

    // Step 3: Apply other code transformations
    const transformed = applyCodeTransforms(transpiled, options);

    return transformed;
  } catch (error) {
    // If transpilation fails, try to apply transforms to original code
    console.error('Transpilation error:', error);
    return applyCodeTransforms(code, options);
  }
}
