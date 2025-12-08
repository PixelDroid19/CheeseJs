/**
 * useTheme Hook
 *
 * Centralized theme management hook.
 * Provides access to current theme, dark mode detection, and theme data.
 */

import { useMemo } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { themesConfig, themes } from '../themes';

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

/**
 * Hook for accessing theme information
 * @returns Theme info object with computed values
 */
export function useTheme(): ThemeInfo {
    const themeName = useSettingsStore((state) => state.themeName);

    return useMemo(() => {
        const themeConfig = themesConfig[themeName];
        const themeData = themes[themeName];
        const isDark = themeConfig?.type === 'dark';

        // Determine data-theme attribute value
        // Only set for themes that have specific CSS overrides
        let dataTheme: string | null = null;
        if (['onedark', 'midnight'].includes(themeName)) {
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

/**
 * Get theme info synchronously (for use outside React)
 */
export function getThemeInfo(): ThemeInfo {
    const themeName = useSettingsStore.getState().themeName;
    const themeConfig = themesConfig[themeName];
    const themeData = themes[themeName];
    const isDark = themeConfig?.type === 'dark';

    let dataTheme: string | null = null;
    if (['onedark', 'midnight'].includes(themeName)) {
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
