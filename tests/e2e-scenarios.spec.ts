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
  clearOutputModel,
  ensureMonacoReady,
  setInputCode,
} from './helpers/monaco';

let app: ElectronApplication;
let window: Page;

async function clearEditor(page: Page, index: number = 0) {
  if (index === 0) {
    await setInputCode(page, '');
  } else {
    await clearOutputModel(page);
  }
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

    const aiSettings = {
      state: {
        provider: 'local',
        localConfig: {
          baseURL: 'http://127.0.0.1:1234/v1',
          modelId: 'mistralai/ministral-3-14b-reasoning',
          apiKey: 'not-needed',
        },
        apiKeys: {
          local: 'not-needed',
          openai: '',
          anthropic: '',
          google: '',
        },
        enableChat: true,
        enableInlineCompletion: true,
      },
      version: 0,
    };

    await window.evaluate((settings) => {
      localStorage.setItem('ai-settings-storage', JSON.stringify(settings));
    }, aiSettings);

    await window.reload();
    await window.waitForSelector('.monaco-editor', { timeout: 10000 });
    await ensureMonacoReady(window);

    await clearEditor(window, 0);

    const chatPanelInput = window.locator(
      'textarea[placeholder*="Ask"], textarea[placeholder*="Config"]'
    );
    if (await chatPanelInput.isVisible()) {
      const closeChat = window.getByTestId('close-ai-chat');
      if (await closeChat.isVisible()) {
        await closeChat.click();
      }
      await expect(chatPanelInput).not.toBeVisible();
    }
  });

  test('1. AI Interaction Flow (UI Validation)', async () => {
    const toggle = window.getByTestId('toggle-chat');
    if (await toggle.isVisible()) {
      await toggle.click();
      const closeChat = window.getByTestId('close-ai-chat');
      await expect(closeChat).toBeVisible({ timeout: 5000 });
    }
  });

  test('2. Prompt and Alert Flow (ConsoleInput)', async () => {
    const code = `
      const name = prompt("What is your name?");
      console.log("Welcome " + name);
    `;

    await setInputCode(window, code);
    const runButton = window.locator('[data-testid="run-button"]');
    await runButton.waitFor({ state: 'attached', timeout: 5000 });
    await runButton.click();

    const consoleInput = window.getByTestId('console-input');
    await expect(consoleInput).toBeVisible({ timeout: 10000 });
    await consoleInput.fill('PlaywrightUser');
    await window.keyboard.press('Enter');

    const outputEditor = window.locator('.monaco-editor').nth(1);
    await expect(outputEditor).toContainText('Welcome PlaywrightUser', {
      timeout: 10000,
    });
  });

  test('3. Alert Flow', async () => {
    const code = `
      alert("This is an alert");
      console.log("Alert closed");
    `;

    await setInputCode(window, code);
    await window.click('[data-testid="run-button"]');

    const consoleInput = window.getByTestId('console-input');
    await expect(consoleInput).toBeVisible({ timeout: 5000 });
    await expect(window.getByTestId('prompt-message')).toHaveText(
      'This is an alert'
    );

    await window.getByTestId('console-submit').click();
    await expect(consoleInput).not.toBeVisible();

    const outputEditor = window.locator('.monaco-editor').nth(1);
    await expect(outputEditor).toContainText('Alert closed', {
      timeout: 10000,
    });
  });

  test('4. Error Handling Scenario', async () => {
    await setInputCode(window, 'throw new Error("Test Error 123");');
    await window.click('[data-testid="run-button"]');

    const outputEditor = window.locator('.monaco-editor').nth(1);
    await expect(outputEditor).toContainText('Test Error 123', {
      timeout: 10000,
    });
  });

  test('5. Performance/Load (Basic)', async () => {
    await setInputCode(window, 'console.log("PERF_CHECK");');
    await window.click('[data-testid="run-button"]');

    const outputEditor = window.locator('.monaco-editor').nth(1);
    await expect(outputEditor).toContainText('PERF_CHECK', { timeout: 10000 });
  });

  test('6. AI Chat Interaction (Real)', async () => {
    const toggleButton = window.getByTestId('toggle-chat');

    if (await toggleButton.isVisible()) {
      await toggleButton.click();
    }

    const chatInput = window.locator(
      'textarea[placeholder*="Ask"], textarea[placeholder*="Config"]'
    );
    const closeChat = window.getByTestId('close-ai-chat');
    await expect(closeChat).toBeVisible({ timeout: 5000 });

    const hasInput = await chatInput.first().isVisible();
    if (!hasInput) {
      return;
    }

    const placeholder =
      (await chatInput.first().getAttribute('placeholder')) || '';

    if (/Configure/i.test(placeholder)) {
      await expect(window.getByText(/Configure.*AI/i)).toBeVisible();
    } else {
      const prompt = 'Write a hello world function in JavaScript';
      await chatInput.first().fill(prompt);
      await chatInput.first().press('Enter');
      await expect(window.getByText(prompt)).toBeVisible();
    }
  });
});
