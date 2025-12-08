/**
 * SWC-based Code Transpiler
 * 
 * High-performance TypeScript/JSX transpilation using SWC (20-70x faster than TSC).
 * Provides the same API as tsTranspiler for drop-in replacement.
 */

import { transformSync, type Options } from '@swc/core'

export interface TransformOptions {
    showTopLevelResults?: boolean
    loopProtection?: boolean
    magicComments?: boolean
    showUndefined?: boolean
}

/**
 * Transpile TypeScript/JSX code using SWC
 */
export function transpileWithSWC(code: string): string {
    const swcOptions: Options = {
        filename: 'index.tsx',
        jsc: {
            parser: {
                syntax: 'typescript',
                tsx: true,
                decorators: true,
                dynamicImport: true
            },
            target: 'es2022',
            transform: {
                decoratorVersion: '2022-03',
                react: {
                    runtime: 'classic',
                    pragma: 'React.createElement',
                    pragmaFrag: 'React.Fragment'
                }
            },
            loose: false,
            externalHelpers: false
        },
        module: {
            type: 'commonjs',
            strict: false,
            strictMode: false,
            noInterop: false
        },
        sourceMaps: false,
        isModule: true
    }

    try {
        const result = transformSync(code, swcOptions)
        return result.code
    } catch (error) {
        // Re-throw with more context
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`SWC transpilation failed: ${message}`)
    }
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
 */
function transformConsoleTodebug(code: string): string {
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
 */
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
            trimmed.startsWith('.') ||
            /^[\]\)\}]+;?$/.test(trimmed) ||
            /^[,\]\}\)]+$/.test(trimmed)
        ) {
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
            result.push(`${indent}debug(${lineNumber}, ${expr});`)
        } else {
            result.push(line)
        }
    }

    return result.join('\n')
}

/**
 * Apply magic comments (//?  or //?) to inject debug calls
 */
function applyMagicComments(code: string): string {
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
                result.push(`debug(${lineNumber}, ${varName});`)
            } else {
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

/**
 * Apply code transformations after transpilation
 */
export function applyCodeTransforms(
    code: string,
    options: TransformOptions = {}
): string {
    let transformed = code

    transformed = transformConsoleTodebug(transformed)

    if (options.loopProtection) {
        transformed = addLoopProtection(transformed)
    }

    if (options.showTopLevelResults !== false) {
        transformed = wrapTopLevelExpressions(transformed)
    }

    return transformed
}

/**
 * Full transform pipeline using SWC
 */
export function transformCode(
    code: string,
    options: TransformOptions = {}
): string {
    if (!code.trim()) return ''

    try {
        // Step 1: Apply magic comments BEFORE transpilation
        let processedCode = code
        if (options.magicComments) {
            processedCode = applyMagicComments(code)
        }

        // Step 2: Transpile TS/JSX with SWC (much faster than TSC)
        const transpiled = transpileWithSWC(processedCode)

        // Step 3: Apply other code transformations
        const transformed = applyCodeTransforms(transpiled, options)

        return transformed
    } catch (error) {
        // If transpilation fails, try to apply transforms to original code
        console.error('SWC Transpilation error:', error)
        return applyCodeTransforms(code, options)
    }
}

// Re-export for backwards compatibility
export { transpileWithSWC as transpileWithTypeScript }
