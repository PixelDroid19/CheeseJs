/**
 * Rust WASM Bindings for CheeseJS
 *
 * This module provides the bridge between JavaScript and the compiled Rust WebAssembly module.
 * Implements proper stdout/stderr capture for real-time output.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let wasmInstance = null;
let stdoutBuffer = [];
let stderrBuffer = [];

/**
 * Initialize the WASM module
 */
export async function initialize(memory, imports) {
  const wasmPath = require.resolve('../runtime/runtime.wasm');
  const wasmBuffer = await require('fs/promises').readFile(wasmPath);

  // Extend imports with our stdout/stderr handlers
  const extendedImports = {
    ...imports,
    env: {
      ...imports.env,
      memory,
      // Override write functions to capture output
      write_stdout: (ptr, len) => {
        const text = new TextDecoder().decode(
          new Uint8Array(memory.buffer, ptr, len)
        );
        stdoutBuffer.push(text);
        handleStdout(text);
      },
      write_stderr: (ptr, len) => {
        const text = new TextDecoder().decode(
          new Uint8Array(memory.buffer, ptr, len)
        );
        stderrBuffer.push(text);
        handleStderr(text);
      },
      // Rust-specific imports
      __wbindgen_throw: (ptr, len) => {
        const text = new TextDecoder().decode(
          new Uint8Array(memory.buffer, ptr, len)
        );
        throw new Error(text);
      },
    },
  };

  const module = await WebAssembly.compile(wasmBuffer);
  wasmInstance = await WebAssembly.instantiate(module, extendedImports);

  return wasmInstance;
}

/**
 * Prepare code for execution
 */
export function prepareCode(code) {
  return code.trim();
}

/**
 * Execute code in the WASM instance
 */
export async function execute(instance, code) {
  // Clear buffers before execution
  stdoutBuffer = [];
  stderrBuffer = [];

  const preparedCode = prepareCode(code);

  try {
    // Try different export conventions
    const runFunction =
      instance.exports.run ||
      instance.exports.run_code ||
      instance.exports._run;

    if (typeof runFunction !== 'function') {
      throw new Error('WASM module does not export a "run" function');
    }

    // For Rust with wasm-bindgen, we need to pass strings properly
    let exitCode = 0;

    if (instance.exports.__wbindgen_malloc) {
      // wasm-bindgen style
      const encoder = new TextEncoder();
      const encoded = encoder.encode(preparedCode);
      const ptr = instance.exports.__wbindgen_malloc(encoded.length);
      const mem = new Uint8Array(instance.exports.memory.buffer);
      mem.set(encoded, ptr);
      exitCode = runFunction(ptr, encoded.length);
      instance.exports.__wbindgen_free(ptr, encoded.length);
    } else {
      // Direct call (for simpler WASM modules)
      exitCode = runFunction(preparedCode);
    }

    return {
      exitCode: exitCode || 0,
      stdout: stdoutBuffer.join(''),
      stderr: stderrBuffer.join(''),
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: stdoutBuffer.join(''),
      stderr: stderrBuffer.join('') + '\n' + (error.message || String(error)),
    };
  }
}

/**
 * Handle stdout output - can be overridden by the executor
 */
export let handleStdout = (text) => {
  console.log('[Rust]', text);
};

/**
 * Handle stderr output - can be overridden by the executor
 */
export let handleStderr = (text) => {
  console.error('[Rust Error]', text);
};

export default {
  initialize,
  prepareCode,
  execute,
  handleStdout,
  handleStderr,
};
