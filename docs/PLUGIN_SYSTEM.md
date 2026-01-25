# CheeseJS Plugin System

Complete plugin architecture for extending CheeseJS with custom languages, transpilers, UI panels, console formatters, commands, keybindings, snippets, themes, and settings.

## Quick Start

### 1. Create a Plugin

```
my-plugin/
  package.json  # Plugin Manifest (standard format)
  index.js      # Entry point
  README.md     # Documentation
```

### 2. Write the Manifest (`package.json`)

Use the standard `package.json` with a `contributes` section (VS Code style):

```json
{
  "name": "cheesejs-my-plugin",
  "displayName": "My Plugin",
  "version": "1.0.0",
  "description": "Does something cool",
  "author": "Your Name",
  "main": "index.js",
  "engines": {
    "cheesejs": "^1.1.0"
  },
  "contributes": {
    "languages": [...],
    "transpilers": [...],
    "panels": [...],
    "formatters": [...],
    "commands": [...],
    "keybindings": [...],
    "snippets": [...],
    "themes": [...],
    "configuration": {...}
  }
}
```

> **Note:** The legacy `plugin.json` format is also supported but deprecated.

### 3. Implement the Plugin (`index.js`)

```javascript
module.exports = {
  activate(context) {
    context.logger.info('Plugin activated!');
    // Register your extensions here
  },
  deactivate() {
    // Cleanup
  },
};
```

### 4. Install

Copy to `~/.cheesejs/plugins/my-plugin/` and activate in Settings → Plugins.

---

## Extension Points

### 1. Language Support

Add custom language syntax highlighting:

```json
{
  "contributes": {
    "languages": [
      {
        "id": "rust",
        "name": "Rust",
        "extensions": [".rs"],
        "configuration": {
          "comments": { "lineComment": "//" },
          "brackets": [
            ["(", ")"],
            ["{", "}"],
            ["[", "]"]
          ]
        }
      }
    ]
  }
}
```

**Registry:** `language-registry.ts` (renderer)  
**Integration:** Automatic Monaco registration

---

### 2. Transpiler Extensions

Add code transformation capabilities:

**Manifest:**

```json
{
  "contributes": {
    "transpilers": [
      {
        "sourceLanguage": "coffeescript",
        "targetLanguage": "javascript",
        "priority": 10
      }
    ]
  }
}
```

**Plugin Code:**

```javascript
const coffeescript = require('coffeescript');

module.exports = {
  activate(context) {
    // Register transpiler extension
    // (Implementation depends on transpiler registry API)
    context.transpiler.register({
      transform(code) {
        return { code: coffeescript.compile(code) };
      },
    });
  },
};
```

**Registry:** `transpiler-registry.ts` (main process)  
**Integration:** Checked before built-in transpilers

---

### 3. UI Panels

Add custom sidebar/bottom panels:

**Manifest:**

```json
{
  "contributes": {
    "panels": [
      {
        "id": "http-inspector",
        "title": "HTTP Inspector",
        "icon": "globe",
        "location": "sidebar",
        "priority": 5
      }
    ]
  }
}
```

**Plugin Code:**

```javascript
module.exports = {
  activate(context) {
    context.panels.register({
      render(container) {
        container.innerHTML = '<div>My Panel Content</div>';
      },
      onActivate() {
        console.log('Panel shown');
      },
      dispose() {
        /* cleanup */
      },
    });
  },
};
```

**Registry:** `panel-registry.ts` (renderer)  
**Integration:** Rendered in app layout

---

### 4. Console Formatters

Customize output display:

**Manifest:**

```json
{
  "contributes": {
    "formatters": [
      {
        "types": ["Date", "CustomClass"],
        "priority": 10
      }
    ]
  }
}
```

**Plugin Code:**

```javascript
module.exports = {
  activate(context) {
    context.formatters.register({
      canFormat(value, type) {
        return type === 'Date';
      },
      format(value) {
        return `📅 ${value.toLocaleString()}`;
      },
    });
  },
};
```

**Registry:** `formatter-registry.ts` (renderer)  
**Integration:** Applied in ResultDisplay

---

### 5. Commands

Register executable commands:

**Manifest:**

```json
{
  "contributes": {
    "commands": [
      {
        "command": "myPlugin.sayHello",
        "title": "Say Hello",
        "category": "My Plugin",
        "icon": "message-circle"
      }
    ]
  }
}
```

**Plugin Code:**

```javascript
const { commandRegistry } = require('cheesejs/plugins');

module.exports = {
  activate(context) {
    commandRegistry.registerHandler('myPlugin.sayHello', () => {
      console.log('Hello from my plugin!');
    });
  },
};
```

**Registry:** `command-registry.ts` (renderer)  
**Execution:** `commandRegistry.execute('myPlugin.sayHello')`

---

### 6. Keybindings

Bind keyboard shortcuts to commands:

**Manifest:**

```json
{
  "contributes": {
    "keybindings": [
      {
        "command": "myPlugin.sayHello",
        "key": "ctrl+shift+h",
        "mac": "cmd+shift+h",
        "when": "editorFocus"
      }
    ]
  }
}
```

**Registry:** `keybinding-registry.ts` (renderer)  
**Integration:** Automatic Monaco registration

---

### 7. Snippets

Add code snippets for autocomplete:

**Manifest:**

```json
{
  "contributes": {
    "snippets": [
      {
        "language": "javascript",
        "path": "./snippets/javascript.json"
      }
    ]
  }
}
```

**Snippet File (`snippets/javascript.json`):**

```json
{
  "Console Log": {
    "prefix": "log",
    "body": ["console.log('$1');", "$0"],
    "description": "Log to console"
  },
  "Arrow Function": {
    "prefix": "af",
    "body": ["const ${1:name} = (${2:params}) => {", "\t$0", "};"],
    "description": "Arrow function"
  }
}
```

**Registry:** `snippet-registry.ts` (renderer)  
**Integration:** Monaco completion provider

---

### 8. Themes

Contribute custom editor themes:

**Manifest:**

```json
{
  "contributes": {
    "themes": [
      {
        "id": "my-dark-theme",
        "label": "My Dark Theme",
        "uiTheme": "vs-dark",
        "path": "./themes/my-dark.json"
      }
    ]
  }
}
```

**Theme File (`themes/my-dark.json`):**

```json
{
  "base": "vs-dark",
  "inherit": true,
  "rules": [
    { "token": "comment", "foreground": "6A9955" },
    { "token": "keyword", "foreground": "569CD6" }
  ],
  "colors": {
    "editor.background": "#1E1E1E",
    "editor.foreground": "#D4D4D4"
  }
}
```

**Registry:** `theme-registry.ts` (renderer)  
**Integration:** Monaco editor theming

---

### 9. Configuration

Add plugin settings to the Settings UI:

**Manifest:**

```json
{
  "contributes": {
    "configuration": {
      "title": "My Plugin Settings",
      "properties": {
        "myPlugin.enableFeature": {
          "type": "boolean",
          "default": true,
          "description": "Enable the awesome feature"
        },
        "myPlugin.maxItems": {
          "type": "number",
          "default": 10,
          "minimum": 1,
          "maximum": 100,
          "description": "Maximum number of items"
        }
      }
    }
  }
}
```

**Access in Plugin:**

```javascript
const { usePluginConfigStore } = require('cheesejs/store');

// Get value
const enabled = usePluginConfigStore
  .getState()
  .getValue('myPlugin.enableFeature', true);

// Set value
usePluginConfigStore.getState().setValue('myPlugin.enableFeature', false);
```

**Store:** `usePluginConfigStore.ts`  
**Integration:** Settings UI (coming soon)

---

## Plugin Context API

Each plugin receives a `context` object:

```typescript
interface PluginContext {
  manifest: PluginManifest; // Your plugin.json
  pluginPath: string; // Plugin directory path
  storage: PluginStorage; // Persistent key-value store
  logger: PluginLogger; // Scoped logging
  subscriptions: Disposable[]; // Cleanup tracking
}
```

### Storage Example

```javascript
activate(context) {
  // Save data
  context.storage.set('lastRun', Date.now());

  // Read data
  const lastRun = context.storage.get('lastRun', 0);
}
```

### Logger Example

```javascript
context.logger.info('Starting...');
context.logger.warn('Deprecated API used');
context.logger.error('Failed to initialize');
```

---

## Examples

See `examples/plugins/` for working examples:

- **yaml-support** - Language extension
- _(More examples coming soon)_

---

## Architecture

```
┌─────────────────────────────────────┐
│        Renderer Process             │
│  ┌───────────────────────────────┐  │
│  │  Language Registry            │  │
│  │  Panel Registry               │  │
│  │  Formatter Registry           │  │
│  │  Command Registry             │  │
│  │  Keybinding Registry          │  │
│  │  Snippet Registry             │  │
│  │  Theme Registry               │  │
│  │  Plugin Config Store          │  │
│  │  Marketplace Service          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
           ↕ IPC
┌─────────────────────────────────────┐
│        Main Process                 │
│  ┌───────────────────────────────┐  │
│  │  Plugin Host                  │  │
│  │  Plugin Loader                │  │
│  │  Plugin Sandbox               │  │
│  │  Transpiler Registry          │  │
│  │  Manifest Parser              │  │
│  │  Plugin Watcher (HMR)         │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Plugin Marketplace

CheeseJS includes a built-in marketplace for discovering and installing plugins.

### Browsing Plugins

1. Open Settings → Marketplace
2. Search by name, category, or keyword
3. Sort by downloads, rating, or date

### Installing from Marketplace

Plugins can be installed directly from the marketplace UI or programmatically.

### Installing from URL

Plugins can be installed directly from a URL (ZIP archive):

```javascript
// Via IPC
window.pluginAPI.installFromUrl(
  'https://example.com/my-plugin.zip',
  'my-plugin-id'
);
```

---

## Security

CheeseJS provides a security sandbox for plugins with permission-based API access.

### Permissions

Plugins can request permissions in their manifest:

```json
{
  "permissions": [
    "filesystem", // Read/write file access
    "network", // HTTP/HTTPS requests
    "shell", // Execute shell commands
    "clipboard", // Clipboard access
    "storage" // Plugin storage (always granted)
  ]
}
```

### Sandbox Features

- **API Restriction:** Plugins only get access to APIs matching their permissions
- **Network Filtering:** Blocked access to localhost and internal IPs
- **Timeout Enforcement:** Long-running operations are terminated
- **Capability Analysis:** Code is analyzed for required permissions

> [!WARNING]
> Plugins still run with elevated privileges. Only install plugins from trusted sources.

**Implementation:** `plugin-sandbox.ts` (main process)

---

## Best Practices

1. **Error Handling:** Always wrap activation in try-catch
2. **Cleanup:** Dispose resources in `deactivate()`
3. **Versioning:** Use semver (e.g., 1.2.3)
4. **Documentation:** Include a README
5. **Testing:** Test activation/deactivation cycles

---

## Development

### Testing a Plugin

1. Copy to `~/.cheesejs/plugins/`
2. Open Settings → Plugins
3. Click "Activate"
4. Check console for logs

### Debugging

```javascript
activate(context) {
  context.logger.debug('Debug info:', someVariable);
}
```

### Hot Module Replacement (HMR)

CheeseJS supports Hot Module Replacement for plugin development.

1. Edit your plugin files (`index.js`, `package.json`, or renderer scripts).
2. Save the file.
3. The plugin will automatically reload (deactivate -> update -> activate) without restarting the application.

---

## API Reference

Full TypeScript definitions: `src/lib/plugins/plugin-api.ts`

---

## License

MIT
