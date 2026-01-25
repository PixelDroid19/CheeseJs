/**
 * Plugin Host
 *
 * Manages plugin lifecycle (activation, deactivation) and provides
 * the runtime environment for plugins to register their extensions.
 */

import { ipcMain } from 'electron';
import path from 'path';
import fs from 'node:fs/promises';
import { createMainLogger } from '../logger.js';
import {
  pluginLoader,
  type PluginManifest,
  type PluginInfo,
} from './plugin-loader.js';
import {
  eventBus,
  ExtensionEvents,
} from '../../../src/core/events/EventBus.js';
import { extensionPointRegistry } from '../../../src/core/extension-points/ExtensionPointRegistry.js';
import { transpilerRegistry } from './transpiler-registry.js';
import { wasmLanguageRegistry } from '../../wasm-languages/WasmLanguageRegistry.js';
import {
  createPluginSandbox,
  type PluginSandbox,
  type PluginPermission,
} from './plugin-sandbox.js';
import { pluginProcessManager } from './plugin-process-manager.js';

const log = createMainLogger('PluginHost');

// ============================================================================
// LOCAL TYPES (avoid cross-process imports)
// ============================================================================

interface PluginStorage {
  get<T>(key: string, defaultValue?: T): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  keys(): string[];
}

interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

interface Disposable {
  dispose(): void;
}

interface PluginContext {
  manifest: PluginManifest;
  pluginPath: string;
  storage: PluginStorage;
  logger: PluginLogger;
  subscriptions: Disposable[];
}

interface Plugin {
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

// Minimal interface for browser window
interface BrowserWindowLike {
  isDestroyed(): boolean;
  webContents: {
    send(channel: string, ...args: unknown[]): void;
  };
}

// ============================================================================
// PLUGIN HOST CLASS
// ============================================================================

import { pluginWatcher } from './plugin-watcher.js';

export class PluginHost {
  private activePlugins: Map<string, Plugin> = new Map();
  private pluginContexts: Map<string, PluginContext> = new Map();
  private pluginSandboxes: Map<string, PluginSandbox> = new Map();
  private isolatedPlugins: Set<string> = new Set(); // Plugins running in UtilityProcess
  private mainWindow: BrowserWindowLike | null = null;
  private subscriptions: Disposable[] = [];
  private reloadCounts: Map<string, number> = new Map();
  private useProcessIsolation = false; // Enable UtilityProcess isolation for plugins

  // Plugin storage (persisted per-plugin)
  private storageData: Map<string, Record<string, unknown>> = new Map();

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the plugin host
   */
  async initialize(): Promise<void> {
    this.registerDefaultExtensionPoints();
    await pluginLoader.initialize();
    await wasmLanguageRegistry.initialize();
    this.registerIpcHandlers();

    // Start watcher
    pluginWatcher.start(this.handlePluginReload.bind(this));

    interface ExtensionErrorPayload {
      id?: string;
      error: unknown;
    }

    // Listen for extension events
    this.subscriptions.push(
      eventBus.on(ExtensionEvents.EXTENSION_ERROR, (data: unknown) => {
        const payload = data as ExtensionErrorPayload;
        log.error(`[PluginHost] Extension error: ${payload.error}`, payload);
        if (payload.id) {
          pluginLoader.setPluginStatus(
            payload.id,
            'error',
            payload.error as string
          );
          this.notifyPluginStateChange();
        }
      })
    );

    // Start the plugin process manager if process isolation is enabled
    if (this.useProcessIsolation) {
      try {
        await pluginProcessManager.start();
        log.info('[PluginHost] Plugin process manager started');

        // Handle process exit for recovery
        pluginProcessManager.on('exit', (code: number) => {
          log.warn(`[PluginHost] Plugin process exited with code ${code}`);
          // The process manager handles auto-restart
        });
      } catch (e) {
        log.error('[PluginHost] Failed to start plugin process manager:', e);
        // Fall back to in-process sandboxing
        this.useProcessIsolation = false;
      }
    }

    // Auto-activate all plugins for now
    try {
      const plugins = await this.discoverPlugins();
      for (const plugin of plugins) {
        try {
          await this.activatePlugin(plugin.manifest.id);
        } catch (e) {
          log.error(
            `[PluginHost] Failed to auto-activate plugin ${plugin.manifest.id}:`,
            e
          );
        }
      }
    } catch (e) {
      log.error('[PluginHost] Error during plugin auto-discovery:', e);
    }

    log.info('[PluginHost] Initialized');
  }

  /**
   * Enable or disable process isolation for plugins
   * Must be called before initialize()
   */
  setProcessIsolation(enabled: boolean): void {
    this.useProcessIsolation = enabled;
  }

  /**
   * Set the main window for IPC communication
   */
  setMainWindow(window: BrowserWindowLike | null): void {
    this.mainWindow = window;
  }

  /**
   * Discover and load all available plugins
   */
  async discoverPlugins(): Promise<PluginInfo[]> {
    return pluginLoader.discoverPlugins();
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(id: string): Promise<void> {
    const pluginInfo = pluginLoader.getPlugin(id);
    if (!pluginInfo) {
      throw new Error(`Plugin ${id} not found`);
    }

    if (this.activePlugins.has(id) || this.isolatedPlugins.has(id)) {
      log.debug(`[PluginHost] Plugin ${id} already active`);
      return;
    }

    log.info(`[PluginHost] Activating plugin: ${pluginInfo.manifest.name}`);
    eventBus.emit(ExtensionEvents.EXTENSION_LOADING, { id });

    try {
      const pluginPath = path.join(pluginLoader.getPluginsDir(), id);
      const entryPath = path.join(pluginPath, pluginInfo.manifest.main);

      // Register declarative contributions
      await this.registerDeclarativeContributions(pluginInfo.manifest);

      // Create plugin context
      const context = this.createPluginContext(pluginInfo.manifest, pluginPath);
      this.pluginContexts.set(id, context);

      // SECURITY: Determine isolation level
      // - sandboxed: false = trusted, direct import
      // - sandboxed: true (default) + useProcessIsolation = UtilityProcess isolation
      // - sandboxed: true (default) + !useProcessIsolation = VM sandbox in main process
      const useSandbox = pluginInfo.manifest.sandboxed !== false;
      const permissions = (pluginInfo.manifest
        .permissions as PluginPermission[]) || ['storage'];

      if (!useSandbox) {
        // TRUSTED PATH: Direct import for explicitly trusted plugins (e.g., built-in)
        log.warn(
          `[PluginHost] Plugin ${id} running WITHOUT sandbox (sandboxed: false in manifest)`
        );

        const reloadCount = this.reloadCounts.get(id) || 0;
        const importPath =
          reloadCount > 0
            ? `file://${entryPath}?t=${Date.now()}`
            : `file://${entryPath}`;

        log.debug(`[PluginHost] Importing plugin from ${importPath}`);
        const pluginModule = await import(importPath);
        const plugin: Plugin = pluginModule.default || pluginModule;

        if (typeof plugin.activate === 'function') {
          await plugin.activate(context);
        }

        this.activePlugins.set(id, plugin);
      } else if (this.useProcessIsolation && pluginProcessManager.ready) {
        // MOST SECURE PATH: Run plugin in isolated UtilityProcess
        log.debug(
          `[PluginHost] Loading plugin ${id} in isolated process with permissions: ${permissions.join(', ')}`
        );

        // Read plugin code
        const pluginCode = await fs.readFile(entryPath, 'utf-8');

        // Activate in isolated process
        const result = await pluginProcessManager.activatePlugin(
          id,
          pluginCode,
          permissions
        );

        if (!result.success) {
          throw new Error(
            `Failed to activate plugin ${id} in isolated process`
          );
        }

        this.isolatedPlugins.add(id);
      } else {
        // SECURE PATH: Run plugin in VM sandbox (same process)
        const sandbox = createPluginSandbox({
          pluginId: id,
          permissions,
          timeout: 30000,
        });

        log.debug(
          `[PluginHost] Loading plugin ${id} in VM sandbox with permissions: ${permissions.join(', ')}`
        );

        // Read plugin code and execute in sandbox
        const pluginCode = await fs.readFile(entryPath, 'utf-8');

        // Wrap code to export the plugin module
        const wrappedCode = `
          const module = { exports: {} };
          const exports = module.exports;
          ${pluginCode}
          module.exports;
        `;

        const pluginModule = await sandbox.run<{ default?: Plugin } & Plugin>(
          wrappedCode,
          entryPath
        );
        const plugin: Plugin = pluginModule.default || pluginModule;

        if (typeof plugin.activate === 'function') {
          await plugin.activate(context);
        }

        this.activePlugins.set(id, plugin);
        this.pluginSandboxes.set(id, sandbox);
      }

      pluginLoader.setPluginStatus(id, 'active');

      log.info(`[PluginHost] Activated plugin: ${pluginInfo.manifest.name}`);
      eventBus.emit(ExtensionEvents.EXTENSION_ACTIVATED, { id });

      // Notify renderer
      this.notifyPluginStateChange();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      pluginLoader.setPluginStatus(id, 'error', errorMessage);

      log.error(`[PluginHost] Failed to activate plugin ${id}:`, error);
      eventBus.emit(ExtensionEvents.EXTENSION_ERROR, {
        id,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(id: string): Promise<void> {
    const plugin = this.activePlugins.get(id);
    const isIsolated = this.isolatedPlugins.has(id);

    if (!plugin && !isIsolated) {
      return;
    }

    log.info(`[PluginHost] Deactivating plugin: ${id}`);
    eventBus.emit(ExtensionEvents.EXTENSION_DEACTIVATING, { id });

    try {
      if (isIsolated) {
        // Deactivate in isolated process
        await pluginProcessManager.deactivatePlugin(id);
        this.isolatedPlugins.delete(id);
      } else if (plugin) {
        // Call deactivate if defined
        if (plugin.deactivate) {
          await plugin.deactivate();
        }
        this.activePlugins.delete(id);
      }

      // Dispose all subscriptions
      const context = this.pluginContexts.get(id);
      if (context) {
        for (const disposable of context.subscriptions) {
          try {
            disposable.dispose();
          } catch (e) {
            log.warn(`[PluginHost] Error disposing subscription:`, e);
          }
        }
      }

      // Unregister contributions
      await this.unregisterDeclarativeContributions(id);

      // Dispose sandbox if used
      const sandbox = this.pluginSandboxes.get(id);
      if (sandbox) {
        sandbox.dispose();
        this.pluginSandboxes.delete(id);
        log.debug(`[PluginHost] Disposed sandbox for plugin ${id}`);
      }

      this.pluginContexts.delete(id);
      pluginLoader.setPluginStatus(id, 'disabled');

      log.info(`[PluginHost] Deactivated plugin: ${id}`);
      eventBus.emit(ExtensionEvents.EXTENSION_DEACTIVATED, { id });

      // Notify renderer
      this.notifyPluginStateChange();
    } catch (error) {
      log.error(`[PluginHost] Error deactivating plugin ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle plugin reload request (HMR)
   */
  private async handlePluginReload(pluginId: string): Promise<void> {
    log.info(`[PluginHost] Reloading plugin: ${pluginId}`);

    // 1. Deactivate
    await this.deactivatePlugin(pluginId);

    // 2. Reload manifest
    const newInfo = await pluginLoader.reloadPlugin(pluginId);
    if (!newInfo) {
      log.error(
        `[PluginHost] Failed to reload manifest for ${pluginId}, aborting reactivation`
      );
      return;
    }

    // 3. Increment reload count to bust cache
    const count = this.reloadCounts.get(pluginId) || 0;
    this.reloadCounts.set(pluginId, count + 1);

    // 4. Activate
    try {
      await this.activatePlugin(pluginId);
      log.info(`[PluginHost] Successfully reloaded plugin: ${pluginId}`);
    } catch (e) {
      log.error(`[PluginHost] Failed to reactivate plugin ${pluginId}:`, e);
    }
  }

  /**
   * Get all registered transpilers
   */
  getTranspilers(): Map<string, unknown> {
    // This is a simplified exposure, usually consumers use the registry directly
    return new Map();
  }

  /**
   * Shutdown all plugins
   */
  async shutdown(): Promise<void> {
    pluginWatcher.stop();

    // Deactivate in-process plugins
    const ids = Array.from(this.activePlugins.keys());
    for (const id of ids) {
      try {
        await this.deactivatePlugin(id);
      } catch (e) {
        log.error(`[PluginHost] Error shutting down plugin ${id}:`, e);
      }
    }

    // Deactivate isolated plugins
    const isolatedIds = Array.from(this.isolatedPlugins);
    for (const id of isolatedIds) {
      try {
        await this.deactivatePlugin(id);
      } catch (e) {
        log.error(`[PluginHost] Error shutting down isolated plugin ${id}:`, e);
      }
    }

    // Stop the plugin process manager
    if (this.useProcessIsolation) {
      try {
        await pluginProcessManager.stop();
        log.info('[PluginHost] Plugin process manager stopped');
      } catch (e) {
        log.error('[PluginHost] Error stopping plugin process manager:', e);
      }
    }

    this.subscriptions.forEach((s) => s.dispose());
    log.info('[PluginHost] All plugins shut down');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Register default extension points
   */
  private registerDefaultExtensionPoints(): void {
    const points = [
      {
        id: 'commands',
        description: 'Contribute new commands to the command palette',
      },
      { id: 'keybindings', description: 'Contribute keyboard shortcuts' },
      { id: 'snippets', description: 'Contribute code snippets' },
      { id: 'themes', description: 'Contribute editor themes' },
      { id: 'languages', description: 'Contribute language support' },
      { id: 'formatters', description: 'Contribute code formatters' },
      { id: 'panels', description: 'Contribute UI panels' },
      { id: 'configuration', description: 'Contribute configuration settings' },
      { id: 'transpilers', description: 'Contribute code transpilers' },
    ];

    for (const point of points) {
      extensionPointRegistry.registerExtensionPoint(
        point.id,
        point.description
      );
    }
  }

  /**
   * Register declarative contributions from manifest
   */
  private async registerDeclarativeContributions(
    manifest: PluginManifest
  ): Promise<void> {
    const { contributes, id: pluginId } = manifest;
    if (!contributes) return;

    const pluginPath = path.join(pluginLoader.getPluginsDir(), pluginId);

    // Register WASM Languages (Main Process)
    if (contributes.wasmLanguages) {
      for (const wasmLang of contributes.wasmLanguages) {
        try {
          await wasmLanguageRegistry.register(pluginId, pluginPath, wasmLang);
          log.info(
            `[PluginHost] Registered WASM language: ${wasmLang.name} (${wasmLang.id})`
          );
        } catch (error) {
          log.error(
            `[PluginHost] Failed to register WASM language ${wasmLang.id}:`,
            error
          );
        }
      }
    }

    // Register Transpilers (Main Process)
    if (contributes.transpilers) {
      for (const _transpiler of contributes.transpilers) {
        // Determine extension based on target language or some logic
        // For declarative transpilers, we might need a way to specify the implementation
        // For now, we assume the code part is registered via `activate()` hook for actual logic
        // But we register the *capability* here
        // If transpiler needs code, it should be registered in activate().
        // However, we can register the metadata here.
        // extensionPointRegistry.registerExtension(
        //     'transpilers',
        //     `${pluginId}-transpiler-${transpiler.sourceLanguage}`,
        //     pluginId,
        //     transpiler
        // );
      }
    }

    // Register all contributions to ExtensionPointRegistry for tracking
    if (typeof contributes === 'object') {
      for (const [pointId, contribution] of Object.entries(contributes)) {
        if (Array.isArray(contribution)) {
          contribution.forEach((item, index) => {
            extensionPointRegistry.registerExtension(
              pointId,
              `${pluginId}-${pointId}-${index}`,
              pluginId,
              item
            );
          });
        }
      }
    }
  }

  /**
   * Unregister declarative contributions
   */
  private async unregisterDeclarativeContributions(
    pluginId: string
  ): Promise<void> {
    // Unregister from ExtensionPointRegistry
    extensionPointRegistry.unregisterPluginExtensions(pluginId);

    // Unregister from TranspilerRegistry (if any were registered declaratively)
    transpilerRegistry.unregisterByPlugin(pluginId);

    // Unregister WASM Languages
    const registered = wasmLanguageRegistry.getAllLanguages();
    for (const lang of registered) {
      if (lang.pluginId === pluginId) {
        await wasmLanguageRegistry.unregister(lang.config.id);
      }
    }
  }

  /**
   * Create a plugin context for a plugin
   */
  private createPluginContext(
    manifest: PluginManifest,
    pluginPath: string
  ): PluginContext {
    const pluginId = manifest.id;

    // Create plugin-scoped storage
    const storage: PluginStorage = {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        const data = this.storageData.get(pluginId) || {};
        return (data[key] as T) ?? defaultValue;
      },
      set: <T>(key: string, value: T): void => {
        const data = this.storageData.get(pluginId) || {};
        data[key] = value;
        this.storageData.set(pluginId, data);
      },
      delete: (key: string): void => {
        const data = this.storageData.get(pluginId);
        if (data) {
          delete data[key];
        }
      },
      keys: (): string[] => {
        const data = this.storageData.get(pluginId) || {};
        return Object.keys(data);
      },
    };

    // Create plugin-scoped logger
    const logger: PluginLogger = {
      info: (message: string, ...args: unknown[]) =>
        log.info(`[Plugin:${pluginId}] ${message}`, ...args),
      warn: (message: string, ...args: unknown[]) =>
        log.warn(`[Plugin:${pluginId}] ${message}`, ...args),
      error: (message: string, ...args: unknown[]) =>
        log.error(`[Plugin:${pluginId}] ${message}`, ...args),
      debug: (message: string, ...args: unknown[]) =>
        log.debug(`[Plugin:${pluginId}] ${message}`, ...args),
    };

    return {
      manifest,
      pluginPath,
      storage,
      logger,
      subscriptions: [],
    };
  }

  /**
   * Register IPC handlers for plugin management
   */
  private registerIpcHandlers(): void {
    ipcMain.handle('plugins:list', async () => {
      return pluginLoader.getLoadedPlugins();
    });

    ipcMain.handle(
      'plugins:activate',
      async (_event: Electron.IpcMainInvokeEvent, id: string) => {
        await this.activatePlugin(id);
        return { success: true };
      }
    );

    ipcMain.handle(
      'plugins:deactivate',
      async (_event: Electron.IpcMainInvokeEvent, id: string) => {
        await this.deactivatePlugin(id);
        return { success: true };
      }
    );

    ipcMain.handle(
      'plugins:install',
      async (_event: Electron.IpcMainInvokeEvent, sourcePath: string) => {
        const pluginInfo = await pluginLoader.installFromPath(sourcePath);
        return { success: true, plugin: pluginInfo };
      }
    );

    ipcMain.handle(
      'plugins:install-from-url',
      async (
        _event: Electron.IpcMainInvokeEvent,
        url: string,
        pluginId?: string
      ) => {
        const result = await pluginLoader.installFromUrl(url, pluginId);
        if (result.success) {
          // Auto-activate after install
          try {
            const plugins = await pluginLoader.discoverPlugins();
            const installed = plugins.find((p) =>
              result.path?.includes(p.manifest.id)
            );
            if (installed) {
              await this.activatePlugin(installed.manifest.id);
            }
          } catch (e) {
            log.warn(
              '[PluginHost] Failed to auto-activate installed plugin:',
              e
            );
          }
          this.notifyPluginStateChange();
        }
        return result;
      }
    );

    ipcMain.handle(
      'plugins:uninstall',
      async (_event: Electron.IpcMainInvokeEvent, id: string) => {
        await this.deactivatePlugin(id);
        await pluginLoader.uninstall(id);
        return { success: true };
      }
    );

    ipcMain.handle('plugins:get-path', () => {
      return pluginLoader.getPluginsDir();
    });

    ipcMain.handle(
      'plugins:read-file',
      async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
        // SECURITY: Validate path is within plugins directory to prevent path traversal
        const pluginsDir = pluginLoader.getPluginsDir();
        const resolvedPath = path.resolve(filePath);

        if (!resolvedPath.startsWith(pluginsDir)) {
          throw new Error('Access denied: path outside plugins directory');
        }

        return fs.readFile(resolvedPath, 'utf-8');
      }
    );

    log.debug('[PluginHost] IPC handlers registered');
  }

  /**
   * Notify renderer of plugin state changes
   */
  private notifyPluginStateChange(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(
        'plugins:state-changed',
        pluginLoader.getLoadedPlugins()
      );
    }
  }
}

// Export singleton instance
export const pluginHost = new PluginHost();
