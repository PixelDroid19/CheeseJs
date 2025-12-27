import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

// Give enough time for Electron boot and Pyodide warm-up
test.setTimeout(120000);

let app: ElectronApplication;
let window: Page;

async function clearOutput(page: Page) {
  await page.evaluate(() => {
    // @ts-ignore
    const models = window.monaco.editor.getModels();
    if (models.length > 1) {
      models[1].setValue('');
    }
  });
}

async function setCode(page: Page, code: string) {
  await clearOutput(page);
  await page.evaluate((c) => {
    // @ts-ignore
    const model = window.monaco.editor.getModels()[0];
    model.setValue(c);
  }, code);
  // Let language detection settle
  await page.waitForTimeout(1200);
}

async function runAndGetOutput(page: Page, waitMs = 4000) {
  await page.getByRole('button', { name: /Run|Ejecutar/i }).click();
  await page.waitForTimeout(waitMs);
  const output = await page.evaluate(() => {
    // @ts-ignore
    const models = window.monaco.editor.getModels();
    if (models.length > 1) {
      return models[1].getValue();
    }
    return '';
  });
  return output as string;
}

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

  await expect(window.locator('.monaco-editor').first()).toBeVisible({ timeout: 30000 });
  await window.waitForFunction(() => {
    // @ts-ignore
    return window.monaco !== undefined && window.monaco.editor !== undefined;
  }, { timeout: 30000 });
});

test.afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// End-to-end flow covering JS -> TS -> Python without reloading the app
// ---------------------------------------------------------------------------

test.describe('Cross-language execution flow', () => {
  test('runs JS, TS, and Python sequentially in one session', async () => {
    await setCode(window, "console.log('JS flow ok');");
    let output = await runAndGetOutput(window, 3000);
    expect(output).toContain('JS flow ok');

    await setCode(window, "const msg: string = 'TS flow ok';\nconsole.log(msg);");
    output = await runAndGetOutput(window, 4000);
    expect(output).toContain('TS flow ok');

    await setCode(window, "print('PY flow ok')");
    output = await runAndGetOutput(window, 9000);
    expect(output).toContain('PY flow ok');
  });
});

// ---------------------------------------------------------------------------
// Deeper execution scenarios per language
// ---------------------------------------------------------------------------

test.describe('Advanced execution scenarios', () => {
  test('JavaScript async flow and error handling', async () => {
    const code = `(async () => {
  console.log('js-start');
  await Promise.resolve();
  console.log('js-after-await');
  try {
    throw new Error('boom-js');
  } catch (err) {
    console.error('caught', err.message);
  }
})();`;

    await setCode(window, code);
    const output = await runAndGetOutput(window, 4000);
    expect(output).toContain('js-start');
    expect(output).toContain('js-after-await');
    expect(output.toLowerCase()).toContain('caught');
    expect(output).toContain('boom-js');
  });

  test('TypeScript "satisfies" operator and literal types', async () => {
    const code = `const config = { mode: 'dark', debug: true } satisfies { mode: 'dark' | 'light'; debug: boolean };
console.log(config.mode);
const tuple: readonly [number, string] = [1, 'ok'];
console.log(tuple[0], tuple[1]);`;

    await setCode(window, code);
    const output = await runAndGetOutput(window, 4000);
    expect(output).toContain('dark');
    expect(output).toMatch(/1\s+ok/);
  });

  test('Python exception handling with traceback avoided', async () => {
    const code = `def boom():
    raise ValueError('boom-py')

try:
    boom()
except ValueError as exc:
    print('handled', exc)
finally:
    print('cleanup done')`;

    await setCode(window, code);
    const output = await runAndGetOutput(window, 10000);
    expect(output).toContain('handled boom-py');
    expect(output).toContain('cleanup done');
    expect(output.toLowerCase()).not.toContain('traceback');
  });
});
