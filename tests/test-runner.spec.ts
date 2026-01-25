import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import electronPath from 'electron';

test('test runner flow: open panel, insert template, run tests', async () => {
  const appPath = process.cwd();
  const mainScript = path.join(appPath, 'dist-electron/main.js');

  const app = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [mainScript],
    env: process.env as { [key: string]: string },
  });

  const window = await app.firstWindow();

  // Wait for load
  await window.waitForLoadState('domcontentloaded');

  // 1. Open Test Panel
  await window.getByRole('button', { name: /Tests/i }).click();

  // Check if panel header exists
  await expect(window.locator('text=Tests').first()).toBeVisible();

  // 2. Insert Basic Test Template
  // Toggle templates menu
  await window.getByRole('button', { name: /Insert Template/i }).click();

  // Select "Basic Test"
  await window.getByRole('button', { name: /Basic Test/i }).click();

  // 3. Run Tests (Inline)
  // Click "Run Current Code" (or the Play icon in the test panel header)
  const runButton = window
    .getByRole('button', { name: /Run Tests from Editor/i })
    .or(window.getByRole('button', { name: /Run Current Code/i }));
  await runButton.click();

  // 4. Verify Results
  // Expect "Inline Tests" file to appear
  await expect(window.locator('text=Inline Tests')).toBeVisible({
    timeout: 10000,
  });

  // Expand it if needed (it might auto-expand or we might need to click)
  // But we can check for the test name "My Feature" from the template
  await expect(window.locator('text=My Feature')).toBeVisible();

  // Check for success status (green checkmark or text)
  // The template has `it('should work correctly', ...)`
  await expect(window.locator('text=should work correctly')).toBeVisible();

  // Optional: Check if passed count is 1
  await expect(window.locator('text=1 ✓')).toBeVisible();

  await app.close();
});
