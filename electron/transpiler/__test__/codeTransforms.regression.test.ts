/**
 * Regression tests for code transformation edge cases
 * These tests prevent regressions for bugs that were found and fixed
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { transformCode } from '../tsTranspiler.js';
import {
  wrapTopLevelExpressions,
  transformConsoleTodebug,
} from '../codeTransforms.js';

describe('Code Transformation Regression Tests', () => {
  describe('Multi-line template literals', () => {
    it('should preserve multi-line template literals without wrapping intermediate lines', () => {
      const code = `const multiLineString = \`This is a
multi-line string\`;`;

      const result = wrapTopLevelExpressions(code);

      // Should NOT wrap the second line (it's part of the template literal)
      expect(result).not.toContain('debug(2,');
      // The template literal should be preserved intact
      expect(result).toContain('multi-line string`');
    });

    it('should handle console.log with multi-line template literal variable', () => {
      const code = `const x = \`line1
line2\`;
console.log(x);`;

      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });

      // The output should be valid JavaScript
      expect(() => new Function(result)).not.toThrow();
    });

    it('should handle template literals spanning 3+ lines', () => {
      const code = `const text = \`line 1
line 2
line 3
line 4\`;`;

      const result = wrapTopLevelExpressions(code);

      // None of the intermediate lines should be wrapped
      expect(result).not.toContain('debug(2,');
      expect(result).not.toContain('debug(3,');
      expect(result).not.toContain('debug(4,');
    });
  });

  describe('Code inside classes and functions', () => {
    it('should not wrap class property declarations', () => {
      // After TypeScript transpilation, class properties become separate declarations
      const transpiledCode = `class Rectangle {
    width;
    height;
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
}`;

      const result = wrapTopLevelExpressions(transpiledCode);

      // Properties inside the class should NOT be wrapped
      expect(result).not.toContain('debug(2, width)');
      expect(result).not.toContain('debug(3, height)');
    });

    it('should not wrap expressions inside function bodies', () => {
      const code = `function test() {
  const x = 5;
  x + 1;
  return x;
}`;

      const result = wrapTopLevelExpressions(code);

      // The expression x + 1 inside the function should NOT be wrapped
      expect(result).not.toContain('debug(3,');
    });

    it('should only wrap top-level expressions', () => {
      const code = `const a = 1;
function foo() {
  const b = 2;
  b;
}
5 + 5;`;

      const result = wrapTopLevelExpressions(code);

      // b; inside function should NOT be wrapped
      expect(result).not.toContain('debug(4,');
      // 5 + 5; at top level SHOULD be wrapped
      expect(result).toContain('debug(6, 5 + 5)');
    });
  });

  describe('Private class fields (ES2022)', () => {
    it('should handle private class fields in transpiled output', () => {
      const code = `class Counter {
  #count = 0;
  increment() { this.#count++; }
  getCount() { return this.#count; }
}`;

      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: false,
      });

      // The output should be valid JavaScript
      expect(() => new Function(result)).not.toThrow();
      // Private field should be preserved
      expect(result).toContain('#count');
    });
  });

  describe('Nested structures', () => {
    it('should track brace depth correctly with nested classes', () => {
      const code = `class Outer {
  method() {
    class Inner {
      prop;
    }
  }
}`;

      const result = wrapTopLevelExpressions(code);

      // prop; inside nested class should NOT be wrapped
      expect(result).not.toContain('debug(4, prop)');
    });

    it('should track brace depth correctly with nested functions', () => {
      const code = `function outer() {
  function inner() {
    const x = 1;
    x;
  }
}`;

      const result = wrapTopLevelExpressions(code);

      // x; inside nested function should NOT be wrapped
      expect(result).not.toContain('debug(4, x)');
    });
  });

  describe('Edge cases with template literals in expressions', () => {
    it('should handle template literal in console.log argument', () => {
      const code = `console.log(\`template\`);`;

      const result = transformConsoleTodebug(code);

      // Should transform correctly
      expect(result).toContain('debug(1,');
      expect(result).toContain('`template`');
    });

    it('should handle multi-line template literal in console.log', () => {
      // This is tricky because the console.log spans multiple lines
      const code = `console.log(\`line1
line2\`);`;

      // Note: transformConsoleTodebug works line-by-line, so this case
      // might not be fully handled. The test documents current behavior.
      const result = transformConsoleTodebug(code);

      // At minimum, it should not corrupt the code
      expect(result).toContain('line1');
      expect(result).toContain('line2');
    });
  });

  describe('Full transformation pipeline', () => {
    it('should produce valid JavaScript for complex code with all features', () => {
      const code = `
// Multi-line template literal
const text = \`Hello
World\`;

// Class with properties
class MyClass {
  constructor(value) {
    this.value = value;
  }
  getValue() {
    return this.value;
  }
}

// Function
function test() {
  const x = new MyClass(5);
  return x.getValue();
}

// Expression at top level
console.log(text);
test();
`;

      const result = transformCode(code, {
        showTopLevelResults: true,
        loopProtection: true,
      });

      // Should produce valid JavaScript
      expect(() => new Function(result)).not.toThrow();
    });
  });
});
