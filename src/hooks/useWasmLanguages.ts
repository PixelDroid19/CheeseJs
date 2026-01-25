/**
 * useWasmLanguages Hook
 *
 * React hook for managing WASM language modules in the frontend.
 * Provides reactive access to available WebAssembly languages and their status.
 * Automatically syncs with the language detection registry.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  registerWasmLanguage,
  unregisterWasmLanguage,
  getWasmLanguages,
} from '../lib/languageDetection';

// ============================================================================
// TYPES
// ============================================================================

export interface WasmLanguage {
  id: string;
  name: string;
  version: string;
  extensions: string[];
  status: 'loading' | 'ready' | 'error';
  error?: string;
}

interface UseWasmLanguagesReturn {
  /** List of available WASM languages */
  languages: WasmLanguage[];
  /** Whether languages are being loaded */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refresh the language list */
  refresh: () => Promise<void>;
  /** Check if a specific language is ready */
  isLanguageReady: (languageId: string) => boolean;
  /** Get a language by ID */
  getLanguage: (languageId: string) => WasmLanguage | undefined;
  /** Get Monaco configuration for a language */
  getMonacoConfig: (
    languageId: string
  ) => Promise<Record<string, unknown> | null>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useWasmLanguages(): UseWasmLanguagesReturn {
  const [languages, setLanguages] = useState<WasmLanguage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch languages from main process
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!window.wasmLanguages) {
        // WASM languages API not available (likely running in browser dev mode)
        setLanguages([]);
        return;
      }

      const result = await window.wasmLanguages.getAll();
      if (result.success) {
        setLanguages(result.languages);

        // Sync with language detection registry
        for (const lang of result.languages) {
          if (lang.status === 'ready') {
            registerWasmLanguage({
              id: lang.id,
              name: lang.name,
              extensions: lang.extensions,
            });
          }
        }
      } else {
        setError('Failed to fetch WASM languages');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load and subscribe to changes
  useEffect(() => {
    refresh();

    // Subscribe to changes from main process
    if (window.wasmLanguages?.onChanged) {
      const unsubscribe = window.wasmLanguages.onChanged((newLanguages) => {
        setLanguages(newLanguages);

        // Sync with language detection registry
        // First, get currently registered WASM languages
        const currentWasmLangs = getWasmLanguages();
        const newLangIds = new Set(newLanguages.map((l) => l.id));

        // Unregister languages that are no longer available
        for (const lang of currentWasmLangs) {
          if (!newLangIds.has(lang.id)) {
            unregisterWasmLanguage(lang.id);
          }
        }

        // Register new languages
        for (const lang of newLanguages) {
          if (lang.status === 'ready') {
            registerWasmLanguage({
              id: lang.id,
              name: lang.name,
              extensions: lang.extensions,
            });
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [refresh]);

  // Check if a language is ready
  const isLanguageReady = useCallback(
    (languageId: string): boolean => {
      const lang = languages.find((l) => l.id === languageId);
      return lang?.status === 'ready';
    },
    [languages]
  );

  // Get language by ID
  const getLanguage = useCallback(
    (languageId: string): WasmLanguage | undefined => {
      return languages.find((l) => l.id === languageId);
    },
    [languages]
  );

  // Get Monaco configuration for a language
  const getMonacoConfig = useCallback(
    async (languageId: string): Promise<Record<string, unknown> | null> => {
      if (!window.wasmLanguages?.getMonacoConfig) {
        return null;
      }

      try {
        const result = await window.wasmLanguages.getMonacoConfig(languageId);
        if (result.success && result.config) {
          return result.config;
        }
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  return {
    languages,
    isLoading,
    error,
    refresh,
    isLanguageReady,
    getLanguage,
    getMonacoConfig,
  };
}

// ============================================================================
// STANDALONE FUNCTIONS (for use outside React)
// ============================================================================

/**
 * Check if a WASM language is available (standalone function)
 */
export async function isWasmLanguageAvailable(
  languageId: string
): Promise<boolean> {
  if (!window.wasmLanguages) {
    return false;
  }

  try {
    const result = await window.wasmLanguages.getAll();
    if (result.success) {
      return result.languages.some(
        (l) => l.id === languageId && l.status === 'ready'
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get all ready WASM languages (standalone function)
 */
export async function getReadyWasmLanguages(): Promise<WasmLanguage[]> {
  if (!window.wasmLanguages) {
    return [];
  }

  try {
    const result = await window.wasmLanguages.getAll();
    if (result.success) {
      return result.languages.filter((l) => l.status === 'ready');
    }
    return [];
  } catch {
    return [];
  }
}

export default useWasmLanguages;
