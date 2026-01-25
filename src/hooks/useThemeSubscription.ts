/**
 * useThemeSubscription Hook
 *
 * React hook for subscribing to theme changes from the ThemeManager.
 * Provides reactive access to theme state with automatic cleanup.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

import type {
  ThemeChangeEvent,
  ThemeType,
  RegisteredTheme,
  CSSVariableMap,
  ExtendedThemeDefinition,
} from '../lib/themes/types';

import { themeManager } from '../lib/themes/theme-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeState {
  /** Current theme ID */
  themeId: string | null;
  /** Theme type (light, dark, high-contrast) */
  type: ThemeType | null;
  /** Whether the theme is dark */
  isDark: boolean;
  /** Current theme definition */
  definition: ExtendedThemeDefinition | null;
  /** Current CSS variables */
  cssVariables: CSSVariableMap;
  /** All registered themes */
  registeredThemes: RegisteredTheme[];
  /** Whether theme manager is loading */
  isLoading: boolean;
  /** Current error (if any) */
  error: Error | null;
}

export interface ThemeActions {
  /** Apply a theme by ID */
  applyTheme: (themeId: string) => Promise<void>;
  /** Get a specific CSS variable value */
  getCssVariable: (name: string) => string | undefined;
  /** Refresh the current theme */
  refreshTheme: () => void;
  /** Get themes by type */
  getThemesByType: (type: ThemeType) => RegisteredTheme[];
}

export interface UseThemeSubscriptionOptions {
  /** Receive initial state immediately */
  immediate?: boolean;
  /** Filter by theme types */
  filterTypes?: ThemeType[];
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseThemeSubscriptionResult extends ThemeState, ThemeActions {}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Subscribe to theme changes and access theme state
 */
export function useThemeSubscription(
  options: UseThemeSubscriptionOptions = {}
): UseThemeSubscriptionResult {
  const { immediate = true, filterTypes, debug = false } = options;

  // State
  const [themeId, setThemeId] = useState<string | null>(
    themeManager.getActiveThemeId()
  );
  const [definition, setDefinition] = useState<ExtendedThemeDefinition | null>(
    themeManager.getActiveTheme()?.definition ?? null
  );
  const [cssVariables, setCssVariables] = useState<CSSVariableMap>(
    themeManager.getCssVariables()
  );
  const [isLoading, setIsLoading] = useState(themeManager.isLoading());
  const [error, setError] = useState<Error | null>(themeManager.getError());

  // Derived state
  const activeTheme = themeManager.getActiveTheme();
  const type = activeTheme?.type ?? null;
  const isDark = type === 'dark' || type === 'high-contrast';

  // Get all registered themes
  const registeredThemes = useMemo(() => {
    const all = themeManager.getAllThemes();
    if (filterTypes && filterTypes.length > 0) {
      return all.filter((t) => filterTypes.includes(t.type));
    }
    return all;
  }, [filterTypes]); // Re-compute when theme changes

  // Subscribe to theme changes
  useEffect(() => {
    const subscription = themeManager.subscribe(
      (event: ThemeChangeEvent) => {
        if (debug) {
          console.log('[useThemeSubscription] Theme changed:', event);
        }

        // Check filter
        if (filterTypes && filterTypes.length > 0) {
          if (!filterTypes.includes(event.type)) {
            return;
          }
        }

        setThemeId(event.newThemeId);
        setDefinition(event.definition);
        setCssVariables(event.cssVariables);
        setError(null);
      },
      { immediate }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [immediate, filterTypes, debug]);

  // Update loading state
  useEffect(() => {
    const checkLoading = () => {
      setIsLoading(themeManager.isLoading());
    };

    // Check periodically (could also use an event)
    const interval = setInterval(checkLoading, 100);
    return () => clearInterval(interval);
  }, []);

  // Actions
  const applyTheme = useCallback(async (newThemeId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await themeManager.applyTheme(newThemeId);
    } catch (err) {
      const themeError = err instanceof Error ? err : new Error(String(err));
      setError(themeError);
      throw themeError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCssVariable = useCallback((name: string): string | undefined => {
    const vars = themeManager.getCssVariables();
    return vars[name as keyof CSSVariableMap];
  }, []);

  const refreshTheme = useCallback(() => {
    themeManager.refreshTheme();
    setCssVariables(themeManager.getCssVariables());
  }, []);

  const getThemesByType = useCallback(
    (themeType: ThemeType): RegisteredTheme[] => {
      return themeManager.getThemesByType(themeType);
    },
    []
  );

  return {
    // State
    themeId,
    type,
    isDark,
    definition,
    cssVariables,
    registeredThemes,
    isLoading,
    error,

    // Actions
    applyTheme,
    getCssVariable,
    refreshTheme,
    getThemesByType,
  };
}

// ============================================================================
// SIMPLIFIED HOOKS
// ============================================================================

/**
 * Get just the current theme ID
 */
export function useCurrentThemeId(): string | null {
  const [themeId, setThemeId] = useState<string | null>(
    themeManager.getActiveThemeId()
  );

  useEffect(() => {
    const subscription = themeManager.subscribe((event) => {
      setThemeId(event.newThemeId);
    });

    return () => subscription.unsubscribe();
  }, []);

  return themeId;
}

/**
 * Check if current theme is dark
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(() => {
    const theme = themeManager.getActiveTheme();
    return theme?.type === 'dark' || theme?.type === 'high-contrast';
  });

  useEffect(() => {
    const subscription = themeManager.subscribe((event) => {
      setIsDark(event.type === 'dark' || event.type === 'high-contrast');
    });

    return () => subscription.unsubscribe();
  }, []);

  return isDark;
}

/**
 * Get a specific CSS variable value
 */
export function useThemeCssVariable(variableName: string): string | undefined {
  const [value, setValue] = useState<string | undefined>(() => {
    const vars = themeManager.getCssVariables();
    return vars[variableName as keyof CSSVariableMap];
  });

  useEffect(() => {
    const subscription = themeManager.subscribe((event) => {
      setValue(event.cssVariables[variableName as keyof CSSVariableMap]);
    });

    return () => subscription.unsubscribe();
  }, [variableName]);

  return value;
}

/**
 * Get all available themes for a theme picker
 */
export function useAvailableThemes(): {
  themes: RegisteredTheme[];
  currentThemeId: string | null;
  applyTheme: (themeId: string) => Promise<void>;
} {
  const [themes, setThemes] = useState<RegisteredTheme[]>(
    themeManager.getAllThemes()
  );
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(
    themeManager.getActiveThemeId()
  );

  useEffect(() => {
    const subscription = themeManager.subscribe((event) => {
      setCurrentThemeId(event.newThemeId);
      setThemes(themeManager.getAllThemes());
    });

    return () => subscription.unsubscribe();
  }, []);

  const applyTheme = useCallback(async (themeId: string) => {
    await themeManager.applyTheme(themeId);
  }, []);

  return { themes, currentThemeId, applyTheme };
}

/**
 * Get theme definition for advanced customization
 */
export function useThemeDefinition(): ExtendedThemeDefinition | null {
  const [definition, setDefinition] = useState<ExtendedThemeDefinition | null>(
    themeManager.getActiveTheme()?.definition ?? null
  );

  useEffect(() => {
    const subscription = themeManager.subscribe((event) => {
      setDefinition(event.definition);
    });

    return () => subscription.unsubscribe();
  }, []);

  return definition;
}
