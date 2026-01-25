/**
 * useTheme Hook
 *
 * Centralized theme management hook.
 * Provides access to current theme, dark mode detection, and theme data.
 * Integrates with both the legacy theme system and the new ThemeManager.
 */

import { useMemo, useEffect, useCallback, useState } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { themesConfig, themes } from '../themes';
import { themeManager } from '../lib/themes/theme-manager';
import type {
  ExtendedThemeDefinition,
  CSSVariableMap,
  RegisteredTheme,
} from '../lib/themes/types';

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeInfo {
  /** Current theme name */
  themeName: string;
  /** Whether the current theme is a dark theme */
  isDark: boolean;
  /** Full theme data for Monaco */
  themeData: unknown;
  /** CSS class to apply ('dark' or '') */
  cssClass: string;
  /** Data theme attribute value */
  dataTheme: string | null;
}

export interface ExtendedThemeInfo extends ThemeInfo {
  /** Theme definition from ThemeManager */
  definition: ExtendedThemeDefinition | null;
  /** Current CSS variables */
  cssVariables: CSSVariableMap;
  /** All available themes */
  availableThemes: RegisteredTheme[];
  /** Whether theme is loading */
  isLoading: boolean;
  /** Apply a new theme */
  setTheme: (themeId: string) => Promise<void>;
  /** Refresh theme CSS variables */
  refreshTheme: () => void;
}

// ============================================================================
// LEGACY HOOK (backward compatible)
// ============================================================================

/**
 * Hook for accessing theme information (legacy API)
 * @returns Theme info object with computed values
 */
export function useTheme(): ThemeInfo {
  const themeName = useSettingsStore((state) => state.themeName);

  return useMemo(() => {
    // First check if theme is in ThemeManager
    const managedTheme = themeManager.getTheme(themeName);

    if (managedTheme?.definition) {
      const isDark =
        managedTheme.type === 'dark' || managedTheme.type === 'high-contrast';
      return {
        themeName,
        isDark,
        themeData: managedTheme.definition,
        cssClass: isDark ? 'dark' : '',
        dataTheme: themeName,
      };
    }

    // Fall back to legacy theme config
    const themeConfig = themesConfig[themeName];
    const themeData = themes[themeName];
    const isDark = themeConfig?.type === 'dark';

    // Determine data-theme attribute value
    let dataTheme: string | null = null;
    if (themeName) {
      dataTheme = themeName;
    }

    return {
      themeName,
      isDark,
      themeData,
      cssClass: isDark ? 'dark' : '',
      dataTheme,
    };
  }, [themeName]);
}

// ============================================================================
// EXTENDED HOOK (new API with ThemeManager integration)
// ============================================================================

/**
 * Extended hook for full theme management with ThemeManager integration
 * @returns Extended theme info with actions
 */
export function useThemeExtended(): ExtendedThemeInfo {
  const themeName = useSettingsStore((state) => state.themeName);
  const setThemeName = useSettingsStore((state) => state.setThemeName);

  const [isLoading, setIsLoading] = useState(false);
  const [cssVariables, setCssVariables] = useState<CSSVariableMap>(
    themeManager.getCssVariables()
  );
  const [availableThemes, setAvailableThemes] = useState<RegisteredTheme[]>(
    themeManager.getAllThemes()
  );

  // Subscribe to theme changes
  useEffect(() => {
    const subscription = themeManager.subscribe(
      (event) => {
        setCssVariables(event.cssVariables);
        setAvailableThemes(themeManager.getAllThemes());
      },
      { immediate: true }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Get basic theme info
  const basicInfo = useTheme();

  // Get theme definition
  const definition = useMemo(() => {
    const theme = themeManager.getTheme(themeName);
    return theme?.definition ?? null;
  }, [themeName]);

  // Set theme action
  const setTheme = useCallback(
    async (themeId: string) => {
      try {
        setIsLoading(true);

        // Update settings store
        setThemeName(themeId);

        // If theme is in ThemeManager, apply it
        if (themeManager.isThemeRegistered(themeId)) {
          await themeManager.applyTheme(themeId);
        }
      } catch (error) {
        console.error('[useThemeExtended] Failed to set theme:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [setThemeName]
  );

  // Refresh theme
  const refreshTheme = useCallback(() => {
    themeManager.refreshTheme();
    setCssVariables(themeManager.getCssVariables());
  }, []);

  return {
    ...basicInfo,
    definition,
    cssVariables,
    availableThemes,
    isLoading,
    setTheme,
    refreshTheme,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get theme info synchronously (for use outside React)
 */
export function getThemeInfo(): ThemeInfo {
  const themeName = useSettingsStore.getState().themeName;

  // Check ThemeManager first
  const managedTheme = themeManager.getTheme(themeName);
  if (managedTheme?.definition) {
    const isDark =
      managedTheme.type === 'dark' || managedTheme.type === 'high-contrast';
    return {
      themeName,
      isDark,
      themeData: managedTheme.definition,
      cssClass: isDark ? 'dark' : '',
      dataTheme: themeName,
    };
  }

  // Fall back to legacy
  const themeConfig = themesConfig[themeName];
  const themeData = themes[themeName];
  const isDark = themeConfig?.type === 'dark';

  let dataTheme: string | null = null;
  if (themeName) {
    dataTheme = themeName;
  }

  return {
    themeName,
    isDark,
    themeData,
    cssClass: isDark ? 'dark' : '',
    dataTheme,
  };
}

/**
 * Get current theme's CSS variable value
 */
export function getThemeCssVariable(variableName: string): string | undefined {
  const cssVars = themeManager.getCssVariables();
  return cssVars[variableName as keyof CSSVariableMap];
}

/**
 * Check if current theme is dark
 */
export function isCurrentThemeDark(): boolean {
  const { isDark } = getThemeInfo();
  return isDark;
}

/**
 * Get all available themes
 */
export function getAllThemes(): RegisteredTheme[] {
  return themeManager.getAllThemes();
}

/**
 * Get themes by type
 */
export function getThemesByType(
  type: 'light' | 'dark' | 'high-contrast'
): RegisteredTheme[] {
  return themeManager.getThemesByType(type);
}
