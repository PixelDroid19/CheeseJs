/**
 * JavaScript/TypeScript Transformer
 * 
 * Modern transformer supporting ES2024/2025 features:
 * - Iterator helpers (ES2025)
 * - Set methods (ES2025)
 * - Promise.withResolvers (ES2024)
 * - Object/Map.groupBy (ES2024)
 * - RegExp v flag (ES2024)
 * - Float16Array (ES2025)
 * - Decorators (Stage 3)
 * - Import attributes
 */

import ts from 'typescript'
import type { 
  LanguageTransformer, 
  SupportedLanguage, 
  TransformOptions,
} from './types.js'

// ============================================================================
// TYPESCRIPT COMPILER OPTIONS FOR MODERN JS/TS
// ============================================================================

/**
 * Get TypeScript compiler options for modern ECMAScript support
 */
function getCompilerOptions(options: TransformOptions): ts.CompilerOptions {
  const target = options.targetVersion === 'ESNext' 
    ? ts.ScriptTarget.ESNext 
    : ts.ScriptTarget.ES2022  // Use ES2022 as base, Node.js 22+ supports ES2024
  
  return {
    module: ts.ModuleKind.CommonJS, // CommonJS for require() support in sandbox
    target,
    jsx: options.jsx !== false ? ts.JsxEmit.React : ts.JsxEmit.None,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    experimentalDecorators: options.experimentalDecorators ?? true,
    emitDecoratorMetadata: false,
    useDefineForClassFields: true,
    strict: false,
    skipLibCheck: true,
    noEmit: false,
    sourceMap: false,
    // Modern features
    downlevelIteration: true,  // Support for iterators in older targets
    importHelpers: false,      // Don't require tslib
    // Allow modern syntax
    lib: ['ES2022', 'ESNext'],
  }
}

// ============================================================================
// CODE TRANSFORMATION UTILITIES
// ============================================================================

/**
 * Find matching closing parenthesis
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
        if (code[i] === '\\') i++
        i++
      }
    }
    i++
  }
  
  return depth === 0 ? i - 1 : -1
}

/**
 * Transform console.log/warn/error/info to debug() calls
 */
function transformConsoleToDebug(code: string): string {
  const lines = code.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    const lineNumber = i + 1
    
    const consoleStartRegex = /\bconsole\.(log|warn|error|info|debug)\s*\(/g
    let match
    let offset = 0
    
    while ((match = consoleStartRegex.exec(lines[i])) !== null) {
      const fullMatchStart = match.index + offset
      const openParenPos = fullMatchStart + match[0].length - 1
      
      const closeParenPos = findMatchingParen(line, openParenPos + 1)
      
      if (closeParenPos !== -1) {
        const args = line.slice(openParenPos + 1, closeParenPos).trim()
        const before = line.slice(0, fullMatchStart)
        const after = line.slice(closeParenPos + 1)
        
        const replacement = args === '' 
          ? `debug(${lineNumber})`
          : `debug(${lineNumber}, ${args})`
        
        line = before + replacement + after
        offset += replacement.length - (closeParenPos + 1 - fullMatchStart)
      }
    }
    
    result.push(line)
  }

  return result.join('\n')
}

/**
 * Add loop protection with cancellation checkpoints
 */
function addLoopProtection(code: string): string {
  const MAX_ITERATIONS = 10000
  const CANCELLATION_CHECK_INTERVAL = 100
  let loopCounter = 0

  const loopPattern = /(while\s*\([^)]*\)\s*\{|for\s*\([^)]*\)\s*\{|do\s*\{)/g

  return code.replace(loopPattern, (match) => {
    const counterVar = `__loopCounter${loopCounter++}`
    const checkCode = `let ${counterVar} = 0; 
if (++${counterVar} > ${MAX_ITERATIONS}) throw new Error("Loop limit exceeded (${MAX_ITERATIONS} iterations)"); 
if (${counterVar} % ${CANCELLATION_CHECK_INTERVAL} === 0 && typeof __checkCancellation__ !== 'undefined' && __checkCancellation__()) throw new Error("Execution cancelled"); `
    
    const braceIndex = match.lastIndexOf('{')
    return match.slice(0, braceIndex + 1) + '\n' + checkCode + '\n'
  })
}

/**
 * Wrap top-level expressions with debug()
 */
function wrapTopLevelExpressions(code: string): string {
  const lines = code.split('\n')
  const result: string[] = []

  // Patterns to skip
  const skipPatterns = [
    /^$/,                        // Empty
    /^\/\//,                     // Single-line comment
    /^\/\*/,                     // Multi-line comment start
    /^\*/,                       // Multi-line comment body
    /^import\s/,                 // Import
    /^export\s/,                 // Export
    /^(const|let|var)\s/,        // Variable declarations
    /^(function|async\s+function)\s/, // Function declarations
    /^class\s/,                  // Class declarations
    /^(interface|type|enum)\s/,  // TypeScript declarations
    /^(if|else|for|while|switch|try|catch|finally|do)\s*[({]/,
    /^(return|throw|break|continue|yield)[\s;]/,
    /^[{}()[\]]/,                // Brackets
    /^[,\]})]+ ?;?$/,            // Closing brackets
    /^debug\(/,                  // Already wrapped
    /^await\s+debug\(/,          // Already wrapped with await
    /^\./,                       // Method chaining
    /^using\s/,                  // Using declarations (ES2024+)
    /^await\s+using\s/,          // Async using declarations
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const lineNumber = i + 1

    // Check skip patterns
    if (skipPatterns.some(pattern => pattern.test(trimmed))) {
      result.push(line)
      continue
    }

    // Skip assignments (but not == or ===)
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/.test(trimmed) && !trimmed.startsWith('==')) {
      result.push(line)
      continue
    }

    // Check if next line starts with . (method chaining)
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (nextLine.startsWith('.')) {
      result.push(line)
      continue
    }

    // Wrap expressions ending with semicolon
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
 * Apply magic comments (//?) for debug output
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
      
      // Variable declaration: const/let/var x = value //?
      const varMatch = codePart.match(/^(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+?);?\s*$/)
      
      if (varMatch) {
        const [, keyword, varName, value] = varMatch
        result.push(`${keyword} ${varName} = ${value};`)
        result.push(`debug(${lineNumber}, ${varName});`)
      } else {
        // Expression: expr //? -> debug(line, expr)
        const exprMatch = codePart.match(/^(.+?);?\s*$/)
        if (exprMatch) {
          result.push(`debug(${lineNumber}, ${exprMatch[1]});`)
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

// ============================================================================
// JAVASCRIPT/TYPESCRIPT TRANSFORMER
// ============================================================================

/**
 * JavaScript transformer implementation
 */
export class JavaScriptTransformer implements LanguageTransformer {
  readonly language: SupportedLanguage = 'javascript'
  
  transform(code: string, options: TransformOptions): string {
    if (!code.trim()) return ''

    try {
      // Step 1: Apply magic comments BEFORE transpilation
      let processedCode = code
      if (options.magicComments) {
        processedCode = applyMagicComments(code)
      }

      // Step 2: Transpile with TypeScript (handles modern JS too)
      const transpiled = this.transpile(processedCode, options)

      // Step 3: Apply code transformations
      let transformed = transformConsoleToDebug(transpiled)
      
      if (options.loopProtection) {
        transformed = addLoopProtection(transformed)
      }
      
      if (options.showTopLevelResults !== false) {
        transformed = wrapTopLevelExpressions(transformed)
      }

      return transformed
    } catch (error) {
      console.error('[JSTransformer] Error:', error)
      // Fallback: apply transforms to original code
      let transformed = transformConsoleToDebug(code)
      if (options.loopProtection) {
        transformed = addLoopProtection(transformed)
      }
      return transformed
    }
  }
  
  private transpile(code: string, options: TransformOptions): string {
    const compilerOptions = getCompilerOptions(options)
    
    const result = ts.transpileModule(code, {
      compilerOptions,
      fileName: 'index.js'
    })
    
    return result.outputText
  }
  
  validateSyntax(code: string): { valid: boolean; error?: string } {
    try {
      const sourceFile = ts.createSourceFile(
        'temp.js',
        code,
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.JS
      )
      
      // Check for parse errors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagnostics = (sourceFile as any).parseDiagnostics || []
      if (diagnostics.length > 0) {
        return {
          valid: false,
          error: diagnostics[0].messageText as string
        }
      }
      
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * TypeScript transformer implementation
 */
export class TypeScriptTransformer implements LanguageTransformer {
  readonly language: SupportedLanguage = 'typescript'
  
  transform(code: string, options: TransformOptions): string {
    if (!code.trim()) return ''

    try {
      // Step 1: Apply magic comments BEFORE transpilation
      let processedCode = code
      if (options.magicComments) {
        processedCode = applyMagicComments(code)
      }

      // Step 2: Transpile TypeScript
      const transpiled = this.transpile(processedCode, options)

      // Step 3: Apply code transformations
      let transformed = transformConsoleToDebug(transpiled)
      
      if (options.loopProtection) {
        transformed = addLoopProtection(transformed)
      }
      
      if (options.showTopLevelResults !== false) {
        transformed = wrapTopLevelExpressions(transformed)
      }

      return transformed
    } catch (error) {
      console.error('[TSTransformer] Error:', error)
      throw error // TypeScript errors should be propagated
    }
  }
  
  private transpile(code: string, options: TransformOptions): string {
    const compilerOptions = getCompilerOptions(options)
    
    const result = ts.transpileModule(code, {
      compilerOptions,
      fileName: 'index.tsx' // Support both TS and TSX
    })
    
    return result.outputText
  }
  
  validateSyntax(code: string): { valid: boolean; error?: string } {
    try {
      const sourceFile = ts.createSourceFile(
        'temp.ts',
        code,
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.TSX
      )
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagnostics = (sourceFile as any).parseDiagnostics || []
      if (diagnostics.length > 0) {
        return {
          valid: false,
          error: diagnostics[0].messageText as string
        }
      }
      
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create transformer for a language
 */
export function createJSTransformer(): JavaScriptTransformer {
  return new JavaScriptTransformer()
}

export function createTSTransformer(): TypeScriptTransformer {
  return new TypeScriptTransformer()
}
