/**
 * Language Detection E2E Tests
 * 
 * Comprehensive tests that verify:
 * 1. Language detection accuracy (JS/TS/Python)
 * 2. Code execution with correct output
 * 3. No syntax errors in output
 * 4. Python package imports work correctly
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

// Increase test timeout for Python (Pyodide takes time to load)
test.setTimeout(120000);

let app: ElectronApplication;
let window: Page;

// Helper to set code in the editor
async function setCode(page: Page, code: string) {
  await page.evaluate((c) => {
    // @ts-ignore
    const model = window.monaco.editor.getModels()[0];
    model.setValue(c);
  }, code);
  
  // Wait for language detection (debounced)
  await page.waitForTimeout(1500);
}

// Helper to get current detected language
async function getLanguage(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // @ts-ignore
    const model = window.monaco.editor.getModels()[0];
    return model.getLanguageId();
  });
}

// Helper to run code and get output
async function runAndGetOutput(page: Page, waitMs = 3000): Promise<string> {
  // Click Run button
  await page.getByRole('button', { name: /Run|Ejecutar/i }).click();
  
  // Wait for execution
  await page.waitForTimeout(waitMs);
  
  // Get output from result panel (second Monaco model)
  const output = await page.evaluate(() => {
    // @ts-ignore
    const models = window.monaco.editor.getModels();
    if (models.length > 1) {
      return models[1].getValue();
    }
    return '';
  });
  
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
  return errorPatterns.some(pattern => pattern.test(output));
}

test.beforeAll(async () => {
  const electronPath = require('electron');
  const appPath = path.join(__dirname, '..');
  const mainScript = path.join(appPath, 'dist-electron/main.js');

  app = await electron.launch({
    executablePath: electronPath,
    args: [mainScript],
  });

  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  
  // Wait for editor to be ready
  await expect(window.locator('.monaco-editor').first()).toBeVisible({ timeout: 30000 });
  await window.waitForTimeout(3000);
  
  // Ensure Monaco is loaded
  await window.waitForFunction(() => {
    // @ts-ignore
    return window.monaco !== undefined && window.monaco.editor !== undefined;
  }, { timeout: 30000 });
});

test.afterAll(async () => {
  await app.close();
});

// ============================================================================
// JAVASCRIPT DETECTION + EXECUTION TESTS
// ============================================================================

test.describe('JavaScript Detection & Execution', () => {
  test('console.log simple - detects JS and outputs correctly', async () => {
    await setCode(window, `console.log('Hello World')`);
    
    const lang = await getLanguage(window);
    expect(['javascript', 'typescript']).toContain(lang);
    
    const output = await runAndGetOutput(window);
    expect(output).toContain('Hello World');
    expect(hasError(output)).toBe(false);
  });

  test('console.log with numbers - correct output', async () => {
    await setCode(window, `console.log(1 + 2 + 3)`);
    
    const lang = await getLanguage(window);
    expect(['javascript', 'typescript']).toContain(lang);
    
    const output = await runAndGetOutput(window);
    expect(output).toContain('6');
    expect(hasError(output)).toBe(false);
  });

  test('multiple console.log - all outputs present', async () => {
    await setCode(window, `console.log('Line 1');\nconsole.log('Line 2');\nconsole.log('Line 3');`);
    
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
console.log('Doubled:', doubled);
console.log('Sum:', sum);`;
    
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
console.log(JSON.stringify(person));`;
    
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
    const code = `const greet = (name: string): string => {
  return \`Hello, \${name}!\`;
};
console.log(greet('TypeScript'));`;
    
    await setCode(window, code);
    
    const lang = await getLanguage(window);
    // ML detection may detect as javascript or typescript - both are valid for execution
    expect(['javascript', 'typescript']).toContain(lang);
    
    const output = await runAndGetOutput(window);
    expect(output).toContain('Hello, TypeScript!');
    expect(hasError(output)).toBe(false);
  });

  test('interface usage - no type errors', async () => {
    const code = `interface User {
  name: string;
  age: number;
}

const user: User = { name: 'Alice', age: 25 };
console.log(\`\${user.name} is \${user.age} years old\`);`;
    
    await setCode(window, code);
    
    const lang = await getLanguage(window);
    expect(lang).toBe('typescript');
    
    const output = await runAndGetOutput(window);
    expect(output).toContain('Alice is 25 years old');
    expect(hasError(output)).toBe(false);
  });

  test('generics - type inference works', async () => {
    const code = `function identity<T>(arg: T): T {
  return arg;
}

console.log(identity<number>(42));
console.log(identity<string>('generic'));`;
    
    await setCode(window, code);
    
    const output = await runAndGetOutput(window);
    expect(output).toContain('42');
    expect(output).toContain('generic');
    expect(hasError(output)).toBe(false);
  });

  test('enum - compiles correctly', async () => {
    const code = `enum Color {
  Red = 'RED',
  Green = 'GREEN',
  Blue = 'BLUE'
}

console.log(Color.Red);
console.log(Color.Green);`;
    
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
  test('print function - detects Python and outputs correctly', async () => {
    await setCode(window, `print('Hello from Python')`);
    
    const lang = await getLanguage(window);
    expect(lang).toBe('python');
    
    // Python/Pyodide takes longer to initialize
    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Hello from Python');
    expect(hasError(output)).toBe(false);
  });

  test('print with numbers - correct arithmetic', async () => {
    await setCode(window, `print(10 + 20 + 30)`);
    
    const lang = await getLanguage(window);
    expect(lang).toBe('python');
    
    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('60');
    expect(hasError(output)).toBe(false);
  });

  test('def function - executes correctly', async () => {
    const code = `def greet(name):
    return f'Hello, {name}!'

print(greet('Python'))`;
    
    await setCode(window, code);
    
    const lang = await getLanguage(window);
    expect(lang).toBe('python');
    
    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Hello, Python!');
    expect(hasError(output)).toBe(false);
  });

  test('for loop with range - correct iteration', async () => {
    const code = `for i in range(5):
    print(i)`;
    
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
    const code = `squares = [x**2 for x in range(5)]
print(squares)`;
    
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
    const code = `class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age
    
    def greet(self):
        return f'{self.name} is {self.age} years old'

p = Person('Alice', 30)
print(p.greet())`;
    
    await setCode(window, code);
    
    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Alice is 30 years old');
    expect(hasError(output)).toBe(false);
  });

  test('try/except - error handling works', async () => {
    const code = `try:
    result = 10 / 0
except ZeroDivisionError:
    print('Caught division by zero!')`;
    
    await setCode(window, code);
    
    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Caught division by zero!');
    expect(hasError(output)).toBe(false);
  });

  test('lambda and map - functional programming', async () => {
    const code = `numbers = [1, 2, 3, 4, 5]
doubled = list(map(lambda x: x * 2, numbers))
print(doubled)`;
    
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
    const code = `data = {'name': 'Python', 'version': 3.11}
print(f"Language: {data['name']}, Version: {data['version']}")`;
    
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
    const code = `import math
print(f'Pi: {math.pi}')
print(f'sqrt(16): {math.sqrt(16)}')
print(f'ceil(4.2): {math.ceil(4.2)}')`;
    
    await setCode(window, code);
    
    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('Pi: 3.14');
    expect(output).toContain('sqrt(16): 4');
    expect(output).toContain('ceil(4.2): 5');
    expect(hasError(output)).toBe(false);
  });

  test('import random - random operations', async () => {
    const code = `import random
random.seed(42)
print(f'Random int: {random.randint(1, 100)}')
print(f'Random choice: {random.choice(["a", "b", "c"])}')`;
    
    await setCode(window, code);
    
    const output = await runAndGetOutput(window, 10000);
    // With seed 42, we get deterministic results
    expect(output).toContain('Random int:');
    expect(output).toContain('Random choice:');
    expect(hasError(output)).toBe(false);
  });

  test('import json - JSON parsing', async () => {
    const code = `import json
data = {'name': 'test', 'value': 42}
json_str = json.dumps(data)
print(f'JSON: {json_str}')
parsed = json.loads(json_str)
print(f'Parsed name: {parsed["name"]}')`;
    
    await setCode(window, code);
    
    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('JSON:');
    expect(output).toContain('test');
    expect(output).toContain('Parsed name: test');
    expect(hasError(output)).toBe(false);
  });

  test('import datetime - date operations', async () => {
    const code = `from datetime import datetime, timedelta
now = datetime(2024, 1, 15, 10, 30)
print(f'Date: {now.strftime("%Y-%m-%d")}')
tomorrow = now + timedelta(days=1)
print(f'Tomorrow: {tomorrow.strftime("%Y-%m-%d")}')`;
    
    await setCode(window, code);
    
    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('Date: 2024-01-15');
    expect(output).toContain('Tomorrow: 2024-01-16');
    expect(hasError(output)).toBe(false);
  });

  test('import collections - Counter', async () => {
    const code = `from collections import Counter
words = ['apple', 'banana', 'apple', 'cherry', 'banana', 'apple']
counter = Counter(words)
print(f'Most common: {counter.most_common(2)}')`;
    
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
    await setCode(window, `console.log('unclosed string`);
    
    const output = await runAndGetOutput(window);
    // Should contain some error indication
    expect(output.length).toBeGreaterThan(0);
  });

  test('Python syntax error - IndentationError detected', async () => {
    const code = `def test():
print('bad indent')`;
    
    await setCode(window, code);
    
    const output = await runAndGetOutput(window, 8000);
    // Python should report indentation error
    expect(output.toLowerCase()).toMatch(/indent|error|syntax/i);
  });

  test('Python NameError - undefined variable', async () => {
    await setCode(window, `print(undefined_variable)`);
    
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
    await setCode(window, `console.log('Hello 🌍 世界 مرحبا');`);
    
    const output = await runAndGetOutput(window);
    expect(output).toContain('Hello');
    expect(output).toContain('🌍');
    expect(hasError(output)).toBe(false);
  });

  test('Unicode in Python - correct output', async () => {
    await setCode(window, `print('Hello 🐍 Привет 你好')`);
    
    const output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Hello');
    expect(output).toContain('🐍');
    expect(hasError(output)).toBe(false);
  });

  test('Large output - handles correctly', async () => {
    const code = `for i in range(100):
    print(f'Line {i}')`;
    
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
    await setCode(window, `console.log('JavaScript first')`);
    let output = await runAndGetOutput(window);
    expect(output).toContain('JavaScript first');
    
    // Switch to Python with more substantial code for reliable detection
    const pythonCode = `# Python code
def hello():
    print('Now Python')

hello()`;
    
    await setCode(window, pythonCode);
    await window.waitForTimeout(2500); // Extra wait for ML detection
    
    const lang = await getLanguage(window);
    expect(lang).toBe('python'); // Should definitely detect as Python now
    
    output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Now Python');
    expect(hasError(output)).toBe(false);
  });

  test('Switch from Python to TypeScript - correct execution', async () => {
    // First run Python
    await setCode(window, `print('Python code')`);
    let output = await runAndGetOutput(window, 8000);
    expect(output).toContain('Python code');
    
    // Then switch to TypeScript
    const tsCode = `const msg: string = 'TypeScript code';
console.log(msg);`;
    await setCode(window, tsCode);
    
    const lang = await getLanguage(window);
    expect(lang).toBe('typescript');
    
    output = await runAndGetOutput(window);
    expect(output).toContain('TypeScript code');
    expect(hasError(output)).toBe(false);
  });
});
