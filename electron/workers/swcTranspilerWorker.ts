/**
 * SWC Transpiler Worker Thread
 *
 * Runs SWC transpilation in a dedicated worker thread to:
 * - Unblock the main process (20-70x faster than TSC)
 * - Enable parallel transpilation requests
 * - Provide isolated transpilation environment
 *
 * Communication Protocol:
 * - Main -> Worker: { type: 'transpile', id, code, options }
 * - Worker -> Main: { type: 'result', id, code } | { type: 'error', id, error }
 */

import { parentPort } from 'worker_threads';
import { transformSync, type Options, type JscTarget } from '@swc/core';
import {
  applyCodeTransforms,
  applyMagicComments,
  type TransformOptions,
} from '../transpiler/codeTransforms.js';

// Re-export for type consumers
export type { TransformOptions };

// ============================================================================
// TYPES
// ============================================================================

// Extend TransformOptions for worker-specific options
export type TranspileOptions = TransformOptions;

interface TranspileRequest {
  type: 'transpile';
  id: string;
  code: string;
  options: TranspileOptions;
}

interface TranspileResult {
  type: 'result';
  id: string;
  code: string;
  timing: number;
}

interface TranspileError {
  type: 'error';
  id: string;
  error: string;
  timing: number;
}

type WorkerMessage = TranspileRequest | { type: 'ping' };
// WorkerResponse type used for documentation purposes
// type WorkerResponse = TranspileResult | TranspileError | { type: 'ready' } | { type: 'pong' }

// ============================================================================
// TRANSPILATION CACHE (in-memory for hot paths)
// ============================================================================

const transpileCache = new Map<string, { code: string; timestamp: number }>();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(code: string, options: TranspileOptions): string {
  const optKey = JSON.stringify({
    t: options.targetVersion,
    d: options.experimentalDecorators,
    j: options.jsx,
    fn: options.debugFunctionName,
  });
  // Simple hash for cache key
  let hash = 0;
  const str = code + optKey;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function getFromCache(key: string): string | null {
  const cached = transpileCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.code;
  }
  transpileCache.delete(key);
  return null;
}

function setCache(key: string, code: string): void {
  // Evict oldest entries if cache is full
  if (transpileCache.size >= CACHE_MAX_SIZE) {
    const oldest = [...transpileCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 10);
    oldest.forEach(([k]) => transpileCache.delete(k));
  }
  transpileCache.set(key, { code, timestamp: Date.now() });
}

// ============================================================================
// SWC TRANSPILATION
// ============================================================================

function getSwcTarget(options: TranspileOptions): JscTarget {
  switch (options.targetVersion) {
    case 'ESNext':
      return 'esnext';
    case 'ES2024':
      return 'es2022'; // SWC uses es2022 as highest stable
    default:
      return 'es2022';
  }
}

function transpileWithSWC(code: string, options: TranspileOptions): string {
  const target = getSwcTarget(options);

  const swcOptions: Options = {
    filename: 'index.tsx',
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: options.jsx !== false,
        decorators: options.experimentalDecorators ?? true,
        dynamicImport: true,
      },
      target,
      transform: {
        decoratorVersion: '2022-03',
        react: {
          runtime: 'classic',
          pragma: 'React.createElement',
          pragmaFrag: 'React.Fragment',
        },
      },
      loose: false,
      externalHelpers: false,
      keepClassNames: true,
    },
    module: {
      type: 'commonjs',
      strict: false,
      strictMode: false,
      noInterop: false,
      importInterop: 'swc',
    },
    sourceMaps: false,
    isModule: true,
  };

  const result = transformSync(code, swcOptions);
  return result.code;
}

// ============================================================================
// FULL TRANSFORM PIPELINE
// ============================================================================

function transformCode(code: string, options: TranspileOptions): string {
  if (!code.trim()) return '';

  const debugFn = options.debugFunctionName || 'debug';

  // Step 1: Apply magic comments BEFORE transpilation
  let processedCode = code;
  if (options.magicComments) {
    processedCode = applyMagicComments(code, debugFn);
  }

  // Step 2: Transpile TS/JSX with SWC
  const transpiled = transpileWithSWC(processedCode, options);

  // Step 3: Apply code transformations (using shared module)
  const transformed = applyCodeTransforms(transpiled, options);

  return transformed;
}

// ============================================================================
// WORKER MESSAGE HANDLER
// ============================================================================

function handleMessage(message: WorkerMessage): void {
  if (message.type === 'ping') {
    parentPort?.postMessage({ type: 'pong' });
    return;
  }

  if (message.type === 'transpile') {
    const startTime = performance.now();
    const { id, code, options } = message;

    try {
      // Check cache first
      const cacheKey = getCacheKey(code, options);
      let transpiledCode = getFromCache(cacheKey);

      if (!transpiledCode) {
        transpiledCode = transformCode(code, options);
        setCache(cacheKey, transpiledCode);
      }

      const timing = performance.now() - startTime;

      parentPort?.postMessage({
        type: 'result',
        id,
        code: transpiledCode,
        timing,
      } as TranspileResult);
    } catch (error) {
      const timing = performance.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      parentPort?.postMessage({
        type: 'error',
        id,
        error: errorMessage,
        timing,
      } as TranspileError);
    }
  }
}

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

if (parentPort) {
  parentPort.on('message', handleMessage);
  parentPort.postMessage({ type: 'ready' });
} else {
  console.error(
    '[SWCTranspilerWorker] No parentPort available - not running as worker'
  );
}

// Export for testing
export { transformCode, transpileWithSWC };
