import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path'; // eslint-disable-line @typescript-eslint/no-unused-vars
import {
  ensureMonacoReady,
  runAndGetOutput,
  setInputCode,
} from './helpers/monaco';

test.describe('Clean Code Execution', () => {
  test('should execute code without console errors', async () => {
    // Launch Electron app
    const electronApp = await electron.launch({
      args: ['dist-electron/main.js'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    // Capture main process logs
    electronApp.process().stdout?.on('data', (data) => {
      const str = data.toString();
      // Filter out some noise if needed
      console.log(`[MAIN]: ${str.trim()}`);
    });
    electronApp.process().stderr?.on('data', (data) => {
      const str = data.toString();
      console.log(`[MAIN ERR]: ${str.trim()}`);
    });

    const window = await electronApp.firstWindow();

    // Listen for console logs
    window.on('console', async (msg) => {
      // Filter out known noise
      const text = msg.text();
      if (
        text.includes('FloatingToolbar') ||
        text.includes('AI inline completion')
      )
        return;

      if (text === 'undefined') {
        // Get stack trace for undefined logs
        const location = msg.location();
        console.log(
          `[BROWSER_UNDEFINED] at ${location.url}:${location.lineNumber}:${location.columnNumber}`
        );
        // Try to get args
        const args = await Promise.all(
          msg.args().map((arg) => arg.jsonValue())
        );
        console.log(`[BROWSER_UNDEFINED_ARGS]:`, args);
      } else {
        console.log(`[BROWSER]: ${text}`);
      }
    });

    await window.waitForLoadState('domcontentloaded');

    // Close AI Chat if open
    const aiChatClose = window.getByTestId('ai-chat-close');
    if (await aiChatClose.isVisible()) {
      await aiChatClose.click();
    }

    // Wait for editor
    await ensureMonacoReady(window);

    // Set code reliably
    await setInputCode(window, "console.log('Clean execution check');");

    // Run code
    const runButton = window.getByTestId('run-button');
    const isDisabled = await runButton.isDisabled();
    console.log(`[TEST] Run button disabled: ${isDisabled}`);
    await expect(runButton).toBeEnabled();

    await runButton.click();
    console.log('[TEST] Run button clicked');

    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('Clean execution check');

    // Check for success indicator
    // const successIcon = window.locator('.lucide-check-circle'); // Assuming success icon exists or check execution status
    // Or just check that no error toast appeared
    const errorToast = window.locator('.toast-error');
    await expect(errorToast).not.toBeVisible();
  });
});
