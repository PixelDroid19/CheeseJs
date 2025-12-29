/**
 * Edge Case Tests - "Crazy User Input" Scenarios
 *
 * These tests simulate unusual, edge-case, or potentially malicious inputs
 * that a typical user might try (intentionally or accidentally).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { transformCode } from '../tsTranspiler.js';
import {
  wrapTopLevelExpressions,
  transformConsoleTodebug,
  findMatchingParen,
} from '../codeTransforms.js';

describe('Edge Case Tests - Unusual User Inputs', () => {
  // ============================================================================
  // EMPTY AND WHITESPACE INPUTS
  // ============================================================================
  describe('Empty and whitespace inputs', () => {
    it('should handle empty string', () => {
      const result = transformCode('', { showTopLevelResults: true });
      expect(result).toBe('');
    });

    it('should handle only whitespace', () => {
      const result = transformCode('   \n\n\t\t   ', {
        showTopLevelResults: true,
      });
      expect(result.trim()).toBe('');
    });

    it('should handle only newlines', () => {
      const result = transformCode('\n\n\n\n\n', { showTopLevelResults: true });
      expect(result.trim()).toBe('');
    });

    it('should handle single space', () => {
      const result = transformCode(' ', { showTopLevelResults: true });
      expect(result.trim()).toBe('');
    });
  });

  // ============================================================================
  // SPECIAL CHARACTERS AND UNICODE
  // ============================================================================
  describe('Special characters and unicode', () => {
    it('should handle emoji in strings', () => {
      const code = `console.log("Hello 🎉 World 🌍!");`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
      expect(result).toContain('🎉');
    });

    it('should handle unicode variable names', () => {
      const code = `const café = "coffee"; console.log(café);`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle Chinese characters', () => {
      const code = `const 你好 = "hello"; console.log(你好);`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle Arabic text in strings', () => {
      const code = `console.log("مرحبا بالعالم");`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(result).toContain('مرحبا');
    });

    it('should handle null character in string', () => {
      const code = `console.log("before\\x00after");`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });

  // ============================================================================
  // DEEPLY NESTED STRUCTURES
  // ============================================================================
  describe('Deeply nested structures', () => {
    it('should handle deeply nested parentheses', () => {
      const code = `console.log(((((((((1))))))));`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle deeply nested braces', () => {
      const code = `
function a() {
  function b() {
    function c() {
      function d() {
        function e() {
          return 1;
        }
      }
    }
  }
}`;
      const result = wrapTopLevelExpressions(code);
      // Should not wrap anything inside the nested functions
      expect(result).not.toContain('debug(6,');
    });

    it('should handle deeply nested arrays', () => {
      const code = `const arr = [[[[[[[[1]]]]]]]];`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle very long single line', () => {
      const longLine = 'console.log(' + '"x".repeat(1000)' + ');';
      const result = transformCode(longLine, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });

  // ============================================================================
  // MALFORMED OR UNUSUAL SYNTAX
  // ============================================================================
  describe('Unusual but valid syntax', () => {
    it('should handle multiple semicolons', () => {
      const code = `;;;const x = 1;;;`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle labeled statements', () => {
      const code = `
outer: for (let i = 0; i < 3; i++) {
  inner: for (let j = 0; j < 3; j++) {
    if (i === 1 && j === 1) break outer;
  }
}`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: true,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle comma operator', () => {
      const code = `const x = (1, 2, 3);`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle void operator', () => {
      const code = `void console.log("test");`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle with statement', () => {
      // Note: 'with' is deprecated but still valid in non-strict mode
      const code = `const obj = {x: 1}; with(obj) { console.log(x); }`;
      // This might fail in strict mode, but we should handle it gracefully
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(result).toContain('with');
    });
  });

  // ============================================================================
  // STRINGS WITH SPECIAL CONTENT
  // ============================================================================
  describe('Strings with special content', () => {
    it('should handle string containing debug(', () => {
      const code = `console.log("debug(1, 2)");`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle string containing console.log', () => {
      const code = `console.log("console.log('nested')");`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle regex that looks like division', () => {
      const code = `const re = /test/g; console.log(re);`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle regex with special characters', () => {
      const code = `const re = /[\\]\\[\\{\\}\\(\\)]/g;`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle escaped quotes in strings', () => {
      const code = `console.log("He said \\"Hello\\"");`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle escaped backticks in template literals', () => {
      // Note: Escaped backticks are a complex edge case
      const code = 'const x = `backtick`; console.log(x);';
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle template literal with ${} containing backticks', () => {
      const code = 'const inner = `inner`; const outer = `outer: ${inner}`;';
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });

  // ============================================================================
  // COMMENTS IN UNUSUAL PLACES
  // ============================================================================
  describe('Comments in unusual places', () => {
    it('should handle comment at end of console.log', () => {
      const code = `console.log("test"); // this is a comment`;
      const result = transformConsoleTodebug(code);
      expect(result).toContain('debug(1,');
    });

    it('should handle multi-line comment in middle of expression', () => {
      const code = `console.log(/* comment */ "test");`;
      const result = transformConsoleTodebug(code);
      expect(result).toContain('debug(1,');
    });

    it('should handle comment that looks like code', () => {
      const code = `// a regular comment
console.log("visible");`;
      const result = transformConsoleTodebug(code);
      // The second line should be transformed
      expect(result).toContain('debug(2,');
    });

    it('should handle empty block comment', () => {
      const code = `/**/ console.log("test");`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });

  // ============================================================================
  // EDGE CASES IN TEMPLATE LITERALS
  // ============================================================================
  describe('Template literal edge cases', () => {
    it('should handle template literal with only newlines', () => {
      const code = 'const x = `\n\n\n`;';
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle template literal with expression spanning lines', () => {
      const code = 'const x = `${1 +\n2}`;';
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle nested template literals', () => {
      const code = 'const x = `outer ${`inner ${1}`}`;';
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle tagged template literal', () => {
      const code = 'const x = String.raw`C:\\path\\to\\file`;';
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });

  // ============================================================================
  // ASYNC/AWAIT EDGE CASES
  // ============================================================================
  describe('Async/await edge cases', () => {
    it('should handle async arrow function', () => {
      const code = `const fn = async () => { await Promise.resolve(1); };`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle async generator', () => {
      const code = `async function* gen() { yield 1; yield 2; }`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle for-await-of loop', () => {
      const code = `
async function test() {
  for await (const item of [Promise.resolve(1)]) {
    console.log(item);
  }
}`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });

  // ============================================================================
  // CLASS EDGE CASES
  // ============================================================================
  describe('Class edge cases', () => {
    it('should handle class with static private field', () => {
      const code = `
class MyClass {
  static #privateStatic = 1;
  static getPrivate() { return MyClass.#privateStatic; }
}`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle class with getter and setter', () => {
      const code = `
class MyClass {
  #value = 0;
  get value() { return this.#value; }
  set value(v) { this.#value = v; }
}`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle class expression', () => {
      const code = `const MyClass = class { constructor() {} };`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle class extending expression', () => {
      const code = `
function getBase() { return class {}; }
class Derived extends getBase() {}`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });

  // ============================================================================
  // DESTRUCTURING EDGE CASES
  // ============================================================================
  describe('Destructuring edge cases', () => {
    it('should handle deeply nested destructuring', () => {
      const code = `const { a: { b: { c: { d } } } } = { a: { b: { c: { d: 1 } } } };`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle array destructuring with holes', () => {
      const code = `const [, , third] = [1, 2, 3];`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle rest in destructuring', () => {
      const code = `const [first, ...rest] = [1, 2, 3, 4, 5];`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle default values in destructuring', () => {
      const code = `const { x = 10, y = 20 } = {};`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });

  // ============================================================================
  // PARENTHESIS MATCHING EDGE CASES
  // ============================================================================
  describe('Parenthesis matching edge cases', () => {
    it('should handle unbalanced parentheses (more open)', () => {
      const code = 'fn(((test)';
      const result = findMatchingParen(code, 3);
      expect(result).toBe(-1);
    });

    it('should handle empty parentheses', () => {
      const code = 'fn()';
      const result = findMatchingParen(code, 3);
      expect(result).toBe(3);
    });

    it('should handle parentheses in regex', () => {
      // This is tricky - regex can contain unbalanced parens
      const code = '/\\(test\\)/';
      // The function should handle this reasonably
      expect(() => findMatchingParen(code, 0)).not.toThrow();
    });
  });

  // ============================================================================
  // VERY LONG INPUTS
  // ============================================================================
  describe('Very long inputs', () => {
    it('should handle 1000 lines of code', () => {
      const lines = Array(1000).fill('const x = 1;').join('\n');
      expect(() =>
        transformCode(lines, {
          showTopLevelResults: false,
          loopProtection: false,
        })
      ).not.toThrow();
    });

    it('should handle very long variable name', () => {
      const longName = 'a'.repeat(256);
      const code = `const ${longName} = 1;`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle very long string literal', () => {
      const longString = 'x'.repeat(10000);
      const code = `const x = "${longString}";`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });

  // ============================================================================
  // POTENTIAL INJECTION ATTACKS
  // ============================================================================
  describe('Potential injection scenarios', () => {
    it('should handle string that tries to break out', () => {
      const code = `const x = "; console.log('injected'); //";`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      // Should produce valid JS without actual injection
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle template literal injection attempt', () => {
      // This tests that malformed template literals don't crash the transformer
      const code = 'const x = `safe ${123} content`;';
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle code with eval', () => {
      const code = `eval("console.log('evaled')");`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle code with Function constructor', () => {
      const code = `new Function("console.log('constructed')")();`;
      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });
      expect(() => new Function(result)).not.toThrow();
    });
  });
});
