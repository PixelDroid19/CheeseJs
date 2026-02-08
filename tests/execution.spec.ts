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
});

test.afterAll(async () => {
  await app.close();
});

test.describe('Code Execution', () => {
  test('should execute simple code and show output', async () => {
    // Wait for editor to be ready with longer timeout
    await expect(page.locator('.monaco-editor').first()).toBeVisible({
      timeout: 15000,
    });

    // Ensure Monaco is loaded and exposed
    await page.waitForFunction(
      () => (window as unknown as { monaco: unknown }).monaco !== undefined,
      { timeout: 15000 }
    );

    // Set code using Monaco API directly
    await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      const model = window.monaco.editor.getModels()[0];
      model.setValue("console.log('Hello from E2E')");
    });

    // Click Run
    await page.getByRole('button', { name: /Run|Ejecutar/i }).click();

    // Wait for execution output to appear in the output model
    await page.waitForFunction(
      () => {
        // @ts-expect-error - Monaco is injected globally
        const models = window.monaco.editor.getModels();
        return models.some((m: any) => m.getValue().includes('Hello from E2E'));
      },
      { timeout: 10000 }
    );

    const output = await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      const models = window.monaco.editor.getModels();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return models.map((m: any) => m.getValue());
    });

    const hasOutput = output.some((val: string) =>
      val.includes('Hello from E2E')
    );
    expect(hasOutput).toBe(true);
  });

  test('should handle multiple console.log statements', async () => {
    await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      const model = window.monaco.editor.getModels()[0];
      model.setValue("console.log('Line 1');\nconsole.log('Line 2');");
    });

    await page.getByRole('button', { name: /Run|Ejecutar/i }).click();

    // Wait for execution output to contain both lines
    await page.waitForFunction(
      () => {
        // @ts-expect-error - Monaco is injected globally
        const models = window.monaco.editor.getModels();
        const combined = models.map((m: any) => m.getValue()).join('\n');
        return combined.includes('Line 1') && combined.includes('Line 2');
      },
      { timeout: 10000 }
    );

    const output = await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return window.monaco.editor.getModels().map((m: any) => m.getValue());
    });

    const combinedOutput = output.join('\n');
    expect(combinedOutput).toContain('Line 1');
    expect(combinedOutput).toContain('Line 2');
  });
});
