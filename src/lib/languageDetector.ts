// Simple heuristic-based language detection
// This avoids the web-tree-sitter module issues

const PATTERNS = {
  python: [
    /^def\s+\w+\s*\(/m,
    /^class\s+\w+\s*:/m,
    /import\s+\w+/,
    /from\s+\w+\s+import/,
    /print\s*\(/
  ],
  html: [/<html/i, /<div/i, /<head/i, /<body/i, /<script/i, /<style/i],
  css: [/[.#]\w+\s*{/, /:\s*[\w-]+\s*;/, /@media/, /@keyframes/],
  json: [/^\s*{/, /^\s*\[/, /"[\w-]+"\s*:/],
  javascript: [
    /^function\s+\w+/m,
    /^const\s+\w+\s*=/m,
    /^let\s+\w+\s*=/m,
    /^var\s+\w+\s*=/m,
    /=>\s*{/,
    /console\.log/
  ],
  typescript: [
    /:\s*(string|number|boolean|any|void|unknown|never)/,
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
    /<[A-Z]\w*>/,
    /as\s+\w+/,
    /@Injectable/,
    /async\s+\w+\s*\([^)]*:\s*\w+/,
    /\w+\s*:\s*\w+\s*[,)]/
  ]
}

export async function initLanguageDetector () {
  // No initialization needed for heuristic approach
  return Promise.resolve()
}

export async function detectLanguage (code: string): Promise<string> {
  if (!code.trim()) return 'typescript'

  const scores: Record<string, number> = {
    python: 0,
    html: 0,
    css: 0,
    json: 0,
    javascript: 0,
    typescript: 0
  }

  // Check each language's patterns
  for (const [lang, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(code)) {
        scores[lang]++
      }
    }
  }

  // Find language with highest score
  let bestLang = 'typescript'
  let maxScore = 0

  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      bestLang = lang
    }
  }

  // If typescript and javascript have same score, prefer typescript
  if (scores.typescript === scores.javascript && scores.typescript > 0) {
    return 'typescript'
  }

  return bestLang
}
