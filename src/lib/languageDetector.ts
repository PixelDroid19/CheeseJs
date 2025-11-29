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
    /<\s*[A-Z]\w*(\s*,\s*[A-Z]\w*)*\s*>/, // Simple generics
    /<\s*[A-Z]\w*\s+extends\s+/, // Generics with extends
    /as\s+(string|number|boolean|const|any)\b/,
    /(@Injectable|@Component|@Module|@Decorator)/,
    /\w+\s*:\s*\w+\s*[,)=]/,
    /\w+\?\s*:/,
    /(public|private|protected|readonly)\s+\w+/,
    /function\s+\w+\s*</,
    /:\s*\[/,
    /extends\s+\w+/,
    /:\s*[A-Z]/,
    /\):/, // Return type annotation start
    /\w+\[\]/ // Array types like number[]
  ],
  javascript: [
    /^\s*function\s+\w+/m,
    /^\s*const\s+\w+\s*=/m,
    /^\s*let\s+\w+\s*=/m,
    /^\s*var\s+\w+\s*=/m,
    /=>\s*{/,
    /console\.(log|error|warn|info)/,
    /require\s*\(/,
    /module\.exports/,
    /export\s+(default|const|function|class)/
  ],
  python: [
    /^\s*def\s+\w+\s*\(/m,
    // Avoid confusing class with JS/TS class
    /^\s*class\s+\w+(\(.*\))?\s*:/m,
    // Make import detection stricter for Python to avoid matching ES modules
    /^\s*import\s+[\w.]+(\s+as\s+\w+)?$/m,
    /^\s*from\s+[\w.]+\s+import/m,
    // Python print is a function call in Python 3, but can look like JS function call.
    // Use boundary or check for no semicolon if possible, but it's hard.
    // Let's rely on other python features more.
    /if\s+__name__\s*==\s*['"]__main__['"]:/,
    /:\s*$/m, // Block ending with colon
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

export function initLanguageDetector (): void {
  // Get all registered languages from Monaco
  monacoLanguages = monaco.languages.getLanguages() as LanguageInfo[]
  
  // Ensure basic languages are present if Monaco hasn't loaded them yet or if we are in a minimal environment
  if (!monacoLanguages.some(l => l.id === 'typescript')) {
      monacoLanguages.push({ id: 'typescript', extensions: ['.ts', '.tsx'], aliases: ['TypeScript', 'ts', 'typescript'] })
  }
  if (!monacoLanguages.some(l => l.id === 'javascript')) {
      monacoLanguages.push({ id: 'javascript', extensions: ['.js', '.jsx'], aliases: ['JavaScript', 'js', 'javascript'] })
  }
}

/**
 * Detect programming language using Monaco's language registry
 * Falls back to pattern matching for ambiguous cases
 */
export function detectLanguage (code: string): string {
  if (!code.trim()) return 'javascript'

  // Initialize if not already done
  if (monacoLanguages.length === 0) {
    initLanguageDetector()
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

  const result = isRegistered ? bestLanguage : 'javascript'
  return result
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
