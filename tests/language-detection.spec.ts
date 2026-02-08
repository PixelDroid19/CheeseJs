/**
 * Language Detection E2E Tests
 *
 * Comprehensive tests that verify:
 * 1. Language detection accuracy (JS/TS/Python)
 * 2. Code execution with correct output
 * 3. No syntax errors in output
 * 4. Python package imports work correctly
 */

import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';

// Increase test timeout for Python (Pyodide takes time to load)
test.setTimeout(120000);

let app: ElectronApplication;
let window: Page;

// Helper to clear the output panel
async function clearOutput(page: Page) {
  await page.evaluate(() => {
    // @ts-expect-error - Monaco is injected globally
    const models = window.monaco.editor.getModels();
    if (models.length > 1) {
      models[1].setValue('');
    }
  });
}

// Helper to set code in the editor
async function setCode(page: Page, code: string) {
  // Clear output first to avoid contamination from previous tests
  await clearOutput(page);

  await page.evaluate((c) => {
    // @ts-expect-error - Monaco is injected globally
    const model = window.monaco.editor.getModels()[0];
    model.setValue(c);
  }, code);

  // Wait for language detection to settle (instead of fixed timeout)
  await page.waitForFunction(
    (c) => {
      // @ts-expect-error - Monaco is injected globally
      const model = window.monaco.editor.getModels()[0];
      return model && model.getValue() === c;
    },
    code,
    { timeout: 10000 }
  );
}

// Helper to get current detected language
async function getLanguage(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // @ts-expect-error - Monaco is injected globally
    const model = window.monaco.editor.getModels()[0];
    return model.getLanguageId();
  });
}

// Helper to run code and get output
async function runAndGetOutput(page: Page, waitMs = 3000): Promise<string> {
  // Click Run button
  await page.getByRole('button', { name: /Run|Ejecutar/i }).click();

  // Poll for output change
  // Wait up to waitMs + 2000ms (to be safe)
  const maxWait = waitMs + 2000;
  const startTime = Date.now();
  let output = '';

  while (Date.now() - startTime < maxWait) {
    output = await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      const models = window.monaco.editor.getModels();
      if (models.length > 1) {
        return models[1].getValue();
      }
      return '';
    });

    // If output is valid (not empty, not placeholder), we're done
    if (
      output &&
      output.trim() !== '' &&
      !output.includes('Waiting for output')
    ) {
      return output;
    }

    await page.waitForTimeout(200);
  }

  return output;
}

// Helper to check for errors in output
function hasError(output: string): boolean {
  const errorPatterns = [
    /Error:/i,
    /SyntaxError/i,
    /TypeError/i,
    /ReferenceError/i,
    /NameError/i,
    /IndentationError/i,
    /ValueError/i,
    /AttributeError/i,
    /ModuleNotFoundError/i,
    /ImportError/i,
    /Traceback/i,
    /undefined is not/i,
    /is not defined/i,
    /Cannot read properties/i,
  ];
  return errorPatterns.some((pattern) => pattern.test(output));
}

test.beforeAll(async () => {
  const appPath = process.cwd();
  const mainScript = path.join(appPath, 'dist-electron/main.js');

  app = await electron.launch({
    args: [mainScript],
  });

  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Wait for editor to be ready
  await expect(window.locator('.monaco-editor').first()).toBeVisible({
    timeout: 30000,
  });

  // Ensure Monaco is loaded
  await window.waitForFunction(
    () => {
      // @ts-expect-error - Monaco is injected globally
      return window.monaco !== undefined && window.monaco.editor !== undefined;
    },
    { timeout: 30000 }
  );
});

test.afterAll(async () => {
  await app.close();
});

// ============================================================================
// JAVASCRIPT DETECTION + EXECUTION TESTS
// ============================================================================

test.describe('JavaScript Detection & Execution', () => {
  test('simple console.log - detects JS and executes', async () => {
    await setCode(window, `console.log('Hello World')`);

    const lang = await getLanguage(window);
    expect(['javascript', 'typescript']).toContain(lang);

    const output = await runAndGetOutput(window);
    expect(output).toContain('Hello World');
    expect(hasError(output)).toBe(false);
  });

  test('arithmetic operation - correct result', async () => {
    await setCode(window, `const result = 1 + 2 + 3;\nconsole.log(result);`);

    const lang = await getLanguage(window);
    expect(['javascript', 'typescript']).toContain(lang);

    const output = await runAndGetOutput(window);
    expect(output).toContain('6');
    expect(hasError(output)).toBe(false);
  });

  test('multiple console.log statements', async () => {
    await setCode(
      window,
      `console.log('Line 1');\nconsole.log('Line 2');\nconsole.log('Line 3');`
    );

    const output = await runAndGetOutput(window);
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 2');
    expect(output).toContain('Line 3');
    expect(hasError(output)).toBe(false);
  });

  test('arrow function execution - correct result', async () => {
    const code = `const add = (a, b) => a + b;
console.log(add(10, 20));`;

    await setCode(window, code);

    const output = await runAndGetOutput(window);
    expect(output).toContain('30');
    expect(hasError(output)).toBe(false);
  });

  test('array methods - map/filter/reduce', async () => {
    const code = `const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(x => x * 2);
const sum = doubled.reduce((a, b) => a + b, 0);
console.log(doubled);
console.log(sum);`;

    await setCode(window, code);

    const output = await runAndGetOutput(window);
    expect(output).toContain('2');
    expect(output).toContain('4');
    expect(output).toContain('30');
    expect(hasError(output)).toBe(false);
  });

  test('async/await - Promise execution', async () => {
    const code = `async function getData() {
  return 'async result';
}

getData().then(result => console.log(result));`;

    await setCode(window, code);

    const output = await runAndGetOutput(window, 4000);
    expect(output).toContain('async result');
    expect(hasError(output)).toBe(false);
  });

  test('object and JSON - correct stringify', async () => {
    const code = `const person = { name: 'John', age: 30 };
console.log(person.name);
console.log(person.age);`;

    await setCode(window, code);

    const output = await runAndGetOutput(window);
    expect(output).toContain('John');
    expect(output).toContain('30');
    expect(hasError(output)).toBe(false);
  });
});

// ============================================================================
// TYPESCRIPT DETECTION + EXECUTION TESTS
// ============================================================================

test.describe('TypeScript Detection & Execution', () => {
  test('type annotations - compiles and runs correctly', async () => {
    const code =
      'const greet = (name: string): string => {\n' +
      '    return `Hello, ${name}!`;\n' +
      '};\n' +
      "console.log(greet('TypeScript'));";

    await setCode(window, code);

    const lang = await getLanguage(window);
    // ML detection may detect as javascript or typescript - both are valid for execution
    expect(['javascript', 'typescript']).toContain(lang);

    const output = await runAndGetOutput(window);
    expect(output).toContain('Hello, TypeScript!');
    expect(hasError(output)).toBe(false);
  });

  test('interface usage - no type errors', async () => {
    const code =
      "interface User { name: string; age: number; } const user: User = { name: 'Alice', age: 25 }; console.log(user.name + ' is ' + user.age + ' years old');";

    await setCode(window, code);

    const lang = await getLanguage(window);
    expect(lang).toBe('typescript');

    const output = await runAndGetOutput(window);
    expect(output).toContain('Alice is 25 years old');
    expect(hasError(output)).toBe(false);
  });

  test('generics - type inference works', async () => {
    const code =
      "function identity<T>(arg: T): T { return arg; } console.log(identity(42)); console.log(identity('generic'));";

    await setCode(window, code);

    const output = await runAndGetOutput(window);
    expect(output).toContain('42');
    expect(output).toContain('generic');
    expect(hasError(output)).toBe(false);
  });

  test('enum - compiles correctly', async () => {
    const code =
      "enum Color { Red = 'RED', Green = 'GREEN', Blue = 'BLUE' } console.log(Color.Red); console.log(Color.Green);";

    await setCode(window, code);

    const output = await runAndGetOutput(window);
    expect(output).toContain('RED');
    expect(output).toContain('GREEN');
    expect(hasError(output)).toBe(false);
  });
});

// ============================================================================
// PYTHON DETECTION + EXECUTION TESTS
// ============================================================================

test.describe('Python Detection & Execution', () => {
  test('SHORT: print("text") - must detect as Python and execute', async () => {
    // This is the CRITICAL test - short print statements must work
    await setCode(window, "print('Now Python')");

    const lang = await getLanguage(window);
    expect(lang).toBe('python'); // MUST be python, not javascript

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Now Python');
    expect(output).not.toContain('ReferenceError'); // No JS error
    expect(output).not.toContain('is not defined'); // No JS error
    expect(hasError(output)).toBe(false);
  });

  test('print function - detects Python and outputs correctly', async () => {
    await setCode(window, "print('Hello from Python')");

    const lang = await getLanguage(window);
    expect(lang).toBe('python');

    // Python/Pyodide takes longer to initialize
    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Hello from Python');
    expect(hasError(output)).toBe(false);
  });

  test('print with numbers - correct arithmetic', async () => {
    await setCode(window, 'print(10 + 20 + 30)');

    const lang = await getLanguage(window);
    expect(lang).toBe('python');

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('60');
    expect(hasError(output)).toBe(false);
  });

  test('def function - executes correctly', async () => {
    const code =
      'def greet(name):\n' +
      "    return f'Hello, {name}!'\n\n" +
      "print(greet('Python'))";

    await setCode(window, code);

    const lang = await getLanguage(window);
    expect(lang).toBe('python');

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Hello, Python!');
    expect(hasError(output)).toBe(false);
  });

  test('for loop with range - correct iteration', async () => {
    const code = 'for i in range(5):\n' + '    print(i)';

    await setCode(window, code);

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('0');
    expect(output).toContain('1');
    expect(output).toContain('2');
    expect(output).toContain('3');
    expect(output).toContain('4');
    expect(hasError(output)).toBe(false);
  });

  test('list comprehension - correct result', async () => {
    const code = 'squares = [x ** 2 for x in range(5)]\n' + 'print(squares)';

    await setCode(window, code);

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('0');
    expect(output).toContain('1');
    expect(output).toContain('4');
    expect(output).toContain('9');
    expect(output).toContain('16');
    expect(hasError(output)).toBe(false);
  });

  test('class definition - instantiation works', async () => {
    const code =
      'class Person:\n' +
      '    def __init__(self, name, age):\n' +
      '        self.name = name\n' +
      '        self.age = age\n\n' +
      '    def greet(self):\n' +
      "        return f'{self.name} is {self.age} years old'\n\n" +
      "p = Person('Alice', 30)\n" +
      'print(p.greet())';

    await setCode(window, code);

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Alice is 30 years old');
    expect(hasError(output)).toBe(false);
  });

  test('try/except - error handling works', async () => {
    const code =
      'try:\n' +
      '    result = 10 / 0\n' +
      'except ZeroDivisionError:\n' +
      "    print('Caught division by zero!')";

    await setCode(window, code);

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Caught division by zero!');
    expect(hasError(output)).toBe(false);
  });

  test('lambda and map - functional programming', async () => {
    const code =
      'numbers = [1, 2, 3, 4, 5]\n' +
      'doubled = list(map(lambda x: x * 2, numbers))\n' +
      'print(doubled)';

    await setCode(window, code);

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('2');
    expect(output).toContain('4');
    expect(output).toContain('6');
    expect(output).toContain('8');
    expect(output).toContain('10');
    expect(hasError(output)).toBe(false);
  });

  test('dictionary operations - correct output', async () => {
    const code =
      "data = { 'name': 'Python', 'version': 3.11 }\n" +
      "print(f\"Language: {data['name']}, Version: {data['version']}\")";

    await setCode(window, code);

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Language: Python');
    expect(output).toContain('Version: 3.11');
    expect(hasError(output)).toBe(false);
  });
});

// ============================================================================
// PYTHON STANDARD LIBRARY IMPORTS
// ============================================================================

test.describe('Python Standard Library', () => {
  test('import math - basic math functions', async () => {
    const code =
      'import math\n' +
      "print(f'Pi: {math.pi}')\n" +
      "print(f'sqrt(16): {math.sqrt(16)}')\n" +
      "print(f'ceil(4.2): {math.ceil(4.2)}')";

    await setCode(window, code);

    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('Pi: 3.14');
    expect(output).toContain('sqrt(16): 4');
    expect(output).toContain('ceil(4.2): 5');
    expect(hasError(output)).toBe(false);
  });

  test('import random - random operations', async () => {
    const code =
      'import random\n' +
      'random.seed(42)\n' +
      "print(f'Random int: {random.randint(1, 100)}')\n" +
      'print(f\'Random choice: {random.choice(["a", "b", "c"])}\')';

    await setCode(window, code);

    const output = await runAndGetOutput(window, 10000);
    // With seed 42, we get deterministic results
    expect(output).toContain('Random int:');
    expect(output).toContain('Random choice:');
    expect(hasError(output)).toBe(false);
  });

  test('import json - JSON parsing', async () => {
    const code =
      'import json\n' +
      "data = { 'name': 'test', 'value': 42 }\n" +
      'json_str = json.dumps(data)\n' +
      "print(f'JSON: {json_str}')\n" +
      'parsed = json.loads(json_str)\n' +
      'print(f\'Parsed name: {parsed["name"]}\')';

    await setCode(window, code);

    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('JSON:');
    expect(output).toContain('test');
    expect(output).toContain('Parsed name: test');
    expect(hasError(output)).toBe(false);
  });

  test('import datetime - date operations', async () => {
    const code =
      'from datetime import datetime, timedelta\n' +
      'now = datetime(2024, 1, 15, 10, 30)\n' +
      'print(f\'Date: {now.strftime("%Y-%m-%d")}\')\n' +
      'tomorrow = now + timedelta(days = 1)\n' +
      'print(f\'Tomorrow: {tomorrow.strftime("%Y-%m-%d")}\')';

    await setCode(window, code);

    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('Date: 2024-01-15');
    expect(output).toContain('Tomorrow: 2024-01-16');
    expect(hasError(output)).toBe(false);
  });

  test('import collections - Counter', async () => {
    const code =
      'from collections import Counter\n' +
      "words =['apple', 'banana', 'apple', 'cherry', 'banana', 'apple']\n" +
      'counter = Counter(words)\n' +
      "print(f'Most common: {counter.most_common(2)}')";

    await setCode(window, code);

    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('apple');
    expect(output).toContain('3');
    expect(hasError(output)).toBe(false);
  });
});

// ============================================================================
// ERROR DETECTION TESTS
// ============================================================================

test.describe('Error Detection', () => {
  test('JavaScript syntax error - detected in output', async () => {
    await setCode(window, 'var a = ;');

    const output = await runAndGetOutput(window);
    // Should contain some error indication
    expect(output.length).toBeGreaterThan(0);
  });

  test('Python syntax error - IndentationError detected', async () => {
    const code =
      'def test():\n' + "    print('ok')\n" + "  print('bad indent')";

    await setCode(window, code);

    const output = await runAndGetOutput(window, 8000);
    // Python should report indentation error
    expect(output.toLowerCase()).toMatch(/indent|error|syntax/i);
  });

  test('Python NameError - undefined variable', async () => {
    await setCode(window, 'print(undefined_variable)');

    const output = await runAndGetOutput(window, 8000);
    expect(output.toLowerCase()).toMatch(/nameerror|undefined|not defined/i);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

test.describe('Edge Cases', () => {
  test('Empty code - no crash', async () => {
    await setCode(window, '');

    // Should not crash, just have empty or minimal output
    const output = await runAndGetOutput(window);
    expect(typeof output).toBe('string');
  });

  test('Unicode in JavaScript - correct output', async () => {
    await setCode(window, "console.log('Hello 🌍');");

    const output = await runAndGetOutput(window);
    expect(output).toContain('Hello');
    expect(output).toContain('🌍');
    expect(hasError(output)).toBe(false);
  });

  test('Unicode in Python - correct output', async () => {
    await setCode(window, "print('Hello 🐍 Привет 你好')");

    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Hello');
    expect(output).toContain('🐍');
    expect(hasError(output)).toBe(false);
  });

  test('Large output - handles correctly', async () => {
    const code = 'for i in range(100):\n' + "      print(f'Line {i}')";

    await setCode(window, code);

    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('Line 0');
    expect(output).toContain('Line 99');
    expect(hasError(output)).toBe(false);
  });
});

// ============================================================================
// LANGUAGE SWITCHING TESTS
// ============================================================================

test.describe('Language Switching', () => {
  test('Switch from JS to Python - correct execution', async () => {
    // First run JavaScript
    await setCode(window, "console.log('JavaScript first');");

    let output = await runAndGetOutput(window);
    expect(output).toContain('JavaScript first');

    // Switch to Python with more substantial code for reliable detection
    const pythonCode =
      '# Python code\n' +
      'def hello():\n' +
      "      print('Now Python')\n" +
      '\n' +
      'hello()';

    await setCode(window, pythonCode);
    // Wait for ML detection to identify Python
    await window.waitForFunction(
      () => {
        // @ts-expect-error - Monaco is injected globally
        const model = window.monaco.editor.getModels()[0];
        return model && model.getLanguageId() === 'python';
      },
      { timeout: 15000 }
    );

    const lang = await getLanguage(window);
    expect(lang).toBe('python'); // Should definitely detect as Python now

    output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Now Python');
    expect(hasError(output)).toBe(false);
  });

  test('Switch from Python to TypeScript - correct execution', async () => {
    // First run Python
    await setCode(window, "print('Python code')");
    let output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Python code');

    // Then switch to TypeScript
    const tsCode =
      "const msg: string = 'TypeScript code';\n" + 'console.log(msg);';

    await setCode(window, tsCode);

    const lang = await getLanguage(window);
    expect(lang).toBe('typescript');

    output = await runAndGetOutput(window);
    expect(output).toContain('TypeScript code');
    expect(hasError(output)).toBe(false);
  });
});
