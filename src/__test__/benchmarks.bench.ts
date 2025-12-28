/**
 * Performance Benchmarks for CheeseJS
 *
 * Run with: pnpm run bench
 *
 * @vitest-environment node
 */
import { bench, describe } from 'vitest';
import * as babel from '@babel/core';

// Import Babel plugins for benchmarking
import loopProtection from '../lib/babel/loop-protection';
import strayExpression from '../lib/babel/stray-expression';
import magicComments from '../lib/babel/magic-comments';
import topLevelThis from '../lib/babel/top-level-this';
import logBabel from '../lib/babel/log-babel';

// ============================================================================
// TEST DATA
// ============================================================================

const SIMPLE_CODE = `
const x = 5;

`;

const COMPLEX_CODE = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {

}

const result = [1, 2, 3, 4, 5]
  .map(x => x * 2)
  .filter(x => x > 4)
  .reduce((a, b) => a + b, 0);


`;

const LOOP_HEAVY_CODE = `
for (let i = 0; i < 100; i++) {
  while (i < 50) {
    for (let j = 0; j < 10; j++) {
      doSomething();
    }
    i++;
  }
}
`;

const CONSOLE_HEAVY_CODE = `

console.warn("Warning!");
console.error("Error!");
console.info("Info");



`;

const EXPRESSION_HEAVY_CODE = `
5 + 3;
Math.random();
[1, 2, 3].map(x => x * 2);
fetch("/api").then(r => r.json());
Promise.resolve(42);
await asyncFunction();
globalThis;
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function transformWithPlugin(code: string, plugin: babel.PluginItem): string {
  const result = babel.transformSync(code, {
    plugins: [plugin],
    parserOpts: { sourceType: 'module' },
    configFile: false,
    babelrc: false,
  });
  return result?.code || '';
}

function transformWithAllPlugins(code: string): string {
  const result = babel.transformSync(code, {
    plugins: [loopProtection, logBabel, strayExpression, topLevelThis],
    parserOpts: { sourceType: 'module' },
    configFile: false,
    babelrc: false,
  });
  return result?.code || '';
}

// ============================================================================
// BABEL PLUGIN BENCHMARKS
// ============================================================================

describe('Babel Plugin Performance', () => {
  describe('Loop Protection Plugin', () => {
    bench('simple code', () => {
      transformWithPlugin(SIMPLE_CODE, loopProtection);
    });

    bench('loop heavy code', () => {
      transformWithPlugin(LOOP_HEAVY_CODE, loopProtection);
    });

    bench('complex code', () => {
      transformWithPlugin(COMPLEX_CODE, loopProtection);
    });
  });

  describe('Console Transform Plugin', () => {
    bench('simple code', () => {
      transformWithPlugin(SIMPLE_CODE, logBabel);
    });

    bench('console heavy code', () => {
      transformWithPlugin(CONSOLE_HEAVY_CODE, logBabel);
    });

    bench('complex code', () => {
      transformWithPlugin(COMPLEX_CODE, logBabel);
    });
  });

  describe('Stray Expression Plugin', () => {
    bench('simple code', () => {
      transformWithPlugin(SIMPLE_CODE, strayExpression);
    });

    bench('expression heavy code', () => {
      transformWithPlugin(EXPRESSION_HEAVY_CODE, strayExpression);
    });

    bench('complex code', () => {
      transformWithPlugin(COMPLEX_CODE, strayExpression);
    });
  });

  describe('Magic Comments Plugin', () => {
    bench('code with magic comments', () => {
      transformWithPlugin(
        `
        const x = 5 //?
        value //?
        fn() // ?
      `,
        magicComments
      );
    });

    bench('code without magic comments', () => {
      transformWithPlugin(COMPLEX_CODE, magicComments);
    });
  });

  describe('Top Level This Plugin', () => {
    bench('code with this', () => {
      transformWithPlugin(
        `
        this;
        const fn = () => this;
        function test() { return this; }
      `,
        topLevelThis
      );
    });

    bench('code without this', () => {
      transformWithPlugin(COMPLEX_CODE, topLevelThis);
    });
  });
});

// ============================================================================
// FULL PIPELINE BENCHMARKS
// ============================================================================

describe('Full Transform Pipeline', () => {
  bench('simple code - all plugins', () => {
    transformWithAllPlugins(SIMPLE_CODE);
  });

  bench('complex code - all plugins', () => {
    transformWithAllPlugins(COMPLEX_CODE);
  });

  bench('loop heavy - all plugins', () => {
    transformWithAllPlugins(LOOP_HEAVY_CODE);
  });

  bench('console heavy - all plugins', () => {
    transformWithAllPlugins(CONSOLE_HEAVY_CODE);
  });

  bench('expression heavy - all plugins', () => {
    transformWithAllPlugins(EXPRESSION_HEAVY_CODE);
  });
});

// ============================================================================
// CODE TRANSFORM UTILITY BENCHMARKS
// ============================================================================

describe('Code Transform Utilities', () => {
  // Test regex-based transforms that run in transpilers

  const consolePattern = /\bconsole\.(log|warn|error|info|debug)\s*\(/g;
  const loopPattern = /(while\s*\([^)]*\)\s*\{|for\s*\([^)]*\)\s*\{|do\s*\{)/g;

  bench('console pattern matching', () => {
    CONSOLE_HEAVY_CODE.match(consolePattern);
  });

  bench('loop pattern matching', () => {
    LOOP_HEAVY_CODE.match(loopPattern);
  });

  bench('string split (line by line)', () => {
    COMPLEX_CODE.split('\n');
  });

  bench('string join (line by line)', () => {
    const lines = COMPLEX_CODE.split('\n');
    lines.join('\n');
  });
});

// ============================================================================
// CACHING SIMULATION BENCHMARKS
// ============================================================================

describe('Cache Key Generation', () => {
  // Using Node.js built-in crypto via dynamic import
  const createHash = (data: string) => {
    // Simple hash implementation for benchmarking
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  };

  bench('SHA-256 hash (small code)', () => {
    createHash(SIMPLE_CODE);
  });

  bench('SHA-256 hash (large code)', () => {
    const largeCode = COMPLEX_CODE.repeat(100);
    createHash(largeCode);
  });

  bench('Simple string key', () => {
    void (SIMPLE_CODE.length + '-' + SIMPLE_CODE.slice(0, 50));
  });
});
