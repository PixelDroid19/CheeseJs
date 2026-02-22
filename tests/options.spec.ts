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
  runAndGetOutput,
  setInputCode,
} from './helpers/monaco';

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
  await ensureMonacoReady(page);
});

test.beforeEach(async () => {
  // Ensure AI Chat is closed
  const closeChat = page.getByTestId('close-ai-chat');
  if (await closeChat.isVisible()) {
    await closeChat.click();
    await expect(closeChat).not.toBeVisible();
  }
});

test.afterAll(async () => {
  await app.close();
});

async function openSettings(p: Page) {
  await p.evaluate(() => {
    const btn = document.querySelector(
      '[data-testid="settings-button"]'
    ) as HTMLButtonElement | null;
    btn?.click();
  });

  await expect(p.locator('.fixed.inset-0').first()).toBeVisible();
}

test.describe('Application Options & Behavior', () => {
  test('should toggle "Show undefined" and affect output', async () => {
    // 1. Open Settings
    await openSettings(page);

    // 2. Go to Formatting
    await page.getByRole('button', { name: /Formatting|Formato/i }).click();

    // 3. Find "Show undefined" toggle
    // The label text in Spanish is "Mostrar valores indefinidos explícitamente"
    const row = page
      .locator('div.flex.items-center.justify-between', {
        has: page.locator('span', {
          hasText: /Show undefined|Mostrar valores indefinidos/i,
        }),
      })
      .first();
    await expect(row).toBeVisible();

    // Click the toggle inside the row (label wrapper)
    await row.locator('label').click();

    // 4. Ensure top-level results are enabled (required for undefined expression visibility)
    await page.getByRole('button', { name: /Compilation|Compilaci/i }).click();
    const topLevelRow = page
      .locator('div.flex.items-center.justify-between', {
        has: page.locator('span', {
          hasText:
            /Show top-level results|Mostrar resultados de nivel superior/i,
        }),
      })
      .first();
    await expect(topLevelRow).toBeVisible();
    const topLevelToggle = topLevelRow.locator('input[type="checkbox"]');
    if (!(await topLevelToggle.isChecked())) {
      await topLevelRow.locator('label').click();
    }

    // Close settings
    const settingsModal = page.locator('.fixed.inset-0.z-\\[100\\]');
    await settingsModal.locator('button:has(svg.lucide-x)').click();

    // 5. Run code that returns undefined explicitly
    await setInputCode(page, 'const maybe = undefined;\nmaybe;');
    const output = await runAndGetOutput(page, 10000);

    // If enabled, it should show 'undefined'
    expect(output).toContain('undefined');
  });

  test('should handle runtime errors gracefully', async () => {
    await setInputCode(page, "throw new Error('Test Error')");
    const output = await runAndGetOutput(page, 10000);

    expect(output).toContain('Test Error');
  });

  test('should support Magic Comments', async () => {
    // 1. Ensure Magic Comments are enabled
    await openSettings(page);
    await page.getByRole('button', { name: /Compilation|Compilaci/i }).click();

    const row = page
      .locator('div.flex.items-center.justify-between', {
        has: page.locator('span', {
          hasText: /Magic Comments|Comentarios mágicos/i,
        }),
      })
      .first();
    await expect(row).toBeVisible();

    // Ensure it's enabled (default may already be true)
    const toggleInput = row.locator('input[type="checkbox"]');
    if (!(await toggleInput.isChecked())) {
      await row.locator('label').click();
    }

    // Close settings
    const settingsModal = page.locator('.fixed.inset-0.z-\\[100\\]');
    await settingsModal.locator('button:has(svg.lucide-x)').click();

    // 2. Run code with //?
    await setInputCode(page, 'const x = 10;\nx //?');
    const output = await runAndGetOutput(page, 10000);

    // Expect output to contain '10' (the result of magic comment)
    expect(output).toContain('10');
  });
});
