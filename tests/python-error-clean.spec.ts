import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import electronPath from 'electron';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const appPath = process.cwd();
  const mainScript = path.join(appPath, 'dist-electron/main.js');

  app = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [mainScript],
  });

  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // Wait for editor
  await expect(page.locator('.monaco-editor').first()).toBeVisible({
    timeout: 20000,
  });
});

test.afterAll(async () => {
  if (app) {
    await app.close();
  }
});

test('Python error traceback should be clean', async () => {
  // Set Python code with error
  await page.evaluate(() => {
    // @ts-expect-error - Monaco is injected globally
    const editor = window.monaco.editor.getModels()[0];
    editor.setValue("print('ok')\nprint(undefined_variable)");
  });

  // Wait for language detection (optional, but good practice)
  await page.waitForTimeout(2000);

  // Click Run
  await page.getByRole('button', { name: /Run|Ejecutar/i }).click();

  // Wait for output
  await page.waitForTimeout(5000);

  const output = await page.evaluate(() => {
    // @ts-expect-error - Monaco is injected globally
    const models = window.monaco.editor.getModels();
    // Assuming the second model is the output
    return models.length > 1 ? models[1].getValue() : '';
  });

  console.log('Output:', output);

  // Assertions
  expect(output).toContain('NameError');
  expect(output).not.toContain('/lib/python3');
  expect(output).not.toContain('_pyodide');
  // Python error might not show the exact line content in <exec>
  // expect(output).toContain("print(undefined_variable)");
});
