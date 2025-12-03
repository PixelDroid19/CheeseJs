/**
 * Language Store
 * 
 * Centralized state management for language detection and configuration.
 * Uses Zustand for reactive state and integrates with Monaco editor.
 * 
 * This is the SINGLE SOURCE OF TRUTH for language-related logic.
 * @see https://github.com/microsoft/vscode-languagedetection
 */

import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { ModelOperations } from '@vscode/vscode-languagedetection'
import type * as Monaco from 'monaco-editor'

// ============================================================================
// TYPES
// ============================================================================

export interface LanguageInfo {
  id: string           // Short ID (e.g., 'py', 'ts', 'js')
  monacoId: string     // Monaco language ID (e.g., 'python', 'typescript')
  displayName: string  // Human-readable name
  extensions: string[] // File extensions
  isExecutable: boolean // Can be executed in CheeseJS
}

export interface DetectionResult {
  monacoId: string
  confidence: number
  isExecutable: boolean
}

interface LanguageState {
  // Current language
  currentLanguage: string
  
  // Detection state
  isDetecting: boolean
  lastDetectionConfidence: number
  
  // ML model state
  isModelLoaded: boolean
  isModelLoading: boolean
  
  // Monaco reference (non-persisted)
  monacoInstance: typeof Monaco | null
  
  // Actions
  setLanguage: (language: string) => void
  detectLanguage: (content: string) => DetectionResult
  detectLanguageAsync: (content: string) => Promise<DetectionResult>
  initializeModel: () => Promise<void>
  setMonacoInstance: (monaco: typeof Monaco) => void
  applyLanguageToMonaco: (model: Monaco.editor.ITextModel | null) => void
  
  // Utilities
  isExecutable: (languageId: string) => boolean
  getLanguageInfo: (languageId: string) => LanguageInfo | undefined
  getDisplayName: (languageId: string) => string
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
    isExecutable: true
  },
  javascript: {
    id: 'js',
    monacoId: 'javascript',
    displayName: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs'],
    isExecutable: true
  },
  python: {
    id: 'py',
    monacoId: 'python',
    displayName: 'Python',
    extensions: ['.py', '.pyw'],
    isExecutable: true
  },
  
  // Non-executable languages
  html: {
    id: 'html',
    monacoId: 'html',
    displayName: 'HTML',
    extensions: ['.html', '.htm'],
    isExecutable: false
  },
  css: {
    id: 'css',
    monacoId: 'css',
    displayName: 'CSS',
    extensions: ['.css'],
    isExecutable: false
  },
  json: {
    id: 'json',
    monacoId: 'json',
    displayName: 'JSON',
    extensions: ['.json'],
    isExecutable: false
  },
  markdown: {
    id: 'md',
    monacoId: 'markdown',
    displayName: 'Markdown',
    extensions: ['.md', '.markdown'],
    isExecutable: false
  }
}

/**
 * Map detection IDs to Monaco IDs
 */
const DETECTION_TO_MONACO: Record<string, string> = {
  'ts': 'typescript',
  'js': 'javascript',
  'py': 'python',
  'rb': 'ruby',
  'go': 'go',
  'rs': 'rust',
  'java': 'java',
  'cs': 'csharp',
  'cpp': 'cpp',
  'c': 'c',
  'php': 'php',
  'swift': 'swift',
  'sh': 'shell',
  'ps1': 'powershell',
  'html': 'html',
  'css': 'css',
  'json': 'json',
  'md': 'markdown',
  'sql': 'sql',
  'yaml': 'yaml',
  'xml': 'xml'
}

// ============================================================================
// PATTERN-BASED DETECTION (Fallback)
// ============================================================================

const PYTHON_PATTERNS: Array<[RegExp, number]> = [
  [/^\s*def\s+\w+\s*\(/m, 3],
  [/^\s*class\s+\w+.*:/m, 3],
  [/^\s*import\s+\w+$/m, 2],
  [/^\s*from\s+\w+\s+import/m, 3],
  [/print\s*\(/, 2],
  [/:\s*$/m, 1],
  [/\bself\b/, 2],
  [/\bNone\b/, 2],
  [/\bTrue\b(?!\s*[,;)\]])/, 1],
  [/\bFalse\b(?!\s*[,;)\]])/, 1],
  [/\belif\b/, 3],
  [/\bexcept\b/, 2],
  [/for\s+\w+\s+in\s+(range|enumerate|zip)/, 3],
  [/^\s*@\w+/m, 2],
  [/f["'].*\{/, 2],
  [/^\s*#(?!\?).*$/m, 1],
]

const TYPESCRIPT_PATTERNS: Array<[RegExp, number]> = [
  [/:\s*(string|number|boolean|any|void|unknown|never)\b/, 3],
  [/interface\s+\w+/, 3],
  [/type\s+\w+\s*=/, 3],
  [/<\w+>/, 2],
  [/as\s+(string|number|boolean|const)/, 2],
  [/\w+\?\s*:/, 2],
  [/(public|private|protected|readonly)\s+\w+/, 2],
]

const JAVASCRIPT_PATTERNS: Array<[RegExp, number]> = [
  [/\bconst\s+\w+\s*=/, 2],
  [/\blet\s+\w+\s*=/, 2],
  [/\bvar\s+\w+\s*=/, 1],
  [/\bfunction\s+\w*\s*\(/, 2],
  [/=>/, 2],
  [/console\.(log|error|warn)/, 2],
  [/require\s*\(/, 2],
  [/import\s+.*\s+from\s+['"]/, 2],
  [/export\s+(default|const|function)/, 2],
  [/===|!==/, 1],
]

function patternBasedDetection(content: string): DetectionResult {
  if (!content || content.trim().length < 10) {
    return { monacoId: 'typescript', confidence: 1.0, isExecutable: true }
  }

  const scores = { python: 0, typescript: 0, javascript: 0 }

  for (const [pattern, weight] of PYTHON_PATTERNS) {
    if (pattern.test(content)) scores.python += weight
  }
  for (const [pattern, weight] of TYPESCRIPT_PATTERNS) {
    if (pattern.test(content)) scores.typescript += weight
  }
  for (const [pattern, weight] of JAVASCRIPT_PATTERNS) {
    if (pattern.test(content)) scores.javascript += weight
  }

  // TypeScript inherits JavaScript patterns
  scores.typescript += scores.javascript * 0.5

  let winner: 'python' | 'typescript' | 'javascript' = 'typescript'
  let maxScore = scores.typescript

  if (scores.python > maxScore) {
    winner = 'python'
    maxScore = scores.python
  }
  if (scores.javascript > maxScore && scores.typescript <= scores.javascript) {
    winner = 'javascript'
    maxScore = scores.javascript
  }

  const totalScore = scores.python + scores.typescript + scores.javascript
  const confidence = totalScore > 0 ? maxScore / totalScore : 0.5

  return {
    monacoId: winner,
    confidence,
    isExecutable: true
  }
}

// ============================================================================
// ML MODEL SINGLETON
// ============================================================================

let modelOperations: ModelOperations | null = null
let modelLoadPromise: Promise<void> | null = null

// ============================================================================
// DETECTION CACHE (LRU with proper key hashing)
// ============================================================================

const detectionCache = new Map<string, DetectionResult>()
const CACHE_SIZE = 50

/**
 * Generate a cache key using content signature:
 * - First 200 chars (captures imports/headers)
 * - Last 200 chars (captures unique code)
 * - Total length (differentiates similar starts)
 */
function getCacheKey(content: string): string {
  const len = content.length
  const start = content.slice(0, 200)
  const end = len > 400 ? content.slice(-200) : ''
  return `${len}:${start}:${end}`
}

function updateCache(key: string, value: DetectionResult): void {
  // LRU eviction: remove oldest entries when at capacity
  if (detectionCache.size >= CACHE_SIZE) {
    const keysToDelete = Array.from(detectionCache.keys()).slice(0, 10)
    keysToDelete.forEach(k => detectionCache.delete(k))
  }
  detectionCache.set(key, value)
}

/** Clear the detection cache (exported for testing/reset) */
export function clearDetectionCache(): void {
  detectionCache.clear()
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
          const state = get()
          if (state.currentLanguage === language) return
          
          set({ currentLanguage: language })
          
          // Apply to Monaco if available
          if (state.monacoInstance) {
            const editors = state.monacoInstance.editor.getEditors()
            for (const editor of editors) {
              const model = editor.getModel()
              if (model && !model.isDisposed()) {
                get().applyLanguageToMonaco(model)
              }
            }
          }
        },

        /**
         * Synchronous detection - uses cache or pattern fallback
         * For immediate UI feedback, prefer detectLanguageAsync for accuracy
         */
        detectLanguage: (content: string): DetectionResult => {
          // Check cache first (may contain ML results from previous async detection)
          const cacheKey = getCacheKey(content)
          const cached = detectionCache.get(cacheKey)
          if (cached) return cached

          // Fallback to pattern-based for sync detection
          // This is only used when cache misses and we need immediate result
          const result = patternBasedDetection(content)
          // Don't cache pattern results - let ML override on next async call
          return result
        },

        /**
         * ML-first async detection - PRIMARY detection method
         * Uses ML model for high accuracy, pattern fallback only on error
         */
        detectLanguageAsync: async (content: string): Promise<DetectionResult> => {
          const state = get()
          
          // Check cache
          const cacheKey = getCacheKey(content)
          const cached = detectionCache.get(cacheKey)
          if (cached) return cached

          // Very short content - use pattern detection (ML unreliable < 20 chars)
          if (!content || content.trim().length < 20) {
            const result = patternBasedDetection(content)
            updateCache(cacheKey, result)
            set({ lastDetectionConfidence: result.confidence })
            return result
          }

          // Ensure model is loaded
          if (!state.isModelLoaded && !state.isModelLoading) {
            await state.initializeModel()
          } else if (state.isModelLoading) {
            // Wait for ongoing load
            await modelLoadPromise
          }

          // If model failed to load, fallback to patterns
          if (!modelOperations) {
            console.warn('[LanguageStore] ML model not available, using pattern fallback')
            const result = patternBasedDetection(content)
            updateCache(cacheKey, result)
            set({ lastDetectionConfidence: result.confidence })
            return result
          }

          set({ isDetecting: true })

          try {
            const results = await modelOperations.runModel(content)
            
            if (results.length === 0) {
              const result = patternBasedDetection(content)
              updateCache(cacheKey, result)
              set({ lastDetectionConfidence: result.confidence, isDetecting: false })
              return result
            }

            const topResult = results[0]
            const monacoId = DETECTION_TO_MONACO[topResult.languageId] || topResult.languageId
            const langInfo = LANGUAGES[monacoId]

            const result: DetectionResult = {
              monacoId,
              confidence: topResult.confidence,
              isExecutable: langInfo?.isExecutable ?? false
            }

            // Cache ML result
            updateCache(cacheKey, result)
            set({ lastDetectionConfidence: result.confidence, isDetecting: false })
            
            console.debug(`[LanguageStore] ML detected: ${monacoId} (${(topResult.confidence * 100).toFixed(1)}%)`)
            return result
          } catch (error) {
            console.error('[LanguageStore] ML detection failed:', error)
            set({ isDetecting: false })
            const result = patternBasedDetection(content)
            updateCache(cacheKey, result)
            return result
          }
        },

        initializeModel: async () => {
          const state = get()
          if (state.isModelLoaded || state.isModelLoading) {
            return modelLoadPromise || Promise.resolve()
          }

          set({ isModelLoading: true })

          modelLoadPromise = (async () => {
            try {
              modelOperations = new ModelOperations()
              set({ isModelLoaded: true, isModelLoading: false })
              console.log('[LanguageStore] ML model loaded')
            } catch (error) {
              console.error('[LanguageStore] Failed to load ML model:', error)
              set({ isModelLoading: false })
            }
          })()

          return modelLoadPromise
        },

        setMonacoInstance: (monaco: typeof Monaco) => {
          set({ monacoInstance: monaco })
        },

        applyLanguageToMonaco: (model: Monaco.editor.ITextModel | null) => {
          const state = get()
          if (!model || model.isDisposed() || !state.monacoInstance) return

          const currentLang = model.getLanguageId()
          const targetLang = state.currentLanguage

          if (currentLang !== targetLang) {
            console.log(`[LanguageStore] Applying language: ${currentLang} -> ${targetLang}`)
            state.monacoInstance.editor.setModelLanguage(model, targetLang)
          }

          // Configure TypeScript diagnostics
          const isPython = targetLang === 'python'
          
          // @ts-expect-error - Monaco types don't include typescript.typescriptDefaults
          state.monacoInstance.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions({
            noSemanticValidation: isPython,
            noSyntaxValidation: isPython,
          })
          // @ts-expect-error - Monaco types don't include typescript.javascriptDefaults
          state.monacoInstance.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions({
            noSemanticValidation: isPython,
            noSyntaxValidation: isPython,
          })

          // Clear markers for Python
          if (isPython) {
            state.monacoInstance.editor.setModelMarkers(model, 'typescript', [])
            state.monacoInstance.editor.setModelMarkers(model, 'javascript', [])
          }
        },

        // Utilities
        isExecutable: (languageId: string): boolean => {
          const info = LANGUAGES[languageId]
          return info?.isExecutable ?? false
        },

        getLanguageInfo: (languageId: string): LanguageInfo | undefined => {
          return LANGUAGES[languageId]
        },

        getDisplayName: (languageId: string): string => {
          const info = LANGUAGES[languageId]
          return info?.displayName ?? languageId
        }
      }),
      {
        name: 'language-storage',
        partialize: (state) => ({ 
          currentLanguage: state.currentLanguage 
        }),
      }
    )
  )
)

// ============================================================================
// SELECTORS (for optimized re-renders)
// ============================================================================

export const selectCurrentLanguage = (state: LanguageState) => state.currentLanguage
export const selectIsDetecting = (state: LanguageState) => state.isDetecting
export const selectIsModelLoaded = (state: LanguageState) => state.isModelLoaded

// ============================================================================
// STANDALONE FUNCTIONS (for use outside React)
// ============================================================================

/**
 * Detect language synchronously (pattern-based)
 */
export function detectLanguageSync(content: string): DetectionResult {
  return useLanguageStore.getState().detectLanguage(content)
}

/**
 * Detect language asynchronously (ML-based)
 */
export async function detectLanguageAsync(content: string): Promise<DetectionResult> {
  return useLanguageStore.getState().detectLanguageAsync(content)
}

/**
 * Check if a language is executable
 */
export function isLanguageExecutable(languageId: string): boolean {
  return useLanguageStore.getState().isExecutable(languageId)
}

/**
 * Initialize ML model
 */
export function initializeLanguageDetection(): Promise<void> {
  return useLanguageStore.getState().initializeModel()
}

/**
 * Get display name for a language
 */
export function getLanguageDisplayName(languageId: string): string {
  return useLanguageStore.getState().getDisplayName(languageId)
}

/**
 * Set Monaco instance
 */
export function setMonacoInstance(monaco: typeof Monaco): void {
  useLanguageStore.getState().setMonacoInstance(monaco)
}

/**
 * Set current language
 */
export function setLanguage(language: string): void {
  useLanguageStore.getState().setLanguage(language)
}
