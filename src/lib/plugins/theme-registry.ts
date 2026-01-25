/**
 * Theme Registry
 *
 * Manages theme contributions from plugins.
 * Integrates with Monaco Editor and application UI theming.
 */

import type { ThemeContribution } from './plugin-api';

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeDefinition {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit: boolean;
  rules: ThemeRule[];
  colors: Record<string, string>;
}

export interface ThemeRule {
  token: string;
  foreground?: string;
  background?: string;
  fontStyle?: string;
}

export interface RegisteredTheme {
  contribution: ThemeContribution;
  definition?: ThemeDefinition;
  pluginId: string;
  isRegistered: boolean;
}

interface MonacoInstance {
  editor: {
    setTheme(themeId: string): void;
    defineTheme(themeId: string, data: unknown): void;
  };
}

// ============================================================================
// THEME REGISTRY
// ============================================================================

export class ThemeRegistry {
  private themes: Map<string, RegisteredTheme> = new Map();
  private monacoInstance: unknown = null;
  private activeTheme: string | null = null;
  private listeners: Set<(event: ThemeRegistryEvent) => void> = new Set();

  /**
   * Set the Monaco instance for theme registration
   */
  setMonacoInstance(monaco: unknown): void {
    this.monacoInstance = monaco;

    // Re-register all themes with Monaco
    for (const [_id, theme] of this.themes) {
      if (theme.definition) {
        this.registerWithMonaco(theme);
      }
    }
  }

  /**
   * Register a theme contribution (manifest entry only)
   */
  registerContribution(
    pluginId: string,
    contribution: ThemeContribution
  ): void {
    const themeId = contribution.id;

    if (this.themes.has(themeId)) {
      console.warn(`[ThemeRegistry] Theme '${themeId}' already registered`);
      return;
    }

    this.themes.set(themeId, {
      contribution,
      pluginId,
      isRegistered: false,
    });

    this.emit({ type: 'contribution-registered', themeId, pluginId });
    console.log(`[ThemeRegistry] Registered theme contribution: ${themeId}`);
  }

  /**
   * Register a theme with its full definition
   */
  register(
    pluginId: string,
    contribution: ThemeContribution,
    definition: ThemeDefinition
  ): void {
    const themeId = contribution.id;

    const theme: RegisteredTheme = {
      contribution,
      definition,
      pluginId,
      isRegistered: false,
    };

    this.themes.set(themeId, theme);

    // Register with Monaco if available
    if (this.monacoInstance) {
      this.registerWithMonaco(theme);
    }

    this.emit({ type: 'registered', themeId, pluginId });
    console.log(`[ThemeRegistry] Registered theme: ${themeId}`);
  }

  /**
   * Load theme definition from path (called when theme is first activated)
   */
  async loadThemeDefinition(
    themeId: string,
    loadFn: (path: string) => Promise<ThemeDefinition>
  ): Promise<void> {
    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error(`Theme '${themeId}' not found`);
    }

    if (theme.definition) {
      return; // Already loaded
    }

    const definition = await loadFn(theme.contribution.path);
    theme.definition = definition;

    if (this.monacoInstance) {
      this.registerWithMonaco(theme);
    }
  }

  /**
   * Unregister all themes from a plugin
   */
  unregisterByPlugin(pluginId: string): void {
    const toRemove: string[] = [];

    for (const [themeId, theme] of this.themes) {
      if (theme.pluginId === pluginId) {
        toRemove.push(themeId);
      }
    }

    for (const themeId of toRemove) {
      this.themes.delete(themeId);
      this.emit({ type: 'unregistered', themeId, pluginId });
    }

    if (toRemove.length > 0) {
      console.log(
        `[ThemeRegistry] Unregistered ${toRemove.length} themes from ${pluginId}`
      );
    }
  }

  /**
   * Get a theme by ID
   */
  get(themeId: string): RegisteredTheme | undefined {
    return this.themes.get(themeId);
  }

  /**
   * Get all registered themes
   */
  getAll(): RegisteredTheme[] {
    return Array.from(this.themes.values());
  }

  /**
   * Get themes by base type
   */
  getByBase(base: 'vs' | 'vs-dark' | 'hc-black'): RegisteredTheme[] {
    return this.getAll().filter((t) => t.contribution.uiTheme === base);
  }

  /**
   * Get themes by plugin
   */
  getByPlugin(pluginId: string): RegisteredTheme[] {
    return this.getAll().filter((t) => t.pluginId === pluginId);
  }

  /**
   * Apply a theme to Monaco editor
   */
  applyTheme(themeId: string): void {
    const monaco = this.monacoInstance as unknown as MonacoInstance;
    if (!monaco?.editor) {
      console.warn('[ThemeRegistry] Monaco not available');
      return;
    }

    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error(`Theme '${themeId}' not found`);
    }

    if (!theme.isRegistered && theme.definition) {
      this.registerWithMonaco(theme);
    }

    monaco.editor.setTheme(themeId);
    this.activeTheme = themeId;
    this.emit({ type: 'applied', themeId });

    console.log(`[ThemeRegistry] Applied theme: ${themeId}`);
  }

  /**
   * Get currently active theme
   */
  getActiveTheme(): string | null {
    return this.activeTheme;
  }

  /**
   * Clear all themes
   */
  clear(): void {
    this.themes.clear();
    this.activeTheme = null;
    this.emit({ type: 'cleared' });
  }

  /**
   * Register theme with Monaco
   */
  private registerWithMonaco(theme: RegisteredTheme): void {
    const monaco = this.monacoInstance as unknown as MonacoInstance;
    if (!monaco?.editor || !theme.definition) return;

    try {
      monaco.editor.defineTheme(theme.contribution.id, {
        base: theme.definition.base,
        inherit: theme.definition.inherit,
        rules: theme.definition.rules,
        colors: theme.definition.colors,
      });

      theme.isRegistered = true;
    } catch (error) {
      console.error(
        `[ThemeRegistry] Failed to register with Monaco: ${theme.contribution.id}`,
        error
      );
    }
  }

  /**
   * Subscribe to registry events
   */
  onEvent(listener: (event: ThemeRegistryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ThemeRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[ThemeRegistry] Event listener error:', error);
      }
    }
  }
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type ThemeRegistryEvent =
  | { type: 'contribution-registered'; themeId: string; pluginId: string }
  | { type: 'registered'; themeId: string; pluginId: string }
  | { type: 'unregistered'; themeId: string; pluginId: string }
  | { type: 'applied'; themeId: string }
  | { type: 'cleared' };

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const themeRegistry = new ThemeRegistry();
