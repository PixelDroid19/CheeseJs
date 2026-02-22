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
  await ensureMonacoReady(page);
});

test.afterAll(async () => {
  await app.close();
});

test.describe('Code Execution', () => {
  test('should execute simple code and show output', async () => {
    await setInputCode(page, "console.log('Hello from E2E')");
    const output = await runAndGetOutput(page, 10000);
    expect(output).toContain('Hello from E2E');
  });

  test('should handle multiple console.log statements', async () => {
    await setInputCode(page, "console.log('Line 1');\nconsole.log('Line 2');");
    const output = await runAndGetOutput(page, 10000);
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 2');
  });
});
