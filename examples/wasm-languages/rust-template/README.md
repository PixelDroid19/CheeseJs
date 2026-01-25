# Rust Language Plugin for CheeseJS

This template provides a starting point for creating Rust language support for CheeseJS using WebAssembly.

## Prerequisites

- Rust 1.70+ with WebAssembly target
- `wasm-pack` for building
- Node.js 18+ for bindings

## Setup

1. Install Rust WebAssembly target:

```bash
rustup target add wasm32-unknown-unknown
```

2. Install wasm-pack:

```bash
cargo install wasm-pack
```

## Building

Build the WASM module:

```bash
wasm-pack build --target web --out-dir runtime
```

This will generate:

- `runtime/runtime.wasm` - Compiled WebAssembly module
- `runtime/runtime.js` - Generated JS bindings

## Usage

The compiled WASM module can be used with CheeseJS as a plugin. Place this directory in `~/.cheesejs/plugins/`.

## Architecture

### Components

- **src/lib.rs** - Rust code that compiles to WebAssembly
- **bindings/index.js** - JavaScript bridge between WASM and CheeseJS
- **package.json** - Plugin manifest with `contributes.wasmLanguages`

### How It Works

1. CheeseJS loads the plugin manifest
2. WASM module is compiled and loaded
3. JavaScript bindings provide the interface
4. Code is executed through the WASM runtime

## Customization

### Adding Functionality

Edit `src/lib.rs` to add new language features:

```rust
pub fn eval(&mut self, code: &str) -> Result<i32, String> {
    // Your implementation here
}
```

### Modifying Bindings

Update `bindings/index.js` to change how code is prepared and executed:

```javascript
export function prepareCode(code) {
  return code.trim();
}
```

## Development

Build in watch mode:

```bash
cargo watch -x build
```

Run tests:

```bash
cargo test
```

## Resources

- [Rust WebAssembly Book](https://rustwasm.github.io/docs/book/)
- [wasm-bindgen Documentation](https://rustwasm.github.io/wasm-bindgen/)
- [CheeseJS Plugin API](https://github.com/cheesejs/cheesejs/blob/main/docs/PLUGIN_SYSTEM.md)
