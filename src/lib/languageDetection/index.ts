/**
 * Language Detection Service
 * 
 * Centralized language detection using Microsoft's ML-based detector.
 * Uses @vscode/vscode-languagedetection for accurate language identification.
 * 
 * @see https://github.com/microsoft/vscode-languagedetection
 */

import { ModelOperations } from '@vscode/vscode-languagedetection'

// ============================================================================
// TYPES
// ============================================================================

export interface LanguageDetectionResult {
  languageId: string
  confidence: number
}

export interface DetectedLanguage {
  id: string
  monacoId: string
  confidence: number
  isExecutable: boolean
}

// ============================================================================
// LANGUAGE ID MAPPING
// ============================================================================

/**
 * Map from vscode-languagedetection IDs to Monaco language IDs
 */
const LANGUAGE_ID_MAP: Record<string, string> = {
  // Common languages
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
  'kt': 'kotlin',
  'scala': 'scala',
  
  // Scripting
  'sh': 'shell',
  'bash': 'shell',
  'ps1': 'powershell',
  'bat': 'bat',
  'lua': 'lua',
  'pl': 'perl',
  'r': 'r',
  
  // Web
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'less': 'less',
  
  // Data/Config
  'json': 'json',
  'yaml': 'yaml',
  'xml': 'xml',
  'sql': 'sql',
  'md': 'markdown',
  'tex': 'latex',
  
  // Others
  'hs': 'haskell',
  'erl': 'erlang',
  'coffee': 'coffeescript',
  'matlab': 'matlab',
  'mm': 'objective-c',
  'ipynb': 'python', // Jupyter notebooks -> Python
}

/**
 * Languages that can be executed in CheeseJS
 */
const EXECUTABLE_LANGUAGES = new Set([
  'typescript',
  'javascript', 
  'python'
])

// ============================================================================
// LANGUAGE DETECTION SERVICE
// ============================================================================

class LanguageDetectionService {
  private modelOperations: ModelOperations | null = null
  private isInitialized = false
  private initPromise: Promise<void> | null = null
  
  // Cache for recent detections
  private cache = new Map<string, DetectedLanguage>()
  private readonly CACHE_SIZE = 50
  private readonly MIN_CONTENT_SIZE = 10
  private readonly CONFIDENCE_THRESHOLD = 0.15

  /**
   * Initialize the ML model (lazy loading)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {
        this.modelOperations = new ModelOperations()
        this.isInitialized = true
        console.log('[LanguageDetection] ML model initialized')
      } catch (error) {
        console.error('[LanguageDetection] Failed to initialize:', error)
        // Fallback to pattern-based detection
        this.modelOperations = null
      }
    })()

    return this.initPromise
  }

  /**
   * Get cache key for content
   */
  private getCacheKey(content: string): string {
    // Use first 500 chars as cache key for performance
    return content.slice(0, 500)
  }

  /**
   * Detect language using ML model
   */
  async detectLanguage(content: string): Promise<DetectedLanguage> {
    // Check cache first
    const cacheKey = this.getCacheKey(content)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    // Default to TypeScript for empty/short content
    if (!content || content.trim().length < this.MIN_CONTENT_SIZE) {
      return {
        id: 'ts',
        monacoId: 'typescript',
        confidence: 1.0,
        isExecutable: true
      }
    }

    // Ensure model is initialized
    await this.initialize()

    // If ML model failed to load, use fallback
    if (!this.modelOperations) {
      return this.fallbackDetection(content)
    }

    try {
      const results = await this.modelOperations.runModel(content)
      
      if (results.length === 0) {
        return this.fallbackDetection(content)
      }

      // Get top result
      const topResult = results[0]
      const monacoId = LANGUAGE_ID_MAP[topResult.languageId] || topResult.languageId
      
      const detected: DetectedLanguage = {
        id: topResult.languageId,
        monacoId,
        confidence: topResult.confidence,
        isExecutable: EXECUTABLE_LANGUAGES.has(monacoId)
      }

      // Apply confidence threshold - if too low, check for strong patterns
      if (topResult.confidence < this.CONFIDENCE_THRESHOLD) {
        const patternResult = this.fallbackDetection(content)
        if (patternResult.confidence > detected.confidence) {
          this.updateCache(cacheKey, patternResult)
          return patternResult
        }
      }

      this.updateCache(cacheKey, detected)
      return detected
    } catch (error) {
      console.error('[LanguageDetection] ML detection failed:', error)
      return this.fallbackDetection(content)
    }
  }

  /**
   * Synchronous detection using pattern matching (fallback)
   */
  detectLanguageSync(content: string): DetectedLanguage {
    const cacheKey = this.getCacheKey(content)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const result = this.fallbackDetection(content)
    this.updateCache(cacheKey, result)
    return result
  }

  /**
   * Pattern-based fallback detection
   */
  private fallbackDetection(content: string): DetectedLanguage {
    if (!content || content.trim().length < this.MIN_CONTENT_SIZE) {
      return {
        id: 'ts',
        monacoId: 'typescript',
        confidence: 1.0,
        isExecutable: true
      }
    }

    const scores = {
      python: 0,
      typescript: 0,
      javascript: 0
    }

    // Python patterns
    const pythonPatterns = [
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
    ] as const

    // TypeScript patterns  
    const tsPatterns = [
      [/:\s*(string|number|boolean|any|void|unknown|never)\b/, 3],
      [/interface\s+\w+/, 3],
      [/type\s+\w+\s*=/, 3],
      [/<\w+>/, 2],
      [/as\s+(string|number|boolean|const)/, 2],
      [/\w+\?\s*:/, 2],
      [/(public|private|protected|readonly)\s+\w+/, 2],
    ] as const

    // JavaScript patterns
    const jsPatterns = [
      [/\bconst\s+\w+\s*=/, 2],
      [/\blet\s+\w+\s*=/, 2],
      [/\bvar\s+\w+\s*=/, 1],
      [/\bfunction\s+\w*\s*\(/, 2],
      [/=>/, 2],
      [/console\.(log|error|warn)/, 2],
      [/require\s*\(/, 2],
      [/module\.exports/, 2],
      [/import\s+.*\s+from\s+['"]/, 2],
      [/export\s+(default|const|function)/, 2],
      [/===|!==/, 1],
      [/\?\?/, 1],
      [/\?\./, 1],
    ] as const

    // Calculate scores
    for (const [pattern, weight] of pythonPatterns) {
      if (pattern.test(content)) scores.python += weight
    }
    for (const [pattern, weight] of tsPatterns) {
      if (pattern.test(content)) scores.typescript += weight
    }
    for (const [pattern, weight] of jsPatterns) {
      if (pattern.test(content)) scores.javascript += weight
    }

    // TypeScript inherits JavaScript patterns
    scores.typescript += scores.javascript * 0.5

    // Determine winner
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

    // Calculate confidence (normalize to 0-1)
    const totalScore = scores.python + scores.typescript + scores.javascript
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.5

    return {
      id: winner === 'python' ? 'py' : winner === 'typescript' ? 'ts' : 'js',
      monacoId: winner,
      confidence,
      isExecutable: true
    }
  }

  /**
   * Update cache with LRU eviction
   */
  private updateCache(key: string, value: DetectedLanguage): void {
    if (this.cache.size >= this.CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  /**
   * Clear the detection cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Check if a language is executable
   */
  isExecutable(monacoId: string): boolean {
    return EXECUTABLE_LANGUAGES.has(monacoId)
  }

  /**
   * Get Monaco language ID from detection ID
   */
  getMonacoId(detectionId: string): string {
    return LANGUAGE_ID_MAP[detectionId] || detectionId
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const languageDetectionService = new LanguageDetectionService()

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Detect language asynchronously using ML model
 */
export async function detectLanguage(content: string): Promise<DetectedLanguage> {
  return languageDetectionService.detectLanguage(content)
}

/**
 * Detect language synchronously using pattern matching
 */
export function detectLanguageSync(content: string): DetectedLanguage {
  return languageDetectionService.detectLanguageSync(content)
}

/**
 * Check if a language can be executed
 */
export function isLanguageExecutable(monacoId: string): boolean {
  return languageDetectionService.isExecutable(monacoId)
}

/**
 * Initialize the ML model (call early for faster first detection)
 */
export async function initializeLanguageDetection(): Promise<void> {
  return languageDetectionService.initialize()
}
