# CheeseJS Public API Reference

This document provides a consolidated reference for the public API available to plugin developers.

## Core Concepts

- **Plugins**: Extensions that add functionality (languages, themes, commands, etc.)
- **Manifest**: `package.json` file defining metadata and contributions
- **Context**: Object passed to `activate()` containing API access

## Plugin Context

Every plugin's `activate` function receives a `PluginContext`:

```typescript
interface PluginContext {
  /** The parsed package.json manifest */
  manifest: PluginManifest;
  /** Absolute path to the plugin directory */
  pluginPath: string;
  /** Persistent storage for the plugin */
  storage: PluginStorage;
  /** Scoped logger instance */
  logger: PluginLogger;
  /** Array to push disposables (cleaned up on deactivation) */
  subscriptions: Disposable[];
}
```

### Storage API

Persist data between sessions:

```typescript
interface PluginStorage {
  get<T>(key: string, defaultValue?: T): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  keys(): string[];
}
```

### Logger API

Log messages to the CheeseJS console:

```typescript
interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}
```

## Contribution Points

Plugins define contributions in `package.json` under the `contributes` key.

### Languages

Register new programming languages.

```typescript
interface LanguageContribution {
  id: string; // e.g. "rust"
  name: string; // e.g. "Rust"
  extensions: string[]; // e.g. [".rs"]
  configuration?: {
    comments?: {
      lineComment?: string;
      blockComment?: [string, string];
    };
    brackets?: [string, string][];
  };
}
```

### Transpilers

Transform code from one language to another (usually to JavaScript).

```typescript
interface TranspilerContribution {
  sourceLanguage: string; // e.g. "coffeescript"
  targetLanguage: string; // e.g. "javascript"
  priority?: number; // Higher wins
}
```

To implement the transpiler logic, access the transpiler registry in `activate()`:

```typescript
// Example: Registering a transpiler
context.transpiler.register({
  transform(code, options) {
    return {
      code: compile(code),
      map: generateMap(code),
    };
  },
});
```

### UI Panels

Add custom sidebars or bottom panels.

```typescript
interface PanelContribution {
  id: string;
  title: string;
  icon?: string; // Lucide icon name
  location: 'sidebar' | 'bottom' | 'floating';
}
```

### Commands & Keybindings

Register commands that can be triggered via palette or shortcuts.

```typescript
interface CommandContribution {
  command: string; // unique ID
  title: string;
  category?: string;
  icon?: string;
}

interface KeybindingContribution {
  command: string;
  key: string; // "ctrl+s"
  mac?: string; // "cmd+s"
  when?: string; // Context key expression
}
```

### Themes

Add Monaco editor themes.

```typescript
interface ThemeContribution {
  id: string;
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  path: string; // Relative path to JSON theme file
}
```

## WebAssembly Languages

For high-performance language support using WASM.

```typescript
interface WasmLanguageContribution {
  id: string;
  name: string;
  extensions: string[];
  version: string;
  wasmPath: string; // Path to .wasm file
  bindingsPath?: string; // Path to .js glue code
  memoryLimit?: number;
  timeout?: number;
}
```

See [WASM_LANGUAGES.md](./WASM_LANGUAGES.md) for detailed implementation guide.
