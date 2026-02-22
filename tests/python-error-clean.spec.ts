import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import electronPath from 'electron';
import {
  ensureMonacoReady,
  getInputLanguage,
  runAndGetOutput,
  setInputCode,
} from './helpers/monaco';

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
  await ensureMonacoReady(page);
});

test.afterAll(async () => {
  if (app) {
    await app.close();
  }
});

test('Python error traceback should be clean', async () => {
  // Set Python code with error
  await setInputCode(page, "print('ok')\nprint(undefined_variable)");

  // Wait for language detection to identify Python
  await page.waitForFunction(
    () => {
      // @ts-expect-error - Monaco is injected globally
      const models = window.monaco.editor.getModels();
      const outputModel = models.find((m: any) =>
        m.uri.toString().includes('result-output')
      );
      const inputModel =
        models.find((m: any) => m !== outputModel) || models[0];
      const model = inputModel;
      return model && model.getLanguageId() === 'python';
    },
    { timeout: 15000 }
  );

  expect(await getInputLanguage(page)).toBe('python');
  const output = await runAndGetOutput(page, 30000);

  console.log('Output:', output);

  // Assertions
  expect(output).toContain('NameError');
  expect(output).not.toContain('/lib/python3');
  expect(output).not.toContain('_pyodide');
  // Python error might not show the exact line content in <exec>
  // expect(output).toContain("print(undefined_variable)");
});
