// Monaco-based language detection using official APIs
// Uses monaco.languages.getLanguages() for accurate detection

import * as monaco from 'monaco-editor'

interface LanguageInfo {
  id: string
  extensions?: string[]
  aliases?: string[]
  mimetypes?: string[]
}

// Enhanced patterns for language detection - ordered by priority
const LANGUAGE_PATTERNS = {
  // Python detection - highest priority patterns
  python: [
    /^\s*def\s+\w+\s*\(/m,                              // def function_name(
    /^\s*class\s+\w+(\(.*\))?\s*:/m,                    // class Name: or class Name(Base):
    /^\s*from\s+[\w.]+\s+import/m,                      // from module import
    /^\s*import\s+[\w.]+(\s+as\s+\w+)?$/m,              // import module (Python style)
    /print\s*\([^)]*\)/,                                // print("...")
    /^\s*#[^!]/m,                                       // # comment (not shebang)
    /for\s+\w+\s+in\s+(range|enumerate|zip|map|filter|list|dict|set|tuple)\s*\(/,  // for x in range(
    /for\s+\w+\s+in\s+\w+\s*:/,                         // for x in items:
    /if\s+.+:\s*$/m,                                    // if condition:
    /^\s*(elif|else)\s*.*:\s*$/m,                       // elif/else:
    /while\s+.+:\s*$/m,                                 // while condition:
    /f["'][^"']*\{/,                                    // f"string {var}"
    /\b(True|False|None)\b/,                            // Python booleans/None
    /\b(elif|except|finally|lambda|pass|raise|yield|with|as|async|await)\b/,  // Python keywords
    /if\s+__name__\s*==\s*['"]__main__['"]:/,           // if __name__ == "__main__":
    /^\s*@\w+/m,                                        // @decorator
    /:\s*$/m,                                           // Block ending with colon
    /\bself\b/,                                         // self reference
    /\b(len|str|int|float|bool|list|dict|tuple|set)\s*\(/,  // Python builtins
  ],
  // TypeScript - must come before JavaScript
  typescript: [
    /:\s*(string|number|boolean|any|void|unknown|never|object)\b/,
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
    /<\s*[A-Z]\w*(\s*,\s*[A-Z]\w*)*\s*>/,              // Simple generics
    /<\s*[A-Z]\w*\s+extends\s+/,                       // Generics with extends
    /as\s+(string|number|boolean|const|any)\b/,
    /(@Injectable|@Component|@Module|@Decorator)/,
    /\w+\s*:\s*\w+\s*[,)=]/,                           // Type annotations
    /\w+\?\s*:/,                                        // Optional properties
    /(public|private|protected|readonly)\s+\w+/,
    /function\s+\w+\s*</,                              // Generic functions
    /:\s*[A-Z]/,                                       // Type starting with capital
    /\):\s*\w+/,                                       // Return type annotation
    /\w+\[\]/,                                         // Array types like number[]
  ],
  javascript: [
    /^\s*function\s+\w+/m,
    /^\s*const\s+\w+\s*=/m,
    /^\s*let\s+\w+\s*=/m,
    /^\s*var\s+\w+\s*=/m,
    /=>\s*\{/,
    /=>\s*[^{]/,                                       // Arrow without braces
    /console\.(log|error|warn|info)/,
    /require\s*\(/,
    /module\.exports/,
    /export\s+(default|const|function|class)/,
    /import\s+.*\s+from\s+['"]/,                       // ES6 import
    /document\./,
    /window\./,
    /addEventListener\(/,
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
  
  // Ensure basic languages are present
  const ensureLanguage = (id: string, extensions: string[], aliases: string[]) => {
    if (!monacoLanguages.some(l => l.id === id)) {
      monacoLanguages.push({ id, extensions, aliases })
    }
  }
  
  ensureLanguage('typescript', ['.ts', '.tsx'], ['TypeScript', 'ts', 'typescript'])
  ensureLanguage('javascript', ['.js', '.jsx'], ['JavaScript', 'js', 'javascript'])
  ensureLanguage('python', ['.py'], ['Python', 'python'])
}

/**
 * Detect programming language from code content
 * Uses pattern matching with priority ordering
 */
export function detectLanguage (code: string): string {
  if (!code.trim()) return 'javascript'

  // Initialize if not already done
  if (monacoLanguages.length === 0) {
    initLanguageDetector()
  }

  // Score languages based on pattern matching
  const scores = new Map<string, number>()

  // Check patterns for each language
  for (const [langId, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
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

  // If Python has ANY matches, and it has more matches than others, use Python
  // Python patterns are distinctive enough
  const pythonScore = scores.get('python') || 0
  const tsScore = scores.get('typescript') || 0
  const jsScore = scores.get('javascript') || 0
  
  // Python wins if it has strong matches (>= 2) or if it has more than JS/TS
  if (pythonScore >= 2 || (pythonScore > 0 && pythonScore >= tsScore && pythonScore >= jsScore)) {
    return 'python'
  }

  // TypeScript vs JavaScript disambiguation
  if (tsScore > 0 && tsScore >= jsScore) {
    return 'typescript'
  }
  
  if (jsScore > 0) {
    return 'javascript'
  }

  // Find the language with the highest score from remaining
  let bestLanguage = 'javascript'
  let maxScore = 0

  for (const [langId, score] of scores.entries()) {
    if (score > maxScore) {
      maxScore = score
      bestLanguage = langId
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
 * JavaScript, TypeScript, and Python can be executed
 */
export function isLanguageExecutable (languageId: string): boolean {
  return languageId === 'javascript' || languageId === 'typescript' || languageId === 'python'
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

/**
 * Update Monaco model language - use this to sync Monaco with detected language
 */
export function setEditorLanguage (model: monaco.editor.ITextModel | null, languageId: string): void {
  if (model && !model.isDisposed()) {
    const currentLang = model.getLanguageId()
    if (currentLang !== languageId) {
      monaco.editor.setModelLanguage(model, languageId)
    }
  }
}
