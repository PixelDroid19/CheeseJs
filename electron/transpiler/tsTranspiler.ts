/**
 * TypeScript-based Code Transpiler
 * 
 * Provides TypeScript/JSX transpilation using the TypeScript Compiler API
 * for code transformations (debug injection, loop protection, etc.)
 * 
 * Supports:
 * - ES2024/2025 features (Iterator helpers, Set methods, Promise.withResolvers)
 * - TypeScript 5.8+ features (granular return checks, erasable syntax)
 * - Modern decorators (Stage 3 - 2022-03)
 * - JSX/TSX support
 */

import ts from 'typescript'

export interface TransformOptions {
  showTopLevelResults?: boolean
  loopProtection?: boolean
  magicComments?: boolean
  showUndefined?: boolean
  /** Target ECMAScript version */
  targetVersion?: 'ES2022' | 'ES2024' | 'ESNext'
  /** Enable experimental decorators (legacy) or use modern decorators */
  experimentalDecorators?: boolean
  /** Enable JSX parsing */
  jsx?: boolean
}

/**
 * Get TypeScript compiler options for modern ECMAScript
 * 
 * TypeScript 5.8+ Features:
 * - Import attributes (with { type: 'json' }) - requires moduleResolution: NodeNext
 * - Granular return type checks
 * - Erasable syntax for type-only constructs
 */
function getCompilerOptions(options?: TransformOptions): ts.CompilerOptions {
  // Use ES2022 as base since TypeScript doesn't have ES2024 target yet
  // Node.js 22+ supports ES2024 features natively
  const target = options?.targetVersion === 'ESNext' 
    ? ts.ScriptTarget.ESNext 
    : ts.ScriptTarget.ES2022

  return {
    // Module system - CommonJS for require() support in worker sandbox
    module: ts.ModuleKind.CommonJS,
    // Enable Node16/NodeNext module resolution for import attributes support
    // This allows: import data from './data.json' with { type: 'json' }
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target,
    jsx: options?.jsx !== false ? ts.JsxEmit.React : ts.JsxEmit.None,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    // Import attributes support (TypeScript 5.3+)
    // Allows: import attributes in static/dynamic imports
    resolveJsonModule: true,
    // Decorators
    experimentalDecorators: options?.experimentalDecorators ?? true,
    emitDecoratorMetadata: false,
    useDefineForClassFields: true,  // Modern class fields behavior
    strict: false,
    skipLibCheck: true,
    noEmit: false,
    sourceMap: false,
    // Modern features support
    downlevelIteration: true,  // Support for iterators
    importHelpers: false,      // Don't require tslib
    // Verbatim module syntax for cleaner ESM/CJS interop (TS 5.0+)
    verbatimModuleSyntax: false,  // Keep false for CJS output compatibility
    // Allow importing from .ts extensions directly
    allowImportingTsExtensions: false,
  }
}

/**
 * Transform code using TypeScript Compiler
 */
export function transpileWithTypeScript(code: string, options?: TransformOptions): string {
  const compilerOptions = getCompilerOptions(options)
  
  const result = ts.transpileModule(code, {
    compilerOptions,
    fileName: 'index.tsx'
  })

  return result.outputText
}

/**
 * Simple regex-based transformations for code injection
 * These run after TypeScript transpilation
 */
export function applyCodeTransforms(
  code: string,
  options: TransformOptions = {}
): string {
  let transformed = code

  // Apply console.log -> debug transformation
  transformed = transformConsoleTodebug(transformed)

  // Apply loop protection if enabled
  if (options.loopProtection) {
    transformed = addLoopProtection(transformed)
  }

  // Apply stray expression wrapping if enabled
  if (options.showTopLevelResults !== false) {
    transformed = wrapTopLevelExpressions(transformed)
  }

  return transformed
}

/**
 * Find the matching closing parenthesis
 */
function findMatchingParen(code: string, startIndex: number): number {
  let depth = 1
  let i = startIndex
  
  while (i < code.length && depth > 0) {
    const char = code[i]
    if (char === '(') depth++
    else if (char === ')') depth--
    
    // Skip string literals
    if (char === '"' || char === "'" || char === '`') {
      const quote = char
      i++
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++ // Skip escaped chars
        i++
      }
    }
    i++
  }
  
  return depth === 0 ? i - 1 : -1
}

/**
 * Transform console.log/warn/error/info calls to debug calls
 * Uses a parser-based approach to handle nested parentheses
 */
function transformConsoleTodebug(code: string): string {
  const lines = code.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    const lineNumber = i + 1
    
    // Pattern to find console.xxx( start positions
    const consoleStartRegex = /\bconsole\.(log|warn|error|info|debug)\s*\(/g
    let match
    let offset = 0
    
    while ((match = consoleStartRegex.exec(lines[i])) !== null) {
      const fullMatchStart = match.index + offset
      const openParenPos = fullMatchStart + match[0].length - 1
      
      // Find the matching close paren in the current line
      const closeParenPos = findMatchingParen(line, openParenPos + 1)
      
      if (closeParenPos !== -1) {
        const args = line.slice(openParenPos + 1, closeParenPos).trim()
        const before = line.slice(0, fullMatchStart)
        const after = line.slice(closeParenPos + 1)
        
        let replacement
        if (args === '') {
          replacement = `debug(${lineNumber})`
        } else {
          replacement = `debug(${lineNumber}, ${args})`
        }
        
        line = before + replacement + after
        offset += replacement.length - (closeParenPos + 1 - fullMatchStart)
      }
    }
    
    result.push(line)
  }

  return result.join('\n')
}

/**
 * Add loop protection to prevent infinite loops
 * Includes cancellation checkpoints for cooperative cancellation
 */
function addLoopProtection(code: string): string {
  const MAX_ITERATIONS = 10000
  const CANCELLATION_CHECK_INTERVAL = 100 // Check for cancellation every 100 iterations
  let loopCounter = 0

  // Match while, for, do-while loops
  const loopPattern = /(while\s*\([^)]*\)\s*\{|for\s*\([^)]*\)\s*\{|do\s*\{)/g

  return code.replace(loopPattern, (match) => {
    const counterVar = `__loopCounter${loopCounter++}`
    // Combined check: loop limit + cancellation checkpoint
    const checkCode = `let ${counterVar} = 0; 
if (++${counterVar} > ${MAX_ITERATIONS}) throw new Error("Loop limit exceeded (${MAX_ITERATIONS} iterations)"); 
if (${counterVar} % ${CANCELLATION_CHECK_INTERVAL} === 0 && typeof __checkCancellation__ !== 'undefined' && __checkCancellation__()) throw new Error("Execution cancelled"); `
    
    // Insert the check after the opening brace
    const braceIndex = match.lastIndexOf('{')
    return match.slice(0, braceIndex + 1) + '\n' + checkCode + '\n'
  })
}

/**
 * Wrap top-level expressions in debug calls
 */
function wrapTopLevelExpressions(code: string): string {
  const lines = code.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const lineNumber = i + 1

    // Skip empty lines, comments, declarations, and structural elements
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import ') ||
      trimmed.startsWith('export ') ||
      trimmed.startsWith('const ') ||
      trimmed.startsWith('let ') ||
      trimmed.startsWith('var ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('async ') ||
      trimmed.startsWith('class ') ||
      trimmed.startsWith('interface ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('enum ') ||
      trimmed.startsWith('if ') ||
      trimmed.startsWith('if(') ||
      trimmed.startsWith('else ') ||
      trimmed.startsWith('else{') ||
      trimmed.startsWith('for ') ||
      trimmed.startsWith('for(') ||
      trimmed.startsWith('while ') ||
      trimmed.startsWith('while(') ||
      trimmed.startsWith('switch ') ||
      trimmed.startsWith('try ') ||
      trimmed.startsWith('try{') ||
      trimmed.startsWith('catch ') ||
      trimmed.startsWith('catch(') ||
      trimmed.startsWith('finally ') ||
      trimmed.startsWith('finally{') ||
      trimmed.startsWith('return ') ||
      trimmed.startsWith('return;') ||
      trimmed.startsWith('throw ') ||
      trimmed.startsWith('break') ||
      trimmed.startsWith('continue') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('}') ||
      trimmed.startsWith('});') ||
      trimmed.startsWith(']);') ||
      trimmed.startsWith(']') ||
      trimmed.startsWith('[') ||
      trimmed.startsWith('(') ||
      trimmed.startsWith(')') ||
      trimmed.startsWith('debug(') ||
      trimmed.startsWith('await debug(') ||
      trimmed.startsWith('yield ') ||
      // Skip method chaining (lines starting with .)
      trimmed.startsWith('.') ||
      // Skip closing brackets with just semicolons
      /^[\]\)\}]+;?$/.test(trimmed) ||
      // Skip lines that are just commas or array/object continuations
      /^[,\]\}\)]+$/.test(trimmed)
    ) {
      result.push(line)
      continue
    }

    // Skip if it's an assignment
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/.test(trimmed) && !trimmed.startsWith('==')) {
      result.push(line)
      continue
    }

    // Check if next line starts with . (method chaining) - don't wrap this line
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (nextLine.startsWith('.')) {
      result.push(line)
      continue
    }

    // Wrap simple expressions that end with semicolon on a single line
    if (trimmed.endsWith(';') && !trimmed.includes('.then(') && !trimmed.includes('.catch(')) {
      const expr = trimmed.slice(0, -1)
      const indent = line.match(/^\s*/)?.[0] || ''
      result.push(`${indent}debug(${lineNumber}, ${expr});`)
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

/**
 * Full transform pipeline
 */
export function transformCode(
  code: string,
  options: TransformOptions = {}
): string {
  if (!code.trim()) return ''

  console.log('[tsTranspiler] transformCode called with options:', options)
  console.log('[tsTranspiler] magicComments enabled:', options.magicComments)

  try {
    // Step 1: Apply magic comments BEFORE transpilation (they get removed by TS)
    let processedCode = code
    if (options.magicComments) {
      console.log('[tsTranspiler] Applying magic comments...')
      console.log('[tsTranspiler] Original code:', code)
      processedCode = applyMagicComments(code)
      console.log('[tsTranspiler] After magic comments:', processedCode)
    }

    // Step 2: Transpile TS/JSX with TypeScript (passing options for ES target)
    const transpiled = transpileWithTypeScript(processedCode, options)
    console.log('[tsTranspiler] After TS transpilation:', transpiled)

    // Step 3: Apply other code transformations
    const transformed = applyCodeTransforms(transpiled, options)
    console.log('[tsTranspiler] Final transformed code:', transformed)

    return transformed
  } catch (error) {
    // If transpilation fails, try to apply transforms to original code
    console.error('Transpilation error:', error)
    return applyCodeTransforms(code, options)
  }
}

/**
 * Apply magic comments (//?  or //?) to inject debug calls
 * This must run BEFORE TypeScript transpilation since TS removes comments
 */
function applyMagicComments(code: string): string {
  const lines = code.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1
    
    // Check for magic comment: //? or //?
    const magicMatch = line.match(/(.+?)\/\/\?\s*(.*)$/)
    
    if (magicMatch) {
      const codePart = magicMatch[1].trim()
      
      // Check if it's a variable declaration: const/let/var x = value //?
      const varMatch = codePart.match(/^(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+?);?\s*$/)
      
      if (varMatch) {
        const [, keyword, varName, value] = varMatch
        // Output: const x = value; debug(line, x);
        result.push(`${keyword} ${varName} = ${value};`)
        result.push(`debug(${lineNumber}, ${varName});`)
      } else {
        // For expressions: expr //? -> debug(line, expr)
        const exprMatch = codePart.match(/^(.+?);?\s*$/)
        if (exprMatch) {
          const expr = exprMatch[1]
          result.push(`debug(${lineNumber}, ${expr});`)
        } else {
          result.push(line)
        }
      }
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}
