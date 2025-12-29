import { registerPlugins, transform } from '@babel/standalone';
import logPlugin from '../babel/log-babel';
import strayExpression from '../babel/stray-expression';
import topLevelThis from '../babel/top-level-this';
import loopProtection from '../babel/loop-protection';
import magicComments from '../babel/magic-comments';

import { Colors, stringify, type ColoredElement } from '../elementParser';
import { getTranspileCache } from '../cache';

const AsyncFunction = Object.getPrototypeOf(async () => {
  return undefined;
}).constructor;

interface Result {
  lineNumber?: number;
  element: ColoredElement;
  type: 'execution' | 'error';
}

// Register ONLY custom plugins that are NOT already in @babel/standalone
// Built-in plugins like proposal-do-expressions, transform-explicit-resource-management,
// proposal-throw-expressions, and proposal-export-default-from are already included
// in @babel/standalone and should be used by their original names directly
registerPlugins({
  'stray-expression-babel': strayExpression,
  'log-transform': logPlugin,
  'top-level-this': topLevelThis,
  'loop-protection': loopProtection,
  'magic-comments': magicComments,
});

interface TransformOptions {
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
  internalLogLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';
  magicComments?: boolean;
}

export function transformCode(
  code: string,
  options: TransformOptions = {}
): string {
  // Check cache first
  const cache = getTranspileCache();
  const cacheOptions = {
    showTopLevelResults: options.showTopLevelResults,
    loopProtection: options.loopProtection,
    magicComments: options.magicComments,
    language: 'typescript' as const,
  };

  const cached = cache.get(code, cacheOptions);
  if (cached) {
    return cached;
  }

  const plugins: Array<string | [string, object]> = [
    ['proposal-decorators', { legacy: true }],
    ['proposal-pipeline-operator', { proposal: 'minimal' }],
    // Use @babel/standalone built-in plugins by their original names
    'proposal-do-expressions',
    'transform-explicit-resource-management',
    'proposal-throw-expressions',
    'proposal-export-default-from',
    'top-level-this',
    'log-transform',
  ];

  if (options.magicComments) {
    plugins.push('magic-comments');
  }

  if (options.showTopLevelResults !== false) {
    plugins.push([
      'stray-expression-babel',
      { internalLogLevel: options.internalLogLevel },
    ]);
  }

  if (options.loopProtection) {
    plugins.push('loop-protection');
  }

  const result = transform(code, {
    filename: 'index.ts',
    presets: [
      [
        'typescript',
        {
          allowDeclareFields: true,
          onlyRemoveTypeImports: true,
        },
      ],
    ],
    sourceType: 'module',
    parserOpts: {
      allowAwaitOutsideFunction: true,
      plugins: [
        'decorators-legacy',
        'classPrivateProperties',
        'classPrivateMethods',
      ],
    },
    targets: {
      esmodules: true,
    },
    sourceMaps: true,
    plugins,
  });

  if (!result.code || code.trim() === '') {
    return '';
  }

  // Store in cache
  cache.set(code, result.code, cacheOptions);

  return result.code;
}

interface RunOptions {
  showUndefined?: boolean;
}

export async function run(
  string: string,
  onResult: (result: Result) => void,
  options: RunOptions = {}
): Promise<void> {
  if (string === '') return;
  try {
    const asyncFunction = AsyncFunction('debug', string);

    await asyncFunction(async (lineNumber: number, ...args: unknown[]) => {
      // Check showUndefined setting
      if (
        !options.showUndefined &&
        args.length === 1 &&
        args[0] === undefined
      ) {
        return;
      }
      const content = args.length > 1 ? args : args[0];

      try {
        const stringifiedContent = await stringify(content);
        if (stringifiedContent) {
          onResult({
            lineNumber,
            element: stringifiedContent,
            type: 'execution',
          });
        }
      } catch (_err) {
        // Ignore stringify errors
      }
    });
  } catch (e: unknown) {
    const errorMessage =
      e instanceof Error ? e.message : 'Unknown error occurred';
    onResult({
      element: { content: errorMessage, color: Colors.ERROR },
      type: 'error',
    });
  }
}
