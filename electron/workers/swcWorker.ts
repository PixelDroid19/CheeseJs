/**
 * SWC Transpiler Worker Thread
 * 
 * Dedicated worker for code transpilation using SWC (20-70x faster than TSC).
 * Offloads transpilation from main process to prevent UI blocking.
 * 
 * Features:
 * - ES2024/ESNext target support
 * - Modern decorators (2022-03)
 * - Import attributes support
 * - Loop protection injection
 * - Magic comments processing
 * - Persistent cache support
 */

import { parentPort } from 'worker_threads'
import { transformSync, type Options } from '@swc/core'
import crypto from 'crypto'

// ============================================================================
// TYPES
// ============================================================================

interface TransformOptions {
  showTopLevelResults?: boolean
  loopProtection?: boolean
  magicComments?: boolean
  showUndefined?: boolean
  targetVersion?: 'ES2022' | 'ES2024' | 'ESNext'
  experimentalDecorators?: boolean
  jsx?: boolean
  /** Debug function name to use (e.g., '__jsDebug' or 'debug') */
  debugFunctionName?: string
}

interface TransformRequest {
  type: 'transform'
  id: string
  code: string
  options: TransformOptions
}

interface ClearCacheRequest {
  type: 'clear-cache'
}

interface GetMetricsRequest {
  type: 'get-metrics'
}

type WorkerRequest = TransformRequest | ClearCacheRequest | GetMetricsRequest

interface TransformResult {
  type: 'transform-result'
  id: string
  code?: string
  error?: string
}

interface MetricsResult {
  type: 'metrics'
  data: {
    cacheSize: number
    cacheHits: number
    cacheMisses: number
    hitRate: number
  }
}

// ============================================================================
// IN-MEMORY TRANSPILATION CACHE
// ============================================================================

interface CacheEntry {
  code: string
  lastUsed: number
}

class TranspilationCache {
  private cache = new Map<string, CacheEntry>()
  private maxSize = 100 // Max cached entries
  private hits = 0
  private misses = 0

  private hashCode(code: string, options: TransformOptions): string {
    const optionsStr = JSON.stringify(options)
    return crypto.createHash('sha256').update(code + optionsStr, 'utf8').digest('hex')
  }

  get(code: string, options: TransformOptions): string | null {
    const key = this.hashCode(code, options)
    const entry = this.cache.get(key)
    
    if (entry) {
      entry.lastUsed = Date.now()
      this.hits++
      return entry.code
    }
    
    this.misses++
    return null
  }

  set(code: string, options: TransformOptions, result: string): void {
    const key = this.hashCode(code, options)
    
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      let oldestKey: string | null = null
      let oldestTime = Infinity
      
      for (const [k, v] of this.cache) {
        if (v.lastUsed < oldestTime) {
          oldestTime = v.lastUsed
          oldestKey = k
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }
    
    this.cache.set(key, { code: result, lastUsed: Date.now() })
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  getMetrics() {
    const total = this.hits + this.misses
    return {
      cacheSize: this.cache.size,
      cacheHits: this.hits,
      cacheMisses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0
    }
  }
}

const cache = new TranspilationCache()

// ============================================================================
// SWC TRANSPILATION
// ============================================================================

function getSwcTarget(options?: TransformOptions): 'es2022' | 'esnext' {
  if (options?.targetVersion === 'ESNext') return 'esnext'
  return 'es2022'
}

function transpileWithSWC(code: string, options?: TransformOptions): string {
  const target = getSwcTarget(options)
  
  const swcOptions: Options = {
    filename: 'index.tsx',
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: options?.jsx !== false,
        decorators: options?.experimentalDecorators ?? true,
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
      while (i < code.length) {
        if (code[i] === '\\') {
          i += 2
          continue
        }
        if (code[i] === quote) break
        if (quote === '`' && code[i] === '$' && code[i + 1] === '{') {
          i += 2
          let templateDepth = 1
          while (i < code.length && templateDepth > 0) {
            if (code[i] === '{') templateDepth++
            else if (code[i] === '}') templateDepth--
            i++
          }
          continue
        }
        i++
      }
    }
    i++
  }

  return depth === 0 ? i - 1 : -1
}

/**
 * Transform console.log calls to debug calls with line numbers
 */
function transformConsoleTodebug(code: string, debugFn = 'debug'): string {
  const lines = code.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    let processedLine = line
    let searchStart = 0

    while (true) {
      const consoleIndex = processedLine.indexOf('console.log(', searchStart)
      if (consoleIndex === -1) break

      const argsStart = consoleIndex + 'console.log('.length
      const closeIndex = findMatchingParen(processedLine, argsStart)

      if (closeIndex === -1) {
        searchStart = argsStart
        continue
      }

      const args = processedLine.substring(argsStart, closeIndex)
      const before = processedLine.substring(0, consoleIndex)
      const after = processedLine.substring(closeIndex + 1)

      processedLine = `${before}${debugFn}(${lineNumber}, ${args})${after}`
      searchStart = before.length + `${debugFn}(${lineNumber}, `.length
    }

    result.push(processedLine)
  }

  return result.join('\n')
}

/**
 * Add loop protection with cancellation checks
 */
function addLoopProtection(code: string): string {
  const MAX_ITERATIONS = 100000
  const loopRegex = /\b(for|while)\s*\(/g
  const lines = code.split('\n')
  const result: string[] = []
  let loopCounter = 0

  for (const line of lines) {
    let processedLine = line
    let match

    const matches: { index: number; type: string }[] = []
    while ((match = loopRegex.exec(line)) !== null) {
      matches.push({ index: match.index, type: match[1] })
    }

    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i]
      const beforeLoop = processedLine.substring(0, m.index)
      const afterLoopStart = processedLine.substring(m.index)

      const parenStart = afterLoopStart.indexOf('(')
      if (parenStart === -1) continue

      const parenClose = findMatchingParen(afterLoopStart, parenStart + 1)
      if (parenClose === -1) continue

      const afterParen = afterLoopStart.substring(parenClose + 1).trimStart()

      const counterVar = `__loop${loopCounter++}__`

      if (afterParen.startsWith('{')) {
        const braceIndex = afterLoopStart.indexOf('{', parenClose)
        const beforeBrace = afterLoopStart.substring(0, braceIndex + 1)
        const afterBrace = afterLoopStart.substring(braceIndex + 1)

        processedLine =
          `${beforeLoop}let ${counterVar}=0;${beforeBrace}` +
          `if(++${counterVar}>${MAX_ITERATIONS}||` +
          `(typeof __checkCancellation__==='function'&&__checkCancellation__()))` +
          `throw new Error('Loop terminated');` +
          `${afterBrace}`
      } else {
        const loopKeyword = afterLoopStart.substring(0, parenClose + 1)
        const statement = afterLoopStart.substring(parenClose + 1).trim()

        processedLine =
          `${beforeLoop}let ${counterVar}=0;${loopKeyword}{` +
          `if(++${counterVar}>${MAX_ITERATIONS}||` +
          `(typeof __checkCancellation__==='function'&&__checkCancellation__()))` +
          `throw new Error('Loop terminated');` +
          `${statement}}`
      }
    }

    result.push(processedLine)
  }

  return result.join('\n')
}

/**
 * Wrap top-level expressions with debug() for inline results
 */
function wrapTopLevelExpressions(code: string, debugFn = 'debug'): string {
  const lines = code.split('\n')
  const result: string[] = []

  const skipPatterns = [
    /^\s*$/,
    /^\s*\/\//,
    /^\s*\/\*/,
    /^\s*\*/,
    /^(const|let|var|function|class|import|export|async\s+function)\s/,
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

    if (skipPatterns.some(pattern => pattern.test(trimmed))) {
      result.push(line)
      continue
    }

    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/.test(trimmed) && !trimmed.startsWith('==')) {
      result.push(line)
      continue
    }

    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (nextLine.startsWith('.')) {
      result.push(line)
      continue
    }

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

/**
 * Apply magic comments (//?  or //?) to inject debug calls
 */
function applyMagicComments(code: string, debugFn = 'debug'): string {
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
          const expr = exprMatch[1]
          result.push(`${debugFn}(${lineNumber}, ${expr});`)
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

/**
 * Full transform pipeline
 */
function transformCode(code: string, options: TransformOptions = {}): string {
  if (!code.trim()) return ''

  const debugFn = options.debugFunctionName ?? 'debug'

  try {
    // Step 1: Apply magic comments BEFORE transpilation
    let processedCode = code
    if (options.magicComments) {
      processedCode = applyMagicComments(code, debugFn)
    }

    // Step 2: Transpile TS/JSX with SWC
    const transpiled = transpileWithSWC(processedCode, options)

    // Step 3: Apply other code transformations
    let transformed = transformConsoleTodebug(transpiled, debugFn)

    if (options.loopProtection) {
      transformed = addLoopProtection(transformed)
    }

    if (options.showTopLevelResults !== false) {
      transformed = wrapTopLevelExpressions(transformed, debugFn)
    }

    return transformed
  } catch (error) {
    // If transpilation fails, re-throw with context
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`SWC transpilation failed: ${message}`)
  }
}

// ============================================================================
// WORKER MESSAGE HANDLER
// ============================================================================

if (parentPort) {
  // Signal that worker is ready
  parentPort.postMessage({ type: 'ready' })

  parentPort.on('message', (message: WorkerRequest) => {
    try {
      switch (message.type) {
        case 'transform': {
          const { id, code, options } = message

          // Check cache first
          const cached = cache.get(code, options)
          if (cached) {
            parentPort!.postMessage({
              type: 'transform-result',
              id,
              code: cached
            } as TransformResult)
            return
          }

          // Transform code
          const result = transformCode(code, options)

          // Cache result
          cache.set(code, options, result)

          parentPort!.postMessage({
            type: 'transform-result',
            id,
            code: result
          } as TransformResult)
          break
        }

        case 'clear-cache':
          cache.clear()
          parentPort!.postMessage({ type: 'cache-cleared' })
          break

        case 'get-metrics':
          parentPort!.postMessage({
            type: 'metrics',
            data: cache.getMetrics()
          } as MetricsResult)
          break

        default:
          console.warn('[SWCWorker] Unknown message type:', (message as { type: string }).type)
      }
    } catch (error) {
      if (message.type === 'transform') {
        parentPort!.postMessage({
          type: 'transform-result',
          id: (message as TransformRequest).id,
          error: error instanceof Error ? error.message : String(error)
        } as TransformResult)
      }
    }
  })
}
