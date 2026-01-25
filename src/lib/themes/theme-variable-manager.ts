/**
 * Theme Variable Manager
 *
 * Manages CSS custom properties (variables) for dynamic theme application.
 * Converts Monaco theme colors to UI component variables and applies them to the DOM.
 */

import type {
  CSSVariableMap,
  CSSVariableName,
  CSSVariableApplicationResult,
  CSSVariableScope,
  ExtendedThemeDefinition,
  UIColorScheme,
  MonacoBaseTheme,
} from './types';

import {
  CSS_VARIABLE_NAMES,
  MONACO_TO_UI_MAPPING,
  DEFAULT_DARK_UI_COLORS,
  DEFAULT_LIGHT_UI_COLORS,
  normalizeColor,
  lightenColor,
  darkenColor,
  withAlpha,
} from './color-mapping';

import { CSSVariableError } from './theme-errors';

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeVariableManagerOptions {
  /** Root element selector (default: ':root') */
  rootSelector?: string;
  /** Transition duration for smooth theme changes (ms) */
  transitionDuration?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface ApplyOptions {
  /** Skip transition animation */
  skipTransition?: boolean;
  /** Scope to apply variables to */
  scope?: CSSVariableScope;
  /** Only apply specific variable names */
  only?: CSSVariableName[];
  /** Exclude specific variable names */
  exclude?: CSSVariableName[];
}

// ============================================================================
// THEME VARIABLE MANAGER
// ============================================================================

export class ThemeVariableManager {
  private options: Required<ThemeVariableManagerOptions>;
  private currentVariables: CSSVariableMap = {} as CSSVariableMap;
  private currentThemeId: string | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private transitionStyleElement: HTMLStyleElement | null = null;

  constructor(options: ThemeVariableManagerOptions = {}) {
    this.options = {
      rootSelector: options.rootSelector ?? ':root',
      transitionDuration: options.transitionDuration ?? 200,
      debug: options.debug ?? false,
    };
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Extract UI colors from a theme definition
   */
  extractUIColors(theme: ExtendedThemeDefinition): UIColorScheme {
    // Start with defaults based on theme type
    const isDark = theme.base === 'vs-dark' || theme.base === 'hc-black';
    const defaults = isDark
      ? { ...DEFAULT_DARK_UI_COLORS }
      : { ...DEFAULT_LIGHT_UI_COLORS };

    // If theme has explicit uiColors, use them
    if (theme.uiColors) {
      return { ...defaults, ...theme.uiColors };
    }

    // Otherwise, derive UI colors from Monaco colors
    const derivedColors = this.deriveUIColorsFromMonaco(
      theme.colors,
      theme.base
    );

    return { ...defaults, ...derivedColors };
  }

  /**
   * Convert UI colors to CSS variable map
   */
  uiColorsToCSSVariables(uiColors: UIColorScheme): CSSVariableMap {
    const variables: CSSVariableMap = {} as CSSVariableMap;

    for (const [key, cssVarName] of Object.entries(CSS_VARIABLE_NAMES)) {
      const colorKey = key as keyof UIColorScheme;
      const color = uiColors[colorKey];
      if (color) {
        variables[cssVarName] = normalizeColor(color) ?? color;
      }
    }

    return variables;
  }

  /**
   * Apply theme variables to the DOM
   */
  apply(
    themeId: string,
    theme: ExtendedThemeDefinition,
    options: ApplyOptions = {}
  ): CSSVariableApplicationResult {
    const scope = options.scope ?? 'root';
    const applied: CSSVariableMap = {} as CSSVariableMap;
    const failed: Array<{ name: CSSVariableName; error: string }> = [];

    // Extract and convert colors
    const uiColors = this.extractUIColors(theme);
    let variables = this.uiColorsToCSSVariables(uiColors);

    // Filter variables if specified
    if (options.only) {
      const filtered: CSSVariableMap = {} as CSSVariableMap;
      for (const name of options.only) {
        if (variables[name]) {
          filtered[name] = variables[name];
        }
      }
      variables = filtered;
    }

    if (options.exclude) {
      for (const name of options.exclude) {
        delete variables[name];
      }
    }

    // Apply transition if enabled
    if (!options.skipTransition && this.options.transitionDuration > 0) {
      this.applyTransition();
    }

    // Apply variables
    const root = this.getRootElement(scope);
    if (!root) {
      this.log('warn', `Could not find root element for scope: ${scope}`);
      return { applied, failed, scope };
    }

    for (const [name, value] of Object.entries(variables)) {
      try {
        root.style.setProperty(name, value);
        applied[name as CSSVariableName] = value;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        failed.push({ name: name as CSSVariableName, error: errorMessage });
        this.log('error', `Failed to set ${name}: ${errorMessage}`);
      }
    }

    // Update current state
    this.currentVariables = { ...this.currentVariables, ...applied };
    this.currentThemeId = themeId;

    // Set data attributes for CSS selectors
    this.setThemeDataAttributes(theme);

    // Clean up transition after animation
    if (!options.skipTransition && this.options.transitionDuration > 0) {
      setTimeout(
        () => this.removeTransition(),
        this.options.transitionDuration
      );
    }

    this.log(
      'info',
      `Applied ${Object.keys(applied).length} CSS variables for theme: ${themeId}`
    );

    return { applied, failed, scope };
  }

  /**
   * Apply a partial update to CSS variables
   */
  update(
    variables: Partial<CSSVariableMap>,
    scope: CSSVariableScope = 'root'
  ): void {
    const root = this.getRootElement(scope);
    if (!root) return;

    for (const [name, value] of Object.entries(variables)) {
      if (value) {
        root.style.setProperty(name, value);
        this.currentVariables[name as CSSVariableName] = value;
      }
    }
  }

  /**
   * Remove all theme variables
   */
  clear(scope: CSSVariableScope = 'root'): void {
    const root = this.getRootElement(scope);
    if (!root) return;

    for (const name of Object.keys(this.currentVariables)) {
      root.style.removeProperty(name);
    }

    this.currentVariables = {} as CSSVariableMap;
    this.currentThemeId = null;

    // Remove data attributes
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-type');
  }

  /**
   * Get current CSS variables
   */
  getCurrentVariables(): CSSVariableMap {
    return { ...this.currentVariables };
  }

  /**
   * Get current theme ID
   */
  getCurrentThemeId(): string | null {
    return this.currentThemeId;
  }

  /**
   * Get computed value of a CSS variable
   */
  getComputedVariable(
    name: CSSVariableName,
    element?: HTMLElement
  ): string | null {
    const el = element ?? document.documentElement;
    const computed = getComputedStyle(el);
    return computed.getPropertyValue(name).trim() || null;
  }

  /**
   * Set a single CSS variable
   */
  setVariable(
    name: CSSVariableName,
    value: string,
    scope: CSSVariableScope = 'root'
  ): void {
    const root = this.getRootElement(scope);
    if (!root) {
      throw new CSSVariableError(
        this.currentThemeId ?? 'unknown',
        name,
        `Could not find root element for scope: ${scope}`,
        value
      );
    }

    root.style.setProperty(name, value);
    this.currentVariables[name] = value;
  }

  /**
   * Remove a single CSS variable
   */
  removeVariable(
    name: CSSVariableName,
    scope: CSSVariableScope = 'root'
  ): void {
    const root = this.getRootElement(scope);
    if (!root) return;

    root.style.removeProperty(name);
    delete this.currentVariables[name];
  }

  /**
   * Generate CSS string for all variables
   */
  generateCSSString(theme: ExtendedThemeDefinition): string {
    const uiColors = this.extractUIColors(theme);
    const variables = this.uiColorsToCSSVariables(uiColors);

    const lines = Object.entries(variables)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n');

    return `${this.options.rootSelector} {\n${lines}\n}`;
  }

  /**
   * Inject CSS variables as a style element (alternative to inline styles)
   */
  injectStyleSheet(theme: ExtendedThemeDefinition, themeId: string): void {
    const css = this.generateCSSString(theme);

    if (this.styleElement) {
      this.styleElement.textContent = css;
    } else {
      this.styleElement = document.createElement('style');
      this.styleElement.id = `theme-variables-${themeId}`;
      this.styleElement.textContent = css;
      document.head.appendChild(this.styleElement);
    }
  }

  /**
   * Remove injected style sheet
   */
  removeStyleSheet(): void {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  /**
   * Derive UI colors from Monaco theme colors
   */
  private deriveUIColorsFromMonaco(
    monacoColors: Record<string, string>,
    base: MonacoBaseTheme
  ): Partial<UIColorScheme> {
    const derived: Partial<UIColorScheme> = {};
    const isDark = base === 'vs-dark' || base === 'hc-black';

    // Direct mappings from Monaco colors
    for (const [monacoKey, uiKey] of Object.entries(MONACO_TO_UI_MAPPING)) {
      const color = monacoColors[monacoKey];
      if (color) {
        derived[uiKey] = normalizeColor(color);
      }
    }

    // Intelligent derivations based on editor colors
    const editorBg = normalizeColor(monacoColors['editor.background']);
    const editorFg = normalizeColor(monacoColors['editor.foreground']);

    if (editorBg) {
      // Derive panel colors from editor background
      if (!derived.panelBackground) {
        derived.panelBackground = isDark
          ? darkenColor(editorBg, 5)
          : lightenColor(editorBg, 5);
      }

      if (!derived.sidebarBackground) {
        derived.sidebarBackground = isDark
          ? lightenColor(editorBg, 3)
          : darkenColor(editorBg, 3);
      }

      if (!derived.titleBarBackground) {
        derived.titleBarBackground = isDark
          ? lightenColor(editorBg, 8)
          : darkenColor(editorBg, 8);
      }

      if (!derived.inputBackground) {
        derived.inputBackground = isDark
          ? lightenColor(editorBg, 10)
          : editorBg;
      }

      if (!derived.dropdownBackground) {
        derived.dropdownBackground = isDark
          ? lightenColor(editorBg, 8)
          : editorBg;
      }

      if (!derived.tooltipBackground) {
        derived.tooltipBackground = isDark
          ? lightenColor(editorBg, 5)
          : darkenColor(editorBg, 5);
      }

      if (!derived.widgetBackground) {
        derived.widgetBackground = isDark
          ? lightenColor(editorBg, 5)
          : darkenColor(editorBg, 3);
      }

      if (!derived.listHoverBackground) {
        derived.listHoverBackground = isDark
          ? lightenColor(editorBg, 8)
          : darkenColor(editorBg, 5);
      }

      if (!derived.terminalBackground) {
        derived.terminalBackground = editorBg;
      }

      if (!derived.consoleBackground) {
        derived.consoleBackground = editorBg;
      }

      // Borders
      if (!derived.panelBorder) {
        derived.panelBorder = isDark
          ? lightenColor(editorBg, 15)
          : darkenColor(editorBg, 15);
      }

      if (!derived.widgetShadow) {
        derived.widgetShadow = withAlpha('#000000', isDark ? 0.5 : 0.16);
      }
    }

    if (editorFg) {
      // Derive text colors from editor foreground
      if (!derived.panelForeground) {
        derived.panelForeground = editorFg;
      }

      if (!derived.sidebarForeground) {
        derived.sidebarForeground = editorFg;
      }

      if (!derived.inputForeground) {
        derived.inputForeground = editorFg;
      }

      if (!derived.tooltipForeground) {
        derived.tooltipForeground = editorFg;
      }

      if (!derived.terminalForeground) {
        derived.terminalForeground = editorFg;
      }

      if (!derived.consoleForeground) {
        derived.consoleForeground = editorFg;
      }

      // Placeholder and secondary text
      if (!derived.inputPlaceholderForeground) {
        derived.inputPlaceholderForeground = withAlpha(editorFg, 0.5);
      }
    }

    // Derive focus border from selection/accent color
    const selectionBg = normalizeColor(
      monacoColors['editor.selectionBackground']
    );
    if (selectionBg && !derived.focusBorder) {
      derived.focusBorder = isDark
        ? lightenColor(selectionBg, 20)
        : selectionBg;
    }

    // Link color from editor info color or default blue
    const infoFg = normalizeColor(monacoColors['editorInfo.foreground']);
    if (!derived.linkForeground) {
      derived.linkForeground = infoFg ?? (isDark ? '#3794ff' : '#006ab1');
    }

    return derived;
  }

  /**
   * Get the root element for a scope
   */
  private getRootElement(scope: CSSVariableScope): HTMLElement | null {
    switch (scope) {
      case 'root':
        return document.documentElement;
      case 'editor':
        return document.querySelector('.monaco-editor') as HTMLElement;
      case 'panel':
        return document.querySelector('[data-panel]') as HTMLElement;
      case 'modal':
        return document.querySelector('[data-modal]') as HTMLElement;
      default:
        return document.documentElement;
    }
  }

  /**
   * Set theme data attributes on the document
   */
  private setThemeDataAttributes(theme: ExtendedThemeDefinition): void {
    const isDark = theme.base === 'vs-dark' || theme.base === 'hc-black';

    document.documentElement.setAttribute(
      'data-theme',
      this.currentThemeId ?? 'default'
    );
    document.documentElement.setAttribute(
      'data-theme-type',
      isDark ? 'dark' : 'light'
    );

    // Toggle dark class for Tailwind compatibility
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  /**
   * Apply transition styles for smooth theme changes
   */
  private applyTransition(): void {
    if (this.transitionStyleElement) return;

    const css = `
            *, *::before, *::after {
                transition: background-color ${this.options.transitionDuration}ms ease,
                            color ${this.options.transitionDuration}ms ease,
                            border-color ${this.options.transitionDuration}ms ease,
                            box-shadow ${this.options.transitionDuration}ms ease !important;
            }
        `;

    this.transitionStyleElement = document.createElement('style');
    this.transitionStyleElement.id = 'theme-transition';
    this.transitionStyleElement.textContent = css;
    document.head.appendChild(this.transitionStyleElement);
  }

  /**
   * Remove transition styles
   */
  private removeTransition(): void {
    if (this.transitionStyleElement) {
      this.transitionStyleElement.remove();
      this.transitionStyleElement = null;
    }
  }

  /**
   * Log a message if debug is enabled
   */
  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (!this.options.debug && level === 'info') return;

    const prefix = '[ThemeVariableManager]';
    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const themeVariableManager = new ThemeVariableManager();
