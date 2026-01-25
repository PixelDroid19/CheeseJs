/**
 * Plugin Worker Process
 *
 * Runs plugins in an isolated UtilityProcess for security and stability.
 * If a plugin crashes, it won't bring down the main process.
 *
 * Communication is done via IPC messages with the main process.
 */

import vm from 'vm';

// Message types
interface PluginMessage {
  type: 'activate' | 'deactivate' | 'call' | 'ping' | 'shutdown';
  id: string;
  pluginId: string;
  data?: unknown;
}

interface PluginResponse {
  type: 'ready' | 'result' | 'error' | 'log' | 'pong';
  id: string;
  pluginId?: string;
  data?: unknown;
  error?: string;
}

// Plugin sandbox context
interface PluginSandboxContext {
  context: vm.Context;
  plugin: {
    activate?: (ctx: unknown) => void | Promise<void>;
    deactivate?: () => void | Promise<void>;
  };
  permissions: string[];
}

// Active plugin sandboxes
const activeSandboxes = new Map<string, PluginSandboxContext>();

/**
 * Create a sandboxed context for a plugin
 */
function createPluginSandbox(
  pluginId: string,
  permissions: string[] = ['storage']
): vm.Context {
  const sandbox: Record<string, unknown> = {
    // Safe console
    console: {
      log: (...args: unknown[]) => sendLog(pluginId, 'info', args),
      info: (...args: unknown[]) => sendLog(pluginId, 'info', args),
      warn: (...args: unknown[]) => sendLog(pluginId, 'warn', args),
      error: (...args: unknown[]) => sendLog(pluginId, 'error', args),
      debug: (...args: unknown[]) => sendLog(pluginId, 'debug', args),
    },

    // Timers
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,

    // Safe globals
    Promise,
    Buffer,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    Error,
    RegExp,
    Proxy,
    Reflect,

    // Module support
    module: { exports: {} },
    exports: {},
  };

  // Add fetch if network permission
  if (permissions.includes('network')) {
    sandbox.fetch = createSafeFetch(pluginId);
  }

  const context = vm.createContext(sandbox, {
    name: `plugin-${pluginId}`,
    codeGeneration: {
      strings: false, // Disable eval()
      wasm: false, // Disable WebAssembly for plugins
    },
  });

  // Set self references
  context.globalThis = context;
  context.global = context;
  context.self = context;

  return context;
}

/**
 * Create safe fetch that blocks internal IPs
 */
function createSafeFetch(pluginId: string): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Block localhost and internal IPs
    const blockedPatterns = [
      /^https?:\/\/localhost/i,
      /^https?:\/\/127\./,
      /^https?:\/\/0\./,
      /^https?:\/\/10\./,
      /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^https?:\/\/192\.168\./,
      /^file:/i,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(url)) {
        throw new Error(`[Plugin:${pluginId}] Access to ${url} is blocked`);
      }
    }

    return fetch(input, init);
  };
}

/**
 * Send log message to main process
 */
function sendLog(pluginId: string, level: string, args: unknown[]): void {
  const message = args
    .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
    .join(' ');

  sendResponse({
    type: 'log',
    id: '',
    pluginId,
    data: { level, message },
  });
}

/**
 * Send response to main process
 */
function sendResponse(response: PluginResponse): void {
  if (process.send) {
    process.send(response);
  }
}

/**
 * Activate a plugin
 */
async function activatePlugin(
  id: string,
  pluginId: string,
  code: string,
  permissions: string[]
): Promise<void> {
  try {
    const context = createPluginSandbox(pluginId, permissions);

    // Wrap code to export the plugin module
    const wrappedCode = `
      (function() {
        ${code}
        return module.exports || exports;
      })()
    `;

    const script = new vm.Script(wrappedCode, {
      filename: `${pluginId}.js`,
    });

    const pluginModule = script.runInContext(context, {
      timeout: 30000,
    });

    const plugin = pluginModule.default || pluginModule;

    // Store sandbox
    activeSandboxes.set(pluginId, {
      context,
      plugin,
      permissions,
    });

    // Call activate if defined
    if (typeof plugin.activate === 'function') {
      const pluginContext = {
        pluginId,
        logger: {
          info: (...args: unknown[]) => sendLog(pluginId, 'info', args),
          warn: (...args: unknown[]) => sendLog(pluginId, 'warn', args),
          error: (...args: unknown[]) => sendLog(pluginId, 'error', args),
          debug: (...args: unknown[]) => sendLog(pluginId, 'debug', args),
        },
        storage: createPluginStorage(pluginId),
        subscriptions: [],
      };

      await plugin.activate(pluginContext);
    }

    sendResponse({
      type: 'result',
      id,
      pluginId,
      data: { success: true },
    });
  } catch (error) {
    sendResponse({
      type: 'error',
      id,
      pluginId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Deactivate a plugin
 */
async function deactivatePlugin(id: string, pluginId: string): Promise<void> {
  try {
    const sandbox = activeSandboxes.get(pluginId);

    if (sandbox?.plugin?.deactivate) {
      await sandbox.plugin.deactivate();
    }

    activeSandboxes.delete(pluginId);

    sendResponse({
      type: 'result',
      id,
      pluginId,
      data: { success: true },
    });
  } catch (error) {
    sendResponse({
      type: 'error',
      id,
      pluginId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create plugin storage (in-memory for now)
 */
function createPluginStorage(_pluginId: string) {
  const data: Record<string, unknown> = {};

  return {
    get<T>(key: string, defaultValue?: T): T | undefined {
      return (data[key] as T) ?? defaultValue;
    },
    set<T>(key: string, value: T): void {
      data[key] = value;
    },
    delete(key: string): void {
      delete data[key];
    },
    keys(): string[] {
      return Object.keys(data);
    },
  };
}

/**
 * Handle incoming messages
 */
process.on('message', async (message: PluginMessage) => {
  switch (message.type) {
    case 'activate': {
      const { code, permissions } = message.data as {
        code: string;
        permissions: string[];
      };
      await activatePlugin(message.id, message.pluginId, code, permissions);
      break;
    }

    case 'deactivate':
      await deactivatePlugin(message.id, message.pluginId);
      break;

    case 'ping':
      sendResponse({ type: 'pong', id: message.id });
      break;

    case 'shutdown':
      // Cleanup all plugins
      for (const pluginId of activeSandboxes.keys()) {
        await deactivatePlugin(message.id, pluginId);
      }
      process.exit(0);
      break;
  }
});

// Signal ready
sendResponse({ type: 'ready', id: 'init' });

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  sendResponse({
    type: 'error',
    id: 'uncaught',
    error: `Uncaught exception: ${error.message}`,
  });
});

process.on('unhandledRejection', (reason) => {
  sendResponse({
    type: 'error',
    id: 'unhandled',
    error: `Unhandled rejection: ${String(reason)}`,
  });
});
