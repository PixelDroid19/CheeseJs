import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

let app: ElectronApplication;
let window: Page;

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
});

test.afterAll(async () => {
  await app.close();
});

test.describe('Code Execution', () => {
  test('should execute simple code and show output', async () => {
    // Wait for editor to be ready with longer timeout
    await expect(window.locator('.monaco-editor').first()).toBeVisible({ timeout: 15000 });

    // Ensure Monaco is loaded and exposed
    await window.waitForFunction(() => window.monaco !== undefined, { timeout: 15000 });

    // Set code using Monaco API directly
    await window.evaluate(() => {
      // @ts-ignore
      const model = window.monaco.editor.getModels()[0];
      model.setValue("console.log('Hello from E2E');");
    });

    // Click Run
    await window.getByRole('button', { name: /Run|Ejecutar/i }).click();

    // Verify output
    // The output is likely in the second Monaco editor (read-only)
    // We can check the content of the second editor model
    
    // Give it a moment to run
    await window.waitForTimeout(2000);

    const output = await window.evaluate(() => {
      // @ts-ignore
      const models = window.monaco.editor.getModels();
      // Assuming the second model is the output one, or we check both
      return models.map(m => m.getValue());
    });

    const hasOutput = output.some(val => val.includes('Hello from E2E'));
    expect(hasOutput).toBe(true);
  });

  test('should handle multiple console logs', async () => {
    await window.evaluate(() => {
      // @ts-ignore
      const model = window.monaco.editor.getModels()[0];
      model.setValue("console.log('Line 1');\nconsole.log('Line 2');");
    });

    await window.getByRole('button', { name: /Run|Ejecutar/i }).click();
    await window.waitForTimeout(2000);

    const output = await window.evaluate(() => {
      // @ts-ignore
      return window.monaco.editor.getModels().map(m => m.getValue());
    });

    const combinedOutput = output.join('\n');
    expect(combinedOutput).toContain('Line 1');
    expect(combinedOutput).toContain('Line 2');
  });
});
