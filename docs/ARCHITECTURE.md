# CheeseJS Architecture

This document describes the technical architecture of CheeseJS, an Electron-based code playground for JavaScript, TypeScript, and Python.

## Overview

CheeseJS uses a **three-process model** to ensure safe code execution and responsive UI:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │  Monaco Editor  │  │  Result Display  │  │  Package Manager  │   │
│  └────────┬────────┘  └────────▲─────────┘  └─────────┬─────────┘   │
│           │                    │                      │              │
│           ▼                    │                      ▼              │
│  ┌─────────────────────────────┴─────────────────────────────────┐  │
│  │                     Renderer Process (React)                   │  │
│  │  • Zustand State Management                                    │  │
│  │  • Language Detection (ML-based)                               │  │
│  │  • Code Transformation (Babel plugins)                         │  │
│  └────────────────────────────┬──────────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────────┘
                                │ IPC (preload.ts)
┌───────────────────────────────┼──────────────────────────────────────┐
│                               ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     Main Process (Electron)                      │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │ │
│  │  │ WorkerPoolManager│  │   IPCHandlers    │  │ WindowManager │  │ │
│  │  └────────┬─────────┘  └────────┬─────────┘  └───────────────┘  │ │
│  │           │                     │                                │ │
│  │           ▼                     ▼                                │ │
│  │  ┌─────────────────────────────────────────────────────────────┐│ │
│  │  │               Transpiler (TS or SWC)                        ││ │
│  │  │  • Code transformation (debug injection, loop protection)   ││ │
│  │  │  • Shared transforms via codeTransforms.ts                  ││ │
│  │  └─────────────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                        Main Process (electron/main.ts)               │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Worker Threads
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│  JS/TS Worker     │  │  Python Worker    │  │  SWC Worker       │
│  (codeExecutor)   │  │  (pythonExecutor) │  │  (transpiler)     │
│                   │  │                   │  │                   │
│  • Node.js VM     │  │  • Pyodide WASM   │  │  • Fast transpile │
│  • Sandbox        │  │  • micropip       │  │                   │
│  • SmartCache     │  │  • Memory Mgmt    │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

## Process Communication

### Renderer → Main (IPC)

Communication from the React UI to the main process uses the `electronAPI` bridge defined in `electron/preload.ts`:

```typescript
// In renderer
window.electronAPI.executeCode({
  id: 'exec-123',
  code: '
  language: 'javascript',
  options: { timeout: 30000 }
});
```

### Main → Workers (postMessage)

The main process communicates with worker threads via `postMessage`:

```typescript
// In main process
codeWorker.postMessage({
  type: 'execute',
  id: 'exec-123',
  code: transformedCode,
  options: { timeout: 30000 },
});
```

### Workers → Main → Renderer

Results flow back through the chain:

1. Worker sends result via `parentPort.postMessage()`
2. Main process receives and forwards via `win.webContents.send()`
3. Renderer receives via `window.electronAPI.onExecutionResult()`

## Key Modules

### Core Modules (`electron/core/`)

- **WorkerPoolManager**: Manages worker lifecycle, execution queuing, and cancellation
- **IPCHandlers**: Centralized IPC handler registration
- **WindowManager**: BrowserWindow creation and management

### Transpiler (`electron/transpiler/`)

- **tsTranspiler.ts**: TypeScript Compiler API-based transpilation
- **swcTranspiler.ts**: SWC-based transpilation (20-70x faster)
- **codeTransforms.ts**: Shared transformation logic:
  - `transformConsoleTodebug()`: Replace console.\* with debug()
  - `addLoopProtection()`: Inject iteration limits
  - `wrapTopLevelExpressions()`: Auto-display results
  - `applyMagicComments()`: Process //? annotations

### Workers (`electron/workers/`)

- **codeExecutor.ts**: JavaScript/TypeScript execution in VM sandbox
- **pythonExecutor.ts**: Python execution via Pyodide WASM
- **SmartScriptCache.ts**: LRU-K cache for compiled scripts
- **MemoryManager.ts**: Memory monitoring and cleanup

### State Management (`src/store/`)

All stores use Zustand with persistence:

| Store                    | Purpose                           |
| ------------------------ | --------------------------------- |
| `useCodeStore`           | Editor content, execution results |
| `useLanguageStore`       | Language detection, Monaco config |
| `useSettingsStore`       | User preferences                  |
| `usePackagesStore`       | npm package state                 |
| `usePythonPackagesStore` | Python package state              |
| `useSnippetsStore`       | Saved code snippets               |

### Babel Plugins (`src/lib/babel/`)

Client-side AST transformations:

- **loop-protection.ts**: Infinite loop prevention
- **stray-expression.ts**: Auto-display expressions
- **magic-comments.ts**: //? annotation processing
- **top-level-this.ts**: `this` → `globalThis` at top level
- **log-babel.ts**: Console method interception

## Code Execution Flow

```
1. User writes code in Monaco Editor
          │
2. useCodeRunner hook triggers execution
          │
3. Language detected (ML or pattern-based)
          │
4. IPC: execute-code → Main Process
          │
5. Code transformed (transpile + inject debug/loop protection)
          │
6. Worker executes code in sandbox
          │
7. Results sent back through IPC chain
          │
8. Results displayed inline via Result component
```

## Security Model

### AI Agent Profiles and Tool Permissions

The AI agent runtime follows a profile-based permission model inspired by Opencode:

- **build profile**: read + write tool access (editor/file modifications)
- **plan profile**: read-only tool access (analysis/planning, no writes)

Current execution mode mapping:

- `agent` → `build`
- `plan` → `plan`
- `verifier` → `plan`

This policy is enforced in `src/features/ai-agent/codeAgent.ts` via profile-aware tool filtering using `src/features/ai-agent/agentProfiles.ts`.

AI runtime concerns are separated into dedicated modules:

- `src/features/ai-agent/agentRuntime.ts`: mode/profile resolution, system prompt policy, execution step limits.
- `src/features/ai-agent/toolRegistry.ts`: centralized tool definitions and filtered tool exposure by mode/profile.
- `src/features/ai-agent/codeAgent.ts`: orchestration layer (provider + runtime + tool registry).

### VM Sandbox (JavaScript/TypeScript)

```javascript
const context = vm.createContext({
  console: customConsole,
  debug: debugFunction,
  require: restrictedRequire,
  // No access to process, fs, etc.
});
```

### Python Sandbox

Pyodide runs in WASM, providing natural isolation. Additional restrictions:

- No direct filesystem access
- Network limited to CORS-enabled endpoints
- Memory limits enforced

## Performance Optimizations

1. **Script Caching**: `SmartScriptCache` uses LRU-K with 50MB memory limit
2. **Worker Pooling**: Workers persist across executions
3. **Lazy Loading**: Heavy components loaded on demand
4. **SWC Option**: 20-70x faster transpilation available

## Directory Structure

```
electron/
├── main.ts              # Main process entry
├── preload.ts           # Context bridge
├── core/                # Core modules (NEW)
│   ├── WorkerPoolManager.ts
│   ├── IPCHandlers.ts
│   └── WindowManager.ts
├── transpiler/          # Code transformation
│   ├── tsTranspiler.ts
│   ├── swcTranspiler.ts
│   └── codeTransforms.ts  # Shared transforms (NEW)
├── workers/             # Execution workers
│   ├── codeExecutor.ts
│   ├── pythonExecutor.ts
│   └── SmartScriptCache.ts
└── packages/            # Package management
    └── packageManager.ts

src/
├── App.tsx              # React entry
├── components/          # UI components
├── hooks/               # Custom hooks
├── store/               # Zustand stores
├── lib/                 # Utilities
│   └── babel/           # Babel plugins
└── themes/              # Editor themes
```
