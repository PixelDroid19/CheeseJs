# CheeseJS Development Guide

CheeseJS is an Electron-based code playground for JavaScript, TypeScript, and Python (experimental). Forked from JSRunner with enhanced architecture.

## Architecture Overview

### Three-Process Model (Electron + Worker Threads)
- **Main Process** (`electron/main.ts`): IPC orchestration, window management, worker pool
- **Renderer Process** (`src/`): React UI with Monaco editor, Zustand state management
- **Worker Threads**: Isolated execution environments
  - `electron/workers/codeExecutor.ts`: JS/TS execution in Node.js VM sandbox
  - `electron/workers/pythonExecutor.ts`: Python execution via Pyodide (WASM)

### Communication Flow
```
User Code → Monaco Editor → IPC (electron/preload.ts) → Main Process → Worker Thread
                ↓
         Worker Result → IPC → Renderer → Result Display
```

**Critical**: Use `window.electronAPI` (preload bridge) for renderer-to-main communication. Never import Node.js modules directly in `src/`.

## Code Execution Pipeline

### 1. Transpilation (`electron/transpiler/tsTranspiler.ts`)
Uses TypeScript Compiler API to transform code, then applies Babel-like transforms:
- **Loop Protection**: Injects timeout checks in loops to prevent hangs
- **Debug Injection**: Wraps top-level expressions with `debug(line, value)` for inline results
- **Magic Comments**: Enables `// @log` annotations to auto-log values

### 2. Babel Plugins (`src/lib/babel/`)
Custom AST transforms run in browser context:
- `stray-expression.ts`: Wraps standalone expressions with `debug()` calls for inline display
- `magic-comments.ts`: Parses `// @log` directives and injects logging
- `loop-protection.ts`: Adds iteration counters to prevent infinite loops
- `top-level-this.ts`: Rewrites top-level `this` to `globalThis`
- `log-babel.ts`: Intercepts console methods for aligned output

**Pattern**: All plugins follow `({ types: t }: { types: typeof BabelTypes }): PluginObj` signature.

### 3. Worker Sandbox (`electron/workers/codeExecutor.ts`)
Executes code in Node.js `vm.Context` with:
- Custom `console` implementation sending results via `parentPort.postMessage()`
- `debug(line, value)` global for line-aligned output
- `require()` support via Module.createRequire for installed packages
- Timeout enforcement using vm.Script `timeout` option

**Security Note**: Package names are validated with regex before installation to prevent command injection.

## State Management (Zustand)

All stores use `zustand` with `persist` middleware:
- `useCodeStore`: Editor content, execution results, loading state
- `useLanguageStore`: ML-based language detection (vscode-languagedetection), Monaco config
- `useSettingsStore`: Theme, font size, output preferences
- `usePackagesStore`: npm package installation state (JS/TS)
- `usePythonPackagesStore`: Python package state (micropip)

**Pattern**: Extract state with `const value = useStore((state) => state.value)` to minimize re-renders.

## Package Management

### JavaScript/TypeScript (`electron/packages/packageManager.ts`)
- Installs to `{userData}/packages/node_modules` using `npm install --no-save`
- Makes packages available via `Module.createRequire` in worker VM
- Validates package names against npm naming rules before spawning install process

### Python (`electron/workers/pythonExecutor.ts`)
- Uses Pyodide's `micropip.install()` for pure-Python packages
- Installs at worker initialization or on-demand
- Limited to packages compatible with WASM environment

## Language Detection

Uses `@vscode/vscode-languagedetection` (ML model) in `useLanguageStore`:
1. Lazy-loads WASM model on first detection
2. Returns confidence scores for detected languages
3. Maps results to Monaco language IDs (`monacoId`)
4. Only executable languages (JS/TS/Python) can be run

**Example**: TypeScript detection confidence >80% auto-switches Monaco to `typescript` mode.

## Development Workflows

### Running Locally
```bash
pnpm install          # Install deps
pnpm run dev          # Start Vite dev server + Electron
```

### Building
```bash
pnpm run build:win    # Windows x64 installer (release/{version}/)
pnpm run build:dist   # Vite build only (dist/)
```

### Testing
```bash
pnpm test                          # Vitest unit tests
npx playwright test                # E2E tests (tests/*.spec.ts)
pnpm run quality                   # Lint + format + test
```

**E2E Pattern**: Tests launch packaged Electron app using `@playwright/test` with `_electron.launch()`.

## Key Conventions

### File Organization
- `electron/`: Main process, workers, native Node.js code
- `src/`: Renderer process, React components, browser-safe code
- `src/lib/`: Utilities (babel plugins, element parser, RPC)
- `src/store/`: Zustand state stores
- `src/hooks/`: React hooks (useCodeRunner, usePackageInstaller)

### Component Patterns
- Lazy load non-critical UI: `const Settings = lazy(() => import('./components/Settings/Settings'))`
- Use `<Suspense fallback={null}>` for lazy components
- Monaco editor wrapped in `react-split` for resizable panels

### Styling
- Tailwind CSS 4.x (via `@tailwindcss/vite`)
- Custom themes in `src/themes/` (JSON format)
- Framer Motion for animations

### Internationalization
- `react-i18next` with English/Spanish locales (`src/i18n/locales/`)
- Auto-detects browser language
- Access via `const { t } = useTranslation()`

## Common Tasks

### Adding a New Babel Plugin
1. Create in `src/lib/babel/` with standard `PluginObj` signature
2. Import in code transform pipeline (usually in `useCodeRunner.ts` or transpiler)
3. Add corresponding tests in `src/__test__/`

### Adding Package Support
- **JS/TS**: Update `packageManager.ts` validation if needed
- **Python**: Ensure package is Pyodide-compatible (pure Python or has WASM builds)

### Debugging Worker Issues
- Check main process console (Electron DevTools)
- Enable `NODE_OPTIONS=--inspect` for worker debugging
- Use `console.log` in workers (visible in main process logs)

## Gotchas

1. **Don't mix Node.js and browser code**: Keep `electron/` separate from `src/`
2. **Worker state is persistent**: Workers stay alive across executions; use message types to clear state
3. **Monaco theming**: Must register custom themes before setting with `monaco.editor.defineTheme()`
4. **Vite config**: Content-Security-Policy in dev server must allow `unsafe-eval` for Monaco
5. **TypeScript transpilation**: Uses `ts.transpileModule` (not full type checking) for speed

## Production Builds

- Uses `electron-builder` with NSIS installer for Windows
- Code signing disabled by default (`forceCodeSigning: false`)
- Output directory: `release/{version}/`
- All workers bundled to `dist-electron/` via Vite plugin
