/**
 * Executor Module Index
 * 
 * Exports all executor-related types and implementations for
 * a clean, modular language execution architecture.
 */

// Types and interfaces
export * from './types.js'

// Registry
export { getExecutorRegistry, ExecutorRegistry } from './registry.js'

// Transformers
export {
  JavaScriptTransformer,
  TypeScriptTransformer,
  createJSTransformer,
  createTSTransformer,
} from './jsTransformer.js'

// ============================================================================
// LANGUAGE DETECTION HELPERS
// ============================================================================

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from './types.js'

/**
 * Map Monaco editor language IDs to supported languages
 */
export function mapMonacoLanguage(monacoLang: string): SupportedLanguage | null {
  const mapping: Record<string, SupportedLanguage> = {
    'javascript': SUPPORTED_LANGUAGES.JAVASCRIPT,
    'typescript': SUPPORTED_LANGUAGES.TYPESCRIPT,
    'typescriptreact': SUPPORTED_LANGUAGES.TYPESCRIPT, // TSX
    'javascriptreact': SUPPORTED_LANGUAGES.JAVASCRIPT, // JSX
    'python': SUPPORTED_LANGUAGES.PYTHON,
  }
  
  return mapping[monacoLang] ?? null
}

/**
 * Get default transform options for a language
 */
export function getDefaultTransformOptions(language: SupportedLanguage) {
  const baseOptions = {
    showTopLevelResults: true,
    loopProtection: true,
    magicComments: false,
    showUndefined: false,
    targetVersion: 'ES2024' as const,
  }
  
  switch (language) {
    case SUPPORTED_LANGUAGES.JAVASCRIPT:
      return {
        ...baseOptions,
        experimentalDecorators: false,  // JS typically doesn't use legacy decorators
        jsx: true,
      }
      
    case SUPPORTED_LANGUAGES.TYPESCRIPT:
      return {
        ...baseOptions,
        experimentalDecorators: true,   // TS often uses decorators
        jsx: true,
      }
      
    case SUPPORTED_LANGUAGES.PYTHON:
      return {
        ...baseOptions,
        // Python doesn't use these options but we keep the interface consistent
        experimentalDecorators: false,
        jsx: false,
      }
      
    default:
      return baseOptions
  }
}

/**
 * Check if code is likely TypeScript (vs JavaScript)
 * Based on TypeScript-specific syntax patterns
 */
export function isLikelyTypeScript(code: string): boolean {
  // TypeScript-specific patterns
  const tsPatterns = [
    /:\s*(string|number|boolean|any|void|never|unknown)\b/,  // Type annotations
    /interface\s+\w+/,                                        // Interface declarations
    /type\s+\w+\s*=/,                                        // Type aliases
    /<\w+>/,                                                 // Generic parameters
    /as\s+(string|number|boolean|any|const)\b/,              // Type assertions
    /\w+\s*\?\s*:/,                                          // Optional properties
    /readonly\s+\w+/,                                        // Readonly modifier
    /enum\s+\w+/,                                            // Enum declarations
    /namespace\s+\w+/,                                       // Namespace declarations
    /declare\s+(const|let|var|function|class)/,              // Declare statements
    /implements\s+\w+/,                                       // Implements clause
    /abstract\s+(class|method)/,                              // Abstract classes
    /public\s+\w+|private\s+\w+|protected\s+\w+/,            // Access modifiers
  ]
  
  return tsPatterns.some(pattern => pattern.test(code))
}

/**
 * Detect language from code content
 */
export function detectLanguageFromCode(code: string): SupportedLanguage {
  // Check for Python patterns first (more distinctive)
  const pythonPatterns = [
    /^def\s+\w+\s*\(/m,           // Function definition
    /^class\s+\w+.*:/m,           // Class definition
    /^import\s+\w+/m,             // Import without from
    /^from\s+\w+\s+import/m,      // From import
    /:\s*$/m,                     // Colon at end of line (block)
    /print\s*\(/,                 // Print function
    /^\s*#.*$/m,                  // Python comments
    /True|False|None\b/,          // Python booleans/None
    /self\./,                     // Self reference
    /__init__/,                   // Constructor
  ]
  
  const pythonScore = pythonPatterns.filter(p => p.test(code)).length
  if (pythonScore >= 2) {
    return SUPPORTED_LANGUAGES.PYTHON
  }
  
  // Check for TypeScript vs JavaScript
  if (isLikelyTypeScript(code)) {
    return SUPPORTED_LANGUAGES.TYPESCRIPT
  }
  
  // Default to JavaScript
  return SUPPORTED_LANGUAGES.JAVASCRIPT
}
