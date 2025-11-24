import { registerPlugins, transform } from '@babel/standalone'
import logPlugin from '../babel/log-babel'
import strayExpression from '../babel/stray-expression'
import topLevelThis from '../babel/top-level-this'
import loopProtection from '../babel/loop-protection'
import { Colors, stringify, type ColoredElement } from '../elementParser'

const AsyncFunction = Object.getPrototypeOf(async () => { }).constructor

interface unparsedResult {
  lineNumber?: number;
  content: ColoredElement;
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
  'loop-protection': loopProtection
})

interface TransformOptions {
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
}

export function transformCode (code: string, options: TransformOptions = {}): string {
  const plugins: any[] = [
    ['proposal-decorators', { legacy: true }],
    'top-level-this',
    'log-transform'
  ]

  if (options.showTopLevelResults !== false) {
    plugins.push('stray-expression-babel')
  }

  if (options.loopProtection) {
    plugins.push('loop-protection')
  }

  const result = transform(code, {
    filename: 'index.ts',
    presets: [
      ['typescript', {
        allowDeclareFields: true,
        onlyRemoveTypeImports: true
      }]
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

  console.log(result)

  return result.code
}

interface RunOptions {
  showUndefined?: boolean;
}

export async function run (string: string, options: RunOptions = {}): Promise<Result[] | Error> {
  if (string == '') return []
  try {
    let unparsedResults: unparsedResult[] = []

    const asyncFunction = AsyncFunction('debug', string)

    await asyncFunction((lineNumber: number, ...args: any[]) => {
      const content = args.length > 1 ? args : args[0]
      unparsedResults = [...unparsedResults, { lineNumber, content }]
    })

    if (unparsedResults.length === 0) return []

    const promises = unparsedResults.map(async (result) => {
      // Filter undefined if needed
      if (options.showUndefined === false && result.content === undefined) {
        return null
      }

      const stringifiedContent = await stringify(result.content)
      if (!stringifiedContent) throw new Error('Unable to stringify content')
      return {
        lineNumber: result.lineNumber,
        element: stringifiedContent,
        type: 'execution'
      }
    })

    const parsedResults = (await Promise.all(promises)).filter((r): r is Result => r !== null)

    return parsedResults
  } catch (e: unknown) {
    return [
      { element: { content: e.message, color: Colors.ERROR }, type: 'error' }
    ]
  }
}
