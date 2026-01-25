/**
 * Plugin Watcher
 *
 * Use fs.watch to detect changes in plugin files and trigger reloading.
 * Implementation uses native fs.watch with debounce to avoid duplicate events.
 */

import fs from 'fs';
import path from 'path';
import { createMainLogger } from '../logger.js';
import { pluginLoader } from './plugin-loader.js';

const log = createMainLogger('PluginWatcher');

export class PluginWatcher {
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private changedPlugins: Set<string> = new Set();
  private isWatching: boolean = false;

  // Callback to notify when a plugin needs reload
  private onPluginChanged: ((pluginId: string) => void) | null = null;

  constructor() {}

  /**
   * Start watching the plugins directory
   */
  start(onPluginChanged: (pluginId: string) => void): void {
    if (this.isWatching) return;

    const pluginsDir = pluginLoader.getPluginsDir();
    this.onPluginChanged = onPluginChanged;

    try {
      // Watch recursively
      this.watcher = fs.watch(
        pluginsDir,
        { recursive: true },
        (eventType, filename) => this.handleFileChange(eventType, filename)
      );

      this.isWatching = true;
      log.info(`[PluginWatcher] Started watching ${pluginsDir}`);
    } catch (error) {
      log.error('[PluginWatcher] Failed to start watcher:', error);
    }
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.isWatching = false;
    log.info('[PluginWatcher] Stopped watching');
  }

  /**
   * Handle file change events
   */
  private handleFileChange(
    _eventType: string,
    filename: string | Buffer | null
  ): void {
    if (!filename) return;

    const filenameStr = filename.toString();

    // Ignore dotfiles and temp files
    if (
      path.basename(filenameStr).startsWith('.') ||
      filenameStr.endsWith('~')
    ) {
      return;
    }

    // Extract plugin ID from path
    // Structure: pluginsDir/pluginId/...
    // filename is relative to pluginsDir usually, or absolute depending on platform implementation of fs.watch
    // On Windows with recursive: true, filename is likely relative to watched dir (pluginsDir).

    // Let's assume filename is relative to pluginsDir (e.g., "my-plugin/index.js")
    const parts = filenameStr.split(path.sep);
    const pluginId = parts[0];

    if (pluginId && pluginId !== 'node_modules') {
      this.changedPlugins.add(pluginId);
      this.scheduleReload();
    }
  }

  /**
   * Schedule a reload (debounce)
   */
  private scheduleReload(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.triggerReloads();
    }, 300); // 300ms debounce
  }

  /**
   * Trigger reloads for all changed plugins
   */
  private triggerReloads(): void {
    if (this.onPluginChanged) {
      for (const pluginId of this.changedPlugins) {
        log.info(`[PluginWatcher] Detected changes in ${pluginId}`);
        this.onPluginChanged(pluginId);
      }
    }
    this.changedPlugins.clear();
    this.debounceTimer = null;
  }
}

export const pluginWatcher = new PluginWatcher();
