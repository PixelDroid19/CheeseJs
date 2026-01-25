/**
 * Theme System Types
 *
 * Core type definitions for the Monaco Editor theme plugin integration.
 * Supports theme inheritance, VS Code compatibility, and dynamic CSS variables.
 */

// ============================================================================
// MONACO THEME TYPES
// ============================================================================

/**
 * Base theme types supported by Monaco Editor
 */
export type MonacoBaseTheme = 'vs' | 'vs-dark' | 'hc-black';

/**
 * Theme type classification
 */
export type ThemeType = 'light' | 'dark' | 'high-contrast';

/**
 * Token styling rule for syntax highlighting
 */
export interface ThemeTokenRule {
  /** Token scope (e.g., 'comment', 'string', 'keyword') */
  token: string;
  /** Foreground color (hex without #) */
  foreground?: string;
  /** Background color (hex without #) */
  background?: string;
  /** Font style ('italic', 'bold', 'underline', or combinations) */
  fontStyle?: string;
}

/**
 * Monaco Editor theme definition
 */
export interface MonacoThemeDefinition {
  /** Base theme to inherit from */
  base: MonacoBaseTheme;
  /** Whether to inherit rules from base theme */
  inherit: boolean;
  /** Token coloring rules for syntax highlighting */
  rules: ThemeTokenRule[];
  /** Editor UI colors */
  colors: Record<string, string>;
}

// ============================================================================
// EXTENDED THEME TYPES (WITH INHERITANCE)
// ============================================================================

/**
 * Extended theme definition with inheritance support
 */
export interface ExtendedThemeDefinition extends MonacoThemeDefinition {
  /** ID of parent theme to extend (optional) */
  extends?: string;
  /** Theme metadata */
  metadata?: ThemeMetadata;
  /** UI colors for application components (beyond Monaco) */
  uiColors?: UIColorScheme;
  /** Semantic token colors (VS Code style) */
  semanticTokenColors?: Record<string, string | SemanticTokenStyle>;
  /** Token colors in TextMate format (VS Code compatibility) */
  tokenColors?: TextMateTokenColor[];
}

/**
 * Theme metadata information
 */
export interface ThemeMetadata {
  /** Theme display name */
  name: string;
  /** Theme author */
  author?: string;
  /** Theme version */
  version?: string;
  /** Theme description */
  description?: string;
  /** Theme homepage or repository */
  homepage?: string;
  /** License information */
  license?: string;
}

/**
 * Semantic token styling (VS Code format)
 */
export interface SemanticTokenStyle {
  foreground?: string;
  fontStyle?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/**
 * TextMate token color (VS Code theme format)
 */
export interface TextMateTokenColor {
  /** Human-readable name */
  name?: string;
  /** Scope selector (string or array of strings) */
  scope: string | string[];
  /** Style settings */
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

// ============================================================================
// UI COLOR SCHEME
// ============================================================================

/**
 * Complete UI color scheme for application theming
 * Maps to CSS variables for consistent styling across all components
 */
export interface UIColorScheme {
  // === Editor Core ===
  editorBackground: string;
  editorForeground: string;
  editorSelectionBackground: string;
  editorLineHighlightBackground: string;
  editorCursorForeground: string;
  editorWhitespaceForeground: string;
  editorIndentGuideBackground: string;
  editorIndentGuideActiveBackground: string;
  editorLineNumberForeground: string;
  editorLineNumberActiveForeground: string;

  // === Panel & Containers ===
  panelBackground: string;
  panelForeground: string;
  panelBorder: string;
  panelHeaderBackground: string;
  panelHeaderForeground: string;

  // === Sidebar ===
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarBorder: string;

  // === Title Bar ===
  titleBarBackground: string;
  titleBarForeground: string;
  titleBarBorder: string;
  titleBarActiveBackground: string;
  titleBarInactiveBackground: string;

  // === Inputs ===
  inputBackground: string;
  inputForeground: string;
  inputBorder: string;
  inputPlaceholderForeground: string;
  inputFocusBorder: string;

  // === Buttons ===
  buttonBackground: string;
  buttonForeground: string;
  buttonHoverBackground: string;
  buttonSecondaryBackground: string;
  buttonSecondaryForeground: string;
  buttonSecondaryHoverBackground: string;

  // === Dropdowns ===
  dropdownBackground: string;
  dropdownForeground: string;
  dropdownBorder: string;
  dropdownListBackground: string;

  // === Lists & Trees ===
  listActiveSelectionBackground: string;
  listActiveSelectionForeground: string;
  listHoverBackground: string;
  listHoverForeground: string;
  listInactiveSelectionBackground: string;
  listInactiveSelectionForeground: string;

  // === Tooltips ===
  tooltipBackground: string;
  tooltipForeground: string;
  tooltipBorder: string;

  // === Scrollbars ===
  scrollbarSliderBackground: string;
  scrollbarSliderHoverBackground: string;
  scrollbarSliderActiveBackground: string;

  // === Badges ===
  badgeBackground: string;
  badgeForeground: string;

  // === Status Colors (Semantic) ===
  errorForeground: string;
  errorBackground: string;
  warningForeground: string;
  warningBackground: string;
  successForeground: string;
  successBackground: string;
  infoForeground: string;
  infoBackground: string;

  // === Diff Editor ===
  diffInsertedBackground: string;
  diffInsertedForeground: string;
  diffRemovedBackground: string;
  diffRemovedForeground: string;
  diffModifiedBackground: string;

  // === Widgets ===
  widgetBackground: string;
  widgetForeground: string;
  widgetBorder: string;
  widgetShadow: string;

  // === Focus & Selection ===
  focusBorder: string;
  selectionBackground: string;
  selectionForeground: string;

  // === Highlights ===
  highlightBackground: string;
  findMatchBackground: string;
  findMatchHighlightBackground: string;

  // === Links ===
  linkForeground: string;
  linkActiveForeground: string;

  // === Terminal ===
  terminalBackground: string;
  terminalForeground: string;
  terminalCursor: string;
  terminalSelectionBackground: string;

  // === Console Output ===
  consoleBackground: string;
  consoleForeground: string;
  consoleErrorForeground: string;
  consoleWarningForeground: string;
  consoleInfoForeground: string;
  consoleDebugForeground: string;
}

// ============================================================================
// THEME REGISTRATION & EVENTS
// ============================================================================

/**
 * Registered theme entry in the registry
 */
export interface RegisteredTheme {
  /** Unique theme identifier */
  id: string;
  /** Display label */
  label: string;
  /** Theme type classification */
  type: ThemeType;
  /** Base Monaco theme */
  base: MonacoBaseTheme;
  /** Plugin ID that contributed this theme */
  pluginId: string;
  /** Path to theme file (for lazy loading) */
  path?: string;
  /** Full theme definition (if loaded) */
  definition?: ExtendedThemeDefinition;
  /** Whether the theme is currently loaded */
  isLoaded: boolean;
  /** Whether the theme is registered with Monaco */
  isRegisteredWithMonaco: boolean;
  /** Theme that this theme extends */
  extendsTheme?: string;
  /** Load timestamp */
  loadedAt?: number;
  /** Error if theme failed to load */
  loadError?: string;
}

/**
 * Theme change event payload
 */
export interface ThemeChangeEvent {
  /** Previous theme ID */
  previousThemeId: string | null;
  /** New theme ID */
  newThemeId: string;
  /** Theme type */
  type: ThemeType;
  /** Theme definition */
  definition: ExtendedThemeDefinition;
  /** CSS variables that were applied */
  cssVariables: Record<string, string>;
}

/**
 * Theme registration event payload
 */
export interface ThemeRegistrationEvent {
  /** Theme ID */
  themeId: string;
  /** Plugin ID */
  pluginId: string;
  /** Event type */
  eventType: 'registered' | 'unregistered' | 'updated';
}

/**
 * Theme load error event payload
 */
export interface ThemeLoadErrorEvent {
  /** Theme ID that failed to load */
  themeId: string;
  /** Error message */
  error: string;
  /** Original error */
  originalError?: Error;
  /** Fallback theme that was used */
  fallbackThemeId?: string;
}

// ============================================================================
// THEME PLUGIN API
// ============================================================================

/**
 * Theme contribution in plugin manifest
 */
export interface ThemePluginContribution {
  /** Theme identifier */
  id: string;
  /** Display label */
  label: string;
  /** Base UI theme type */
  uiTheme: MonacoBaseTheme;
  /** Path to theme JSON file (relative to plugin) */
  path: string;
  /** Theme this extends (optional) */
  extends?: string;
}

/**
 * VS Code theme package.json format (for compatibility)
 */
export interface VSCodeThemePackage {
  name: string;
  displayName?: string;
  version?: string;
  publisher?: string;
  contributes?: {
    themes?: VSCodeThemeContribution[];
  };
}

/**
 * VS Code theme contribution format
 */
export interface VSCodeThemeContribution {
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  path: string;
}

/**
 * VS Code theme file format
 */
export interface VSCodeThemeFile {
  name?: string;
  type?: 'light' | 'dark' | 'hc';
  colors?: Record<string, string>;
  tokenColors?: TextMateTokenColor[];
  semanticHighlighting?: boolean;
  semanticTokenColors?: Record<string, string | SemanticTokenStyle>;
}

// ============================================================================
// THEME MANAGER INTERFACES
// ============================================================================

/**
 * Theme loading options
 */
export interface ThemeLoadOptions {
  /** Force reload even if already loaded */
  forceReload?: boolean;
  /** Timeout for loading (ms) */
  timeout?: number;
  /** Number of retries on failure */
  retries?: number;
  /** Skip validation */
  skipValidation?: boolean;
}

/**
 * Theme application options
 */
export interface ThemeApplyOptions {
  /** Skip CSS variable application */
  skipCssVariables?: boolean;
  /** Transition duration (ms) for smooth theme change */
  transitionDuration?: number;
  /** Callback after theme is applied */
  onApplied?: () => void;
}

/**
 * Theme validation result
 */
export interface ThemeValidationResult {
  /** Whether the theme is valid */
  isValid: boolean;
  /** Validation errors */
  errors: ThemeValidationError[];
  /** Validation warnings */
  warnings: ThemeValidationWarning[];
  /** Normalized theme definition */
  normalizedTheme?: ExtendedThemeDefinition;
}

/**
 * Theme validation error
 */
export interface ThemeValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Property path that caused the error */
  path?: string;
}

/**
 * Theme validation warning
 */
export interface ThemeValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Property path */
  path?: string;
  /** Suggested fix */
  suggestion?: string;
}

// ============================================================================
// CSS VARIABLE TYPES
// ============================================================================

/**
 * CSS variable name (always starts with --)
 */
export type CSSVariableName = `--${string}`;

/**
 * CSS variable map
 */
export type CSSVariableMap = Record<CSSVariableName, string>;

/**
 * CSS variable scope
 */
export type CSSVariableScope = 'root' | 'editor' | 'panel' | 'modal';

/**
 * CSS variable application result
 */
export interface CSSVariableApplicationResult {
  /** Variables that were applied */
  applied: CSSVariableMap;
  /** Variables that failed to apply */
  failed: Array<{ name: CSSVariableName; error: string }>;
  /** Scope where variables were applied */
  scope: CSSVariableScope;
}

// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

/**
 * Theme subscription callback
 */
export type ThemeSubscriptionCallback = (event: ThemeChangeEvent) => void;

/**
 * Theme subscription options
 */
export interface ThemeSubscriptionOptions {
  /** Receive initial theme state immediately */
  immediate?: boolean;
  /** Filter by theme types */
  types?: ThemeType[];
}

/**
 * Subscription handle for cleanup
 */
export interface ThemeSubscription {
  /** Unsubscribe from theme changes */
  unsubscribe: () => void;
  /** Subscription ID */
  id: string;
}
