import { test, expect } from '@playwright/test';

test('loads the workbench shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/CheeseJS/i);
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.getByTestId('run-button')).toBeVisible();
  await expect(page.getByText('VM Ready')).toBeVisible();
});

test('executes JavaScript from the editor', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.editor && window.useEditorTabsStore);

  await page.evaluate(() => {
    const code = 'console.log("cheese-e2e");\n42';
    const store = window.useEditorTabsStore.getState();
    store.updateTabCode(store.activeTabId, code);
    store.updateTabLanguage(store.activeTabId, 'javascript');
    window.editor.setValue(code);
  });

  await page.getByTestId('run-button').click();

  await expect(
    page.getByTestId('result-panel').getByText('cheese-e2e')
  ).toBeVisible();
});
