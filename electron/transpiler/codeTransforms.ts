/**
 * Shared Code Transforms
 *
 * Common code transformation utilities used by both TypeScript and SWC transpilers.
 * This module extracts duplicated logic to maintain DRY principles.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TransformOptions {
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
  magicComments?: boolean;
  showUndefined?: boolean;
  /** Target ECMAScript version */
  targetVersion?: 'ES2022' | 'ES2024' | 'ESNext';
  /** Enable experimental decorators (legacy) or use modern decorators */
  experimentalDecorators?: boolean;
  /** Enable JSX parsing */
  jsx?: boolean;
  /** Debug function name to use (default: 'debug') */
  debugFunctionName?: string;
  /** Enable using declarations (explicit resource management) */
  usingDeclarations?: boolean;
}

// ============================================================================
// PARENTHESIS MATCHING
// ============================================================================

/**
 * Find the matching closing parenthesis
 * Handles nested parentheses and string literals
 */
export function findMatchingParen(code: string, startIndex: number): number {
  let depth = 1;
  let i = startIndex;

  while (i < code.length && depth > 0) {
    const char = code[i];

    // Check for comments first
    if (char === '/') {
      const nextChar = code[i + 1];
      if (nextChar === '/') {
        // Single line comment: skip until newline or end of string
        i += 2;
        while (i < code.length && code[i] !== '\n') {
          i++;
        }
        continue;
      } else if (nextChar === '*') {
        // Block comment: skip until */
        i += 2;
        while (i < code.length - 1) {
          if (code[i] === '*' && code[i + 1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }
    }

    if (char === '(') depth++;
    else if (char === ')') depth--;

    // Skip string literals
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++; // Skip escaped chars
        i++;
      }
    }
    i++;
  }

  return depth === 0 ? i - 1 : -1;
}

// ============================================================================
// CONSOLE TO DEBUG TRANSFORMATION
// ============================================================================

/**
 * Transform
 * Uses a parser-based approach to handle nested parentheses
 */
export function transformConsoleTodebug(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineNumber = i + 1;

    // Pattern to find console.xxx( start positions
    const consoleStartRegex = /\bconsole\.(log|warn|error|info|debug)\s*\(/g;
    let match;
    let offset = 0;

    while ((match = consoleStartRegex.exec(lines[i])) !== null) {
      const fullMatchStart = match.index + offset;
      const openParenPos = fullMatchStart + match[0].length - 1;

      // Find the matching close paren in the current line
      const closeParenPos = findMatchingParen(line, openParenPos + 1);

      if (closeParenPos !== -1) {
        const args = line.slice(openParenPos + 1, closeParenPos).trim();
        const before = line.slice(0, fullMatchStart);
        const after = line.slice(closeParenPos + 1);

        let replacement;
        // Check if args is effectively empty (only comments/whitespace)
        const strippedArgs = args
          .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
          .trim();

        if (strippedArgs === '') {
          replacement = `debug(${lineNumber})`;
        } else {
          replacement = `debug(${lineNumber}, ${args})`;
        }

        line = before + replacement + after;
        offset += replacement.length - (closeParenPos + 1 - fullMatchStart);
      }
    }

    result.push(line);
  }

  return result.join('\n');
}

// ============================================================================
// LOOP PROTECTION
// ============================================================================

/**
 * Add loop protection to prevent infinite loops
 * Includes cancellation checkpoints for cooperative cancellation
 */
export function addLoopProtection(
  code: string,
  options: {
    maxIterations?: number;
    cancellationCheckInterval?: number;
    includeCancellationCheck?: boolean;
  } = {}
): string {
  const {
    maxIterations = 10000,
    cancellationCheckInterval = 100,
    includeCancellationCheck = true,
  } = options;

  let loopCounter = 0;

  // Match while, for, do-while loops
  const loopPattern = /(while\s*\([^)]*\)\s*\{|for\s*\([^)]*\)\s*\{|do\s*\{)/g;

  return code.replace(loopPattern, (match) => {
    const counterVar = `__loopCounter${loopCounter++}`;

    let checkCode = `let ${counterVar} = 0;
if (++${counterVar} > ${maxIterations}) throw new Error("Loop limit exceeded (${maxIterations} iterations)");`;

    // Add cancellation checkpoint if enabled
    if (includeCancellationCheck) {
      checkCode += `
if (${counterVar} % ${cancellationCheckInterval} === 0 && typeof __checkCancellation__ !== 'undefined' && __checkCancellation__()) throw new Error("Execution cancelled");`;
    }

    // Insert the check after the opening brace
    const braceIndex = match.lastIndexOf('{');
    return match.slice(0, braceIndex + 1) + '\n' + checkCode + '\n';
  });
}

// ============================================================================
// EXPRESSION WRAPPING
// ============================================================================

/**
 * Patterns that should be skipped when wrapping top-level expressions
 */
const SKIP_PATTERNS = [
  'import ',
  'export ',
  'const ',
  'let ',
  'var ',
  'function ',
  'async ',
  'class ',
  'interface ',
  'type ',
  'enum ',
  'if ',
  'if(',
  'else ',
  'else{',
  'for ',
  'for(',
  'while ',
  'while(',
  'switch ',
  'try ',
  'try{',
  'catch ',
  'catch(',
  'finally ',
  'finally{',
  'return ',
  'return;',
  'throw ',
  'break',
  'continue',
  '{',
  '}',
  '});',
  ']);',
  ']',
  '[',
  '(',
  ')',
  'debug(',
  'await debug(',
  'yield ',
  '.',
  '//',
  '/*',
  '*',
];

/**
 * Check if a line should be skipped based on skip patterns
 */
function shouldSkipLine(trimmed: string): boolean {
  // Skip empty lines
  if (!trimmed) return true;

  // Check skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (trimmed.startsWith(pattern)) return true;
  }

  // Skip closing brackets with just semicolons
  if (/^[\])}]+;?$/.test(trimmed)) return true;

  // Skip lines that are just commas or array/object continuations
  if (/^[,\]})]+$/.test(trimmed)) return true;

  return false;
}

/**
 * Count brace depth change in a line (considering strings and template literals)
 * Returns the net change in depth for the line
 */
function countBraceDepthChange(
  line: string,
  currentInsideTemplateLiteral: boolean
): { depthChange: number; insideTemplateLiteral: boolean } {
  let depthChange = 0;
  let insideTemplateLiteral = currentInsideTemplateLiteral;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    // Skip escaped characters
    if (char === '\\' && i + 1 < line.length) {
      i += 2;
      continue;
    }

    // Handle template literals
    if (char === '`') {
      insideTemplateLiteral = !insideTemplateLiteral;
      i++;
      continue;
    }

    // Skip content inside template literals
    if (insideTemplateLiteral) {
      i++;
      continue;
    }

    // Skip regular strings
    if (char === '"' || char === "'") {
      const quote = char;
      i++;
      while (i < line.length) {
        if (line[i] === '\\' && i + 1 < line.length) {
          i += 2;
          continue;
        }
        if (line[i] === quote) {
          break;
        }
        i++;
      }
      i++;
      continue;
    }

    // Count braces
    if (char === '{') {
      depthChange++;
    } else if (char === '}') {
      depthChange--;
    }

    i++;
  }

  return { depthChange, insideTemplateLiteral };
}

/**
 * Wrap top-level expressions in debug calls
 */
export function wrapTopLevelExpressions(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];
  let insideTemplateLiteral = false;
  let braceDepth = 0; // Track nesting level

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNumber = i + 1;

    // Track if we're inside a multi-line template literal
    const wasInsideTemplateLiteral = insideTemplateLiteral;

    // Calculate brace depth change for this line
    const { depthChange, insideTemplateLiteral: newInsideTemplateLiteral } =
      countBraceDepthChange(line, insideTemplateLiteral);
    insideTemplateLiteral = newInsideTemplateLiteral;

    // Update brace depth BEFORE processing (to handle lines that open a block)
    const depthAtLineStart = braceDepth;
    braceDepth += depthChange;

    // Skip if we were inside a template literal at the start of this line
    if (wasInsideTemplateLiteral) {
      result.push(line);
      continue;
    }

    // Skip if not at top level (inside a function, class, etc.)
    if (depthAtLineStart > 0) {
      result.push(line);
      continue;
    }

    // Skip lines based on patterns
    if (shouldSkipLine(trimmed)) {
      result.push(line);
      continue;
    }

    // Skip if it's an assignment
    if (
      /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/.test(trimmed) &&
      !trimmed.startsWith('==')
    ) {
      result.push(line);
      continue;
    }

    // Check if next line starts with . (method chaining) - don't wrap this line
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
    if (nextLine.startsWith('.')) {
      result.push(line);
      continue;
    }

    // Skip if this line starts a template literal that continues to the next line
    if (insideTemplateLiteral) {
      result.push(line);
      continue;
    }

    // Skip if this line changes depth (opens or closes a block)
    if (depthChange !== 0) {
      result.push(line);
      continue;
    }

    // Wrap simple expressions that end with semicolon on a single line
    if (
      trimmed.endsWith(';') &&
      !trimmed.includes('.then(') &&
      !trimmed.includes('.catch(')
    ) {
      const expr = trimmed.slice(0, -1);
      const indent = line.match(/^\s*/)?.[0] || '';
      result.push(`${indent}debug(${lineNumber}, ${expr});`);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

// ============================================================================
// MAGIC COMMENTS
// ============================================================================

/**
 * Apply magic comments (//?  or //?) to inject debug calls
 * This must run BEFORE TypeScript transpilation since TS removes comments
 */
export function applyMagicComments(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for magic comment: //? or //?
    const magicMatch = line.match(/(.+?)\/\/\?\s*(.*)$/);

    if (magicMatch) {
      const codePart = magicMatch[1].trim();

      // Check if it's a variable declaration: const/let/var x = value //?
      const varMatch = codePart.match(
        /^(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+?);?\s*$/
      );

      if (varMatch) {
        const [, keyword, varName, value] = varMatch;
        // Output: const x = value; debug(line, x);
        result.push(`${keyword} ${varName} = ${value};`);
        result.push(`debug(${lineNumber}, ${varName});`);
      } else {
        // For expressions: expr //? -> debug(line, expr)
        const exprMatch = codePart.match(/^(.+?);?\s*$/);
        if (exprMatch) {
          const expr = exprMatch[1];
          result.push(`debug(${lineNumber}, ${expr});`);
        } else {
          result.push(line);
        }
      }
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

// ============================================================================
// FULL TRANSFORM PIPELINE
// ============================================================================

/**
 * Apply all code transformations after transpilation
 */
export function applyCodeTransforms(
  code: string,
  options: TransformOptions = {}
): string {
  let transformed = code;

  // Transform console calls to debug
  transformed = transformConsoleTodebug(transformed);

  // Apply loop protection if enabled
  if (options.loopProtection) {
    transformed = addLoopProtection(transformed);
  }

  // Apply expression wrapping if enabled
  if (options.showTopLevelResults !== false) {
    transformed = wrapTopLevelExpressions(transformed);
  }

  return transformed;
}
