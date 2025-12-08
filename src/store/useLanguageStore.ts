/**
 * Language Store
 *
 * Centralized state management for language detection and configuration.
 * Uses Zustand for reactive state and integrates with Monaco editor.
 *
 * This is the SINGLE SOURCE OF TRUTH for language-related logic.
 * @see https://github.com/microsoft/vscode-languagedetection
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { ModelOperations } from '@vscode/vscode-languagedetection';
import type * as Monaco from 'monaco-editor';

// ============================================================================
// TYPES
// ============================================================================

export interface LanguageInfo {
  id: string; // Short ID (e.g., 'py', 'ts', 'js')
  monacoId: string; // Monaco language ID (e.g., 'python', 'typescript')
  displayName: string; // Human-readable name
  extensions: string[]; // File extensions
  isExecutable: boolean; // Can be executed in CheeseJS
}

export interface DetectionResult {
  monacoId: string;
  confidence: number;
  isExecutable: boolean;
}

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
// LANGUAGE REGISTRY
// ============================================================================

const LANGUAGES: Record<string, LanguageInfo> = {
  // Executable languages
  typescript: {
    id: 'ts',
    monacoId: 'typescript',
    displayName: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    isExecutable: true,
  },
  javascript: {
    id: 'js',
    monacoId: 'javascript',
    displayName: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs'],
    isExecutable: true,
  },
  python: {
    id: 'py',
    monacoId: 'python',
    displayName: 'Python',
    extensions: ['.py', '.pyw'],
    isExecutable: true,
  },

  // Non-executable languages
  html: {
    id: 'html',
    monacoId: 'html',
    displayName: 'HTML',
    extensions: ['.html', '.htm'],
    isExecutable: false,
  },
  css: {
    id: 'css',
    monacoId: 'css',
    displayName: 'CSS',
    extensions: ['.css'],
    isExecutable: false,
  },
  json: {
    id: 'json',
    monacoId: 'json',
    displayName: 'JSON',
    extensions: ['.json'],
    isExecutable: false,
  },
  markdown: {
    id: 'md',
    monacoId: 'markdown',
    displayName: 'Markdown',
    extensions: ['.md', '.markdown'],
    isExecutable: false,
  },
};

/**
 * Map detection IDs to Monaco IDs
 */
const DETECTION_TO_MONACO: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  php: 'php',
  swift: 'swift',
  sh: 'shell',
  ps1: 'powershell',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  sql: 'sql',
  yaml: 'yaml',
  xml: 'xml',
};

// ============================================================================
// PATTERN-BASED DETECTION (Fallback)
// ============================================================================

/**
 * DEFINITIVE Python patterns - these ONLY exist in Python, not JS/TS
 * If matched, immediately return Python without scoring
 */
const DEFINITIVE_PYTHON_PATTERNS: RegExp[] = [
  /^print\s*\(/m, // print( at start of line - ONLY Python
  /^\s*print\s*\([^)]*\)\s*$/, // Single line print statement
  /^\s*def\s+\w+\s*\([^)]*\).*:/m, // def func(): or def func() -> type: - Python function
  /^\s*class\s+\w+.*:\s*$/m, // class Name: - Python class
  /^\s*from\s+\w+\s+import\s+/m, // from x import - Python import
  /^\s*import\s+\w+\s*$/m, // import x (no from/require)
  /\belif\s+/, // elif - ONLY Python
  /\bexcept\s*:/, // except: - ONLY Python
  /\bexcept\s+\w+/, // except Exception - ONLY Python
  /:\s*\n\s+/, // colon followed by indented block
  /->\s*(str|int|float|bool|None|list|dict|tuple|set)\s*:/, // Python return type hints
  /if\s+__name__\s*==\s*["']__main__["']\s*:/, // Python main guard
];

/**
 * DEFINITIVE JavaScript/TypeScript patterns - these ONLY exist in JS/TS
 */
const DEFINITIVE_JS_PATTERNS: RegExp[] = [
  /console\.(log|error|warn|info|debug|table|dir)\s*\(/, // console.log( - ONLY JS
  /\bfunction\s+\w+\s*\(/, // function name( - JS syntax (any function declaration)
  /\bfunction\s*\(/, // function( - anonymous function
  /=>\s*[{()]/, // => { or => ( - Arrow function
  /\bconst\s+\w+\s*=\s*[({]/, // const x = ( or { - likely JS
  /\blet\s+\w+\s*=\s*[({]/, // let x = ( or { - likely JS
  /\bvar\s+\w+\s*=\s*[({]/, // var x = ( or { - likely JS
  /\brequire\s*\(\s*['"`]/, // require('...')
  /\bimport\s+.*\s+from\s+['"`]/, // import x from '...'
  /document\.|window\.|localStorage\./, // DOM APIs
  /\.(then|catch|finally)\s*\(/, // Promise chain
  // NOTE: Removed /===|!==/ as it's too aggressive and causes false positives
];

/**
 * DEFINITIVE TypeScript patterns - these ONLY exist in TypeScript, not plain JS
 * If matched, return TypeScript (higher priority than JS)
 */
const DEFINITIVE_TS_PATTERNS: RegExp[] = [
  /\binterface\s+\w+\s*\{/, // interface Name { - TS only
  /\btype\s+\w+\s*=/, // type Name = - TS only
  /:\s*(string|number|boolean|void|never|unknown|any)\b/, // Type annotations
  /<\w+>\s*\(/, // Generic syntax: <T>(
  /\w+<[^>]+>/, // Generic usage: Array<string>
  /\bas\s+(string|number|boolean|any|unknown)\b/, // Type assertion
  /\benum\s+\w+/, // enum - TS only
  /\bnamespace\s+\w+/, // namespace - TS only
  /\bdeclare\s+(const|let|var|function|class)/, // declare - TS only
  /\bimplements\s+\w+/, // implements - TS only
  /\bprivate\s+\w+:/, // private property - TS only
  /\bpublic\s+\w+:/, // public property - TS only
  /\bprotected\s+\w+:/, // protected property - TS only
  /\breadonly\s+\w+:/, // readonly property - TS only
];

const PYTHON_PATTERNS: Array<[RegExp, number]> = [
  [/^\s*def\s+\w+\s*\(/m, 4],
  [/^\s*def\s+\w+\s*\([^)]*\).*:/m, 5], // def with return type hint
  [/^\s*class\s+\w+.*:/m, 4],
  [/^\s*import\s+\w+$/m, 3],
  [/^\s*from\s+\w+\s+import/m, 4],
  [/print\s*\(/, 5], // HIGH weight - print() is Python-specific
  [/:\s*$/m, 1],
  [/\bself\b/, 3],
  [/\bNone\b/, 3],
  [/\bTrue\b(?!\s*[,;)\]])/, 2],
  [/\bFalse\b(?!\s*[,;)\]])/, 2],
  [/\belif\b/, 4],
  [/\bexcept\b/, 3],
  [/for\s+\w+\s+in\s+(range|enumerate|zip)/, 4],
  [/^\s*@\w+/m, 3],
  [/f["'].*\{/, 3],
  [/^\s*#(?!\?).*$/m, 1],
  [/__\w+__/, 2], // __init__, __name__, etc.
  [/\bpass\b/, 2],
  [/\blambda\s+\w*:/, 3],
  [/->\s*(str|int|float|bool|None|list|dict|tuple)\s*:/, 5], // Return type hints
  [/:\s*(str|int|float|bool|List|Dict|Tuple|Set|Optional)\b/, 4], // Python type hints
  [/if\s+__name__\s*==\s*["']__main__["']/, 5], // Python main guard
];

const TYPESCRIPT_PATTERNS: Array<[RegExp, number]> = [
  [/:\s*(string|number|boolean|any|void|unknown|never)\b/, 3],
  [/interface\s+\w+/, 3],
  [/type\s+\w+\s*=/, 3],
  [/<\w+>/, 2],
  [/as\s+(string|number|boolean|const)/, 2],
  [/\w+\?\s*:/, 2],
  [/(public|private|protected|readonly)\s+\w+/, 2],
];

const JAVASCRIPT_PATTERNS: Array<[RegExp, number]> = [
  [/\bconst\s+\w+\s*=/, 2],
  [/\blet\s+\w+\s*=/, 2],
  [/\bvar\s+\w+\s*=/, 1],
  [/\bfunction\s+\w*\s*\(/, 2],
  [/=>/, 2],
  [/console\.(log|error|warn|info|debug|table)/, 5], // High weight - very JS specific
  [/require\s*\(/, 3],
  [/import\s+.*\s+from\s+['"]/, 3],
  [/export\s+(default|const|function|class)/, 3],
  [/===|!==/, 2],
  [/document\.|window\.|localStorage/, 4], // DOM APIs
  [/\.(then|catch|finally)\s*\(/, 3], // Promise chains
  [/async\s+function|await\s+/, 3],
];

function patternBasedDetection(content: string): DetectionResult {
  // Empty content - default to TypeScript
  if (!content || content.trim().length === 0) {
    return { monacoId: 'typescript', confidence: 1.0, isExecutable: true };
  }

  const trimmed = content.trim();

  // =========================================================================
  // DEFINITIVE PATTERN MATCHING (highest priority)
  // These patterns are UNIQUE to their language - no ambiguity
  // Order matters: Python first, then TypeScript (superset of JS), then JS
  // =========================================================================

  // Check definitive Python patterns FIRST
  for (const pattern of DEFINITIVE_PYTHON_PATTERNS) {
    if (pattern.test(trimmed)) {
      console.log(`[Detection] Definitive Python pattern matched: ${pattern}`);
      return { monacoId: 'python', confidence: 0.95, isExecutable: true };
    }
  }

  // Check definitive TypeScript patterns (before JS, since TS is superset)
  for (const pattern of DEFINITIVE_TS_PATTERNS) {
    if (pattern.test(trimmed)) {
      console.log(
        `[Detection] Definitive TypeScript pattern matched: ${pattern}`
      );
      return { monacoId: 'typescript', confidence: 0.95, isExecutable: true };
    }
  }

  // Check definitive JS patterns
  for (const pattern of DEFINITIVE_JS_PATTERNS) {
    if (pattern.test(trimmed)) {
      console.log(`[Detection] Definitive JS pattern matched: ${pattern}`);
      return { monacoId: 'javascript', confidence: 0.95, isExecutable: true };
    }
  }

  // =========================================================================
  // SCORING-BASED DETECTION (for ambiguous code)
  // =========================================================================

  // Very short content without definitive patterns - default to TypeScript
  if (trimmed.length < 10) {
    return { monacoId: 'typescript', confidence: 1.0, isExecutable: true };
  }

  const scores = { python: 0, typescript: 0, javascript: 0 };

  for (const [pattern, weight] of PYTHON_PATTERNS) {
    if (pattern.test(content)) scores.python += weight;
  }
  for (const [pattern, weight] of TYPESCRIPT_PATTERNS) {
    if (pattern.test(content)) scores.typescript += weight;
  }
  for (const [pattern, weight] of JAVASCRIPT_PATTERNS) {
    if (pattern.test(content)) scores.javascript += weight;
  }

  // TypeScript inherits JavaScript patterns
  scores.typescript += scores.javascript * 0.5;

  let winner: 'python' | 'typescript' | 'javascript' = 'typescript';
  let maxScore = scores.typescript;

  if (scores.python > maxScore) {
    winner = 'python';
    maxScore = scores.python;
  }
  if (scores.javascript > maxScore && scores.typescript <= scores.javascript) {
    winner = 'javascript';
    maxScore = scores.javascript;
  }

  const totalScore = scores.python + scores.typescript + scores.javascript;
  const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

  return {
    monacoId: winner,
    confidence,
    isExecutable: true,
  };
}

// ============================================================================
// ML MODEL SINGLETON
// ============================================================================

let modelOperations: ModelOperations | null = null;
let modelLoadPromise: Promise<void> | null = null;

// ============================================================================
// DETECTION CACHE (LRU with proper key hashing)
// ============================================================================

const detectionCache = new Map<string, DetectionResult>();
const CACHE_SIZE = 50;

/**
 * Generate a cache key using content signature:
 * - First 100 chars (captures imports/headers)
 * - Middle 100 chars (captures unique code patterns)
 * - Last 100 chars (captures unique endings)
 * - Total length (differentiates similar content)
 */
function getCacheKey(content: string): string {
  const len = content.length;
  const start = content.slice(0, 100);
  const mid =
    len > 300
      ? content.slice(Math.floor(len / 2) - 50, Math.floor(len / 2) + 50)
      : '';
  const end = len > 200 ? content.slice(-100) : '';
  return `${len}:${start}:${mid}:${end}`;
}

function updateCache(key: string, value: DetectionResult): void {
  // LRU eviction: remove oldest entries when at capacity
  if (detectionCache.size >= CACHE_SIZE) {
    const keysToDelete = Array.from(detectionCache.keys()).slice(0, 10);
    keysToDelete.forEach((k) => detectionCache.delete(k));
  }
  detectionCache.set(key, value);
}

/** Clear the detection cache (exported for testing/reset) */
export function clearDetectionCache(): void {
  detectionCache.clear();
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

          // =====================================================================
          // DEFINITIVE PATTERN CHECK (highest priority, before cache)
          // Order: Python FIRST (most distinctive), then TypeScript, then JavaScript
          // Python patterns like 'def', 'import', 'print' are VERY distinctive
          // =====================================================================

          // Check Python FIRST - patterns like 'def func():' are unambiguous
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

          // Check TypeScript second - type annotations are distinctive
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

          // Check JavaScript last - patterns like 'function' are clear
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

          // Check cache only for ambiguous content
          const cacheKey = getCacheKey(content);
          const cached = detectionCache.get(cacheKey);
          if (cached) return cached;

          // Fallback to pattern-based scoring for sync detection
          const result = patternBasedDetection(content);
          return result;
        },

        /**
         * ML-first async detection - PRIMARY detection method
         * Uses ML model for high accuracy, pattern fallback only on error
         */
        detectLanguageAsync: async (
          content: string
        ): Promise<DetectionResult> => {
          const state = get();

          // Check cache
          const cacheKey = getCacheKey(content);
          const cached = detectionCache.get(cacheKey);
          if (cached) return cached;

          const trimmed = content?.trim() || '';

          // =====================================================================
          // DEFINITIVE PATTERN CHECK (ALWAYS runs first, regardless of ML)
          // These patterns are UNAMBIGUOUS - no ML needed
          // Order: Python first, then TypeScript, then JavaScript
          // =====================================================================
          for (const pattern of DEFINITIVE_PYTHON_PATTERNS) {
            if (pattern.test(trimmed)) {
              console.log(`[LanguageStore] Definitive Python: ${pattern}`);
              const result: DetectionResult = {
                monacoId: 'python',
                confidence: 0.98,
                isExecutable: true,
              };
              updateCache(cacheKey, result);
              set({ lastDetectionConfidence: result.confidence });
              return result;
            }
          }

          for (const pattern of DEFINITIVE_TS_PATTERNS) {
            if (pattern.test(trimmed)) {
              console.log(`[LanguageStore] Definitive TypeScript: ${pattern}`);
              const result: DetectionResult = {
                monacoId: 'typescript',
                confidence: 0.98,
                isExecutable: true,
              };
              updateCache(cacheKey, result);
              set({ lastDetectionConfidence: result.confidence });
              return result;
            }
          }

          for (const pattern of DEFINITIVE_JS_PATTERNS) {
            if (pattern.test(trimmed)) {
              console.log(`[LanguageStore] Definitive JS: ${pattern}`);
              const result: DetectionResult = {
                monacoId: 'javascript',
                confidence: 0.98,
                isExecutable: true,
              };
              updateCache(cacheKey, result);
              set({ lastDetectionConfidence: result.confidence });
              return result;
            }
          }

          // =====================================================================
          // SHORT CONTENT - use pattern scoring (ML unreliable < 50 chars)
          // =====================================================================
          if (trimmed.length < 50) {
            const result = patternBasedDetection(content);
            updateCache(cacheKey, result);
            set({ lastDetectionConfidence: result.confidence });
            return result;
          }

          // Ensure model is loaded
          if (!state.isModelLoaded && !state.isModelLoading) {
            await state.initializeModel();
          } else if (state.isModelLoading) {
            // Wait for ongoing load
            await modelLoadPromise;
          }

          // If model failed to load, fallback to patterns
          if (!modelOperations) {
            console.warn(
              '[LanguageStore] ML model not available, using pattern fallback'
            );
            const result = patternBasedDetection(content);
            updateCache(cacheKey, result);
            set({ lastDetectionConfidence: result.confidence });
            return result;
          }

          set({ isDetecting: true });

          try {
            const results = await modelOperations.runModel(content);

            if (results.length === 0) {
              const result = patternBasedDetection(content);
              updateCache(cacheKey, result);
              set({
                lastDetectionConfidence: result.confidence,
                isDetecting: false,
              });
              return result;
            }

            const topResult = results[0];
            const monacoId =
              DETECTION_TO_MONACO[topResult.languageId] || topResult.languageId;
            const langInfo = LANGUAGES[monacoId];

            const result: DetectionResult = {
              monacoId,
              confidence: topResult.confidence,
              isExecutable: langInfo?.isExecutable ?? false,
            };

            // Cache ML result
            updateCache(cacheKey, result);
            set({
              lastDetectionConfidence: result.confidence,
              isDetecting: false,
            });

            console.debug(
              `[LanguageStore] ML detected: ${monacoId} (${(topResult.confidence * 100).toFixed(1)}%)`
            );
            return result;
          } catch (error) {
            console.error('[LanguageStore] ML detection failed:', error);
            set({ isDetecting: false });
            const result = patternBasedDetection(content);
            updateCache(cacheKey, result);
            return result;
          }
        },

        initializeModel: async () => {
          const state = get();
          if (state.isModelLoaded || state.isModelLoading) {
            return modelLoadPromise || Promise.resolve();
          }

          set({ isModelLoading: true });

          modelLoadPromise = (async () => {
            try {
              modelOperations = new ModelOperations();
              set({ isModelLoaded: true, isModelLoading: false });
              console.log('[LanguageStore] ML model loaded');
            } catch (error) {
              console.error('[LanguageStore] Failed to load ML model:', error);
              set({ isModelLoading: false });
            }
          })();

          return modelLoadPromise;
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

          // @ts-expect-error - Monaco types don't include typescript.typescriptDefaults
          state.monacoInstance.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions(
            {
              noSemanticValidation: isPython,
              noSyntaxValidation: isPython,
            }
          );
          // @ts-expect-error - Monaco types don't include typescript.javascriptDefaults
          state.monacoInstance.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions(
            {
              noSemanticValidation: isPython,
              noSyntaxValidation: isPython,
            }
          );

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

        // Utilities
        isExecutable: (languageId: string): boolean => {
          const info = LANGUAGES[languageId];
          return info?.isExecutable ?? false;
        },

        getLanguageInfo: (languageId: string): LanguageInfo | undefined => {
          return LANGUAGES[languageId];
        },

        getDisplayName: (languageId: string): string => {
          const info = LANGUAGES[languageId];
          return info?.displayName ?? languageId;
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

/**
 * Set current language
 */
export function setLanguage(language: string): void {
  useLanguageStore.getState().setLanguage(language);
}
