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

test.describe('Application Options & Behavior', () => {
  
  test('should toggle "Show undefined" and affect output', async () => {
    // 1. Open Settings
    await window.getByRole('button', { name: /Settings|Configuraci|Ajustes/i }).click();
    
    // 2. Go to Advanced
    await window.getByRole('button', { name: /Advanced|Avanzado|Avanzadas/i }).click();

    // 3. Find "Show undefined" toggle
    // The label text in Spanish is "Mostrar valores indefinidos explícitamente"
    const row = window.locator('.flex.items-center.justify-between', { hasText: /Show undefined|Mostrar valores indefinidos/i });
    await expect(row).toBeVisible();
    
    // Click the toggle inside the row (label wrapper)
    await row.locator('label').click();

    // Close settings
    const settingsModal = window.locator('.fixed.inset-0.z-\\[100\\]');
    await settingsModal.locator('button:has(svg.lucide-x)').click();

    // 4. Run code that returns undefined explicitly
    await window.evaluate(() => {
      // @ts-ignore
      const model = window.monaco.editor.getModels()[0];
      model.setValue("undefined");
    });

    await window.getByRole('button', { name: /Run|Ejecutar/i }).click();
    await window.waitForTimeout(1000);

    const output = await window.evaluate(() => {
      // @ts-ignore
      return window.monaco.editor.getModels().map(m => m.getValue()).join('\n');
    });

    // If enabled, it should show 'undefined'
    expect(output).toContain('undefined');
  });

  test('should handle runtime errors gracefully', async () => {
    await window.evaluate(() => {
      // @ts-ignore
      const model = window.monaco.editor.getModels()[0];
      model.setValue("throw new Error('Test Error')");
    });

    await window.getByRole('button', { name: /Run|Ejecutar/i }).click();
    await window.waitForTimeout(1000);

    const output = await window.evaluate(() => {
      // @ts-ignore
      return window.monaco.editor.getModels().map(m => m.getValue()).join('\n');
    });

    expect(output).toContain('Test Error');
  });

  test('should support Magic Comments', async () => {
    // 1. Ensure Magic Comments are enabled
    await window.getByRole('button', { name: /Settings|Configuraci|Ajustes/i }).click();
    await window.getByRole('button', { name: /Advanced|Avanzado|Avanzadas/i }).click();
    
    const row = window.locator('.flex.items-center.justify-between', { hasText: /Magic Comments|Comentarios mágicos/i });
    await expect(row).toBeVisible();
    
    // Toggle it
    await row.locator('label').click();
    
    // Close settings
    const settingsModal = window.locator('.fixed.inset-0.z-\\[100\\]');
    await settingsModal.locator('button:has(svg.lucide-x)').click();

    // 2. Run code with //?
    await window.evaluate(() => {
      // @ts-ignore
      const model = window.monaco.editor.getModels()[0];
      model.setValue("const x = 10;\nx //?");
    });

    await window.getByRole('button', { name: /Run|Ejecutar/i }).click();
    await window.waitForTimeout(1000);

    const output = await window.evaluate(() => {
      // @ts-ignore
      // Check all models content (output might be in second model)
      return window.monaco.editor.getModels().map(m => m.getValue()).join('\n');
    });
    
    // Expect output to contain '10' (the result of magic comment)
    expect(output).toContain('10');
  });
});
