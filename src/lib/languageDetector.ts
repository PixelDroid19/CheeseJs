// Monaco-based language detection using official APIs
// Uses monaco.languages.getLanguages() for accurate detection

import * as monaco from 'monaco-editor'

interface LanguageInfo {
  id: string
  extensions?: string[]
  aliases?: string[]
  mimetypes?: string[]
}

// Enhanced patterns for ambiguous cases
const ENHANCED_PATTERNS = {
  typescript: [
    /:\s*(string|number|boolean|any|void|unknown|never|object)/,
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
    /<[A-Z]\w*>/,
    /as\s+(string|number|boolean|const|any)\b/,
    /(@Injectable|@Component|@Module|@Decorator)/,
    /\w+\s*:\s*\w+\s*[,)=]/,
    /\w+\?\s*:/,
    /(public|private|protected|readonly)\s+\w+/
  ],
  javascript: [
    /^function\s+\w+/m,
    /^const\s+\w+\s*=/m,
    /^let\s+\w+\s*=/m,
    /^var\s+\w+\s*=/m,
    /=>\s*{/,
    /console\.(log|error|warn|info)/,
    /require\s*\(/,
    /module\.exports/,
    /export\s+(default|const|function|class)/
  ],
  python: [
    /^def\s+\w+\s*\(/m,
    /^class\s+\w+\s*(\(.*\))?\s*:/m,
    /^import\s+\w+/m,
    /^from\s+\w+\s+import/m,
    /print\s*\(/,
    /__init__\s*\(/,
    /self\.\w+/
  ],
  html: [
    /<!DOCTYPE\s+html>/i,
    /<html[^>]*>/i,
    /<head[^>]*>/i,
    /<body[^>]*>/i,
    /<div[^>]*>/i,
    /<script[^>]*>/i,
    /<style[^>]*>/i,
    /<[a-z]+[^>]*>[^<]*<\/[a-z]+>/i
  ],
  css: [
    /[.#][\w-]+\s*\{/,
    /@media\s*\(/,
    /@keyframes\s+\w+/,
    /:\s*[\w-]+\s*;/,
    /\w+\s*:\s*[^;]+;/,
    /@import\s+/
  ],
  json: [
    /^\s*\{[\s\S]*\}\s*$/,
    /^\s*\[[\s\S]*\]\s*$/,
    /"[\w-]+"\s*:\s*("[\w-]*"|[\d.]+|true|false|null)/
  ]
}

// Cache for Monaco languages
let monacoLanguages: LanguageInfo[] = []

export async function initLanguageDetector (): Promise<void> {
  // Get all registered languages from Monaco
  monacoLanguages = monaco.languages.getLanguages() as LanguageInfo[]
}

/**
 * Detect programming language using Monaco's language registry
 * Falls back to pattern matching for ambiguous cases
 */
export async function detectLanguage (code: string): Promise<string> {
  if (!code.trim()) return 'javascript'

  // Initialize if not already done
  if (monacoLanguages.length === 0) {
    await initLanguageDetector()
  }

  // Score languages based on pattern matching
  const scores = new Map<string, number>()

  // Check enhanced patterns for common languages
  for (const [langId, patterns] of Object.entries(ENHANCED_PATTERNS)) {
    let score = 0
    for (const pattern of patterns) {
      if (pattern.test(code)) {
        score++
      }
    }
    if (score > 0) {
      scores.set(langId, score)
    }
  }

  // Find the language with the highest score
  let bestLanguage = 'javascript'
  let maxScore = 0

  for (const [langId, score] of scores.entries()) {
    if (score > maxScore) {
      maxScore = score
      bestLanguage = langId
    }
  }

  // Special case: TypeScript vs JavaScript disambiguation
  const tsScore = scores.get('typescript') || 0
  const jsScore = scores.get('javascript') || 0

  if (tsScore > 0 && jsScore > 0) {
    // If TypeScript-specific patterns found, prefer TypeScript
    if (tsScore >= jsScore) {
      return 'typescript'
    }
  }

  // Validate that the detected language is registered in Monaco
  const isRegistered = monacoLanguages.some(
    (lang) => lang.id === bestLanguage || lang.aliases?.includes(bestLanguage)
  )

  return isRegistered ? bestLanguage : 'javascript'
}

/**
 * Check if a language is executable in this runtime
 * Only JavaScript and TypeScript can be executed
 */
export function isLanguageExecutable (languageId: string): boolean {
  return languageId === 'javascript' || languageId === 'typescript'
}

/**
 * Get all available Monaco languages
 */
export function getAvailableLanguages (): LanguageInfo[] {
  return monacoLanguages
}

/**
 * Get language info by ID
 */
export function getLanguageById (id: string): LanguageInfo | undefined {
  return monacoLanguages.find(
    (lang) => lang.id === id || lang.aliases?.includes(id)
  )
}
