/**
 * Plugin Store
 *
 * Zustand store for managing plugin state in the renderer process.
 */

import { create } from 'zustand';
import type { PluginInfo } from '../lib/plugins/plugin-api';

// ============================================================================
// TYPES
// ============================================================================

interface PluginState {
  /** All discovered plugins */
  plugins: PluginInfo[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Plugins directory path */
  pluginsPath: string | null;

  // Actions
  loadPlugins: () => Promise<void>;
  activatePlugin: (id: string) => Promise<void>;
  deactivatePlugin: (id: string) => Promise<void>;
  installPlugin: (sourcePath: string) => Promise<void>;
  uninstallPlugin: (id: string) => Promise<void>;
  getPluginsPath: () => Promise<string>;
  updatePluginList: (plugins: PluginInfo[]) => void;
}

// ============================================================================
// STORE
// ============================================================================

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  isLoading: false,
  error: null,
  pluginsPath: null,

  loadPlugins: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!window.pluginAPI) {
        throw new Error('Plugin API not available');
      }
      const plugins = await window.pluginAPI.list();
      set({ plugins, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to load plugins',
        isLoading: false,
      });
    }
  },

  activatePlugin: async (id: string) => {
    try {
      if (!window.pluginAPI) {
        throw new Error('Plugin API not available');
      }
      await window.pluginAPI.activate(id);
      // Refresh plugin list
      await get().loadPlugins();
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to activate plugin',
      });
      throw error;
    }
  },

  deactivatePlugin: async (id: string) => {
    try {
      if (!window.pluginAPI) {
        throw new Error('Plugin API not available');
      }
      await window.pluginAPI.deactivate(id);
      await get().loadPlugins();
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to deactivate plugin',
      });
      throw error;
    }
  },

  installPlugin: async (sourcePath: string) => {
    try {
      if (!window.pluginAPI) {
        throw new Error('Plugin API not available');
      }
      await window.pluginAPI.install(sourcePath);
      await get().loadPlugins();
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to install plugin',
      });
      throw error;
    }
  },

  uninstallPlugin: async (id: string) => {
    try {
      if (!window.pluginAPI) {
        throw new Error('Plugin API not available');
      }
      await window.pluginAPI.uninstall(id);
      await get().loadPlugins();
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to uninstall plugin',
      });
      throw error;
    }
  },

  getPluginsPath: async () => {
    if (get().pluginsPath) {
      return get().pluginsPath!;
    }
    if (!window.pluginAPI) {
      throw new Error('Plugin API not available');
    }
    const path = await window.pluginAPI.getPath();
    set({ pluginsPath: path });
    return path;
  },

  updatePluginList: (plugins: PluginInfo[]) => {
    set({ plugins });
  },
}));

// Note: Window.pluginAPI type is declared in src/types.d.ts
