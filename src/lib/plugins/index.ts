/**
 * Plugin System Exports
 *
 * Centralized exports for the plugin system.
 */

// Registries
export {
  commandRegistry,
  type CommandHandler,
  type RegisteredCommand,
} from './command-registry';
export {
  keybindingRegistry,
  type RegisteredKeybinding,
  type ParsedKeybinding,
} from './keybinding-registry';
export {
  snippetRegistry,
  type Snippet,
  type SnippetFile,
  type RegisteredSnippet,
} from './snippet-registry';
export {
  themeRegistry,
  type ThemeDefinition,
  type ThemeRule,
  type RegisteredTheme,
} from './theme-registry';
export { languageRegistry, type RegisteredLanguage } from './language-registry';
export {
  formatterRegistry,
  type RegisteredFormatter,
} from './formatter-registry';
export { panelRegistry, type RegisteredPanel } from './panel-registry';

// Marketplace
export {
  pluginMarketplace,
  PluginMarketplace,
  type MarketplacePlugin,
  type MarketplaceCategory,
  type MarketplaceVersion,
  type SearchOptions,
  type SearchResult,
  type InstallResult,
} from './marketplace';

// API Types
export type {
  PluginManifest,
  PluginContributions,
  PluginContext,
  PluginStorage,
  PluginLogger,
  Plugin,
  PluginActivator,
  PluginConfigSchema,
  PluginStatus,
  PluginInfo,
  // Language
  LanguageContribution,
  LanguageProvider,
  MonacoLanguageConfig,
  // Transpiler
  TranspilerContribution,
  TranspilerExtension,
  TransformOptions,
  TransformResult,
  TransformError,
  // Panel
  PanelContribution,
  UIPanelProvider,
  // Formatter
  FormatterContribution,
  ConsoleFormatter,
  // Command & Keybinding
  CommandContribution,
  KeybindingContribution,
  // Snippet & Theme
  SnippetContribution,
  ThemeContribution,
  // Configuration
  ConfigurationContribution,
  ConfigurationProperty,
  // Utils
  Disposable,
} from './plugin-api';
