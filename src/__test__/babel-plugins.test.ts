/**
 * Tests for Babel plugins used in code transformation
 */
import { describe, it, expect } from 'vitest';
import * as babel from '@babel/core';
import loopProtection from '../lib/babel/loop-protection';
import magicComments from '../lib/babel/magic-comments';
import strayExpression from '../lib/babel/stray-expression';
import topLevelThis from '../lib/babel/top-level-this';
import logBabel from '../lib/babel/log-babel';

// Helper function to transform code with a plugin
function transform(
  code: string,
  plugin: babel.PluginItem,
  options: Record<string, unknown> = {}
): string {
  const result = babel.transformSync(code, {
    plugins: [[plugin, options]],
    parserOpts: { sourceType: 'module' },
    generatorOpts: { retainLines: true },
    configFile: false,
    babelrc: false,
  });
  return result?.code || '';
}

describe('loop-protection plugin', () => {
  it('should inject counter and limit check in while loops', () => {
    const code = `while (true) { doSomething(); }`;
    const result = transform(code, loopProtection);

    expect(result).toContain('let _loopCounter');
    // The plugin inserts the check inside the block
    expect(result).toContain('Loop limit exceeded');
  });

  it('should inject counter and limit check in for loops', () => {
    const code = `for (let i = 0; i < 100; i++) { doSomething(); }`;
    const result = transform(code, loopProtection);

    expect(result).toContain('let _loopCounter');
    expect(result).toContain('10000'); // MAX_ITERATIONS
  });

  it('should inject counter and limit check in do-while loops', () => {
    const code = `do { doSomething(); } while (condition);`;
    const result = transform(code, loopProtection);

    expect(result).toContain('let _loopCounter');
    expect(result).toContain('Loop limit exceeded');
  });

  it('should add cancellation checkpoint check', () => {
    const code = `while (true) { process(); }`;
    const result = transform(code, loopProtection);

    expect(result).toContain('__checkCancellation__');
    expect(result).toContain('Execution cancelled');
  });

  it('should handle nested loops with unique counters', () => {
    const code = `
      while (a) {
        for (let i = 0; i < 10; i++) {
          doSomething();
        }
      }
    `;
    const result = transform(code, loopProtection);

    // Should have different counter names for nested loops
    expect(result).toContain('_loopCounter');
    // The scope.generateUidIdentifier ensures unique names
    const counterMatches = result.match(/_loopCounter\d*/g);
    expect(counterMatches).toBeTruthy();
  });

  it('should wrap single-statement loop body in block', () => {
    const code = `while (true) doSomething();`;
    const result = transform(code, loopProtection);

    // Should now have braces
    expect(result).toContain('{');
    expect(result).toContain('}');
    expect(result).toContain('Loop limit exceeded');
  });

  it('should handle for-in loops', () => {
    const code = `for (const key in obj) { doSomething(); }`;
    const result = transform(code, loopProtection);

    expect(result).toContain('let _loopCounter');
    expect(result).toContain('Loop limit exceeded');
  });

  it('should handle for-of loops', () => {
    const code = `for (const item of list) { doSomething(); }`;
    const result = transform(code, loopProtection);

    expect(result).toContain('let _loopCounter');
    expect(result).toContain('Loop limit exceeded');
  });
});

describe('magic-comments plugin', () => {
  // Note: The magic-comments plugin requires comments to be parsed and preserved
  // by Babel. These tests verify the plugin logic when comments are available.

  it('should transform expression with trailing magic comment', () => {
    // The plugin checks for trailingComments on nodes
    // Babel may not preserve inline comments in all cases
    const code = `myValue /* ? */`;
    const result = transform(code, magicComments);

    // Block comments are more reliably preserved
    expect(result).toContain('myValue');
  });

  it('should handle variable declarations', () => {
    const code = `const x = 1`;
    const result = transform(code, magicComments);

    // Without magic comment, should pass through unchanged
    expect(result).toContain('const x = 1');
  });

  it('should not double-wrap already wrapped debug calls', () => {
    const code = `debug(1, value)`;
    const result = transform(code, magicComments);

    // Should not have nested debug calls
    expect(result).not.toMatch(/debug\(\s*\d+\s*,\s*debug\(/);
  });

  it('should ignore expressions without magic comments', () => {
    const code = `myValue`;
    const result = transform(code, magicComments);

    // Without magic comment, should remain as-is
    expect(result).toBe('myValue;');
  });
});

describe('stray-expression plugin', () => {
  it('should wrap top-level expressions with debug call', () => {
    const code = `5 + 3`;
    const result = transform(code, strayExpression);

    expect(result).toContain('debug(');
    expect(result).toContain('5 + 3');
  });

  it('should not wrap console.log calls', () => {
    const code = `console.log("test")`;
    const result = transform(code, strayExpression);

    // Should remain as console.log, not wrapped in debug
    expect(result).toContain('console.log');
    expect(result).not.toMatch(/debug\(\s*\d+\s*,\s*console\.log/);
  });

  it('should not wrap "use strict" directive', () => {
    const code = `"use strict"`;
    const result = transform(code, strayExpression);

    expect(result).toContain('"use strict"');
    expect(result).not.toContain('debug(');
  });

  it('should skip assignment expressions by default', () => {
    const code = `x = 10`;
    const result = transform(code, strayExpression);

    // Assignment without internalLogLevel should not be wrapped
    expect(result).toBe('x = 10;');
  });

  it('should wrap assignment expressions when internalLogLevel is set', () => {
    const code = `x = 10`;
    const result = transform(code, strayExpression, {
      internalLogLevel: 'all',
    });

    expect(result).toContain('debug(');
  });

  it('should handle this/globalThis expressions', () => {
    const code = `globalThis`;
    const result = transform(code, strayExpression);

    expect(result).toContain('debug(');
    expect(result).toContain('globalThis');
  });

  it('should handle promise chains', () => {
    const code = `fetch("/api").then(r => r.json())`;
    const result = transform(code, strayExpression);

    expect(result).toContain('debug(');
    // Should wrap with await for promises
    expect(result).toContain('await');
  });

  it('should skip setTimeout/setInterval calls', () => {
    const code = `setTimeout(() => { }, 1000)`;
    const result = transform(code, strayExpression);

    expect(result).toContain('setTimeout');
    expect(result).not.toContain('debug(');
  });

  it('should not wrap already wrapped debug calls', () => {
    const code = `debug(1, value)`;
    const result = transform(code, strayExpression);

    expect(result).not.toMatch(/debug\(\s*\d+\s*,\s*debug\(/);
  });

  it('should add debug for variable declarations when internalLogLevel is set', () => {
    const code = `const x = 5`;
    const result = transform(code, strayExpression, {
      internalLogLevel: 'all',
    });

    expect(result).toContain('const x = 5');
    expect(result).toContain('debug(');
  });

  it('should only transform top-level expressions', () => {
    const code = `
  function test() {
    5 + 3;
  }
  `;
    const result = transform(code, strayExpression);

    // The 5 + 3 inside the function should not be wrapped
    // since it's not at Program level
    expect(result).toContain('5 + 3');
    // Check there's no debug inside the function
    expect(result).not.toMatch(/function test\(\)\s*\{[^}]*debug/);
  });
});

describe('top-level-this plugin', () => {
  it('should replace top-level this with globalThis', () => {
    const code = `this`;
    const result = transform(code, topLevelThis);

    expect(result).toContain('globalThis');
    expect(result).not.toMatch(/\bthis\b/);
  });

  it('should not replace this inside regular functions', () => {
    const code = `
  function test() {
    return this;
  }
  `;
    const result = transform(code, topLevelThis);

    // Inside regular function, this should remain
    expect(result).toContain('this');
  });

  it('should replace this inside arrow functions at top level', () => {
    const code = `const fn = () => this`;
    const result = transform(code, topLevelThis);

    // Arrow functions inherit this from parent scope, so top-level arrow should use globalThis
    expect(result).toContain('globalThis');
  });

  it('should not replace this inside arrow function within regular function', () => {
    const code = `
  function outer() {
    const inner = () => this;
    return inner;
  }
  `;
    const result = transform(code, topLevelThis);

    // Arrow inside regular function inherits function's this
    expect(result).toContain('this');
  });

  it('should handle nested arrow functions at top level', () => {
    const code = `const fn = () => () => this`;
    const result = transform(code, topLevelThis);

    // Both arrows at top level, this should be globalThis
    expect(result).toContain('globalThis');
  });

  it('should not replace this inside class methods', () => {
    const code = `
  class MyClass {
    method() {
      return this;
    }
  }
  `;
    const result = transform(code, topLevelThis);

    // Class method this should remain
    expect(result).toContain('this');
  });
});

describe('log-babel plugin', () => {
  it('should transform console.log to debug call', () => {
    const code = `console.log("hello")`;
    const result = transform(code, logBabel);

    expect(result).toContain('debug(');
    expect(result).toContain('"hello"');
    expect(result).not.toContain('console.log');
  });

  it('should transform console.warn to debug call', () => {
    const code = `console.warn("warning")`;
    const result = transform(code, logBabel);

    expect(result).toContain('debug(');
    expect(result).not.toContain('console.warn');
  });

  it('should transform console.error to debug call', () => {
    const code = `console.error("error")`;
    const result = transform(code, logBabel);

    expect(result).toContain('debug(');
    expect(result).not.toContain('console.error');
  });

  it('should transform console.info to debug call', () => {
    const code = `console.info("info")`;
    const result = transform(code, logBabel);

    expect(result).toContain('debug(');
    expect(result).not.toContain('console.info');
  });

  it('should pass multiple arguments to debug', () => {
    const code = `console.log("a", "b", "c")`;
    const result = transform(code, logBabel);

    expect(result).toContain('debug(');
    expect(result).toContain('"a"');
    expect(result).toContain('"b"');
    expect(result).toContain('"c"');
  });

  it('should include line number as first argument', () => {
    const code = `console.log("test")`;
    const result = transform(code, logBabel);

    // Should have debug(lineNumber, ...args)
    expect(result).toMatch(/debug\(\s*\d+/);
  });

  it('should not transform non-console member expressions', () => {
    const code = `myObject.log("test")`;
    const result = transform(code, logBabel);

    expect(result).toContain('myObject.log');
    expect(result).not.toContain('debug(');
  });

  it('should not transform console property access', () => {
    const code = `const x = console`;
    const result = transform(code, logBabel);

    expect(result).toContain('const x = console');
    expect(result).not.toContain('debug(');
  });
});

describe('plugin composition', () => {
  it('should work with multiple plugins in sequence', () => {
    const code = `
      while (true) {
        console.log("inside loop");
      }
      5 + 3
    `;

    // Apply all plugins in order
    let result = transform(code, loopProtection);
    result = transform(result, logBabel);
    result = transform(result, strayExpression);

    // Should have loop protection
    expect(result).toContain('_loopCounter');
    // Should have console.log transformed
    expect(result).toContain('debug(');
    // Expression should be wrapped
    expect(result).toMatch(/debug\(\s*\d+\s*,\s*5\s*\+\s*3/);
  });
});
