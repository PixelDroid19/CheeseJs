/**
 * Monaco Theme Wrapper
 *
 * Encapsulates all interactions with Monaco Editor for theme management.
 * Provides a safe, type-safe API for registering and applying themes.
 */

import type { editor } from 'monaco-editor';

import type {
  MonacoThemeDefinition,
  ExtendedThemeDefinition,
  MonacoBaseTheme,
} from './types';

import { ThemeApplicationError } from './theme-errors';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Monaco Editor interface (minimal typing for theme operations)
 */
export interface MonacoInstance {
  editor: {
    defineTheme: (
      themeName: string,
      themeData: editor.IStandaloneThemeData
    ) => void;
    setTheme: (themeName: string) => void;
    getModels: () => editor.ITextModel[];
  };
}

export interface RegisterThemeOptions {
  /** Override if theme already exists */
  override?: boolean;
  /** Log registration */
  debug?: boolean;
}

export interface ApplyThemeOptions {
  /** Force re-registration before applying */
  forceRegister?: boolean;
  /** Callback after theme is applied */
  onApplied?: () => void;
}

// ============================================================================
// MONACO THEME WRAPPER
// ============================================================================

export class MonacoThemeWrapper {
  private monaco: MonacoInstance | null = null;
  private registeredThemes: Set<string> = new Set();
  private currentTheme: string | null = null;
  private pendingTheme: string | null = null;
  private onReadyCallbacks: Array<() => void> = [];

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Set the Monaco instance
   */
  setMonaco(monaco: MonacoInstance): void {
    this.monaco = monaco;

    // Register any pending themes
    console.log('[MonacoThemeWrapper] Monaco instance set');

    // Execute ready callbacks
    for (const callback of this.onReadyCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[MonacoThemeWrapper] Ready callback error:', error);
      }
    }
    this.onReadyCallbacks = [];

    // Apply pending theme if any
    if (this.pendingTheme) {
      this.setTheme(this.pendingTheme);
      this.pendingTheme = null;
    }
  }

  /**
   * Check if Monaco is available
   */
  isReady(): boolean {
    return this.monaco !== null;
  }

  /**
   * Execute a callback when Monaco is ready
   */
  onReady(callback: () => void): void {
    if (this.monaco) {
      callback();
    } else {
      this.onReadyCallbacks.push(callback);
    }
  }

  // ========================================================================
  // THEME REGISTRATION
  // ========================================================================

  /**
   * Register a theme with Monaco
   */
  registerTheme(
    themeId: string,
    theme: ExtendedThemeDefinition | MonacoThemeDefinition,
    options: RegisterThemeOptions = {}
  ): boolean {
    // Check if already registered
    if (this.registeredThemes.has(themeId) && !options.override) {
      if (options.debug) {
        console.log(
          `[MonacoThemeWrapper] Theme '${themeId}' already registered`
        );
      }
      return false;
    }

    // If Monaco not ready, queue for later
    if (!this.monaco) {
      this.onReady(() => this.registerTheme(themeId, theme, options));
      return false;
    }

    try {
      const monacoTheme = this.toMonacoThemeData(theme);
      this.monaco.editor.defineTheme(themeId, monacoTheme);
      this.registeredThemes.add(themeId);

      if (options.debug) {
        console.log(`[MonacoThemeWrapper] Registered theme: ${themeId}`);
      }

      return true;
    } catch (error) {
      console.error(
        `[MonacoThemeWrapper] Failed to register theme '${themeId}':`,
        error
      );
      return false;
    }
  }

  /**
   * Unregister a theme (only removes from tracking, Monaco doesn't support full unregistration)
   */
  unregisterTheme(themeId: string): boolean {
    const wasRegistered = this.registeredThemes.delete(themeId);

    // If this was the current theme, we can't really "unset" it in Monaco
    // Just note it for tracking purposes
    if (this.currentTheme === themeId) {
      console.warn(
        `[MonacoThemeWrapper] Unregistered active theme '${themeId}'. Consider applying a different theme.`
      );
    }

    return wasRegistered;
  }

  /**
   * Check if a theme is registered
   */
  isThemeRegistered(themeId: string): boolean {
    return this.registeredThemes.has(themeId);
  }

  /**
   * Get all registered theme IDs
   */
  getRegisteredThemes(): string[] {
    return Array.from(this.registeredThemes);
  }

  // ========================================================================
  // THEME APPLICATION
  // ========================================================================

  /**
   * Apply a theme to Monaco Editor
   */
  setTheme(themeId: string, options: ApplyThemeOptions = {}): void {
    // If Monaco not ready, queue for later
    if (!this.monaco) {
      this.pendingTheme = themeId;
      console.log(
        `[MonacoThemeWrapper] Monaco not ready, queuing theme: ${themeId}`
      );
      return;
    }

    // Check if theme is registered
    if (!this.registeredThemes.has(themeId) && !this.isBuiltinTheme(themeId)) {
      throw new ThemeApplicationError(
        themeId,
        'monaco',
        `Theme '${themeId}' is not registered. Call registerTheme first.`
      );
    }

    try {
      this.monaco.editor.setTheme(themeId);
      this.currentTheme = themeId;

      if (options.onApplied) {
        options.onApplied();
      }

      console.log(`[MonacoThemeWrapper] Applied theme: ${themeId}`);
    } catch (error) {
      throw new ThemeApplicationError(
        themeId,
        'monaco',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get the currently applied theme ID
   */
  getCurrentTheme(): string | null {
    return this.currentTheme;
  }

  /**
   * Check if a theme ID is a Monaco built-in theme
   */
  isBuiltinTheme(themeId: string): boolean {
    return ['vs', 'vs-dark', 'hc-black'].includes(themeId);
  }

  // ========================================================================
  // THEME DATA CONVERSION
  // ========================================================================

  /**
   * Convert extended theme to Monaco theme data
   */
  toMonacoThemeData(
    theme: ExtendedThemeDefinition | MonacoThemeDefinition
  ): editor.IStandaloneThemeData {
    return {
      base: theme.base,
      inherit: theme.inherit,
      rules: theme.rules.map((rule) => ({
        token: rule.token,
        foreground: rule.foreground,
        background: rule.background,
        fontStyle: rule.fontStyle,
      })),
      colors: { ...theme.colors },
    };
  }

  /**
   * Create a minimal Monaco theme
   */
  createMinimalTheme(base: MonacoBaseTheme): editor.IStandaloneThemeData {
    return {
      base,
      inherit: true,
      rules: [],
      colors: {},
    };
  }

  // ========================================================================
  // EDITOR REFRESH
  // ========================================================================

  /**
   * Force refresh all Monaco editors (useful after theme change)
   */
  refreshAllEditors(): void {
    if (!this.monaco) return;

    try {
      // Get all editor models and trigger a re-render
      const models = this.monaco.editor.getModels();

      for (const model of models) {
        // Trigger a content change event to refresh tokenization
        const content = model.getValue();
        model.setValue(content);
      }

      console.log(`[MonacoThemeWrapper] Refreshed ${models.length} editor(s)`);
    } catch (error) {
      console.error('[MonacoThemeWrapper] Failed to refresh editors:', error);
    }
  }

  /**
   * Clear all registered themes
   */
  clear(): void {
    this.registeredThemes.clear();
    this.currentTheme = null;
    this.pendingTheme = null;
  }

  // ========================================================================
  // THEME UTILITIES
  // ========================================================================

  /**
   * Get default colors for a base theme
   */
  getDefaultColors(base: MonacoBaseTheme): Record<string, string> {
    switch (base) {
      case 'vs':
        return {
          'editor.background': '#ffffff',
          'editor.foreground': '#000000',
          'editor.selectionBackground': '#add6ff',
          'editorLineNumber.foreground': '#237893',
        };
      case 'vs-dark':
        return {
          'editor.background': '#1e1e1e',
          'editor.foreground': '#d4d4d4',
          'editor.selectionBackground': '#264f78',
          'editorLineNumber.foreground': '#858585',
        };
      case 'hc-black':
        return {
          'editor.background': '#000000',
          'editor.foreground': '#ffffff',
          'editor.selectionBackground': '#7c7c7c',
          'editorLineNumber.foreground': '#ffffff',
        };
    }
  }

  /**
   * Merge theme colors with defaults
   */
  mergeWithDefaults(
    colors: Record<string, string>,
    base: MonacoBaseTheme
  ): Record<string, string> {
    const defaults = this.getDefaultColors(base);
    return { ...defaults, ...colors };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const monacoThemeWrapper = new MonacoThemeWrapper();
