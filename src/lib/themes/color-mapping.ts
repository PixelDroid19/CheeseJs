/**
 * Color Mapping
 *
 * Maps Monaco Editor colors to UI component CSS variables.
 * Provides intelligent derivation of UI colors from editor theme colors.
 */

import type { CSSVariableName, UIColorScheme } from './types';

// ============================================================================
// MONACO COLOR KEYS
// ============================================================================

/**
 * Standard Monaco Editor color keys
 */
export const MONACO_COLOR_KEYS = {
  // Editor Core
  EDITOR_BACKGROUND: 'editor.background',
  EDITOR_FOREGROUND: 'editor.foreground',
  EDITOR_SELECTION_BACKGROUND: 'editor.selectionBackground',
  EDITOR_SELECTION_FOREGROUND: 'editor.selectionForeground',
  EDITOR_LINE_HIGHLIGHT_BACKGROUND: 'editor.lineHighlightBackground',
  EDITOR_LINE_HIGHLIGHT_BORDER: 'editor.lineHighlightBorder',
  EDITOR_CURSOR_FOREGROUND: 'editorCursor.foreground',
  EDITOR_CURSOR_BACKGROUND: 'editorCursor.background',
  EDITOR_WHITESPACE_FOREGROUND: 'editorWhitespace.foreground',
  EDITOR_INDENT_GUIDE_BACKGROUND: 'editorIndentGuide.background',
  EDITOR_INDENT_GUIDE_ACTIVE_BACKGROUND: 'editorIndentGuide.activeBackground',
  EDITOR_LINE_NUMBER_FOREGROUND: 'editorLineNumber.foreground',
  EDITOR_LINE_NUMBER_ACTIVE_FOREGROUND: 'editorLineNumber.activeForeground',

  // Widget
  EDITOR_WIDGET_BACKGROUND: 'editorWidget.background',
  EDITOR_WIDGET_FOREGROUND: 'editorWidget.foreground',
  EDITOR_WIDGET_BORDER: 'editorWidget.border',

  // Hover
  EDITOR_HOVER_HIGHLIGHT_BACKGROUND: 'editorHoverWidget.background',
  EDITOR_HOVER_FOREGROUND: 'editorHoverWidget.foreground',
  EDITOR_HOVER_BORDER: 'editorHoverWidget.border',

  // Suggestions
  EDITOR_SUGGEST_WIDGET_BACKGROUND: 'editorSuggestWidget.background',
  EDITOR_SUGGEST_WIDGET_FOREGROUND: 'editorSuggestWidget.foreground',
  EDITOR_SUGGEST_WIDGET_BORDER: 'editorSuggestWidget.border',
  EDITOR_SUGGEST_WIDGET_SELECTED_BACKGROUND:
    'editorSuggestWidget.selectedBackground',
  EDITOR_SUGGEST_WIDGET_HIGHLIGHT_FOREGROUND:
    'editorSuggestWidget.highlightForeground',

  // Find/Replace
  EDITOR_FIND_MATCH_BACKGROUND: 'editor.findMatchBackground',
  EDITOR_FIND_MATCH_HIGHLIGHT_BACKGROUND: 'editor.findMatchHighlightBackground',

  // Errors & Warnings
  EDITOR_ERROR_FOREGROUND: 'editorError.foreground',
  EDITOR_ERROR_BORDER: 'editorError.border',
  EDITOR_WARNING_FOREGROUND: 'editorWarning.foreground',
  EDITOR_WARNING_BORDER: 'editorWarning.border',
  EDITOR_INFO_FOREGROUND: 'editorInfo.foreground',
  EDITOR_INFO_BORDER: 'editorInfo.border',

  // Diff
  DIFF_EDITOR_INSERTED_BACKGROUND: 'diffEditor.insertedTextBackground',
  DIFF_EDITOR_REMOVED_BACKGROUND: 'diffEditor.removedTextBackground',

  // Minimap
  MINIMAP_BACKGROUND: 'minimap.background',

  // Scrollbar
  SCROLLBAR_SLIDER_BACKGROUND: 'scrollbarSlider.background',
  SCROLLBAR_SLIDER_HOVER_BACKGROUND: 'scrollbarSlider.hoverBackground',
  SCROLLBAR_SLIDER_ACTIVE_BACKGROUND: 'scrollbarSlider.activeBackground',

  // Peek View
  PEEK_VIEW_EDITOR_BACKGROUND: 'peekViewEditor.background',
  PEEK_VIEW_RESULT_BACKGROUND: 'peekViewResult.background',
  PEEK_VIEW_TITLE_BACKGROUND: 'peekViewTitle.background',

  // Activity Bar (VS Code)
  ACTIVITY_BAR_BACKGROUND: 'activityBar.background',
  ACTIVITY_BAR_FOREGROUND: 'activityBar.foreground',

  // Sidebar (VS Code)
  SIDEBAR_BACKGROUND: 'sideBar.background',
  SIDEBAR_FOREGROUND: 'sideBar.foreground',
  SIDEBAR_BORDER: 'sideBar.border',

  // Title Bar (VS Code)
  TITLE_BAR_ACTIVE_BACKGROUND: 'titleBar.activeBackground',
  TITLE_BAR_ACTIVE_FOREGROUND: 'titleBar.activeForeground',
  TITLE_BAR_INACTIVE_BACKGROUND: 'titleBar.inactiveBackground',
  TITLE_BAR_INACTIVE_FOREGROUND: 'titleBar.inactiveForeground',

  // Panel (VS Code)
  PANEL_BACKGROUND: 'panel.background',
  PANEL_FOREGROUND: 'panel.foreground',
  PANEL_BORDER: 'panel.border',

  // Status Bar (VS Code)
  STATUS_BAR_BACKGROUND: 'statusBar.background',
  STATUS_BAR_FOREGROUND: 'statusBar.foreground',

  // Input
  INPUT_BACKGROUND: 'input.background',
  INPUT_FOREGROUND: 'input.foreground',
  INPUT_BORDER: 'input.border',
  INPUT_PLACEHOLDER_FOREGROUND: 'input.placeholderForeground',

  // Button
  BUTTON_BACKGROUND: 'button.background',
  BUTTON_FOREGROUND: 'button.foreground',
  BUTTON_HOVER_BACKGROUND: 'button.hoverBackground',
  BUTTON_SECONDARY_BACKGROUND: 'button.secondaryBackground',
  BUTTON_SECONDARY_FOREGROUND: 'button.secondaryForeground',
  BUTTON_SECONDARY_HOVER_BACKGROUND: 'button.secondaryHoverBackground',

  // Dropdown
  DROPDOWN_BACKGROUND: 'dropdown.background',
  DROPDOWN_FOREGROUND: 'dropdown.foreground',
  DROPDOWN_BORDER: 'dropdown.border',

  // List
  LIST_ACTIVE_SELECTION_BACKGROUND: 'list.activeSelectionBackground',
  LIST_ACTIVE_SELECTION_FOREGROUND: 'list.activeSelectionForeground',
  LIST_HOVER_BACKGROUND: 'list.hoverBackground',
  LIST_HOVER_FOREGROUND: 'list.hoverForeground',
  LIST_INACTIVE_SELECTION_BACKGROUND: 'list.inactiveSelectionBackground',
  LIST_INACTIVE_SELECTION_FOREGROUND: 'list.inactiveSelectionForeground',

  // Focus Border
  FOCUS_BORDER: 'focusBorder',

  // Badge
  BADGE_BACKGROUND: 'badge.background',
  BADGE_FOREGROUND: 'badge.foreground',

  // Terminal
  TERMINAL_BACKGROUND: 'terminal.background',
  TERMINAL_FOREGROUND: 'terminal.foreground',
  TERMINAL_CURSOR: 'terminalCursor.foreground',
  TERMINAL_SELECTION_BACKGROUND: 'terminal.selectionBackground',
} as const;

// ============================================================================
// CSS VARIABLE NAMES
// ============================================================================

/**
 * All CSS variable names used in the application
 */
export const CSS_VARIABLE_NAMES: Record<keyof UIColorScheme, CSSVariableName> =
  {
    // Editor Core
    editorBackground: '--theme-editor-bg',
    editorForeground: '--theme-editor-fg',
    editorSelectionBackground: '--theme-editor-selection-bg',
    editorLineHighlightBackground: '--theme-editor-line-highlight-bg',
    editorCursorForeground: '--theme-editor-cursor-fg',
    editorWhitespaceForeground: '--theme-editor-whitespace-fg',
    editorIndentGuideBackground: '--theme-editor-indent-guide-bg',
    editorIndentGuideActiveBackground: '--theme-editor-indent-guide-active-bg',
    editorLineNumberForeground: '--theme-editor-line-number-fg',
    editorLineNumberActiveForeground: '--theme-editor-line-number-active-fg',

    // Panel & Containers
    panelBackground: '--theme-panel-bg',
    panelForeground: '--theme-panel-fg',
    panelBorder: '--theme-panel-border',
    panelHeaderBackground: '--theme-panel-header-bg',
    panelHeaderForeground: '--theme-panel-header-fg',

    // Sidebar
    sidebarBackground: '--theme-sidebar-bg',
    sidebarForeground: '--theme-sidebar-fg',
    sidebarBorder: '--theme-sidebar-border',

    // Title Bar
    titleBarBackground: '--theme-titlebar-bg',
    titleBarForeground: '--theme-titlebar-fg',
    titleBarBorder: '--theme-titlebar-border',
    titleBarActiveBackground: '--theme-titlebar-active-bg',
    titleBarInactiveBackground: '--theme-titlebar-inactive-bg',

    // Inputs
    inputBackground: '--theme-input-bg',
    inputForeground: '--theme-input-fg',
    inputBorder: '--theme-input-border',
    inputPlaceholderForeground: '--theme-input-placeholder-fg',
    inputFocusBorder: '--theme-input-focus-border',

    // Buttons
    buttonBackground: '--theme-button-bg',
    buttonForeground: '--theme-button-fg',
    buttonHoverBackground: '--theme-button-hover-bg',
    buttonSecondaryBackground: '--theme-button-secondary-bg',
    buttonSecondaryForeground: '--theme-button-secondary-fg',
    buttonSecondaryHoverBackground: '--theme-button-secondary-hover-bg',

    // Dropdowns
    dropdownBackground: '--theme-dropdown-bg',
    dropdownForeground: '--theme-dropdown-fg',
    dropdownBorder: '--theme-dropdown-border',
    dropdownListBackground: '--theme-dropdown-list-bg',

    // Lists & Trees
    listActiveSelectionBackground: '--theme-list-active-selection-bg',
    listActiveSelectionForeground: '--theme-list-active-selection-fg',
    listHoverBackground: '--theme-list-hover-bg',
    listHoverForeground: '--theme-list-hover-fg',
    listInactiveSelectionBackground: '--theme-list-inactive-selection-bg',
    listInactiveSelectionForeground: '--theme-list-inactive-selection-fg',

    // Tooltips
    tooltipBackground: '--theme-tooltip-bg',
    tooltipForeground: '--theme-tooltip-fg',
    tooltipBorder: '--theme-tooltip-border',

    // Scrollbars
    scrollbarSliderBackground: '--theme-scrollbar-bg',
    scrollbarSliderHoverBackground: '--theme-scrollbar-hover-bg',
    scrollbarSliderActiveBackground: '--theme-scrollbar-active-bg',

    // Badges
    badgeBackground: '--theme-badge-bg',
    badgeForeground: '--theme-badge-fg',

    // Status Colors
    errorForeground: '--theme-error-fg',
    errorBackground: '--theme-error-bg',
    warningForeground: '--theme-warning-fg',
    warningBackground: '--theme-warning-bg',
    successForeground: '--theme-success-fg',
    successBackground: '--theme-success-bg',
    infoForeground: '--theme-info-fg',
    infoBackground: '--theme-info-bg',

    // Diff Editor
    diffInsertedBackground: '--theme-diff-inserted-bg',
    diffInsertedForeground: '--theme-diff-inserted-fg',
    diffRemovedBackground: '--theme-diff-removed-bg',
    diffRemovedForeground: '--theme-diff-removed-fg',
    diffModifiedBackground: '--theme-diff-modified-bg',

    // Widgets
    widgetBackground: '--theme-widget-bg',
    widgetForeground: '--theme-widget-fg',
    widgetBorder: '--theme-widget-border',
    widgetShadow: '--theme-widget-shadow',

    // Focus & Selection
    focusBorder: '--theme-focus-border',
    selectionBackground: '--theme-selection-bg',
    selectionForeground: '--theme-selection-fg',

    // Highlights
    highlightBackground: '--theme-highlight-bg',
    findMatchBackground: '--theme-find-match-bg',
    findMatchHighlightBackground: '--theme-find-match-highlight-bg',

    // Links
    linkForeground: '--theme-link-fg',
    linkActiveForeground: '--theme-link-active-fg',

    // Terminal
    terminalBackground: '--theme-terminal-bg',
    terminalForeground: '--theme-terminal-fg',
    terminalCursor: '--theme-terminal-cursor',
    terminalSelectionBackground: '--theme-terminal-selection-bg',

    // Console Output
    consoleBackground: '--theme-console-bg',
    consoleForeground: '--theme-console-fg',
    consoleErrorForeground: '--theme-console-error-fg',
    consoleWarningForeground: '--theme-console-warning-fg',
    consoleInfoForeground: '--theme-console-info-fg',
    consoleDebugForeground: '--theme-console-debug-fg',
  };

// ============================================================================
// MONACO TO UI MAPPING
// ============================================================================

/**
 * Maps Monaco color keys to UIColorScheme properties
 */
export const MONACO_TO_UI_MAPPING: Record<string, keyof UIColorScheme> = {
  // Editor Core
  [MONACO_COLOR_KEYS.EDITOR_BACKGROUND]: 'editorBackground',
  [MONACO_COLOR_KEYS.EDITOR_FOREGROUND]: 'editorForeground',
  [MONACO_COLOR_KEYS.EDITOR_SELECTION_BACKGROUND]: 'editorSelectionBackground',
  [MONACO_COLOR_KEYS.EDITOR_LINE_HIGHLIGHT_BACKGROUND]:
    'editorLineHighlightBackground',
  [MONACO_COLOR_KEYS.EDITOR_CURSOR_FOREGROUND]: 'editorCursorForeground',
  [MONACO_COLOR_KEYS.EDITOR_WHITESPACE_FOREGROUND]:
    'editorWhitespaceForeground',
  [MONACO_COLOR_KEYS.EDITOR_INDENT_GUIDE_BACKGROUND]:
    'editorIndentGuideBackground',
  [MONACO_COLOR_KEYS.EDITOR_INDENT_GUIDE_ACTIVE_BACKGROUND]:
    'editorIndentGuideActiveBackground',
  [MONACO_COLOR_KEYS.EDITOR_LINE_NUMBER_FOREGROUND]:
    'editorLineNumberForeground',
  [MONACO_COLOR_KEYS.EDITOR_LINE_NUMBER_ACTIVE_FOREGROUND]:
    'editorLineNumberActiveForeground',

  // Panel
  [MONACO_COLOR_KEYS.PANEL_BACKGROUND]: 'panelBackground',
  [MONACO_COLOR_KEYS.PANEL_FOREGROUND]: 'panelForeground',
  [MONACO_COLOR_KEYS.PANEL_BORDER]: 'panelBorder',

  // Sidebar
  [MONACO_COLOR_KEYS.SIDEBAR_BACKGROUND]: 'sidebarBackground',
  [MONACO_COLOR_KEYS.SIDEBAR_FOREGROUND]: 'sidebarForeground',
  [MONACO_COLOR_KEYS.SIDEBAR_BORDER]: 'sidebarBorder',

  // Title Bar
  [MONACO_COLOR_KEYS.TITLE_BAR_ACTIVE_BACKGROUND]: 'titleBarActiveBackground',
  [MONACO_COLOR_KEYS.TITLE_BAR_ACTIVE_FOREGROUND]: 'titleBarForeground',
  [MONACO_COLOR_KEYS.TITLE_BAR_INACTIVE_BACKGROUND]:
    'titleBarInactiveBackground',

  // Input
  [MONACO_COLOR_KEYS.INPUT_BACKGROUND]: 'inputBackground',
  [MONACO_COLOR_KEYS.INPUT_FOREGROUND]: 'inputForeground',
  [MONACO_COLOR_KEYS.INPUT_BORDER]: 'inputBorder',
  [MONACO_COLOR_KEYS.INPUT_PLACEHOLDER_FOREGROUND]:
    'inputPlaceholderForeground',

  // Button
  [MONACO_COLOR_KEYS.BUTTON_BACKGROUND]: 'buttonBackground',
  [MONACO_COLOR_KEYS.BUTTON_FOREGROUND]: 'buttonForeground',
  [MONACO_COLOR_KEYS.BUTTON_HOVER_BACKGROUND]: 'buttonHoverBackground',
  [MONACO_COLOR_KEYS.BUTTON_SECONDARY_BACKGROUND]: 'buttonSecondaryBackground',
  [MONACO_COLOR_KEYS.BUTTON_SECONDARY_FOREGROUND]: 'buttonSecondaryForeground',
  [MONACO_COLOR_KEYS.BUTTON_SECONDARY_HOVER_BACKGROUND]:
    'buttonSecondaryHoverBackground',

  // Dropdown
  [MONACO_COLOR_KEYS.DROPDOWN_BACKGROUND]: 'dropdownBackground',
  [MONACO_COLOR_KEYS.DROPDOWN_FOREGROUND]: 'dropdownForeground',
  [MONACO_COLOR_KEYS.DROPDOWN_BORDER]: 'dropdownBorder',

  // List
  [MONACO_COLOR_KEYS.LIST_ACTIVE_SELECTION_BACKGROUND]:
    'listActiveSelectionBackground',
  [MONACO_COLOR_KEYS.LIST_ACTIVE_SELECTION_FOREGROUND]:
    'listActiveSelectionForeground',
  [MONACO_COLOR_KEYS.LIST_HOVER_BACKGROUND]: 'listHoverBackground',
  [MONACO_COLOR_KEYS.LIST_HOVER_FOREGROUND]: 'listHoverForeground',
  [MONACO_COLOR_KEYS.LIST_INACTIVE_SELECTION_BACKGROUND]:
    'listInactiveSelectionBackground',
  [MONACO_COLOR_KEYS.LIST_INACTIVE_SELECTION_FOREGROUND]:
    'listInactiveSelectionForeground',

  // Scrollbar
  [MONACO_COLOR_KEYS.SCROLLBAR_SLIDER_BACKGROUND]: 'scrollbarSliderBackground',
  [MONACO_COLOR_KEYS.SCROLLBAR_SLIDER_HOVER_BACKGROUND]:
    'scrollbarSliderHoverBackground',
  [MONACO_COLOR_KEYS.SCROLLBAR_SLIDER_ACTIVE_BACKGROUND]:
    'scrollbarSliderActiveBackground',

  // Widget
  [MONACO_COLOR_KEYS.EDITOR_WIDGET_BACKGROUND]: 'widgetBackground',
  [MONACO_COLOR_KEYS.EDITOR_WIDGET_FOREGROUND]: 'widgetForeground',
  [MONACO_COLOR_KEYS.EDITOR_WIDGET_BORDER]: 'widgetBorder',

  // Tooltip (from hover widget)
  [MONACO_COLOR_KEYS.EDITOR_HOVER_HIGHLIGHT_BACKGROUND]: 'tooltipBackground',
  [MONACO_COLOR_KEYS.EDITOR_HOVER_FOREGROUND]: 'tooltipForeground',
  [MONACO_COLOR_KEYS.EDITOR_HOVER_BORDER]: 'tooltipBorder',

  // Badge
  [MONACO_COLOR_KEYS.BADGE_BACKGROUND]: 'badgeBackground',
  [MONACO_COLOR_KEYS.BADGE_FOREGROUND]: 'badgeForeground',

  // Focus
  [MONACO_COLOR_KEYS.FOCUS_BORDER]: 'focusBorder',

  // Find
  [MONACO_COLOR_KEYS.EDITOR_FIND_MATCH_BACKGROUND]: 'findMatchBackground',
  [MONACO_COLOR_KEYS.EDITOR_FIND_MATCH_HIGHLIGHT_BACKGROUND]:
    'findMatchHighlightBackground',

  // Errors & Warnings
  [MONACO_COLOR_KEYS.EDITOR_ERROR_FOREGROUND]: 'errorForeground',
  [MONACO_COLOR_KEYS.EDITOR_WARNING_FOREGROUND]: 'warningForeground',
  [MONACO_COLOR_KEYS.EDITOR_INFO_FOREGROUND]: 'infoForeground',

  // Diff
  [MONACO_COLOR_KEYS.DIFF_EDITOR_INSERTED_BACKGROUND]: 'diffInsertedBackground',
  [MONACO_COLOR_KEYS.DIFF_EDITOR_REMOVED_BACKGROUND]: 'diffRemovedBackground',

  // Terminal
  [MONACO_COLOR_KEYS.TERMINAL_BACKGROUND]: 'terminalBackground',
  [MONACO_COLOR_KEYS.TERMINAL_FOREGROUND]: 'terminalForeground',
  [MONACO_COLOR_KEYS.TERMINAL_CURSOR]: 'terminalCursor',
  [MONACO_COLOR_KEYS.TERMINAL_SELECTION_BACKGROUND]:
    'terminalSelectionBackground',
};

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Normalize a color to hex format with #
 */
export function normalizeColor(color: string | undefined): string | undefined {
  if (!color) return undefined;

  // Already has #
  if (color.startsWith('#')) {
    return color.toLowerCase();
  }

  // RGB/RGBA format
  const rgbMatch = color.match(
    /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/
  );
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    const a = rgbMatch[4]
      ? Math.round(parseFloat(rgbMatch[4]) * 255)
          .toString(16)
          .padStart(2, '0')
      : '';
    return `#${r}${g}${b}${a}`.toLowerCase();
  }

  // Assume it's hex without #
  if (/^[0-9a-fA-F]{3,8}$/.test(color)) {
    return `#${color.toLowerCase()}`;
  }

  // Return as-is for CSS color names
  return color.toLowerCase();
}

/**
 * Check if a color is dark
 */
export function isColorDark(color: string): boolean {
  const normalized = normalizeColor(color);
  if (!normalized || !normalized.startsWith('#')) return true;

  // Extract RGB values
  let r: number, g: number, b: number;
  const hex = normalized.slice(1);

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

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(color: string, percent: number): string {
  const normalized = normalizeColor(color);
  if (!normalized || !normalized.startsWith('#')) return color;

  const hex = normalized.slice(1);
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
    return color;
  }

  r = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(color: string, percent: number): string {
  const normalized = normalizeColor(color);
  if (!normalized || !normalized.startsWith('#')) return color;

  const hex = normalized.slice(1);
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
    return color;
  }

  r = Math.max(0, Math.round(r * (1 - percent / 100)));
  g = Math.max(0, Math.round(g * (1 - percent / 100)));
  b = Math.max(0, Math.round(b * (1 - percent / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Add alpha to a color
 */
export function withAlpha(color: string, alpha: number): string {
  const normalized = normalizeColor(color);
  if (!normalized || !normalized.startsWith('#')) return color;

  // Remove existing alpha if present
  const hex = normalized.slice(1, 7);
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');

  return `#${hex}${alphaHex}`;
}

/**
 * Get contrast color (black or white) for a background
 */
export function getContrastColor(backgroundColor: string): string {
  return isColorDark(backgroundColor) ? '#ffffff' : '#000000';
}

// ============================================================================
// DEFAULT COLORS
// ============================================================================

/**
 * Default dark theme UI colors
 */
export const DEFAULT_DARK_UI_COLORS: UIColorScheme = {
  // Editor Core
  editorBackground: '#1e1e1e',
  editorForeground: '#d4d4d4',
  editorSelectionBackground: '#264f78',
  editorLineHighlightBackground: '#2a2d2e',
  editorCursorForeground: '#aeafad',
  editorWhitespaceForeground: '#3b3b3b',
  editorIndentGuideBackground: '#404040',
  editorIndentGuideActiveBackground: '#707070',
  editorLineNumberForeground: '#858585',
  editorLineNumberActiveForeground: '#c6c6c6',

  // Panel
  panelBackground: '#1e1e1e',
  panelForeground: '#cccccc',
  panelBorder: '#454545',
  panelHeaderBackground: '#252526',
  panelHeaderForeground: '#cccccc',

  // Sidebar
  sidebarBackground: '#252526',
  sidebarForeground: '#cccccc',
  sidebarBorder: '#454545',

  // Title Bar
  titleBarBackground: '#323233',
  titleBarForeground: '#cccccc',
  titleBarBorder: '#454545',
  titleBarActiveBackground: '#323233',
  titleBarInactiveBackground: '#2d2d2d',

  // Input
  inputBackground: '#3c3c3c',
  inputForeground: '#cccccc',
  inputBorder: '#3c3c3c',
  inputPlaceholderForeground: '#a6a6a6',
  inputFocusBorder: '#007fd4',

  // Button
  buttonBackground: '#0e639c',
  buttonForeground: '#ffffff',
  buttonHoverBackground: '#1177bb',
  buttonSecondaryBackground: '#3a3d41',
  buttonSecondaryForeground: '#ffffff',
  buttonSecondaryHoverBackground: '#45494e',

  // Dropdown
  dropdownBackground: '#3c3c3c',
  dropdownForeground: '#f0f0f0',
  dropdownBorder: '#3c3c3c',
  dropdownListBackground: '#252526',

  // List
  listActiveSelectionBackground: '#094771',
  listActiveSelectionForeground: '#ffffff',
  listHoverBackground: '#2a2d2e',
  listHoverForeground: '#ffffff',
  listInactiveSelectionBackground: '#37373d',
  listInactiveSelectionForeground: '#ffffff',

  // Tooltip
  tooltipBackground: '#252526',
  tooltipForeground: '#cccccc',
  tooltipBorder: '#454545',

  // Scrollbar
  scrollbarSliderBackground: '#79797966',
  scrollbarSliderHoverBackground: '#646464b3',
  scrollbarSliderActiveBackground: '#bfbfbf66',

  // Badge
  badgeBackground: '#4d4d4d',
  badgeForeground: '#ffffff',

  // Status Colors
  errorForeground: '#f48771',
  errorBackground: '#5a1d1d',
  warningForeground: '#cca700',
  warningBackground: '#4d3800',
  successForeground: '#89d185',
  successBackground: '#1d4d1d',
  infoForeground: '#75beff',
  infoBackground: '#063b49',

  // Diff
  diffInsertedBackground: '#9bb95533',
  diffInsertedForeground: '#89d185',
  diffRemovedBackground: '#ff000033',
  diffRemovedForeground: '#f48771',
  diffModifiedBackground: '#007acc33',

  // Widget
  widgetBackground: '#252526',
  widgetForeground: '#cccccc',
  widgetBorder: '#454545',
  widgetShadow: '#00000080',

  // Focus
  focusBorder: '#007fd4',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',

  // Highlight
  highlightBackground: '#ffd33d44',
  findMatchBackground: '#515c6a',
  findMatchHighlightBackground: '#ea5c0055',

  // Links
  linkForeground: '#3794ff',
  linkActiveForeground: '#3794ff',

  // Terminal
  terminalBackground: '#1e1e1e',
  terminalForeground: '#cccccc',
  terminalCursor: '#ffffff',
  terminalSelectionBackground: '#ffffff40',

  // Console
  consoleBackground: '#1e1e1e',
  consoleForeground: '#cccccc',
  consoleErrorForeground: '#f48771',
  consoleWarningForeground: '#cca700',
  consoleInfoForeground: '#75beff',
  consoleDebugForeground: '#b5cea8',
};

/**
 * Default light theme UI colors
 */
export const DEFAULT_LIGHT_UI_COLORS: UIColorScheme = {
  // Editor Core
  editorBackground: '#ffffff',
  editorForeground: '#000000',
  editorSelectionBackground: '#add6ff',
  editorLineHighlightBackground: '#f7f7f7',
  editorCursorForeground: '#000000',
  editorWhitespaceForeground: '#d3d3d3',
  editorIndentGuideBackground: '#d3d3d3',
  editorIndentGuideActiveBackground: '#939393',
  editorLineNumberForeground: '#2b91af',
  editorLineNumberActiveForeground: '#000000',

  // Panel
  panelBackground: '#f3f3f3',
  panelForeground: '#616161',
  panelBorder: '#e5e5e5',
  panelHeaderBackground: '#e8e8e8',
  panelHeaderForeground: '#616161',

  // Sidebar
  sidebarBackground: '#f3f3f3',
  sidebarForeground: '#616161',
  sidebarBorder: '#e5e5e5',

  // Title Bar
  titleBarBackground: '#dddddd',
  titleBarForeground: '#333333',
  titleBarBorder: '#cccccc',
  titleBarActiveBackground: '#dddddd',
  titleBarInactiveBackground: '#e8e8e8',

  // Input
  inputBackground: '#ffffff',
  inputForeground: '#616161',
  inputBorder: '#cecece',
  inputPlaceholderForeground: '#a0a0a0',
  inputFocusBorder: '#0090f1',

  // Button
  buttonBackground: '#007acc',
  buttonForeground: '#ffffff',
  buttonHoverBackground: '#0062a3',
  buttonSecondaryBackground: '#dcdcdc',
  buttonSecondaryForeground: '#333333',
  buttonSecondaryHoverBackground: '#c4c4c4',

  // Dropdown
  dropdownBackground: '#ffffff',
  dropdownForeground: '#616161',
  dropdownBorder: '#cecece',
  dropdownListBackground: '#ffffff',

  // List
  listActiveSelectionBackground: '#0060c0',
  listActiveSelectionForeground: '#ffffff',
  listHoverBackground: '#e8e8e8',
  listHoverForeground: '#000000',
  listInactiveSelectionBackground: '#e4e6f1',
  listInactiveSelectionForeground: '#000000',

  // Tooltip
  tooltipBackground: '#f3f3f3',
  tooltipForeground: '#616161',
  tooltipBorder: '#c8c8c8',

  // Scrollbar
  scrollbarSliderBackground: '#64646466',
  scrollbarSliderHoverBackground: '#646464b3',
  scrollbarSliderActiveBackground: '#00000099',

  // Badge
  badgeBackground: '#c4c4c4',
  badgeForeground: '#333333',

  // Status Colors
  errorForeground: '#e51400',
  errorBackground: '#f8d7da',
  warningForeground: '#bf8803',
  warningBackground: '#fff3cd',
  successForeground: '#388a34',
  successBackground: '#d4edda',
  infoForeground: '#1a85ff',
  infoBackground: '#cce5ff',

  // Diff
  diffInsertedBackground: '#9ccc2c33',
  diffInsertedForeground: '#388a34',
  diffRemovedBackground: '#ff000033',
  diffRemovedForeground: '#e51400',
  diffModifiedBackground: '#007acc33',

  // Widget
  widgetBackground: '#f3f3f3',
  widgetForeground: '#616161',
  widgetBorder: '#c8c8c8',
  widgetShadow: '#00000029',

  // Focus
  focusBorder: '#0090f1',
  selectionBackground: '#add6ff',
  selectionForeground: '#000000',

  // Highlight
  highlightBackground: '#ffff0033',
  findMatchBackground: '#a8ac94',
  findMatchHighlightBackground: '#ea5c0055',

  // Links
  linkForeground: '#006ab1',
  linkActiveForeground: '#006ab1',

  // Terminal
  terminalBackground: '#ffffff',
  terminalForeground: '#000000',
  terminalCursor: '#000000',
  terminalSelectionBackground: '#00000040',

  // Console
  consoleBackground: '#ffffff',
  consoleForeground: '#000000',
  consoleErrorForeground: '#e51400',
  consoleWarningForeground: '#bf8803',
  consoleInfoForeground: '#1a85ff',
  consoleDebugForeground: '#388a34',
};
