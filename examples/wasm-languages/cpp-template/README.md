# C++ Language Plugin for CheeseJS

This template provides a starting point for creating C++ language support for CheeseJS using WebAssembly and Emscripten.

## Prerequisites

- Emscripten 3.0+ for compiling to WebAssembly
- Node.js 18+ for build scripts
- C++17 compatible compiler

## Setup

### Installing Emscripten

Follow the official Emscripten SDK installation guide:
https://emscripten.org/docs/getting_started/downloads.html

Or use Docker:

```bash
docker run --rm -v $(pwd):/src -w /src emscripten/emsdk emcc src/runtime.cpp -o runtime/runtime.wasm
```

## Building

### Using the build script (Node.js):

```bash
node build.js
```

### Using the Makefile (Unix):

```bash
make
```

### Clean build:

```bash
node build.js --clean
# or
make clean
```

This will generate:

- `runtime/runtime.wasm` - Compiled WebAssembly module

## Usage

The compiled WASM module can be used with CheeseJS as a plugin. Place this directory in `~/.cheesejs/plugins/`.

## Architecture

### Components

- **src/runtime.cpp** - C++ code that compiles to WebAssembly
- **bindings/index.js** - JavaScript bridge between WASM and CheeseJS
- **package.json** - Plugin manifest with `contributes.wasmLanguages`
- **build.js** - Cross-platform build script

### How It Works

1. CheeseJS loads plugin manifest
2. WASM module is compiled with Emscripten
3. JavaScript bindings provide interface
4. Code is executed through WASM runtime

## Customization

### Adding Functionality

Edit `src/runtime.cpp` to add new language features:

```cpp
extern "C" {
    EMSCRIPTEN_KEEPALIVE
    int your_function(WasmRuntime* runtime, const char* input) {
        // Your implementation here
        return 0;
    }
}
```

Remember to export new functions in the build flags:

```bash
-s EXPORTED_FUNCTIONS=["_create_runtime","_your_function",...]
```

### Modifying Bindings

Update `bindings/index.js` to change how code is prepared and executed:

```javascript
export function prepareCode(code) {
  return code.trim();
}
```

## Development

### Debugging

Build with debug symbols:

```bash
emcc -g4 -s WASM=1 src/runtime.cpp -o runtime/runtime.wasm
```

### Testing

Test in browser with Emscripten's runtime:

```bash
emrun --browser chrome runtime/runtime.html
```

## Resources

- [Emscripten Documentation](https://emscripten.org/docs/api_reference/)
- [WebAssembly C/C++ API](https://emscripten.org/docs/api_reference/emscripten.h.html)
- [CheeseJS Plugin API](https://github.com/cheesejs/cheesejs/blob/main/docs/PLUGIN_SYSTEM.md)
