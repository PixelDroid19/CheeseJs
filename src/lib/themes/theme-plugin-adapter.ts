/**
 * Theme Plugin Adapter
 *
 * Converts between different theme formats:
 * - VS Code theme format (tokenColors, colors, semanticTokenColors)
 * - Monaco Editor native format (rules, colors)
 * - Extended theme format (with inheritance and UI colors)
 */

import type {
  MonacoThemeDefinition,
  ExtendedThemeDefinition,
  ThemeTokenRule,
  TextMateTokenColor,
  VSCodeThemeFile,
  MonacoBaseTheme,
  ThemeMetadata,
  SemanticTokenStyle,
  ThemeValidationResult,
  ThemeValidationError,
  ThemeValidationWarning,
} from './types';

import { normalizeColor } from './color-mapping';
import {
  ThemeConversionError,
  ThemeValidationError as ValidationError,
} from './theme-errors';

// ============================================================================
// TYPES
// ============================================================================

export type ThemeFormat = 'vscode' | 'monaco' | 'extended';

export interface ConversionOptions {
  /** Source format (auto-detect if not specified) */
  sourceFormat?: ThemeFormat;
  /** Include metadata in output */
  includeMetadata?: boolean;
  /** Preserve original properties */
  preserveOriginal?: boolean;
  /** Validate output */
  validate?: boolean;
}

// ============================================================================
// THEME PLUGIN ADAPTER
// ============================================================================

export class ThemePluginAdapter {
  private static instance: ThemePluginAdapter | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): ThemePluginAdapter {
    if (!ThemePluginAdapter.instance) {
      ThemePluginAdapter.instance = new ThemePluginAdapter();
    }
    return ThemePluginAdapter.instance;
  }

  // ========================================================================
  // FORMAT DETECTION
  // ========================================================================

  /**
   * Detect the format of a theme object
   */
  detectFormat(theme: unknown): ThemeFormat {
    if (!theme || typeof theme !== 'object') {
      throw new ThemeConversionError(
        'unknown',
        'unknown',
        'extended',
        'Invalid theme object'
      );
    }

    const obj = theme as Record<string, unknown>;

    // VS Code format has tokenColors array
    if (Array.isArray(obj.tokenColors)) {
      return 'vscode';
    }

    // Monaco format has rules array and base property
    if (Array.isArray(obj.rules) && typeof obj.base === 'string') {
      // Check if it's extended format
      if (obj.extends || obj.uiColors || obj.metadata) {
        return 'extended';
      }
      return 'monaco';
    }

    // Default to VS Code format if it has colors but no rules
    if (obj.colors && !obj.rules) {
      return 'vscode';
    }

    throw new ThemeConversionError(
      'unknown',
      'unknown',
      'extended',
      'Could not detect theme format'
    );
  }

  // ========================================================================
  // CONVERSION METHODS
  // ========================================================================

  /**
   * Convert any theme format to extended format
   */
  toExtendedFormat(
    theme: unknown,
    themeId: string,
    options: ConversionOptions = {}
  ): ExtendedThemeDefinition {
    const format = options.sourceFormat ?? this.detectFormat(theme);

    let result: ExtendedThemeDefinition;

    switch (format) {
      case 'vscode':
        result = this.convertVSCodeToExtended(
          theme as VSCodeThemeFile,
          themeId
        );
        break;
      case 'monaco':
        result = this.convertMonacoToExtended(
          theme as MonacoThemeDefinition,
          themeId
        );
        break;
      case 'extended':
        result = theme as ExtendedThemeDefinition;
        break;
      default:
        throw new ThemeConversionError(
          themeId,
          format,
          'extended',
          'Unsupported source format'
        );
    }

    // Validate if requested
    if (options.validate) {
      const validation = this.validate(result, themeId);
      if (!validation.isValid) {
        throw new ValidationError(
          themeId,
          validation.errors.map((e) => ({
            path: e.path ?? '',
            message: e.message,
          }))
        );
      }
      if (validation.normalizedTheme) {
        result = validation.normalizedTheme;
      }
    }

    return result;
  }

  /**
   * Convert extended format to Monaco format
   */
  toMonacoFormat(theme: ExtendedThemeDefinition): MonacoThemeDefinition {
    return {
      base: theme.base,
      inherit: theme.inherit,
      rules: theme.rules,
      colors: theme.colors,
    };
  }

  /**
   * Convert VS Code theme to extended format
   */
  private convertVSCodeToExtended(
    vscodeTheme: VSCodeThemeFile,
    themeId: string
  ): ExtendedThemeDefinition {
    // Determine base theme
    const base = this.determineBaseTheme(vscodeTheme);

    // Convert tokenColors to Monaco rules
    const rules = this.convertTokenColorsToRules(vscodeTheme.tokenColors ?? []);

    // Normalize colors
    const colors = this.normalizeColors(vscodeTheme.colors ?? {});

    // Build extended theme
    const extended: ExtendedThemeDefinition = {
      base,
      inherit: true,
      rules,
      colors,
      metadata: {
        name: vscodeTheme.name ?? themeId,
      },
    };

    // Include semantic token colors if present
    if (vscodeTheme.semanticTokenColors) {
      extended.semanticTokenColors = vscodeTheme.semanticTokenColors;
    }

    // Keep original tokenColors for reference
    if (vscodeTheme.tokenColors) {
      extended.tokenColors = vscodeTheme.tokenColors;
    }

    return extended;
  }

  /**
   * Convert Monaco theme to extended format
   */
  private convertMonacoToExtended(
    monacoTheme: MonacoThemeDefinition,
    themeId: string
  ): ExtendedThemeDefinition {
    return {
      ...monacoTheme,
      metadata: {
        name: themeId,
      },
    };
  }

  /**
   * Convert TextMate tokenColors to Monaco rules
   */
  private convertTokenColorsToRules(
    tokenColors: TextMateTokenColor[]
  ): ThemeTokenRule[] {
    const rules: ThemeTokenRule[] = [];

    for (const tokenColor of tokenColors) {
      const scopes = Array.isArray(tokenColor.scope)
        ? tokenColor.scope
        : (tokenColor.scope?.split(',').map((s) => s.trim()) ?? []);

      const settings = tokenColor.settings;

      for (const scope of scopes) {
        if (!scope) continue;

        const rule: ThemeTokenRule = {
          token: this.convertScopeToToken(scope),
        };

        if (settings.foreground) {
          rule.foreground = this.stripHash(settings.foreground);
        }

        if (settings.background) {
          rule.background = this.stripHash(settings.background);
        }

        if (settings.fontStyle) {
          rule.fontStyle = settings.fontStyle;
        }

        rules.push(rule);
      }
    }

    return rules;
  }

  /**
   * Convert TextMate scope to Monaco token
   */
  private convertScopeToToken(scope: string): string {
    // Monaco uses simplified token names
    // This is a best-effort conversion from TextMate scopes

    const scopeMappings: Record<string, string> = {
      comment: 'comment',
      'comment.line': 'comment',
      'comment.block': 'comment',
      string: 'string',
      'string.quoted': 'string',
      'string.quoted.single': 'string',
      'string.quoted.double': 'string',
      'string.template': 'string',
      'string.regexp': 'regexp',
      constant: 'constant',
      'constant.numeric': 'number',
      'constant.language': 'constant.language',
      'constant.character': 'constant.character',
      'constant.character.escape': 'string.escape',
      variable: 'variable',
      'variable.parameter': 'variable.parameter',
      'variable.other': 'variable',
      'variable.language': 'variable.language',
      keyword: 'keyword',
      'keyword.control': 'keyword',
      'keyword.operator': 'keyword.operator',
      storage: 'storage',
      'storage.type': 'storage.type',
      'storage.modifier': 'storage.modifier',
      'entity.name': 'entity.name',
      'entity.name.type': 'type',
      'entity.name.class': 'type.class',
      'entity.name.function': 'entity.name.function',
      'entity.name.tag': 'tag',
      'entity.other.attribute-name': 'attribute.name',
      support: 'support',
      'support.function': 'support.function',
      'support.class': 'support.class',
      'support.type': 'support.type',
      'support.constant': 'support.constant',
      'support.variable': 'support.variable',
      invalid: 'invalid',
      'invalid.deprecated': 'invalid.deprecated',
      meta: 'meta',
      'meta.brace': 'delimiter.bracket',
      punctuation: 'delimiter',
      'punctuation.definition': 'delimiter',
      'punctuation.separator': 'delimiter',
      'punctuation.terminator': 'delimiter',
      'markup.heading': 'markup.heading',
      'markup.bold': 'markup.bold',
      'markup.italic': 'markup.italic',
      'markup.underline': 'markup.underline',
      'markup.list': 'markup.list',
      'markup.quote': 'markup.quote',
      'markup.raw': 'markup.raw',
      'markup.inserted': 'markup.inserted',
      'markup.deleted': 'markup.deleted',
      'markup.changed': 'markup.changed',
    };

    // Find exact match first
    if (scopeMappings[scope]) {
      return scopeMappings[scope];
    }

    // Find partial match (longest prefix)
    const parts = scope.split('.');
    for (let i = parts.length; i > 0; i--) {
      const prefix = parts.slice(0, i).join('.');
      if (scopeMappings[prefix]) {
        return scopeMappings[prefix];
      }
    }

    // Return simplified version of original scope
    return parts.slice(0, 2).join('.');
  }

  /**
   * Strip # from hex color
   */
  private stripHash(color: string): string {
    if (color.startsWith('#')) {
      return color.slice(1);
    }
    return color;
  }

  /**
   * Normalize color values in a colors object
   */
  private normalizeColors(
    colors: Record<string, string>
  ): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(colors)) {
      const normalizedColor = normalizeColor(value);
      if (normalizedColor) {
        normalized[key] = normalizedColor;
      }
    }

    return normalized;
  }

  /**
   * Determine the base theme from a VS Code theme
   */
  private determineBaseTheme(theme: VSCodeThemeFile): MonacoBaseTheme {
    // Explicit type
    if (theme.type === 'light') return 'vs';
    if (theme.type === 'dark') return 'vs-dark';
    if (theme.type === 'hc') return 'hc-black';

    // Try to determine from colors
    const editorBg = theme.colors?.['editor.background'];
    if (editorBg) {
      const normalized = normalizeColor(editorBg);
      if (normalized) {
        const isDark = this.isColorDark(normalized);
        return isDark ? 'vs-dark' : 'vs';
      }
    }

    // Default to dark
    return 'vs-dark';
  }

  /**
   * Check if a color is dark
   */
  private isColorDark(color: string): boolean {
    if (!color.startsWith('#')) return true;

    const hex = color.slice(1);
    let r: number, g: number, b: number;

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return true;
    }

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  // ========================================================================
  // THEME INHERITANCE
  // ========================================================================

  /**
   * Merge a child theme with its parent theme
   */
  mergeThemes(
    child: ExtendedThemeDefinition,
    parent: ExtendedThemeDefinition
  ): ExtendedThemeDefinition {
    // Merge token rules (child rules override parent)
    const mergedRules = this.mergeRules(parent.rules, child.rules);

    // Merge colors (child colors override parent)
    const mergedColors = { ...parent.colors, ...child.colors };

    // Merge UI colors if present
    const mergedUIColors = child.uiColors
      ? { ...parent.uiColors, ...child.uiColors }
      : parent.uiColors;

    // Merge semantic token colors
    const mergedSemanticTokenColors = child.semanticTokenColors
      ? { ...parent.semanticTokenColors, ...child.semanticTokenColors }
      : parent.semanticTokenColors;

    // Merge metadata
    const mergedMetadata: ThemeMetadata = {
      ...parent.metadata,
      ...child.metadata,
      name: child.metadata?.name ?? parent.metadata?.name ?? 'Unknown',
    };

    return {
      base: child.base ?? parent.base,
      inherit: child.inherit ?? parent.inherit ?? true,
      rules: mergedRules,
      colors: mergedColors,
      extends: undefined, // Resolved
      metadata: mergedMetadata,
      uiColors: mergedUIColors,
      semanticTokenColors: mergedSemanticTokenColors,
      tokenColors: child.tokenColors ?? parent.tokenColors,
    };
  }

  /**
   * Merge token rules arrays
   */
  private mergeRules(
    parentRules: ThemeTokenRule[],
    childRules: ThemeTokenRule[]
  ): ThemeTokenRule[] {
    const ruleMap = new Map<string, ThemeTokenRule>();

    // Add parent rules
    for (const rule of parentRules) {
      ruleMap.set(rule.token, { ...rule });
    }

    // Override with child rules
    for (const rule of childRules) {
      const existing = ruleMap.get(rule.token);
      if (existing) {
        // Merge individual properties
        ruleMap.set(rule.token, { ...existing, ...rule });
      } else {
        ruleMap.set(rule.token, { ...rule });
      }
    }

    return Array.from(ruleMap.values());
  }

  /**
   * Resolve inheritance chain
   */
  resolveInheritance(
    theme: ExtendedThemeDefinition,
    getTheme: (id: string) => ExtendedThemeDefinition | undefined,
    visited: Set<string> = new Set()
  ): ExtendedThemeDefinition {
    if (!theme.extends) {
      return theme;
    }

    const parentId = theme.extends;

    // Check for circular reference
    if (visited.has(parentId)) {
      console.warn(
        `[ThemePluginAdapter] Circular theme inheritance detected: ${parentId}`
      );
      return { ...theme, extends: undefined };
    }

    visited.add(parentId);

    const parent = getTheme(parentId);
    if (!parent) {
      console.warn(`[ThemePluginAdapter] Parent theme not found: ${parentId}`);
      return { ...theme, extends: undefined };
    }

    // Recursively resolve parent inheritance
    const resolvedParent = this.resolveInheritance(parent, getTheme, visited);

    // Merge child with resolved parent
    return this.mergeThemes(theme, resolvedParent);
  }

  // ========================================================================
  // VALIDATION
  // ========================================================================

  /**
   * Validate a theme definition
   */
  validate(
    theme: ExtendedThemeDefinition,
    _themeId?: string
  ): ThemeValidationResult {
    const errors: ThemeValidationError[] = [];
    const warnings: ThemeValidationWarning[] = [];

    // Required: base
    if (!theme.base) {
      errors.push({
        code: 'MISSING_BASE',
        message: 'Theme must have a base property (vs, vs-dark, or hc-black)',
        path: 'base',
      });
    } else if (!['vs', 'vs-dark', 'hc-black'].includes(theme.base)) {
      errors.push({
        code: 'INVALID_BASE',
        message: `Invalid base theme: ${theme.base}. Must be vs, vs-dark, or hc-black`,
        path: 'base',
      });
    }

    // Required: rules (can be empty array)
    if (!Array.isArray(theme.rules)) {
      errors.push({
        code: 'MISSING_RULES',
        message: 'Theme must have a rules array',
        path: 'rules',
      });
    } else {
      // Validate individual rules
      theme.rules.forEach((rule, index) => {
        if (!rule.token && rule.token !== '') {
          warnings.push({
            code: 'MISSING_TOKEN',
            message: `Rule at index ${index} is missing token property`,
            path: `rules[${index}]`,
          });
        }
      });
    }

    // Required: colors (can be empty object)
    if (!theme.colors || typeof theme.colors !== 'object') {
      errors.push({
        code: 'MISSING_COLORS',
        message: 'Theme must have a colors object',
        path: 'colors',
      });
    }

    // Warnings for recommended colors
    const recommendedColors = [
      'editor.background',
      'editor.foreground',
      'editor.selectionBackground',
      'editorLineNumber.foreground',
    ];

    for (const color of recommendedColors) {
      if (!theme.colors?.[color]) {
        warnings.push({
          code: 'MISSING_RECOMMENDED_COLOR',
          message: `Missing recommended color: ${color}`,
          path: `colors.${color}`,
          suggestion: 'Add this color for better theme consistency',
        });
      }
    }

    // Normalize the theme if valid
    let normalizedTheme: ExtendedThemeDefinition | undefined;
    if (errors.length === 0) {
      normalizedTheme = {
        ...theme,
        inherit: theme.inherit ?? true,
        rules: theme.rules ?? [],
        colors: theme.colors ?? {},
      };
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedTheme,
    };
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  /**
   * Create a minimal theme from base
   */
  createMinimalTheme(
    base: MonacoBaseTheme,
    colors: Record<string, string> = {},
    rules: ThemeTokenRule[] = []
  ): ExtendedThemeDefinition {
    return {
      base,
      inherit: true,
      rules,
      colors,
    };
  }

  /**
   * Clone a theme with modifications
   */
  cloneTheme(
    theme: ExtendedThemeDefinition,
    modifications: Partial<ExtendedThemeDefinition>
  ): ExtendedThemeDefinition {
    return {
      ...theme,
      ...modifications,
      rules: modifications.rules ?? [...theme.rules],
      colors: { ...theme.colors, ...modifications.colors },
      uiColors: modifications.uiColors
        ? { ...theme.uiColors, ...modifications.uiColors }
        : theme.uiColors,
      metadata: modifications.metadata
        ? { ...theme.metadata, ...modifications.metadata }
        : theme.metadata,
    };
  }

  /**
   * Extract semantic color from theme
   */
  getSemanticColor(
    theme: ExtendedThemeDefinition,
    semanticToken: string
  ): string | SemanticTokenStyle | undefined {
    return theme.semanticTokenColors?.[semanticToken];
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const themePluginAdapter = ThemePluginAdapter.getInstance();
