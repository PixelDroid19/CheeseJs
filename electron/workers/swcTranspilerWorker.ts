/**
 * SWC Transpiler Worker Thread
 * 
 * Runs SWC transpilation in a dedicated worker thread to:
 * - Unblock the main process (20-70x faster than TSC)
 * - Enable parallel transpilation requests
 * - Provide isolated transpilation environment
 * 
 * Communication Protocol:
 * - Main -> Worker: { type: 'transpile', id, code, options }
 * - Worker -> Main: { type: 'result', id, code } | { type: 'error', id, error }
 */

import { parentPort } from 'worker_threads'
import { transformSync, type Options, type JscTarget } from '@swc/core'

// ============================================================================
// TYPES
// ============================================================================

export interface TranspileOptions {
  /** Wrap top-level expressions with debug() for inline results */
  showTopLevelResults?: boolean
  /** Add loop protection to prevent infinite loops */
  loopProtection?: boolean
  /** Process //? magic comments for debug output */
  magicComments?: boolean
  /** Show undefined values in output */
  showUndefined?: boolean
  /** Target ECMAScript version */
  targetVersion?: 'ES2022' | 'ES2024' | 'ESNext'
  /** Enable experimental decorators */
  experimentalDecorators?: boolean
  /** Parse JSX syntax */
  jsx?: boolean
  /** Debug function name (default: 'debug', can be '__jsDebug' for JS-specific) */
  debugFunctionName?: string
}

interface TranspileRequest {
  type: 'transpile'
  id: string
  code: string
  options: TranspileOptions
}

interface TranspileResult {
  type: 'result'
  id: string
  code: string
  timing: number
}

interface TranspileError {
  type: 'error'
  id: string
  error: string
  timing: number
}

type WorkerMessage = TranspileRequest | { type: 'ping' }
// WorkerResponse type used for documentation purposes
// type WorkerResponse = TranspileResult | TranspileError | { type: 'ready' } | { type: 'pong' }

// ============================================================================
// TRANSPILATION CACHE (in-memory for hot paths)
// ============================================================================

const transpileCache = new Map<string, { code: string; timestamp: number }>()
const CACHE_MAX_SIZE = 100
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCacheKey(code: string, options: TranspileOptions): string {
  const optKey = JSON.stringify({
    t: options.targetVersion,
    d: options.experimentalDecorators,
    j: options.jsx,
    fn: options.debugFunctionName
  })
  // Simple hash for cache key
  let hash = 0
  const str = code + optKey
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(36)
}

function getFromCache(key: string): string | null {
  const cached = transpileCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.code
  }
  transpileCache.delete(key)
  return null
}

function setCache(key: string, code: string): void {
  // Evict oldest entries if cache is full
  if (transpileCache.size >= CACHE_MAX_SIZE) {
    const oldest = [...transpileCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 10)
    oldest.forEach(([k]) => transpileCache.delete(k))
  }
  transpileCache.set(key, { code, timestamp: Date.now() })
}

// ============================================================================
// SWC TRANSPILATION
// ============================================================================

function getSwcTarget(options: TranspileOptions): JscTarget {
  switch (options.targetVersion) {
    case 'ESNext': return 'esnext'
    case 'ES2024': return 'es2022' // SWC uses es2022 as highest stable
    default: return 'es2022'
  }
}

function transpileWithSWC(code: string, options: TranspileOptions): string {
  const target = getSwcTarget(options)
  
  const swcOptions: Options = {
    filename: 'index.tsx',
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: options.jsx !== false,
        decorators: options.experimentalDecorators ?? true,
        dynamicImport: true
      },
      target,
      transform: {
        decoratorVersion: '2022-03',
        react: {
          runtime: 'classic',
          pragma: 'React.createElement',
          pragmaFrag: 'React.Fragment'
        }
      },
      loose: false,
      externalHelpers: false,
      keepClassNames: true
    },
    module: {
      type: 'commonjs',
      strict: false,
      strictMode: false,
      noInterop: false,
      importInterop: 'swc'
    },
    sourceMaps: false,
    isModule: true
  }

  const result = transformSync(code, swcOptions)
  return result.code
}

// ============================================================================
// CODE TRANSFORMATIONS
// ============================================================================

function findMatchingParen(code: string, startIndex: number): number {
  let depth = 1
  let i = startIndex

  while (i < code.length && depth > 0) {
    const char = code[i]
    if (char === '(') depth++
    else if (char === ')') depth--

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

function transformConsoleToDebug(code: string, debugFn: string): string {
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
          ? `${debugFn}(${lineNumber})`
          : `${debugFn}(${lineNumber}, ${args})`

        line = before + replacement + after
        offset += replacement.length - (closeParenPos + 1 - fullMatchStart)
      }
    }

    result.push(line)
  }

  return result.join('\n')
}

function addLoopProtection(code: string): string {
  const MAX_ITERATIONS = 10000
  let loopCounter = 0

  const loopPattern = /(while\s*\([^)]*\)\s*\{|for\s*\([^)]*\)\s*\{|do\s*\{)/g

  return code.replace(loopPattern, (match) => {
    const counterVar = `__loopCounter${loopCounter++}`
    const checkCode = `let ${counterVar} = 0; if (++${counterVar} > ${MAX_ITERATIONS}) throw new Error("Loop limit exceeded (${MAX_ITERATIONS} iterations)"); `

    const braceIndex = match.lastIndexOf('{')
    return match.slice(0, braceIndex + 1) + '\n' + checkCode + '\n'
  })
}

function wrapTopLevelExpressions(code: string, debugFn: string): string {
  const lines = code.split('\n')
  const result: string[] = []

  const skipPatterns = [
    /^$/,
    /^\/\//,
    /^\/\*/,
    /^\*/,
    /^import\s/,
    /^export\s/,
    /^(const|let|var)\s/,
    /^(function|async\s+function)\s/,
    /^class\s/,
    /^(interface|type|enum)\s/,
    /^(if|else|for|while|switch|try|catch|finally|do)\s*[({]/,
    /^(return|throw|break|continue|yield)[\s;]/,
    /^[{}()[\]]/,
    /^[,\]})]+ ?;?$/,
    new RegExp(`^${debugFn}\\(`),
    new RegExp(`^await\\s+${debugFn}\\(`),
    /^\./,
    /^using\s/,
    /^await\s+using\s/,
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const lineNumber = i + 1

    // Check skip patterns
    if (skipPatterns.some(p => p.test(trimmed))) {
      result.push(line)
      continue
    }

    // Skip assignments
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/.test(trimmed) && !trimmed.startsWith('==')) {
      result.push(line)
      continue
    }

    // Skip if next line is method chaining
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (nextLine.startsWith('.')) {
      result.push(line)
      continue
    }

    // Wrap expressions ending with semicolon
    if (trimmed.endsWith(';') && !trimmed.includes('.then(') && !trimmed.includes('.catch(')) {
      const expr = trimmed.slice(0, -1)
      const indent = line.match(/^\s*/)?.[0] || ''
      result.push(`${indent}${debugFn}(${lineNumber}, ${expr});`)
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

function applyMagicComments(code: string, debugFn: string): string {
  const lines = code.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    const magicMatch = line.match(/(.+?)\/\/\?\s*(.*)$/)

    if (magicMatch) {
      const codePart = magicMatch[1].trim()
      const varMatch = codePart.match(/^(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+?);?\s*$/)

      if (varMatch) {
        const [, keyword, varName, value] = varMatch
        result.push(`${keyword} ${varName} = ${value};`)
        result.push(`${debugFn}(${lineNumber}, ${varName});`)
      } else {
        const exprMatch = codePart.match(/^(.+?);?\s*$/)
        if (exprMatch) {
          result.push(`${debugFn}(${lineNumber}, ${exprMatch[1]});`)
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
// FULL TRANSFORM PIPELINE
// ============================================================================

function transformCode(code: string, options: TranspileOptions): string {
  if (!code.trim()) return ''

  const debugFn = options.debugFunctionName || 'debug'

  // Step 1: Apply magic comments BEFORE transpilation
  let processedCode = code
  if (options.magicComments) {
    processedCode = applyMagicComments(code, debugFn)
  }

  // Step 2: Transpile TS/JSX with SWC
  const transpiled = transpileWithSWC(processedCode, options)

  // Step 3: Apply code transformations
  let transformed = transformConsoleToDebug(transpiled, debugFn)

  if (options.loopProtection) {
    transformed = addLoopProtection(transformed)
  }

  if (options.showTopLevelResults !== false) {
    transformed = wrapTopLevelExpressions(transformed, debugFn)
  }

  return transformed
}

// ============================================================================
// WORKER MESSAGE HANDLER
// ============================================================================

function handleMessage(message: WorkerMessage): void {
  if (message.type === 'ping') {
    parentPort?.postMessage({ type: 'pong' })
    return
  }

  if (message.type === 'transpile') {
    const startTime = performance.now()
    const { id, code, options } = message

    try {
      // Check cache first
      const cacheKey = getCacheKey(code, options)
      let transpiledCode = getFromCache(cacheKey)

      if (!transpiledCode) {
        transpiledCode = transformCode(code, options)
        setCache(cacheKey, transpiledCode)
      }

      const timing = performance.now() - startTime

      parentPort?.postMessage({
        type: 'result',
        id,
        code: transpiledCode,
        timing
      } as TranspileResult)

    } catch (error) {
      const timing = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      parentPort?.postMessage({
        type: 'error',
        id,
        error: errorMessage,
        timing
      } as TranspileError)
    }
  }
}

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

if (parentPort) {
  parentPort.on('message', handleMessage)
  parentPort.postMessage({ type: 'ready' })
  console.log('[SWCTranspilerWorker] Ready')
} else {
  console.error('[SWCTranspilerWorker] No parentPort available - not running as worker')
}

// Export for testing
export { transformCode, transpileWithSWC }
