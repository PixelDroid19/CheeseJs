/**
 * Manifest Parser
 *
 * Parses plugin manifests from both plugin.json and package.json formats.
 * Supports VS Code-style declarative contributions.
 */

import fs from 'fs/promises';
import path from 'path';
import type { WasmLanguageContribution } from '../../wasm-languages/WasmLanguageModule.js';

// ============================================================================
// TYPES
// ============================================================================

export interface PluginManifest {
  // Basic info
  id: string;
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  license?: string;

  // Entry point
  main: string;
  renderer?: string;

  // Engine compatibility
  engines?: {
    cheesejs?: string;
    node?: string;
  };

  // Security settings
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

  // Declarative contributions
  contributes?: PluginContributions;

  // Activation
  activationEvents?: string[];

  // Dependencies
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;

  // Metadata
  keywords?: string[];
  categories?: string[];
  icon?: string;
  repository?: string | { type: string; url: string };
  homepage?: string;
}

export interface PluginContributions {
  languages?: LanguageContribution[];
  grammars?: GrammarContribution[];
  transpilers?: TranspilerContribution[];
  themes?: ThemeContribution[];
  snippets?: SnippetContribution[];
  commands?: CommandContribution[];
  keybindings?: KeybindingContribution[];
  panels?: PanelContribution[];
  formatters?: FormatterContribution[];
  wasmLanguages?: WasmLanguageContribution[];
}

export interface LanguageContribution {
  id: string;
  aliases?: string[];
  extensions: string[];
  filenames?: string[];
  configuration?: string | LanguageConfiguration;
}

export interface LanguageConfiguration {
  comments?: {
    lineComment?: string;
    blockComment?: [string, string];
  };
  brackets?: [string, string][];
  autoClosingPairs?: { open: string; close: string; notIn?: string[] }[];
  surroundingPairs?: { open: string; close: string }[];
  folding?: {
    markers?: {
      start?: string;
      end?: string;
    };
  };
}

export interface GrammarContribution {
  language: string;
  scopeName: string;
  path: string;
  embeddedLanguages?: Record<string, string>;
}

export interface TranspilerContribution {
  sourceLanguage: string;
  targetLanguage: string;
  priority?: number;
}

export interface ThemeContribution {
  id: string;
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  path: string;
}

export interface SnippetContribution {
  language: string;
  path: string;
}

export interface CommandContribution {
  command: string;
  title: string;
  category?: string;
  icon?: string;
}

export interface KeybindingContribution {
  command: string;
  key: string;
  mac?: string;
  linux?: string;
  when?: string;
}

export interface PanelContribution {
  id: string;
  title: string;
  icon?: string;
  location: 'sidebar' | 'bottom' | 'floating';
  priority?: number;
}

export interface FormatterContribution {
  types: string[];
  priority?: number;
}

// ============================================================================
// MANIFEST PARSER
// ============================================================================

export class ManifestParser {
  /**
   * Parse manifest from plugin directory
   * Tries package.json first, falls back to plugin.json
   */
  async parseFromDirectory(pluginDir: string): Promise<PluginManifest> {
    // Try package.json first (VS Code style)
    const packageJsonPath = path.join(pluginDir, 'package.json');
    const pluginJsonPath = path.join(pluginDir, 'plugin.json');

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const data = JSON.parse(content);
      return this.parsePackageJson(data, pluginDir);
    } catch {
      // Fall back to plugin.json
      try {
        const content = await fs.readFile(pluginJsonPath, 'utf-8');
        const data = JSON.parse(content);
        return this.parsePluginJson(data);
      } catch {
        throw new Error(
          `No valid manifest found in ${pluginDir}. Expected package.json or plugin.json`
        );
      }
    }
  }

  /**
   * Parse package.json (VS Code style)
   */
  private parsePackageJson(
    data: Record<string, unknown>,
    pluginDir: string
  ): PluginManifest {
    // Generate ID from name if not provided
    const id = (data.name as string) || path.basename(pluginDir);

    const manifest: PluginManifest = {
      id,
      name: (data.displayName as string) || (data.name as string) || id,
      version: (data.version as string) || '1.0.0',
      displayName: data.displayName as string,
      description: data.description as string,
      author: data.author as string,
      license: data.license as string,
      main: (data.main as string) || 'index.js',
      renderer: data.renderer as string,
      engines: data.engines as PluginManifest['engines'],
      contributes: this.parseContributes(
        data.contributes as Record<string, unknown>,
        pluginDir
      ),
      activationEvents: data.activationEvents as string[],
      dependencies: data.dependencies as Record<string, string>,
      devDependencies: data.devDependencies as Record<string, string>,
      keywords: data.keywords as string[],
      categories: data.categories as string[],
      icon: data.icon as string,
      repository: data.repository as PluginManifest['repository'],
      homepage: data.homepage as string,
    };

    this.validateManifest(manifest);
    return manifest;
  }

  /**
   * Parse plugin.json (legacy format)
   */
  private parsePluginJson(data: Record<string, unknown>): PluginManifest {
    const manifest: PluginManifest = {
      id: data.id as string,
      name: data.name as string,
      version: data.version as string,
      description: data.description as string,
      author: data.author as string,
      main: (data.main as string) || 'index.js',
      engines: data.engines as PluginManifest['engines'],
      contributes: data.contributes as PluginContributions,
    };

    this.validateManifest(manifest);
    return manifest;
  }

  /**
   * Parse contributes section
   */
  private parseContributes(
    contributes: Record<string, unknown> | undefined,
    pluginDir: string
  ): PluginContributions | undefined {
    if (!contributes) return undefined;

    const result: PluginContributions = {};

    // Parse languages
    if (contributes.languages) {
      result.languages = (contributes.languages as LanguageContribution[]).map(
        (lang) => {
          // Load configuration from file if it's a string path
          if (typeof lang.configuration === 'string') {
            const configPath = path.join(pluginDir, lang.configuration);
            // This will be loaded asynchronously during activation
            return { ...lang, configuration: configPath };
          }
          return lang;
        }
      );
    }

    // Parse grammars
    if (contributes.grammars) {
      result.grammars = contributes.grammars as GrammarContribution[];
    }

    // Parse transpilers
    if (contributes.transpilers) {
      result.transpilers = contributes.transpilers as TranspilerContribution[];
    }

    // Parse themes
    if (contributes.themes) {
      result.themes = contributes.themes as ThemeContribution[];
    }

    // Parse snippets
    if (contributes.snippets) {
      result.snippets = contributes.snippets as SnippetContribution[];
    }

    // Parse commands
    if (contributes.commands) {
      result.commands = contributes.commands as CommandContribution[];
    }

    // Parse keybindings
    if (contributes.keybindings) {
      result.keybindings = contributes.keybindings as KeybindingContribution[];
    }

    // Parse panels
    if (contributes.panels) {
      result.panels = contributes.panels as PanelContribution[];
    }

    // Parse formatters
    if (contributes.formatters) {
      result.formatters = contributes.formatters as FormatterContribution[];
    }

    return result;
  }

  /**
   * Validate manifest
   */
  private validateManifest(manifest: PluginManifest): void {
    const errors: string[] = [];

    if (!manifest.id) errors.push('Missing required field: id');
    if (!manifest.name) errors.push('Missing required field: name');
    if (!manifest.version) errors.push('Missing required field: version');
    if (!manifest.main) errors.push('Missing required field: main');

    // Validate version format (basic semver check)
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('Version must follow semver format (x.y.z)');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid manifest:\n${errors.join('\n')}`);
    }
  }

  /**
   * Load language configuration from file
   */
  async loadLanguageConfiguration(
    configPath: string
  ): Promise<LanguageConfiguration> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      throw new Error(
        `Failed to load language configuration from ${configPath}`
      );
    }
  }
}

// Singleton instance
export const manifestParser = new ManifestParser();
