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
  getOutputValue,
  setInputCode,
} from './helpers/monaco';

let app: ElectronApplication;
let window: Page;

async function ensureConsoleInputFlowStarted(page: Page) {
  const consoleInput = page.getByTestId('console-input');
  if (await consoleInput.isVisible().catch(() => false)) {
    return;
  }

  const runButton = page.locator('[data-testid="run-button"]');
  await runButton.waitFor({ state: 'attached', timeout: 5000 });

  const autoRunDeadline = Date.now() + 1500;
  while (Date.now() < autoRunDeadline) {
    if (await consoleInput.isVisible().catch(() => false)) {
      return;
    }

    if (await runButton.isDisabled().catch(() => false)) {
      await expect(consoleInput).toBeVisible({ timeout: 5000 });
      return;
    }

    await page.waitForTimeout(100);
  }

  if (await consoleInput.isVisible().catch(() => false)) {
    return;
  }

  if (await runButton.isEnabled().catch(() => false)) {
    await runButton.click({ force: true });
  }

  await expect(consoleInput).toBeVisible({ timeout: 5000 });
}

test.beforeAll(async () => {
  const appPath = process.cwd();
  const mainScript = path.join(appPath, 'dist-electron/main.js');

  app = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [mainScript],
    env: process.env as { [key: string]: string },
  });

  app.on('console', (msg) => console.log(`[MAIN]: ${msg.text()}`));

  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForSelector('.monaco-editor', { timeout: 10000 });
  await ensureMonacoReady(window);
});

test.afterAll(async () => {
  if (app) {
    await app.close();
  }
});

test.describe('End-to-End System Validation', () => {
  test.beforeEach(async () => {
    test.setTimeout(60000);

    window.on('console', (msg) => console.log(`[BROWSER]: ${msg.text()}`));

    await window.evaluate(() => {
      localStorage.clear();
    });
  });

  test('1. Prompt and Alert Flow (ConsoleInput)', async () => {
    const code = `
      const name = prompt("What is your name?");
      console.log("Welcome " + name);
    `;

    await setInputCode(window, code);
    await ensureConsoleInputFlowStarted(window);
    const consoleInput = window.getByTestId('console-input');
    await expect(consoleInput).toBeVisible({ timeout: 10000 });
    await consoleInput.fill('PlaywrightUser');
    await window.keyboard.press('Enter');

    await expect
      .poll(async () => getOutputValue(window), { timeout: 10000 })
      .toContain('Welcome PlaywrightUser');
  });

  test('2. Alert Flow', async () => {
    const code = `
      alert("This is an alert");
      console.log("Alert closed");
    `;

    await setInputCode(window, code);
    await ensureConsoleInputFlowStarted(window);
    const consoleInput = window.getByTestId('console-input');
    await expect(consoleInput).toBeVisible({ timeout: 5000 });
    await expect(window.getByTestId('prompt-message')).toHaveText(
      'This is an alert'
    );

    await window.getByTestId('console-submit').click();
    await expect(consoleInput).not.toBeVisible();

    await expect
      .poll(async () => getOutputValue(window), { timeout: 10000 })
      .toContain('Alert closed');
  });

  test('3. Error Handling Scenario', async () => {
    await setInputCode(window, 'throw new Error("Test Error 123");');
    await window.click('[data-testid="run-button"]');

    await expect
      .poll(async () => getOutputValue(window), { timeout: 10000 })
      .toContain('Test Error 123');
  });

  test('4. Performance/Load (Basic)', async () => {
    await setInputCode(window, 'console.log("PERF_CHECK");');
    await window.click('[data-testid="run-button"]');

    await expect
      .poll(async () => getOutputValue(window), { timeout: 10000 })
      .toContain('PERF_CHECK');
  });
});
