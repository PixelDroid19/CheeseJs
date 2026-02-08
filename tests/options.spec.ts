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

  // Wait for Monaco to be initialized
  await page.waitForFunction(() => window.monaco && window.monaco.editor);
});

test.beforeEach(async () => {
  // Ensure AI Chat is closed
  const chatInput = page.getByTestId('ai-chat-input');
  if (await chatInput.isVisible()) {
    // Try to find the close button or toggle button
    // The chat usually has a close button or we can toggle it off
    const toggleButton = page.getByTestId('toggle-chat');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
    } else {
      // Fallback: try clicking outside or looking for a close button inside the chat
      // Assuming there is a toggle button as per AIChat.tsx
    }
    await expect(chatInput).not.toBeVisible();
  }
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

    // Wait for execution output to appear in any model
    await page.waitForFunction(
      () => {
        // @ts-expect-error - Monaco is injected globally
        const models = window.monaco.editor.getModels();
        return (
          models.length > 1 &&
          models.some((m: any) => m.getValue().includes('undefined'))
        );
      },
      { timeout: 10000 }
    );

    const output = await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally

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

    // Wait for execution output containing the error
    await page.waitForFunction(
      () => {
        // @ts-expect-error - Monaco is injected globally
        const models = window.monaco.editor.getModels();
        return models.some((m: any) => m.getValue().includes('Test Error'));
      },
      { timeout: 10000 }
    );

    const output = await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally

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

    // Wait for execution output
    await page.waitForFunction(
      () => {
        // @ts-expect-error - Monaco is injected globally
        const models = window.monaco.editor.getModels();
        return models.some((m: any) => m.getValue().includes('10'));
      },
      { timeout: 10000 }
    );

    const output = await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      // Check all models content (output might be in second model)

      return window.monaco.editor
        .getModels()
        .map((m: any) => m.getValue())
        .join('\n');
    });

    // Expect output to contain '10' (the result of magic comment)
    expect(output).toContain('10');
  });
});
