/**
 * C++ WASM Bindings for CheeseJS
 *
 * This module provides the bridge between JavaScript and compiled C++ WebAssembly module.
 * Uses Emscripten conventions for memory management and output capture.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let wasmInstance = null;
let stdoutBuffer = [];
let stderrBuffer = [];

/**
 * Initialize WASM module
 */
export async function initialize(memory, imports) {
  const wasmPath = require.resolve('../runtime/runtime.wasm');
  const wasmBuffer = await require('fs/promises').readFile(wasmPath);

  // Extend imports with our stdout/stderr handlers and Emscripten compatibility
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
      // Emscripten-specific imports
      emscripten_memcpy_big: (dest, src, num) => {
        const heap = new Uint8Array(memory.buffer);
        heap.set(heap.subarray(src, src + num), dest);
      },
      emscripten_resize_heap: () => false,
      __cxa_throw: () => {
        throw new Error('C++ exception thrown');
      },
      abort: () => {
        throw new Error('Execution aborted');
      },
    },
    wasi_snapshot_preview1: {
      fd_write: (fd, iovs, iovsLen, nwritten) => {
        const mem = new DataView(memory.buffer);
        const heap = new Uint8Array(memory.buffer);
        let written = 0;

        for (let i = 0; i < iovsLen; i++) {
          const ptr = mem.getUint32(iovs + i * 8, true);
          const len = mem.getUint32(iovs + i * 8 + 4, true);
          const text = new TextDecoder().decode(heap.subarray(ptr, ptr + len));

          if (fd === 1) {
            stdoutBuffer.push(text);
            handleStdout(text);
          } else if (fd === 2) {
            stderrBuffer.push(text);
            handleStderr(text);
          }

          written += len;
        }

        mem.setUint32(nwritten, written, true);
        return 0;
      },
      fd_close: () => 0,
      fd_seek: () => 0,
      proc_exit: (code) => {
        throw new Error(`Process exited with code ${code}`);
      },
    },
  };

  const module = await WebAssembly.compile(wasmBuffer);
  wasmInstance = await WebAssembly.instantiate(module, extendedImports);

  // Call _initialize or _start if available (Emscripten convention)
  if (typeof wasmInstance.exports._initialize === 'function') {
    wasmInstance.exports._initialize();
  }

  return wasmInstance;
}

/**
 * Prepare code for execution
 */
export function prepareCode(code) {
  return code.trim();
}

/**
 * Execute code in WASM instance
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
      instance.exports._run ||
      instance.exports._run_code;

    if (typeof runFunction !== 'function') {
      throw new Error('WASM module does not export a "run" function');
    }

    // Allocate string in WASM memory
    let exitCode = 0;

    if (instance.exports._malloc && instance.exports._free) {
      // Emscripten style with malloc/free
      const encoder = new TextEncoder();
      const encoded = encoder.encode(preparedCode + '\0'); // null-terminated
      const ptr = instance.exports._malloc(encoded.length);
      const heap = new Uint8Array(instance.exports.memory.buffer);
      heap.set(encoded, ptr);
      exitCode = runFunction(ptr);
      instance.exports._free(ptr);
    } else if (instance.exports.alloc && instance.exports.dealloc) {
      // Custom allocator
      const encoder = new TextEncoder();
      const encoded = encoder.encode(preparedCode);
      const ptr = instance.exports.alloc(encoded.length);
      const heap = new Uint8Array(instance.exports.memory.buffer);
      heap.set(encoded, ptr);
      exitCode = runFunction(ptr, encoded.length);
      instance.exports.dealloc(ptr, encoded.length);
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
  console.log('[C++]', text);
};

/**
 * Handle stderr output - can be overridden by the executor
 */
export let handleStderr = (text) => {
  console.error('[C++ Error]', text);
};

export default {
  initialize,
  prepareCode,
  execute,
  handleStdout,
  handleStderr,
};
