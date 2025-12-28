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

test.describe('Application Options & Behavior', () => {
  test('should toggle "Show undefined" and affect output', async () => {
    // 1. Open Settings
    await page
      .getByRole('button', { name: /Settings|Configuraci|Ajustes/i })
      .click();

    // 2. Go to Advanced
    await page
      .getByRole('button', { name: /Advanced|Avanzado|Avanzadas/i })
      .click();

    // 3. Find "Show undefined" toggle
    // The label text in Spanish is "Mostrar valores indefinidos explícitamente"
    const row = page.locator('.flex.items-center.justify-between', {
      hasText: /Show undefined|Mostrar valores indefinidos/i,
    });
    await expect(row).toBeVisible();

    // Click the toggle inside the row (label wrapper)
    await row.locator('label').click();

    // Close settings
    const settingsModal = page.locator('.fixed.inset-0.z-\\[100\\]');
    await settingsModal.locator('button:has(svg.lucide-x)').click();

    // 4. Run code that returns undefined explicitly
    await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      const model = window.monaco.editor.getModels()[0];
      model.setValue('undefined');
    });

    await page.getByRole('button', { name: /Run|Ejecutar/i }).click();
    await page.waitForTimeout(1000);

    const output = await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return window.monaco.editor
        .getModels()
        .map((m: any) => m.getValue())
        .join('\n');
    });

    // If enabled, it should show 'undefined'
    expect(output).toContain('undefined');
  });

  test('should handle runtime errors gracefully', async () => {
    await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      const model = window.monaco.editor.getModels()[0];
      model.setValue("throw new Error('Test Error')");
    });

    await page.getByRole('button', { name: /Run|Ejecutar/i }).click();
    await page.waitForTimeout(1000);

    const output = await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return window.monaco.editor
        .getModels()
        .map((m: any) => m.getValue())
        .join('\n');
    });

    expect(output).toContain('Test Error');
  });

  test('should support Magic Comments', async () => {
    // 1. Ensure Magic Comments are enabled
    await page
      .getByRole('button', { name: /Settings|Configuraci|Ajustes/i })
      .click();
    await page
      .getByRole('button', { name: /Advanced|Avanzado|Avanzadas/i })
      .click();

    const row = page.locator('.flex.items-center.justify-between', {
      hasText: /Magic Comments|Comentarios mágicos/i,
    });
    await expect(row).toBeVisible();

    // Toggle it
    await row.locator('label').click();

    // Close settings
    const settingsModal = page.locator('.fixed.inset-0.z-\\[100\\]');
    await settingsModal.locator('button:has(svg.lucide-x)').click();

    // 2. Run code with //?
    await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      const model = window.monaco.editor.getModels()[0];
      model.setValue('const x = 10;\nx //?');
    });

    await page.getByRole('button', { name: /Run|Ejecutar/i }).click();
    await page.waitForTimeout(1000);

    const output = await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      // Check all models content (output might be in second model)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return window.monaco.editor
        .getModels()
        .map((m: any) => m.getValue())
        .join('\n');
    });

    // Expect output to contain '10' (the result of magic comment)
    expect(output).toContain('10');
  });
});
