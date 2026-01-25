import { useEffect, useRef } from 'react';
import { usePluginStore } from '../store/usePluginStore';
import { usePluginConfigStore } from '../store/usePluginConfigStore';
import { languageRegistry } from '../lib/plugins/language-registry';
import { formatterRegistry } from '../lib/plugins/formatter-registry';
import { commandRegistry } from '../lib/plugins/command-registry';
import { keybindingRegistry } from '../lib/plugins/keybinding-registry';
import { snippetRegistry } from '../lib/plugins/snippet-registry';
import { themeManager } from '../lib/themes/theme-manager';
import type {
  PluginManifest,
  LanguageContribution,
  CommandContribution,
  KeybindingContribution,
  ThemeContribution,
  SnippetContribution,
  ConfigurationContribution,
  PluginInfo,
} from '../lib/plugins/plugin-api';

export function usePluginSystem() {
  const loadPlugins = usePluginStore((state) => state.loadPlugins);
  const updatePluginList = usePluginStore((state) => state.updatePluginList);
  const getPluginsPath = usePluginStore((state) => state.getPluginsPath);
  const registerConfiguration = usePluginConfigStore(
    (state) => state.registerConfiguration
  );
  const loadedScripts = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Initial load
    const init = async () => {
      await loadPlugins();
      await getPluginsPath();
    };
    init();

    // Listen for state changes
    if (window.pluginAPI?.onStateChanged) {
      const cleanup = window.pluginAPI.onStateChanged((plugins) => {
        updatePluginList(plugins);

        // Sync registries
        const pluginsPath = usePluginStore.getState().pluginsPath;
        if (pluginsPath) {
          syncRegistries(
            plugins,
            pluginsPath,
            loadedScripts.current,
            registerConfiguration
          );
        }
      });
      return cleanup;
    }
  }, [loadPlugins, updatePluginList, getPluginsPath, registerConfiguration]);
}

/**
 * Syncs renderer registries with active plugins
 */
async function syncRegistries(
  plugins: PluginInfo[],
  pluginsPath: string,
  loadedScripts: Set<string>,
  registerConfiguration: (
    pluginId: string,
    contribution: ConfigurationContribution
  ) => void
) {
  // Clear registries for refresh to ensure we match the current active plugins state
  languageRegistry.clear();
  formatterRegistry.clear();
  themeManager.clear();
  commandRegistry.clear();
  keybindingRegistry.clear();
  snippetRegistry.clear();

  for (const plugin of plugins) {
    if (plugin.status === 'active') {
      const manifest = plugin.manifest as PluginManifest;
      const contributes = manifest.contributes;

      // 1. Load Renderer Script if present
      if (manifest.renderer) {
        const cacheBuster = plugin.loadedAt || Date.now();
        const scriptPath = `file://${pluginsPath}/${manifest.id}/${manifest.renderer}?t=${cacheBuster}`;

        if (!loadedScripts.has(scriptPath)) {
          try {
            console.log(
              `[PluginSystem] Loading renderer script: ${scriptPath}`
            );
            await import(/* @vite-ignore */ scriptPath);
            loadedScripts.add(scriptPath);
          } catch (error) {
            console.error(
              `[PluginSystem] Failed to load renderer script for ${manifest.id}:`,
              error
            );
          }
        }
      }

      // 2. Register Declarative Contributions
      if (!contributes) continue;

      // Register Languages
      if (contributes.languages) {
        contributes.languages.forEach((lang: LanguageContribution) => {
          languageRegistry.register(manifest.id, lang);
        });
      }

      // Register Commands
      if (contributes.commands) {
        contributes.commands.forEach((cmd: CommandContribution) => {
          commandRegistry.registerContribution(manifest.id, cmd);
        });
      }

      // Register Keybindings
      if (contributes.keybindings) {
        contributes.keybindings.forEach((kb: KeybindingContribution) => {
          keybindingRegistry.register(manifest.id, kb);
        });
      }

      // Register Themes
      if (contributes.themes) {
        contributes.themes.forEach(async (theme: ThemeContribution) => {
          // Register with ThemeManager
          themeManager.registerTheme(manifest.id, theme);

          // Preload theme definition if it's active or eager loaded
          try {
            const themePath = `${pluginsPath}/${manifest.id}/${theme.path}`;
            const content = await window.pluginAPI.readFile(themePath);
            const definition = JSON.parse(content);

            // Update with full definition
            themeManager.registerThemeWithDefinition(
              theme.id,
              definition,
              manifest.id
            );
          } catch (error) {
            console.warn(
              `[PluginSystem] Failed to load theme definition for ${theme.id}:`,
              error
            );
          }
        });
      }

      // Register Snippets (need to load from file)
      if (contributes.snippets) {
        for (const snippet of contributes.snippets as SnippetContribution[]) {
          try {
            const snippetPath = `${pluginsPath}/${manifest.id}/${snippet.path}`;
            const content = await window.pluginAPI.readFile(snippetPath);
            const snippetData = JSON.parse(content);
            snippetRegistry.register(manifest.id, snippet, snippetData);
          } catch (error) {
            console.error(
              `[PluginSystem] Failed to load snippets for ${manifest.id}:`,
              error
            );
          }
        }
      }

      // Register Configuration
      if (contributes.configuration) {
        registerConfiguration(
          manifest.id,
          contributes.configuration as ConfigurationContribution
        );
      }
    } else {
      // Plugin is not active - unregister its contributions
      commandRegistry.unregisterByPlugin(plugin.manifest.id);
      keybindingRegistry.unregisterByPlugin(plugin.manifest.id);
      snippetRegistry.unregisterByPlugin(plugin.manifest.id);
      themeManager.unregisterPluginThemes(plugin.manifest.id);
    }
  }
}
