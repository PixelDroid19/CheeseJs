import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import electronPath from 'electron';

// Give enough time for Electron boot and Pyodide warm-up
test.setTimeout(120000);

let app: ElectronApplication;
let page: Page;

async function clearOutput(p: Page) {
  await p.evaluate(() => {
    // @ts-expect-error - Monaco is injected globally
    const models = window.monaco.editor.getModels();
    if (models.length > 1) {
      models[1].setValue('');
    }
  });
}

async function setCode(p: Page, code: string) {
  await clearOutput(p);
  await p.evaluate((c) => {
    // @ts-expect-error - Monaco is injected globally
    const model = window.monaco.editor.getModels()[0];
    model.setValue(c);
  }, code);
  // Let language detection settle
  await p.waitForTimeout(1200);
}

async function runAndGetOutput(p: Page, waitMs = 4000) {
  await p.getByRole('button', { name: /Run|Ejecutar/i }).click();
  await p.waitForTimeout(waitMs);
  const output = await p.evaluate(() => {
    // @ts-expect-error - Monaco is injected globally
    const models = window.monaco.editor.getModels();
    if (models.length > 1) {
      return models[1].getValue();
    }
    return '';
  });
  return output as string;
}

test.beforeAll(async () => {
  const appPath = process.cwd();
  const mainScript = path.join(appPath, 'dist-electron/main.js');

  app = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [mainScript],
  });

  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  await expect(page.locator('.monaco-editor').first()).toBeVisible({
    timeout: 30000,
  });
  await page.waitForFunction(
    () => {
      // @ts-expect-error - Monaco is injected globally
      return window.monaco !== undefined && window.monaco.editor !== undefined;
    },
    { timeout: 30000 }
  );
});

test.afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// End-to-end flow covering JS -> TS -> Python without reloading the app
// ---------------------------------------------------------------------------

test.describe('Cross-language execution flow', () => {
  test('runs JS, TS, and Python sequentially in one session', async () => {
    // JavaScript
    await setCode(page, "console.log('JS flow ok')");
    let output = await runAndGetOutput(page, 3000);
    expect(output).toContain('JS flow ok');

    // TypeScript
    await setCode(page, "const msg: string = 'TS flow ok';\nconsole.log(msg)");
    output = await runAndGetOutput(page, 4000);
    expect(output).toContain('TS flow ok');

    // Python
    await setCode(page, "print('PY flow ok')");
    output = await runAndGetOutput(page, 9000);
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

    await setCode(page, code);
    const output = await runAndGetOutput(page, 4000);
    expect(output).toContain('js-start');
    expect(output).toContain('js-after-await');
    expect(output.toLowerCase()).toContain('caught');
    expect(output).toContain('boom-js');
  });

  test('TypeScript "satisfies" operator and literal types', async () => {
    const code = `const config = { mode: 'dark', debug: true } satisfies { mode: 'dark' | 'light'; debug: boolean };
console.log(config.mode);

const tuple: readonly [number, string] = [1, 'ok'];
console.log(tuple);`;

    await setCode(page, code);
    const output = await runAndGetOutput(page, 4000);
    expect(output).toContain('dark');
    expect(output).toMatch(/1.*ok/);
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

    await setCode(page, code);
    const output = await runAndGetOutput(page, 10000);
    expect(output).toContain('handled');
    expect(output).toContain('cleanup done');
    expect(output.toLowerCase()).not.toContain('traceback');
  });
});
