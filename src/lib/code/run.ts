import { registerPlugins, transform } from '@babel/standalone'
import logPlugin from '../babel/log-babel'
import strayExpression from '../babel/stray-expression'
import topLevelThis from '../babel/top-level-this'
import loopProtection from '../babel/loop-protection'
import magicComments from '../babel/magic-comments'
// @ts-expect-error - Babel plugins don't always have types
import pluginDoExpressions from '@babel/plugin-proposal-do-expressions'
// @ts-expect-error - Babel plugins don't always have types
import pluginExplicitResourceManagement from '@babel/plugin-transform-explicit-resource-management'
// @ts-expect-error - Babel plugins don't always have types
import pluginThrowExpressions from '@babel/plugin-proposal-throw-expressions'
// @ts-expect-error - Babel plugins don't always have types
import pluginExportDefaultFrom from '@babel/plugin-proposal-export-default-from'

import { Colors, stringify, type ColoredElement } from '../elementParser'

const AsyncFunction = Object.getPrototypeOf(async () => { return undefined }).constructor

interface unparsedResult {
  lineNumber?: number;
  content: unknown;
}
interface Result {
  lineNumber?: number;
  element: ColoredElement;
  type: 'execution' | 'error';
}

registerPlugins({
  'stray-expression-babel': strayExpression,
  'log-transform': logPlugin,
  'top-level-this': topLevelThis,
  'loop-protection': loopProtection,
  'magic-comments': magicComments,
  'proposal-do-expressions': pluginDoExpressions,
  'transform-explicit-resource-management': pluginExplicitResourceManagement,
  'proposal-throw-expressions': pluginThrowExpressions,
  'proposal-export-default-from': pluginExportDefaultFrom
})


interface TransformOptions {
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
  internalLogLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';
  magicComments?: boolean;
}

export function transformCode (
  code: string,
  options: TransformOptions = {}
): string {
  const plugins: Array<string | [string, object]> = [
    ['proposal-decorators', { legacy: true }],
    ['proposal-pipeline-operator', { proposal: 'minimal' }],
    'proposal-do-expressions',
    'transform-explicit-resource-management',
    'proposal-throw-expressions',
    'proposal-export-default-from',
    'top-level-this',
    'log-transform'
  ]

  if (options.magicComments) {
    plugins.push('magic-comments')
  }

  if (options.showTopLevelResults !== false) {
    plugins.push(['stray-expression-babel', { internalLogLevel: options.internalLogLevel }])
  }

  if (options.loopProtection) {
    plugins.push('loop-protection')
  }

  const result = transform(code, {
    filename: 'index.ts',
    presets: [
      [
        'typescript',
        {
          allowDeclareFields: true,
          onlyRemoveTypeImports: true
        }
      ]
    ],
    sourceType: 'module',
    parserOpts: {
      allowAwaitOutsideFunction: true,
      plugins: ['decorators-legacy']
    },
    targets: {
      esmodules: true
    },
    sourceMaps: true,
    plugins
  })

  if (!result.code || code.trim() === '') {
    return ''
  }

  return result.code
}

interface RunOptions {
  showUndefined?: boolean;
}

export async function run (
  string: string,
  onResult: (result: Result) => void,
  options: RunOptions = {}
): Promise<void> {
  if (string === '') return
  try {
    const asyncFunction = AsyncFunction('debug', string)

    await asyncFunction(async (lineNumber: number, ...args: unknown[]) => {
      // Check showUndefined setting
      if (!options.showUndefined && args.length === 1 && args[0] === undefined) {
        return
      }
      const content = args.length > 1 ? args : args[0]
      
      try {
        const stringifiedContent = await stringify(content)
        if (stringifiedContent) {
          onResult({
            lineNumber,
            element: stringifiedContent,
            type: 'execution'
          })
        }
      } catch (err) {
        // Ignore stringify errors
      }
    })
  } catch (e: unknown) {
    const errorMessage =
      e instanceof Error ? e.message : 'Unknown error occurred'
    onResult({
      element: { content: errorMessage, color: Colors.ERROR },
      type: 'error'
    })
  }
}
