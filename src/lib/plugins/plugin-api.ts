/**
 * Plugin API Types
 *
 * Defines the core interfaces for the CheeseJS plugin system.
 * Plugins can extend: languages, transpilers, UI panels, and console formatters.
 */

// ============================================================================
// PLUGIN MANIFEST
// ============================================================================

export interface PluginManifest {
  /** Unique plugin identifier (e.g., 'cheesejs-yaml-support') */
  id: string;
  /** Display name */
  name: string;
  /** Semantic version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Author name or object */
  author?: string | { name: string; email?: string; url?: string };
  /** Entry point relative to plugin directory */
  main: string;
  /** Renderer entry point relative to plugin directory */
  renderer?: string;
  /** Minimum CheeseJS version required */
  engines?: { cheesejs?: string };
  /**
   * Whether to run plugin in a sandboxed VM context.
   * Default is true for security. Set to false only for trusted built-in plugins.
   */
  sandboxed?: boolean;
  /**
   * Permissions required by the plugin when running in sandbox.
   * Available: 'filesystem', 'network', 'shell', 'clipboard', 'notifications', 'storage', 'editor', 'terminal', 'debug'
   */
  permissions?: string[];
  /** Capabilities this plugin provides */
  contributes?: PluginContributions;
  /** Plugin configuration schema */
  configuration?: PluginConfigSchema;
}

export interface PluginContributions {
  /** Custom language definitions */
  languages?: LanguageContribution[];
  /** Transpiler extensions */
  transpilers?: TranspilerContribution[];
  /** UI panel contributions */
  panels?: PanelContribution[];
  /** Console output formatters */
  formatters?: FormatterContribution[];
  /** Commands that can be executed */
  commands?: CommandContribution[];
  /** Keyboard shortcuts */
  keybindings?: KeybindingContribution[];
  /** Code snippets */
  snippets?: SnippetContribution[];
  /** Editor themes */
  themes?: ThemeContribution[];
  /** Configuration contributions */
  configuration?: ConfigurationContribution;
  /** WebAssembly language contributions */
  wasmLanguages?: WasmLanguageContribution[];
}

// ============================================================================
// LANGUAGE EXTENSION API
// ============================================================================

export interface LanguageContribution {
  /** Language identifier (e.g., 'yaml', 'rust') */
  id: string;
  /** Display name */
  name: string;
  /** File extensions (e.g., ['.yaml', '.yml']) */
  extensions: string[];
  /** Monaco language configuration */
  configuration?: MonacoLanguageConfig;
  /** Path to TextMate grammar (optional) */
  grammar?: string;
}

export interface MonacoLanguageConfig {
  comments?: {
    lineComment?: string;
    blockComment?: [string, string];
  };
  brackets?: [string, string][];
  autoClosingPairs?: { open: string; close: string }[];
  surroundingPairs?: { open: string; close: string }[];
}

export interface LanguageProvider {
  /** Register Monaco language */
  registerLanguage(): void;
  /** Dispose language registration */
  dispose(): void;
}

// ============================================================================
// TRANSPILER EXTENSION API
// ============================================================================

export interface TranspilerContribution {
  /** Source language ID */
  sourceLanguage: string;
  /** Target language (usually 'javascript') */
  targetLanguage: string;
  /** Priority (higher = preferred) */
  priority?: number;
}

export interface TranspilerExtension {
  /**
   * Transform source code
   * @param code - Source code
   * @param options - Transpilation options
   * @returns Transformed code and source map
   */
  transform(
    code: string,
    options?: TransformOptions
  ): Promise<TransformResult> | TransformResult;
}

export interface TransformOptions {
  filename?: string;
  sourceMap?: boolean;
}

export interface TransformResult {
  code: string;
  map?: string;
  errors?: TransformError[];
}

export interface TransformError {
  message: string;
  line?: number;
  column?: number;
}

// ============================================================================
// UI PANEL API
// ============================================================================

export interface PanelContribution {
  /** Panel identifier */
  id: string;
  /** Panel title */
  title: string;
  /** Icon name (lucide icon) */
  icon?: string;
  /** Panel location */
  location: 'sidebar' | 'bottom' | 'floating';
  /** Priority for ordering */
  priority?: number;
}

export interface UIPanelProvider {
  /**
   * Render the panel content
   * @param container - DOM element to render into
   */
  render(container: HTMLElement): void;
  /** Called when panel is activated */
  onActivate?(): void;
  /** Called when panel is deactivated */
  onDeactivate?(): void;
  /** Dispose panel */
  dispose(): void;
}

// ============================================================================
// CONSOLE FORMATTER API
// ============================================================================

export interface FormatterContribution {
  /** Types this formatter handles (e.g., 'Date', 'Map', 'CustomClass') */
  types: string[];
  /** Priority (higher = preferred) */
  priority?: number;
}

export interface ConsoleFormatter {
  /**
   * Check if this formatter can handle the value
   */
  canFormat(value: unknown, type: string): boolean;
  /**
   * Format the value for console display
   * @returns HTML string or plain text
   */
  format(value: unknown, type: string): string;
}

// ============================================================================
// COMMAND & KEYBINDING API
// ============================================================================

export interface CommandContribution {
  /** Command identifier (e.g., 'myPlugin.doSomething') */
  command: string;
  /** Display title */
  title: string;
  /** Category for grouping in command palette */
  category?: string;
  /** Icon name or path */
  icon?: string;
}

export interface KeybindingContribution {
  /** Command to execute */
  command: string;
  /** Key combination (e.g., 'ctrl+shift+p') */
  key: string;
  /** Mac-specific key combination */
  mac?: string;
  /** Linux-specific key combination */
  linux?: string;
  /** When clause for conditional activation */
  when?: string;
}

// ============================================================================
// SNIPPET API
// ============================================================================

export interface SnippetContribution {
  /** Language ID for these snippets */
  language: string;
  /** Path to snippets JSON file */
  path: string;
}

// ============================================================================
// THEME API
// ============================================================================

export interface ThemeContribution {
  /** Theme identifier */
  id: string;
  /** Display label */
  label: string;
  /** Base UI theme */
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  /** Path to theme JSON file */
  path: string;
}

// ============================================================================
// CONFIGURATION CONTRIBUTION API
// ============================================================================

export interface ConfigurationContribution {
  /** Configuration title */
  title?: string;
  /** Configuration properties */
  properties: Record<string, ConfigurationProperty>;
}

export interface ConfigurationProperty {
  /** Property type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Default value */
  default?: unknown;
  /** Description for UI */
  description?: string;
  /** Enum values for select inputs */
  enum?: unknown[];
  /** Enum descriptions */
  enumDescriptions?: string[];
  /** Minimum value (for numbers) */
  minimum?: number;
  /** Maximum value (for numbers) */
  maximum?: number;
  /** Order for display */
  order?: number;
}

// ============================================================================
// PLUGIN CONTEXT
// ============================================================================

export interface PluginContext {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Plugin directory path */
  pluginPath: string;
  /** Storage for plugin data */
  storage: PluginStorage;
  /** Logger scoped to this plugin */
  logger: PluginLogger;
  /** Subscribe to editor events */
  subscriptions: Disposable[];
}

export interface PluginStorage {
  get<T>(key: string, defaultValue?: T): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  keys(): string[];
}

export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface Disposable {
  dispose(): void;
}

// ============================================================================
// WASM LANGUAGE API
// ============================================================================

export interface WasmLanguageContribution {
  /** Unique language identifier (e.g., 'rust', 'go', 'cpp') */
  id: string;
  /** Display name */
  name: string;
  /** File extensions (e.g., ['.rs', '.go', '.cpp']) */
  extensions: string[];
  /** Version of the language runtime */
  version: string;
  /** Path to WASM module (relative to plugin directory) */
  wasmPath: string;
  /** Path to JS bindings (relative to plugin directory) */
  bindingsPath?: string;
  /** Monaco language configuration */
  monacoConfig?: MonacoLanguageConfig;
  /** Dependencies required by this language */
  dependencies?: WasmDependency[];
  /** Memory limit in bytes (default: 128MB) */
  memoryLimit?: number;
  /** Maximum execution time in ms (default: 30000) */
  timeout?: number;
}

export interface WasmDependency {
  /** Dependency identifier */
  id: string;
  /** Version constraint (e.g., '^1.0.0') */
  version?: string;
  /** URL to download WASM module */
  url?: string;
  /** Optional checksum for validation */
  checksum?: string;
}

// ============================================================================
// PLUGIN LIFECYCLE
// ============================================================================

export interface Plugin {
  /**
   * Called when plugin is activated
   * @param context - Plugin context with APIs
   */
  activate(context: PluginContext): void | Promise<void>;
  /**
   * Called when plugin is deactivated
   */
  deactivate?(): void | Promise<void>;
}

export type PluginActivator = (
  context: PluginContext
) => Plugin | Promise<Plugin>;

// ============================================================================
// PLUGIN CONFIG
// ============================================================================

export interface PluginConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    default?: unknown;
    description?: string;
    enum?: unknown[];
  };
}

// ============================================================================
// PLUGIN STATE
// ============================================================================

export type PluginStatus = 'installed' | 'active' | 'disabled' | 'error';

export interface PluginInfo {
  manifest: PluginManifest;
  status: PluginStatus;
  error?: string;
  loadedAt?: number;
}
