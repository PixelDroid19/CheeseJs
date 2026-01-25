/**
 * Theme System - Public API
 *
 * Central export point for the Monaco Editor theme plugin integration.
 * Provides a unified API for theme management, registration, and subscription.
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Core Monaco types
  MonacoBaseTheme,
  ThemeType,
  ThemeTokenRule,
  MonacoThemeDefinition,

  // Extended theme types
  ExtendedThemeDefinition,
  ThemeMetadata,
  SemanticTokenStyle,
  TextMateTokenColor,
  UIColorScheme,

  // Registration types
  RegisteredTheme,
  ThemePluginContribution,

  // Event types
  ThemeChangeEvent,
  ThemeRegistrationEvent,
  ThemeLoadErrorEvent,

  // Options types
  ThemeLoadOptions,
  ThemeApplyOptions,
  ThemeValidationResult,
  ThemeValidationError as ThemeValidationErrorType,
  ThemeValidationWarning,

  // CSS variable types
  CSSVariableName,
  CSSVariableMap,
  CSSVariableScope,
  CSSVariableApplicationResult,

  // Subscription types
  ThemeSubscription,
  ThemeSubscriptionCallback,
  ThemeSubscriptionOptions,

  // VS Code compatibility types
  VSCodeThemePackage,
  VSCodeThemeContribution,
  VSCodeThemeFile,
} from './types';

// ============================================================================
// THEME MANAGER
// ============================================================================

export {
  ThemeManager,
  themeManager,
  type ThemeManagerOptions,
  type ThemeManagerState,
} from './theme-manager';

// ============================================================================
// THEME VARIABLE MANAGER
// ============================================================================

export {
  ThemeVariableManager,
  themeVariableManager,
  type ThemeVariableManagerOptions,
  type ApplyOptions as ThemeVariableApplyOptions,
} from './theme-variable-manager';

// ============================================================================
// THEME PLUGIN ADAPTER
// ============================================================================

export {
  ThemePluginAdapter,
  themePluginAdapter,
  type ThemeFormat,
  type ConversionOptions,
} from './theme-plugin-adapter';

// ============================================================================
// MONACO THEME WRAPPER
// ============================================================================

export {
  MonacoThemeWrapper,
  monacoThemeWrapper,
  type MonacoInstance,
  type RegisterThemeOptions,
  type ApplyThemeOptions as MonacoApplyThemeOptions,
} from './monaco-theme-wrapper';

// ============================================================================
// COLOR MAPPING
// ============================================================================

export {
  // Color key constants
  MONACO_COLOR_KEYS,
  CSS_VARIABLE_NAMES,
  MONACO_TO_UI_MAPPING,

  // Default color schemes
  DEFAULT_DARK_UI_COLORS,
  DEFAULT_LIGHT_UI_COLORS,

  // Color utilities
  normalizeColor,
  isColorDark,
  lightenColor,
  darkenColor,
  withAlpha,
  getContrastColor,
} from './color-mapping';

// ============================================================================
// ERRORS
// ============================================================================

export {
  ThemeError,
  ThemeLoadError,
  ThemeValidationError,
  ThemeNotFoundError,
  ThemeApplicationError,
  ThemeInheritanceError,
  MonacoNotAvailableError,
  CSSVariableError,
  ThemeConversionError,
  isThemeError,
  getThemeErrorMessage,
  getThemeErrorCode,
  wrapAsThemeError,
} from './theme-errors';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

// Re-export the singleton instance as the default for simple usage
export { themeManager as default } from './theme-manager';
