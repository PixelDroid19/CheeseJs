import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import electronPath from 'electron';

test('launch app and check basic functionality', async () => {
  const appPath = process.cwd();

  const mainScript = path.join(appPath, 'dist-electron/main.js');

  const app = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [mainScript],
    env: process.env as { [key: string]: string },
  });

  const window = await app.firstWindow();

  // Capture console and errors for debugging
  window.on('console', (msg) => console.log('Browser console:', msg.text()));
  window.on('pageerror', (err) =>
    console.error('Page error:', err.message || err)
  );

  // Wait for load
  await window.waitForLoadState('domcontentloaded');

  // Wait for Monaco
  await window.waitForFunction(() => window.monaco && window.monaco.editor);

  const title = await window.title();

  // Expect title to contain CheeseJS (case insensitive)
  expect(title).toMatch(/CheeseJS/i);

  // Take screenshot for debugging
  await window.screenshot({ path: 'tests/debug-screenshot.png' });

  // Check Editor presence (we expect 2: input and output)
  const editors = window.locator('.monaco-editor');
  await expect(editors.first()).toBeVisible({ timeout: 10000 });
  await expect(editors).toHaveCount(2);

  // Check Floating Toolbar buttons
  // Using getByRole with name matches the title attribute if there's no text
  await expect(
    window.getByRole('button', { name: /Run|Ejecutar/i })
  ).toBeVisible();

  // Open Settings
  await window.getByTestId('settings-button').click({ force: true });
  await expect(window.locator('.fixed.inset-0').first()).toBeVisible();

  await app.close();
});
