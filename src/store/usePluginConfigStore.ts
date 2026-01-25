/**
 * Plugin Configuration Store
 *
 * Manages configuration contributions from plugins.
 * Provides a centralized store for plugin settings with persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ConfigurationContribution,
  ConfigurationProperty,
} from '../lib/plugins/plugin-api';

// ============================================================================
// TYPES
// ============================================================================

export interface RegisteredConfiguration {
  pluginId: string;
  contribution: ConfigurationContribution;
  values: Record<string, unknown>;
}

export interface PluginConfigState {
  /** Registered configurations by plugin ID */
  configurations: Map<string, RegisteredConfiguration>;

  /** Current values for all plugin settings */
  values: Record<string, unknown>;

  /** Register a configuration contribution */
  registerConfiguration: (
    pluginId: string,
    contribution: ConfigurationContribution
  ) => void;

  /** Unregister configuration by plugin */
  unregisterByPlugin: (pluginId: string) => void;

  /** Get a configuration value */
  getValue: <T>(key: string, defaultValue?: T) => T | undefined;

  /** Set a configuration value */
  setValue: (key: string, value: unknown) => void;

  /** Get all values for a plugin */
  getPluginValues: (pluginId: string) => Record<string, unknown>;

  /** Reset a plugin's configuration to defaults */
  resetPlugin: (pluginId: string) => void;

  /** Reset all configurations */
  resetAll: () => void;

  /** Get all registered configurations */
  getAllConfigurations: () => RegisteredConfiguration[];

  /** Get configuration schema for a key */
  getSchema: (key: string) => ConfigurationProperty | undefined;
}

// ============================================================================
// STORE
// ============================================================================

export const usePluginConfigStore = create<PluginConfigState>()(
  persist(
    (set, get) => ({
      configurations: new Map(),
      values: {},

      registerConfiguration: (
        pluginId: string,
        contribution: ConfigurationContribution
      ) => {
        const configurations = new Map(get().configurations);
        const values = { ...get().values };

        // Initialize default values
        const pluginValues: Record<string, unknown> = {};
        for (const [key, property] of Object.entries(contribution.properties)) {
          const fullKey = `${pluginId}.${key}`;

          // Only set default if not already set
          if (values[fullKey] === undefined && property.default !== undefined) {
            values[fullKey] = property.default;
          }

          pluginValues[key] = values[fullKey] ?? property.default;
        }

        configurations.set(pluginId, {
          pluginId,
          contribution,
          values: pluginValues,
        });

        set({ configurations, values });
        console.log(
          `[PluginConfigStore] Registered configuration for ${pluginId}`
        );
      },

      unregisterByPlugin: (pluginId: string) => {
        const configurations = new Map(get().configurations);
        // const values = { ...get().values };

        // Remove configuration
        configurations.delete(pluginId);

        // Remove values (but keep them for potential re-registration)
        // Uncomment to actually remove values:
        // for (const key of Object.keys(values)) {
        //     if (key.startsWith(`${pluginId}.`)) {
        //         delete values[key];
        //     }
        // }

        set({ configurations });
        console.log(
          `[PluginConfigStore] Unregistered configuration for ${pluginId}`
        );
      },

      getValue: <T>(key: string, defaultValue?: T): T | undefined => {
        const { values, configurations } = get();

        if (values[key] !== undefined) {
          return values[key] as T;
        }

        // Try to find default from schema
        const [pluginId, ...rest] = key.split('.');
        const propertyKey = rest.join('.');
        const config = configurations.get(pluginId);

        if (config) {
          const property = config.contribution.properties[propertyKey];
          if (property?.default !== undefined) {
            return property.default as T;
          }
        }

        return defaultValue;
      },

      setValue: (key: string, value: unknown) => {
        const values = { ...get().values };
        values[key] = value;

        // Update registered configuration values
        const configurations = new Map(get().configurations);
        const [pluginId, ...rest] = key.split('.');
        const propertyKey = rest.join('.');

        const config = configurations.get(pluginId);
        if (config) {
          config.values[propertyKey] = value;
        }

        set({ configurations, values });
        console.log(
          `[PluginConfigStore] Set ${key} = ${JSON.stringify(value)}`
        );
      },

      getPluginValues: (pluginId: string): Record<string, unknown> => {
        const config = get().configurations.get(pluginId);
        if (!config) return {};

        const result: Record<string, unknown> = {};
        for (const key of Object.keys(config.contribution.properties)) {
          result[key] = get().getValue(`${pluginId}.${key}`);
        }
        return result;
      },

      resetPlugin: (pluginId: string) => {
        const config = get().configurations.get(pluginId);
        if (!config) return;

        const values = { ...get().values };

        for (const [key, property] of Object.entries(
          config.contribution.properties
        )) {
          const fullKey = `${pluginId}.${key}`;
          if (property.default !== undefined) {
            values[fullKey] = property.default;
          } else {
            delete values[fullKey];
          }
        }

        set({ values });
        console.log(`[PluginConfigStore] Reset configuration for ${pluginId}`);
      },

      resetAll: () => {
        const configurations = get().configurations;
        const values: Record<string, unknown> = {};

        for (const [pluginId, config] of configurations) {
          for (const [key, property] of Object.entries(
            config.contribution.properties
          )) {
            if (property.default !== undefined) {
              values[`${pluginId}.${key}`] = property.default;
            }
          }
        }

        set({ values });
        console.log('[PluginConfigStore] Reset all configurations');
      },

      getAllConfigurations: (): RegisteredConfiguration[] => {
        return Array.from(get().configurations.values());
      },

      getSchema: (key: string): ConfigurationProperty | undefined => {
        const [pluginId, ...rest] = key.split('.');
        const propertyKey = rest.join('.');
        const config = get().configurations.get(pluginId);
        return config?.contribution.properties[propertyKey];
      },
    }),
    {
      name: 'plugin-config-storage',
      partialize: (state) => ({
        values: state.values,
      }),
      // Custom serialization for Map
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str);
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook to get a single plugin config value
 */
export function usePluginConfig<T>(
  key: string,
  defaultValue?: T
): T | undefined {
  return usePluginConfigStore((state) => state.getValue<T>(key, defaultValue));
}

/**
 * Hook to get and set a plugin config value
 */
export function usePluginConfigValue<T>(
  key: string,
  defaultValue?: T
): [T | undefined, (value: T) => void] {
  const value = usePluginConfigStore((state) =>
    state.getValue<T>(key, defaultValue)
  );
  const setValue = usePluginConfigStore((state) => state.setValue);

  return [value, (newValue: T) => setValue(key, newValue)];
}
