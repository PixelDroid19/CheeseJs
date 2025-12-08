/**
 * Python Service
 *
 * Centralized service for Python support in CheeseJS:
 * - Language registration in Monaco
 * - Code execution via Pyodide
 * - Language detection
 */

import * as monaco from 'monaco-editor';
import { registerPythonLanguage, isPythonRegistered } from './pythonLanguage';

// ============================================================================
// TYPES
// ============================================================================

export interface PythonExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  debugValues?: Map<number, unknown>;
}

// ============================================================================
// PYTHON DETECTION
// ============================================================================

/**
 * Patterns that strongly indicate Python code
 */
const PYTHON_PATTERNS = [
  // Function/class definitions
  /^def\s+\w+\s*\(/m,
  /^class\s+\w+(\s*\(.*\))?:/m,

  // Python-specific syntax
  /\bfor\s+\w+\s+in\s+(range|enumerate|zip|iter)\s*\(/,
  /\bif\s+__name__\s*==\s*['"]__main__['"]\s*:/,
  /^\s*from\s+\w+\s+import\s+/m,
  /^\s*import\s+\w+/m,
  /\bprint\s*\(/,
  /\bself\./,
  /\bNone\b/,
  /\bTrue\b(?!\s*[,;)\]])/,
  /\bFalse\b(?!\s*[,;)\]])/,

  // Python decorators
  /^@\w+/m,

  // Python string prefixes
  /\bf["']/,
  /\br["']/,

  // Python comments
  /^\s*#(?!\?)/m,

  // Python comprehensions
  /\[\s*\w+\s+for\s+\w+\s+in\s+/,
  /\{\s*\w+\s*:\s*\w+\s+for\s+\w+\s+in\s+/,

  // Python specific keywords
  /\belif\s+/,
  /\bexcept\s+/,
  /\braise\s+/,
  /\byield\s+/,
  /\basync\s+def\s+/,
  /\bawait\s+/,
  /\bwith\s+.*\s+as\s+/,
  /\blambda\s+/,

  // Python type hints
  /\)\s*->\s*\w+\s*:/,
  /:\s*(int|str|float|bool|list|dict|tuple|set|None)\b/,
];

/**
 * Patterns that indicate NOT Python (JavaScript/TypeScript)
 */
const NON_PYTHON_PATTERNS = [
  // JavaScript specific
  /\bconst\s+\w+\s*=/,
  /\blet\s+\w+\s*=/,
  /\bvar\s+\w+\s*=/,
  /\bfunction\s+\w+\s*\(/, // function name( - clear JS
  /\bfunction\s*\(/, // function( - anonymous
  /=>/, // Arrow function
  /console\.log\s*\(/,
  /\bnew\s+\w+\(/,
  /\bthis\./,
  /\bimport\s+.*\s+from\s+['"][^'"]+['"]/,
  /\bexport\s+(default\s+)?/,
  /\binterface\s+\w+/,
  /\btype\s+\w+\s*=/,
  /\{\s*[\w,\s]+\s*\}/, // Destructuring (more common in JS)
  /===|!==/, // Strict equality (JS only)
  /\?\./, // Optional chaining
  /\?\?/, // Nullish coalescing
];

/**
 * Detect if code is Python
 */
export function isPythonCode(code: string): boolean {
  if (!code || code.trim().length === 0) return false;

  let pythonScore = 0;
  let jsScore = 0;

  // Check Python patterns
  for (const pattern of PYTHON_PATTERNS) {
    if (pattern.test(code)) {
      pythonScore += 2;
    }
  }

  // Check non-Python patterns
  for (const pattern of NON_PYTHON_PATTERNS) {
    if (pattern.test(code)) {
      jsScore += 2;
    }
  }

  // Additional heuristics

  // Indentation-based structure (Python uses : and indentation)
  if (/:\s*\n\s+\S/.test(code)) {
    pythonScore += 3;
  }

  // Semicolons at end of lines (more common in JS)
  const semicolonLines = (code.match(/;\s*$/gm) || []).length;
  const totalLines = code.split('\n').length;
  if (semicolonLines > totalLines * 0.3) {
    jsScore += 3;
  }

  // Curly braces for blocks (JS style)
  if (/\{\s*\n/.test(code) && /\n\s*\}/.test(code)) {
    jsScore += 2;
  }

  return pythonScore > jsScore && pythonScore >= 2;
}

/**
 * Get detected language as string
 */
export function detectLanguage(
  code: string
): 'python' | 'typescript' | 'javascript' {
  if (isPythonCode(code)) {
    return 'python';
  }

  // Check for TypeScript-specific patterns
  const tsPatterns = [
    /\binterface\s+\w+/,
    /\btype\s+\w+\s*=/,
    /:\s*(string|number|boolean|any|void|never|unknown)\b/,
    /<\w+>/, // Generics
    /as\s+(string|number|boolean|any|\w+)/, // Type assertions
  ];

  for (const pattern of tsPatterns) {
    if (pattern.test(code)) {
      return 'typescript';
    }
  }

  return 'typescript'; // Default to TypeScript
}

// ============================================================================
// MONACO INTEGRATION
// ============================================================================

/**
 * Initialize Python support in Monaco
 */
export function initializePythonSupport(monacoInstance: typeof monaco): void {
  if (!isPythonRegistered()) {
    registerPythonLanguage(monacoInstance);
  }
}

/**
 * Set editor model language based on code content
 */
export function updateEditorLanguage(
  editor: monaco.editor.IStandaloneCodeEditor,
  code: string
): string {
  const language = detectLanguage(code);
  const model = editor.getModel();

  if (model) {
    const currentLang = model.getLanguageId();
    if (currentLang !== language) {
      monaco.editor.setModelLanguage(model, language);
      console.log(`[Python] Language changed: ${currentLang} -> ${language}`);
    }
  }

  return language;
}

// ============================================================================
// EXPORT
// ============================================================================

export { registerPythonLanguage, isPythonRegistered };
