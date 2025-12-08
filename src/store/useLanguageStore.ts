/**
 * Language Store
 *
 * Centralized state management for language detection and configuration.
 * Uses Zustand for reactive state and integrates with Monaco editor.
 *
 * This is the SINGLE SOURCE OF TRUTH for language-related state.
 * Detection logic is delegated to the languageDetection module.
 *
 * @see https://github.com/microsoft/vscode-languagedetection
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Import from the new language detection module
import {
  type DetectionResult,
  type LanguageInfo,
  patternBasedDetection,
  detectWithML,
  initializeMLModel,
  isMLModelLoaded,
  isMLModelLoading,
  getLanguageInfo as getLangInfo,
  isExecutable as checkExecutable,
  getDisplayName as getLangDisplayName,
  clearDetectionCache,
  getCacheKey,
  getCached,
  DEFINITIVE_PYTHON_PATTERNS,
  DEFINITIVE_TS_PATTERNS,
  DEFINITIVE_JS_PATTERNS,
} from '../lib/languageDetection';

// Re-export types for backward compatibility
export type { DetectionResult, LanguageInfo };
export { clearDetectionCache };

// ============================================================================
// TYPES
// ============================================================================

interface LanguageState {
  // Current language
  currentLanguage: string;

  // Detection state
  isDetecting: boolean;
  lastDetectionConfidence: number;

  // ML model state
  isModelLoaded: boolean;
  isModelLoading: boolean;

  // Monaco reference (non-persisted)
  monacoInstance: typeof Monaco | null;

  // Actions
  setLanguage: (language: string) => void;
  detectLanguage: (content: string) => DetectionResult;
  detectLanguageAsync: (content: string) => Promise<DetectionResult>;
  initializeModel: () => Promise<void>;
  setMonacoInstance: (monaco: typeof Monaco) => void;
  applyLanguageToMonaco: (model: Monaco.editor.ITextModel | null) => void;

  // Utilities
  isExecutable: (languageId: string) => boolean;
  getLanguageInfo: (languageId: string) => LanguageInfo | undefined;
  getDisplayName: (languageId: string) => string;
}

// ============================================================================
// STORE
// ============================================================================

export const useLanguageStore = create<LanguageState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // State
        currentLanguage: 'typescript',
        isDetecting: false,
        lastDetectionConfidence: 1.0,
        isModelLoaded: false,
        isModelLoading: false,
        monacoInstance: null,

        // Actions
        setLanguage: (language: string) => {
          const state = get();
          if (state.currentLanguage === language) return;

          set({ currentLanguage: language });

          // Apply to Monaco if available
          if (state.monacoInstance) {
            const editors = state.monacoInstance.editor.getEditors();
            for (const editor of editors) {
              const model = editor.getModel();
              if (model && !model.isDisposed()) {
                get().applyLanguageToMonaco(model);
              }
            }
          }
        },

        /**
         * Synchronous detection - uses cache or pattern fallback
         * For immediate UI feedback, prefer detectLanguageAsync for accuracy
         */
        detectLanguage: (content: string): DetectionResult => {
          const trimmed = content?.trim() || '';

          // Check definitive patterns first (highest priority)
          for (const pattern of DEFINITIVE_PYTHON_PATTERNS) {
            if (pattern.test(trimmed)) {
              console.log(
                `[LanguageStore] Sync: Definitive Python matched: ${pattern}`
              );
              return {
                monacoId: 'python',
                confidence: 0.98,
                isExecutable: true,
              };
            }
          }

          for (const pattern of DEFINITIVE_TS_PATTERNS) {
            if (pattern.test(trimmed)) {
              console.log(
                `[LanguageStore] Sync: Definitive TS matched: ${pattern}`
              );
              return {
                monacoId: 'typescript',
                confidence: 0.98,
                isExecutable: true,
              };
            }
          }

          for (const pattern of DEFINITIVE_JS_PATTERNS) {
            if (pattern.test(trimmed)) {
              console.log(
                `[LanguageStore] Sync: Definitive JS matched: ${pattern}`
              );
              return {
                monacoId: 'javascript',
                confidence: 0.98,
                isExecutable: true,
              };
            }
          }

          // Check cache
          const cacheKey = getCacheKey(content);
          const cached = getCached(cacheKey);
          if (cached) return cached;

          // Fallback to pattern-based detection
          return patternBasedDetection(content);
        },

        /**
         * ML-first async detection - PRIMARY detection method
         * Uses ML model for high accuracy, pattern fallback only on error
         */
        detectLanguageAsync: async (
          content: string
        ): Promise<DetectionResult> => {
          return detectWithML(
            content,
            (detecting) => set({ isDetecting: detecting }),
            (confidence) => set({ lastDetectionConfidence: confidence })
          );
        },

        initializeModel: async () => {
          const state = get();
          if (state.isModelLoaded || state.isModelLoading) {
            return;
          }

          set({ isModelLoading: true });

          await initializeMLModel();

          set({
            isModelLoaded: isMLModelLoaded(),
            isModelLoading: isMLModelLoading(),
          });
        },

        setMonacoInstance: (monaco: typeof Monaco) => {
          set({ monacoInstance: monaco });
        },

        applyLanguageToMonaco: (model: Monaco.editor.ITextModel | null) => {
          const state = get();
          if (!model || model.isDisposed() || !state.monacoInstance) return;

          const currentLang = model.getLanguageId();
          const targetLang = state.currentLanguage;

          if (currentLang !== targetLang) {
            console.log(
              `[LanguageStore] Applying language: ${currentLang} -> ${targetLang}`
            );
            state.monacoInstance.editor.setModelLanguage(model, targetLang);
          }

          // Configure TypeScript diagnostics
          const isPython = targetLang === 'python';

          // Type for TS diagnostics
          interface TSDefaults { setDiagnosticsOptions(opts: { noSemanticValidation?: boolean; noSyntaxValidation?: boolean }): void; }
          interface TSLanguages { typescriptDefaults?: TSDefaults; javascriptDefaults?: TSDefaults; }

          const ts = (state.monacoInstance.languages as unknown as { typescript: TSLanguages }).typescript;
          if (ts) {
            ts.typescriptDefaults?.setDiagnosticsOptions({
              noSemanticValidation: isPython,
              noSyntaxValidation: isPython,
            });
            ts.javascriptDefaults?.setDiagnosticsOptions({
              noSemanticValidation: isPython,
              noSyntaxValidation: isPython,
            });
          }

          // Clear markers for Python
          if (isPython) {
            state.monacoInstance.editor.setModelMarkers(
              model,
              'typescript',
              []
            );
            state.monacoInstance.editor.setModelMarkers(
              model,
              'javascript',
              []
            );
          }
        },

        // Utilities - delegate to module
        isExecutable: (languageId: string): boolean => {
          return checkExecutable(languageId);
        },

        getLanguageInfo: (languageId: string): LanguageInfo | undefined => {
          return getLangInfo(languageId);
        },

        getDisplayName: (languageId: string): string => {
          return getLangDisplayName(languageId);
        },
      }),
      {
        name: 'language-storage',
        partialize: (state) => ({
          currentLanguage: state.currentLanguage,
        }),
      }
    )
  )
);

// ============================================================================
// SELECTORS (for optimized re-renders)
// ============================================================================

export const selectCurrentLanguage = (state: LanguageState) =>
  state.currentLanguage;
export const selectIsDetecting = (state: LanguageState) => state.isDetecting;
export const selectIsModelLoaded = (state: LanguageState) =>
  state.isModelLoaded;

// ============================================================================
// STANDALONE FUNCTIONS (for use outside React)
// ============================================================================

/**
 * Detect language synchronously (pattern-based)
 */
export function detectLanguageSync(content: string): DetectionResult {
  return useLanguageStore.getState().detectLanguage(content);
}

/**
 * Detect language asynchronously (ML-based)
 */
export async function detectLanguageAsync(
  content: string
): Promise<DetectionResult> {
  return useLanguageStore.getState().detectLanguageAsync(content);
}

/**
 * Check if a language is executable
 */
export function isLanguageExecutable(languageId: string): boolean {
  return useLanguageStore.getState().isExecutable(languageId);
}

/**
 * Initialize ML model
 */
export function initializeLanguageDetection(): Promise<void> {
  return useLanguageStore.getState().initializeModel();
}

/**
 * Get display name for a language
 */
export function getLanguageDisplayName(languageId: string): string {
  return useLanguageStore.getState().getDisplayName(languageId);
}

/**
 * Set Monaco instance
 */
export function setMonacoInstance(monaco: typeof Monaco): void {
  useLanguageStore.getState().setMonacoInstance(monaco);
}
