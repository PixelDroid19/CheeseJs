/**
 * Plugin Loader
 *
 * Handles discovery, validation, and loading of plugins from the filesystem.
 * Plugins are stored in ~/.cheesejs/plugins/
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { createMainLogger } from '../logger.js';
import { manifestParser, type PluginManifest } from './manifest-parser.js';

const log = createMainLogger('PluginLoader');

// ============================================================================
// TYPES
// ============================================================================

export type { PluginManifest };

export type PluginStatus = 'installed' | 'active' | 'disabled' | 'error';

export interface PluginInfo {
  manifest: PluginManifest;
  status: PluginStatus;
  error?: string;
  loadedAt?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PLUGINS_DIR_NAME = 'plugins';

// ============================================================================
// PLUGIN LOADER CLASS
// ============================================================================

export class PluginLoader {
  private pluginsDir: string;
  private loadedPlugins: Map<string, PluginInfo> = new Map();

  constructor() {
    // Use app.getPath('userData') for cross-platform user data directory
    const userDataPath = app.getPath('userData');
    this.pluginsDir = path.join(userDataPath, PLUGINS_DIR_NAME);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the plugin loader
   * Creates plugins directory if it doesn't exist
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.pluginsDir, { recursive: true });
      log.info(`[PluginLoader] Plugins directory: ${this.pluginsDir}`);
    } catch (error) {
      log.error('[PluginLoader] Failed to create plugins directory:', error);
      throw error;
    }
  }

  /**
   * Discover all plugins in the plugins directory
   */
  async discoverPlugins(): Promise<PluginInfo[]> {
    const plugins: PluginInfo[] = [];

    try {
      const entries = await fs.readdir(this.pluginsDir, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.pluginsDir, entry.name);
          const pluginInfo = await this.loadPluginManifest(pluginPath);

          if (pluginInfo) {
            plugins.push(pluginInfo);
            this.loadedPlugins.set(pluginInfo.manifest.id, pluginInfo);
          }
        }
      }

      log.info(`[PluginLoader] Discovered ${plugins.length} plugins`);
      return plugins;
    } catch (error) {
      log.error('[PluginLoader] Failed to discover plugins:', error);
      return [];
    }
  }

  /**
   * Load a plugin's manifest from a directory
   */
  async loadPluginManifest(pluginPath: string): Promise<PluginInfo | null> {
    try {
      // Use ManifestParser to support both package.json and plugin.json
      const manifest = await manifestParser.parseFromDirectory(pluginPath);

      log.debug(
        `[PluginLoader] Loaded manifest for: ${manifest.name} v${manifest.version}`
      );

      return {
        manifest,
        status: 'installed',
      };
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'ENOENT') {
        log.debug(`[PluginLoader] No valid manifest found at ${pluginPath}`);
      } else {
        log.error(
          `[PluginLoader] Failed to load manifest at ${pluginPath}:`,
          error
        );
      }
      return null;
    }
  }

  /**
   * Get the plugins directory path
   */
  getPluginsDir(): string {
    return this.pluginsDir;
  }

  /**
   * Get all loaded plugin info
   */
  getLoadedPlugins(): PluginInfo[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get a specific plugin by ID
   */
  getPlugin(id: string): PluginInfo | undefined {
    return this.loadedPlugins.get(id);
  }

  /**
   * Update plugin status
   */
  setPluginStatus(id: string, status: PluginStatus, error?: string): void {
    const plugin = this.loadedPlugins.get(id);
    if (plugin) {
      plugin.status = status;
      plugin.error = error;
      if (status === 'active') {
        plugin.loadedAt = Date.now();
      }
      // Emit event on status change
      // eventBus.emit(ExtensionEvents.EXTENSION_STATUS_CHANGED, { id, status, error });
    }
  }

  /**
   * Install a plugin from a directory path
   */
  async installFromPath(sourcePath: string): Promise<PluginInfo | null> {
    const pluginInfo = await this.loadPluginManifest(sourcePath);

    if (!pluginInfo) {
      throw new Error('Invalid plugin: No valid manifest found');
    }

    const targetPath = path.join(this.pluginsDir, pluginInfo.manifest.id);

    // Check if already installed
    if (this.loadedPlugins.has(pluginInfo.manifest.id)) {
      throw new Error(`Plugin ${pluginInfo.manifest.id} is already installed`);
    }

    // Copy plugin to plugins directory
    await this.copyDirectory(sourcePath, targetPath);

    // Reload manifest from new location
    const installedInfo = await this.loadPluginManifest(targetPath);
    if (installedInfo) {
      this.loadedPlugins.set(installedInfo.manifest.id, installedInfo);
      log.info(
        `[PluginLoader] Installed plugin: ${installedInfo.manifest.name}`
      );
    }

    return installedInfo;
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(id: string): Promise<void> {
    const plugin = this.loadedPlugins.get(id);
    if (!plugin) {
      throw new Error(`Plugin ${id} not found`);
    }

    const pluginPath = path.join(this.pluginsDir, id);
    await fs.rm(pluginPath, { recursive: true, force: true });
    this.loadedPlugins.delete(id);

    log.info(`[PluginLoader] Uninstalled plugin: ${id}`);
  }

  /**
   * Install a plugin from a URL
   * Supports .zip archives and git repositories
   */
  async installFromUrl(
    url: string,
    pluginId?: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    // Handle Mock Installation
    if (url.startsWith('mock:')) {
      return this.installMockPlugin(url, pluginId);
    }

    const tempDir = path.join(this.pluginsDir, '.temp', Date.now().toString());

    try {
      await fs.mkdir(tempDir, { recursive: true });

      // Download the package
      log.info(`[PluginLoader] Downloading plugin from: ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const zipPath = path.join(tempDir, 'plugin.zip');
      await fs.writeFile(zipPath, Buffer.from(buffer));

      // Extract the archive
      const extractedPath = path.join(tempDir, 'extracted');
      await this.extractZip(zipPath, extractedPath);

      // Find the plugin root (might be nested in a folder)
      const pluginRoot = await this.findPluginRoot(extractedPath);

      if (!pluginRoot) {
        throw new Error('No valid plugin manifest found in archive');
      }

      // Load manifest to get plugin ID
      const pluginInfo = await this.loadPluginManifest(pluginRoot);
      if (!pluginInfo) {
        throw new Error('Failed to parse plugin manifest');
      }

      const finalId = pluginId || pluginInfo.manifest.id;
      const targetPath = path.join(this.pluginsDir, finalId);

      // Check if already installed
      if (this.loadedPlugins.has(finalId)) {
        // Update existing plugin
        log.info(`[PluginLoader] Updating existing plugin: ${finalId}`);
        await fs.rm(targetPath, { recursive: true, force: true });
      }

      // Copy to plugins directory
      await this.copyDirectory(pluginRoot, targetPath);

      // Reload manifest
      const installedInfo = await this.loadPluginManifest(targetPath);
      if (installedInfo) {
        this.loadedPlugins.set(finalId, installedInfo);
        log.info(`[PluginLoader] Installed plugin from URL: ${finalId}`);
      }

      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });

      return { success: true, path: targetPath };
    } catch (error) {
      log.error('[PluginLoader] Failed to install from URL:', error);

      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
        void 0;
      }

      return { success: false, error: String(error) };
    }
  }

  /**
   * Extract a ZIP file
   */
  private async extractZip(zipPath: string, destPath: string): Promise<void> {
    // Use built-in unzip or fall back to extraction logic
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await fs.mkdir(destPath, { recursive: true });

    // Try using system unzip (available on most systems)
    try {
      if (process.platform === 'win32') {
        // PowerShell Expand-Archive
        await execAsync(
          `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`
        );
      } else {
        // Unix unzip
        await execAsync(`unzip -o "${zipPath}" -d "${destPath}"`);
      }
    } catch (error) {
      log.error('[PluginLoader] System unzip failed, trying fallback:', error);
      // Fallback: use adm-zip if available or throw
      throw new Error('ZIP extraction failed. Please install unzip utility.');
    }
  }

  /**
   * Find the plugin root directory (where manifest is located)
   */
  private async findPluginRoot(extractedPath: string): Promise<string | null> {
    // Check if manifest is at root
    const rootManifest = path.join(extractedPath, 'package.json');
    try {
      await fs.access(rootManifest);
      return extractedPath;
    } catch {
      // Not at root, check subdirectories
      void 0;
    }

    // Check one level deep
    const entries = await fs.readdir(extractedPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subManifest = path.join(
          extractedPath,
          entry.name,
          'package.json'
        );
        try {
          await fs.access(subManifest);
          return path.join(extractedPath, entry.name);
        } catch {
          // Continue searching
        }
      }
    }

    return null;
  }

  /**
   * Reload a plugin (update manifest and status)
   */
  async reloadPlugin(id: string): Promise<PluginInfo | null> {
    const plugin = this.loadedPlugins.get(id);
    if (!plugin) {
      // Maybe it's a new plugin that appeared?
      // For now assume logic handles discovery elsewhere if new.
      log.warn(`[PluginLoader] Cannot reload unknown plugin: ${id}`);
      return null;
    }

    const pluginPath = path.join(this.pluginsDir, id);

    // Clear previous info but keep status if possible or reset
    // We reload manifest from disk
    const newInfo = await this.loadPluginManifest(pluginPath);

    if (newInfo) {
      // Preserve previous status if it was active,
      // but PluginHost will handle reactivation.
      // Here we just update the manifest data in memory.
      this.loadedPlugins.set(id, newInfo);
      log.info(`[PluginLoader] Reloaded plugin manifest: ${id}`);
      return newInfo;
    } else {
      log.error(
        `[PluginLoader] Failed to reload plugin ${id}, manifest invalid`
      );
      return null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async installMockPlugin(
    url: string,
    pluginId?: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    const id = pluginId || url.replace('mock:install/', '');
    if (!id) return { success: false, error: 'Invalid mock plugin ID' };

    const targetPath = path.join(this.pluginsDir, id);

    try {
      // Clean up if exists
      try {
        await fs.rm(targetPath, { recursive: true, force: true });
      } catch {
        // Ignore error if directory doesn't exist
        void 0;
      }

      await fs.mkdir(targetPath, { recursive: true });

      // Create manifest
      const isTheme = id.includes('theme');

      const manifest: PluginManifest = {
        id,
        name: id,
        displayName: id
          .split('-')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' '),
        version: '1.0.0',
        description: 'Mock plugin installed from marketplace',
        author: 'CheeseJS',
        main: 'main.js',
        engines: { cheesejs: '^1.0.0' },
        contributes: {
          commands: [{ command: `${id}.hello`, title: `Hello from ${id}` }],
          themes: isTheme
            ? [
                {
                  id: id,
                  label: id
                    .split('-')
                    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                    .join(' '),
                  uiTheme: 'vs-dark',
                  path: './theme.json',
                },
              ]
            : undefined,
        },
      };

      await fs.writeFile(
        path.join(targetPath, 'package.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Create theme file if needed
      if (isTheme) {
        const themeData = {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '6272a4' },
            { token: 'keyword', foreground: 'ff79c6' },
            { token: 'identifier', foreground: 'f8f8f2' },
            { token: 'string', foreground: 'f1fa8c' },
            { token: 'number', foreground: 'bd93f9' },
          ],
          colors: {
            'editor.background': '#282a36',
            'editor.foreground': '#f8f8f2',
            'editorCursor.foreground': '#f8f8f0',
            'editor.lineHighlightBackground': '#44475a',
            'editor.selectionBackground': '#44475a',
          },
        };
        await fs.writeFile(
          path.join(targetPath, 'theme.json'),
          JSON.stringify(themeData, null, 2)
        );
      }

      // Create main entry point
      const mainScript = `
module.exports = {
    activate: async (context) => {
        context.logger.info('Plugin activated!');
    },
    deactivate: async () => {
        console.log('Plugin deactivated');
    }
};
`;
      await fs.writeFile(path.join(targetPath, 'main.js'), mainScript);

      // Register
      const info = await this.loadPluginManifest(targetPath);
      if (info) {
        this.loadedPlugins.set(id, info);
      }

      log.info(`[PluginLoader] Installed mock plugin: ${id}`);
      return { success: true, path: targetPath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Copy a directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

// Export singleton instance
export const pluginLoader = new PluginLoader();
