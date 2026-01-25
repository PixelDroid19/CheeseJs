/**
 * SWC-based Code Transpiler
 *
 * High-performance TypeScript/JSX transpilation using SWC (20-70x faster than TSC).
 * Provides the same API as tsTranspiler for drop-in replacement.
 *
 * Supports ES2024/2025 Features:
 * - Iterator helpers (Iterator.from(), .map(), .filter(), .take(), .drop())
 * - Set methods (union, intersection, difference, symmetricDifference)
 * - Promise.withResolvers()
 * - Object.groupBy(), Map.groupBy()
 * - Resizable ArrayBuffer
 * - Using declarations (explicit resource management)
 * - RegExp v flag (set notation)
 * - ArrayBuffer.prototype.transfer()
 *
 * Supports TypeScript 5.x Features:
 * - Modern decorators (Stage 3 - 2022-03)
 * - Import attributes (with { type: 'json' })
 * - using/await using declarations (explicit resource management)
 * - satisfies operator
 * - const type parameters
 * - Variadic tuple improvements
 * - NoInfer<T> utility type
 * - Isolated declarations (erasable syntax)
 */

import { transformSync, type Options } from '@swc/core';
import {
  applyCodeTransforms,
  applyMagicComments,
  type TransformOptions,
} from './codeTransforms.js';

// Re-export TransformOptions for consumers
export type { TransformOptions };

/**
 * Get SWC target based on options
 */
function getSwcTarget(options?: TransformOptions): 'es2022' | 'esnext' {
  if (options?.targetVersion === 'ESNext') return 'esnext';
  // SWC uses es2022 as highest stable target, but supports ES2024+ features
  // via esnext when targeting latest features
  if (options?.targetVersion === 'ES2024') return 'esnext';
  return 'es2022';
}

/**
 * Transpile TypeScript/JSX code using SWC
 *
 * Supports:
 * - Import attributes: import data from './file.json' with { type: 'json' }
 * - Dynamic imports with attributes: import('./file.json', { with: { type: 'json' } })
 * - Modern decorators (Stage 3 - 2022-03)
 * - TypeScript 5.x features (satisfies, const type params, using declarations)
 * - Explicit resource management (using/await using)
 *
 * Note: SWC 1.3+ automatically supports import attributes/assertions in parsing.
 * The parser handles the 'with' clause without explicit configuration.
 */
export function transpileWithSWC(
  code: string,
  options?: TransformOptions
): string {
  const target = getSwcTarget(options);

  const swcOptions: Options = {
    filename: 'index.tsx',
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: options?.jsx !== false,
        decorators: options?.experimentalDecorators ?? true,
        dynamicImport: true,
        // Import attributes are automatically supported in SWC 1.3+
      },
      target,
      transform: {
        // Modern decorators (Stage 3 - 2022-03)
        decoratorVersion: '2022-03',
        // Explicit resource management (using declarations)
        // SWC handles this automatically when target is esnext
        react: {
          runtime: 'classic',
          pragma: 'React.createElement',
          pragmaFrag: 'React.Fragment',
        },
      },
      // Keep loose: false for spec compliance
      loose: false,
      externalHelpers: false,
      // Preserve class names for better debugging and stack traces
      keepClassNames: true,
      // Preserve function names for debugging
      preserveAllComments: false,
    },
    module: {
      type: 'commonjs',
      strict: false,
      strictMode: false,
      noInterop: false,
      // Import assertions/attributes interop
      importInterop: 'swc',
    },
    sourceMaps: false,
    isModule: true,
  };

  try {
    const result = transformSync(code, swcOptions);
    return result.code;
  } catch (error) {
    // Re-throw with more context
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SWC transpilation failed: ${message}`);
  }
}

/**
 * Full transform pipeline using SWC
 */
export function transformCode(
  code: string,
  options: TransformOptions = {}
): string {
  if (!code.trim()) return '';

  try {
    // Step 1: Apply magic comments BEFORE transpilation
    let processedCode = code;
    if (options.magicComments) {
      const debugFn = options.debugFunctionName || 'debug';
      processedCode = applyMagicComments(code, debugFn);
    }

    // Step 2: Transpile TS/JSX with SWC (much faster than TSC)
    const transpiled = transpileWithSWC(processedCode, options);

    // Step 3: Apply other code transformations
    const transformed = applyCodeTransforms(transpiled, options);

    return transformed;
  } catch (error) {
    // If transpilation fails, try to apply transforms to original code
    console.error('SWC Transpilation error:', error);
    return applyCodeTransforms(code, options);
  }
}

// Re-export for backwards compatibility
export { transpileWithSWC as transpileWithTypeScript };
export { applyCodeTransforms };
