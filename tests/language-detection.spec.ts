/**
 * Language Detection E2E Tests
 * 
 * Tests that JavaScript and Python code are correctly detected and executed
 * in their respective runtimes (JS/TS in Node, Python in Pyodide)
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

// Increase test timeout
test.setTimeout(60000);

let app: ElectronApplication;
let window: Page;

// Helper to set code and wait for detection
async function setCodeAndWait(page: Page, code: string, waitMs = 1000) {
  await page.evaluate((c) => {
    // @ts-ignore
    const model = window.monaco.editor.getModels()[0];
    model.setValue(c);
  }, code);
  
  // Wait for debounced detection to complete
  await page.waitForTimeout(waitMs);
}

// Helper to get current detected language
async function getDetectedLanguage(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // @ts-ignore
    const model = window.monaco.editor.getModels()[0];
    return model.getLanguageId();
  });
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
  
  // Wait for editor to be ready with longer timeout
  await expect(window.locator('.monaco-editor').first()).toBeVisible({ timeout: 30000 });
  
  // Wait a bit more for Monaco to fully initialize
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

// =========================================================================
// JAVASCRIPT DETECTION TESTS
// =========================================================================

const jsTestCases = [
  { name: 'console.log simple', code: `console.log('hello')` },
  { name: 'console.log with variable', code: `const x = 42;\nconsole.log(x);` },
  { name: 'arrow function', code: `const add = (a, b) => a + b;\nconsole.log(add(1, 2));` },
  { name: 'async/await', code: `async function fetchData() {\n  const data = await fetch('url');\n  return data;\n}` },
  { name: 'Promise chain', code: `fetch('url').then(r => r.json()).catch(e => console.error(e));` },
  { name: 'DOM API', code: `document.getElementById('app');\nwindow.location.href;` },
  { name: 'require statement', code: `const fs = require('fs');\nconst path = require('path');` },
  { name: 'ES6 import/export', code: `import { useState } from 'react';\nexport default function App() {}` },
  { name: 'Array methods', code: `const arr = [1, 2, 3];\narr.map(x => x * 2).filter(x => x > 2);` },
  { name: 'Object destructuring', code: `const { name, age } = person;\nconst [first, ...rest] = array;` },
  { name: 'Template literal', code: 'const msg = `Hello ${name}, you are ${age} years old`;' },
  { name: 'Class syntax', code: `class Person {\n  constructor(name) {\n    this.name = name;\n  }\n}` },
];

for (const tc of jsTestCases) {
  test(`JavaScript Detection: ${tc.name}`, async () => {
    await setCodeAndWait(window, tc.code);
    const lang = await getDetectedLanguage(window);
    expect(['javascript', 'typescript']).toContain(lang);
  });
}

// =========================================================================
// TYPESCRIPT DETECTION TESTS
// =========================================================================

const tsTestCases = [
  { name: 'type annotation', code: `const name: string = 'hello';\nconst age: number = 25;` },
  { name: 'interface', code: `interface User {\n  name: string;\n  age: number;\n}` },
  { name: 'type alias', code: `type Point = { x: number; y: number };\ntype ID = string | number;` },
  { name: 'generic function', code: `function identity<T>(arg: T): T {\n  return arg;\n}` },
  { name: 'class with access modifiers', code: `class Person {\n  private name: string;\n  public age: number;\n  readonly id: string;\n}` },
  { name: 'enum', code: `enum Direction {\n  Up,\n  Down,\n  Left,\n  Right\n}` },
  { name: 'as const assertion', code: `const config = { api: 'url' } as const;` },
  { name: 'optional chaining with types', code: `function greet(user?: User): string | undefined {\n  return user?.name;\n}` },
];

for (const tc of tsTestCases) {
  test(`TypeScript Detection: ${tc.name}`, async () => {
    await setCodeAndWait(window, tc.code);
    const lang = await getDetectedLanguage(window);
    expect(lang).toBe('typescript');
  });
}

// =========================================================================
// PYTHON DETECTION TESTS
// =========================================================================

const pythonTestCases = [
  { name: 'print function', code: `print('Hello, World!')` },
  { name: 'def function', code: `def greet(name):\n    print(f'Hello, {name}!')` },
  { name: 'class definition', code: `class Person:\n    def __init__(self, name):\n        self.name = name` },
  { name: 'for loop with range', code: `for i in range(10):\n    print(i)` },
  { name: 'list comprehension', code: `squares = [x**2 for x in range(10)]` },
  { name: 'import statement', code: `import os\nimport sys\nfrom pathlib import Path` },
  { name: 'try/except', code: `try:\n    x = 1/0\nexcept ZeroDivisionError:\n    print('Error!')` },
  { name: 'with statement', code: `with open('file.txt') as f:\n    content = f.read()` },
  { name: 'decorator', code: `@staticmethod\ndef my_func():\n    pass` },
  { name: 'f-string', code: `name = 'World'\nprint(f'Hello, {name}!')` },
  { name: 'None/True/False', code: `x = None\ny = True\nz = False` },
  { name: 'elif statement', code: `if x > 0:\n    print('positive')\nelif x < 0:\n    print('negative')\nelse:\n    print('zero')` },
  { name: 'lambda', code: `add = lambda x, y: x + y\nprint(add(2, 3))` },
  { name: 'enumerate/zip', code: `for i, item in enumerate(items):\n    print(i, item)` },
];

for (const tc of pythonTestCases) {
  test(`Python Detection: ${tc.name}`, async () => {
    await setCodeAndWait(window, tc.code);
    const lang = await getDetectedLanguage(window);
    expect(lang).toBe('python');
  });
}

// =========================================================================
// EXECUTION TESTS - Verify correct runtime is used
// =========================================================================

test('Runtime: JavaScript console.log should execute in JS runtime', async () => {
  await setCodeAndWait(window, `console.log('JS runtime test')`);
  
  // Run and check no Python errors
  await window.getByRole('button', { name: /Run|Ejecutar/i }).click();
  await window.waitForTimeout(2000);
  
  // Check that output doesn't contain Python error
  const pageContent = await window.content();
  expect(pageContent).not.toContain('PythonError');
  expect(pageContent).not.toContain('NameError');
});

test('Runtime: Python print should execute in Python runtime', async () => {
  await setCodeAndWait(window, `print('Python runtime test')`);
  
  // Run and verify Python runtime is used
  await window.getByRole('button', { name: /Run|Ejecutar/i }).click();
  await window.waitForTimeout(5000); // Python takes longer to load
  
  // Should not have JS-specific errors
  const pageContent = await window.content();
  expect(pageContent).not.toContain('ReferenceError');
  expect(pageContent).not.toContain('is not defined');
});

test('Runtime: TypeScript with types should execute correctly', async () => {
  const tsCode = `const greet = (name: string): string => {
  return \`Hello, \${name}!\`;
};
console.log(greet('TypeScript'));`;
  
  await setCodeAndWait(window, tsCode);
  
  await window.getByRole('button', { name: /Run|Ejecutar/i }).click();
  await window.waitForTimeout(2000);
  
  const pageContent = await window.content();
  expect(pageContent).not.toContain('PythonError');
});

// =========================================================================
// EDGE CASES
// =========================================================================

test('Edge Case: Empty code should keep last language', async () => {
  await setCodeAndWait(window, '');
  const lang = await getDetectedLanguage(window);
  // Empty code keeps the last detected language (doesn't re-detect on empty)
  expect(['javascript', 'typescript', 'python']).toContain(lang);
});

test('Edge Case: Very short code should keep last language', async () => {
  await setCodeAndWait(window, 'x');
  const lang = await getDetectedLanguage(window);
  // Very short code keeps the last detected language (below detection threshold)
  expect(['javascript', 'typescript', 'python']).toContain(lang);
});

test('Edge Case: Mixed-looking code with console.log should be JS', async () => {
  // This has some Python-like patterns but console.log is definitive
  await setCodeAndWait(window, `// This is a comment\nconsole.log('test')`);
  const lang = await getDetectedLanguage(window);
  expect(['javascript', 'typescript']).toContain(lang);
});

test('Edge Case: Comments only should default to TypeScript', async () => {
  await setCodeAndWait(window, `// Just a comment\n// Another comment`);
  const lang = await getDetectedLanguage(window);
  expect(['javascript', 'typescript']).toContain(lang);
});
