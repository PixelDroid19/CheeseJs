/**
 * Language Detection Patterns
 *
 * Regex patterns for detecting programming languages.
 * Used by both synchronous heuristic detection and as a fallback for ML detection.
 */

// ============================================================================
// DEFINITIVE PATTERNS (Highest Priority)
// These patterns are UNIQUE to their language - no ambiguity
// ============================================================================

/**
 * DEFINITIVE Python patterns - these ONLY exist in Python, not JS/TS
 * If matched, immediately return Python without scoring
 */
export const DEFINITIVE_PYTHON_PATTERNS: RegExp[] = [
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
export const DEFINITIVE_JS_PATTERNS: RegExp[] = [
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
];

/**
 * DEFINITIVE TypeScript patterns - these ONLY exist in TypeScript, not plain JS
 * If matched, return TypeScript (higher priority than JS)
 */
export const DEFINITIVE_TS_PATTERNS: RegExp[] = [
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

// ============================================================================
// WEIGHTED PATTERNS (for scoring-based detection)
// ============================================================================

export const PYTHON_PATTERNS: Array<[RegExp, number]> = [
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

export const TYPESCRIPT_PATTERNS: Array<[RegExp, number]> = [
    [/:\s*(string|number|boolean|any|void|unknown|never)\b/, 3],
    [/interface\s+\w+/, 3],
    [/type\s+\w+\s*=/, 3],
    [/<\w+>/, 2],
    [/as\s+(string|number|boolean|const)/, 2],
    [/\w+\?\s*:/, 2],
    [/(public|private|protected|readonly)\s+\w+/, 2],
];

export const JAVASCRIPT_PATTERNS: Array<[RegExp, number]> = [
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
