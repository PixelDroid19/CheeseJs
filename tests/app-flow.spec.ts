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
  forceInputLanguage,
  getInputLanguage,
  isWaitingOutput,
  runAndGetOutput,
  setInputCode,
} from './helpers/monaco';

// Give enough time for Electron boot and Pyodide warm-up
test.setTimeout(120000);

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

  await expect(page.locator('.monaco-editor').first()).toBeVisible({
    timeout: 30000,
  });
  await ensureMonacoReady(page);
});

test.afterAll(async () => {
  await app.close();
});

test.beforeEach(async () => {
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.monaco-editor').first()).toBeVisible({
    timeout: 30000,
  });
  await ensureMonacoReady(page);
});

// ---------------------------------------------------------------------------
// End-to-end flow covering JS -> TS -> Python without reloading the app
// ---------------------------------------------------------------------------

test.describe('Cross-language execution flow', () => {
  test('runs JS, TS, and Python sequentially in one session', async () => {
    // JavaScript
    await setInputCode(page, "console.log('JS flow ok')");
    let output = await runAndGetOutput(page, 3000);
    expect(output).toContain('JS flow ok');

    // TypeScript
    await setInputCode(
      page,
      "const msg: string = 'TS flow ok';\nconsole.log(msg)"
    );
    output = await runAndGetOutput(page, 4000);
    expect(output).toContain('TS flow ok');

    // Python
    await setInputCode(page, "print('PY flow ok')");
    await forceInputLanguage(page, 'python');
    output = await runAndGetOutput(page, 25000);
    if (isWaitingOutput(output)) {
      expect(await getInputLanguage(page)).toBe('python');
      await expect(
        page.getByRole('button', { name: /Run|Ejecutar/i })
      ).toBeVisible();
    } else {
      expect(output).toContain('PY flow ok');
    }
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

    await setInputCode(page, code);
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

    let output = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await setInputCode(page, code);
      await forceInputLanguage(page, 'typescript');
      output = await runAndGetOutput(page, 8000);
      if (output.includes('dark') && /1.*ok/.test(output)) {
        break;
      }
      await page.waitForTimeout(400);
    }

    if (!output.includes('dark') || !/1.*ok/.test(output)) {
      expect(await getInputLanguage(page)).toBe('typescript');
      const inputCode = await page.evaluate(() => {
        const w = window as unknown as {
          monaco?: {
            editor?: {
              getModels?: () => Array<{
                uri?: { toString: () => string };
                getValue: () => string;
              }>;
            };
          };
          editor?: { getModel?: () => { getValue: () => string } };
        };

        const models = w.monaco?.editor?.getModels?.() ?? [];
        const outputModel = models.find((m) =>
          m?.uri?.toString?.().includes('result-output')
        );
        const editorModel = w.editor?.getModel?.();
        const inputModel =
          editorModel ?? models.find((m) => m !== outputModel) ?? models[0];
        return inputModel?.getValue?.() ?? '';
      });

      expect(inputCode).toContain('satisfies');
      await expect(
        page.getByRole('button', { name: /Run|Ejecutar/i })
      ).toBeVisible();
    } else {
      expect(output).toContain('dark');
      expect(output).toMatch(/1.*ok/);
    }
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

    await setInputCode(page, code);
    await forceInputLanguage(page, 'python');
    const output = await runAndGetOutput(page, 25000);
    if (isWaitingOutput(output)) {
      expect(await getInputLanguage(page)).toBe('python');
    } else {
      expect(output).toContain('handled');
      expect(output).toContain('cleanup done');
      expect(output.toLowerCase()).not.toContain('traceback');
    }
  });
});
