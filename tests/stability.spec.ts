import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import electronPath from 'electron';

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
  // Capture console and errors for debugging
  page.on('console', (msg) => console.log('Browser console:', msg.text()));
  page.on('pageerror', (err) => console.error('Page error:', err));

  await page.waitForLoadState('domcontentloaded');

  // Wait for editor to be ready
  await expect(page.locator('.monaco-editor').first()).toBeVisible({
    timeout: 20000,
  });
  await page.waitForFunction(() => (window as any).monaco !== undefined, {
    timeout: 20000,
  });
});

test.afterAll(async () => {
  if (app) {
    await app.close();
  }
});

test.describe('Editor Stability & Language Switching', () => {
  const setCode = async (code: string) => {
    await page.evaluate((c) => {
      // @ts-expect-error - Monaco is injected globally
      const editor = window.editor;
      if (editor) {
        editor.setValue(c);
      }
    }, code);
    // Give time for onChange -> detectLanguage -> setLanguage -> React Render -> Model Switch
    await page.waitForTimeout(1000);
  };

  const getMarkers = async () => {
    return await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      const model = window.editor.getModel();
      // @ts-expect-error - Monaco is injected globally
      return window.monaco.editor.getModelMarkers({ resource: model.uri });
    });
  };

  const getLanguageId = async () => {
    return await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      return window.editor.getModel().getLanguageId();
    });
  };

  const getOutputContent = async () => {
    return await page.evaluate(() => {
      // @ts-expect-error - Monaco is injected globally
      const models = window.monaco.editor.getModels();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outputModel = models.find((m: any) =>
        m.uri.toString().includes('result-output.js')
      );
      return outputModel ? outputModel.getValue() : null;
    });
  };

  const waitForLanguage = async (expectedLang: string) => {
    try {
      await page.waitForFunction(
        (lang) => {
          // @ts-expect-error - Monaco is injected globally
          return (
            window.editor && window.editor.getModel().getLanguageId() === lang
          );
        },
        expectedLang,
        { timeout: 10000 }
      );
    } catch (e) {
      const currentLang = await getLanguageId();
      console.error(
        `Timeout waiting for language ${expectedLang}. Current: ${currentLang}`
      );
      throw e;
    }
  };

  test('should handle simple JavaScript code without errors and show output', async () => {
    const jsCode = `
      const a = 10;
      const b = 20;
      console.log(a + b);
    `;

    await setCode(jsCode);
    await waitForLanguage('javascript');

    // Click Run button to ensure execution
    await page.getByRole('button', { name: /Run|Ejecutar/i }).click();

    // Verify Language
    expect(await getLanguageId()).toBe('javascript');

    // Verify No Errors
    await expect
      .poll(
        async () => {
          const markers = await getMarkers();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errors = markers.filter((m: any) => m.severity === 8);
          return errors;
        },
        { timeout: 10000 }
      )
      .toEqual([]);

    // Verify Output
    await expect
      .poll(
        async () => {
          const output = await getOutputContent();
          // Output might be JSON stringified array ["Result:", 30]
          return output;
        },
        { timeout: 10000 }
      )
      .toEqual(expect.stringContaining('30'));
  });

  test('should switch to TypeScript and handle generics correctly', async () => {
    const tsCode = `
      function concat< N extends number[], S extends string[] >(nums: [...N], strs: [...S]): [...N, ...S] {
        return [...nums, ...strs];
      }
      const result = concat([1,2,3], ['hello world']);
    `;

    await setCode(tsCode);

    // Force wait for language switch if detection is slow
    try {
      await waitForLanguage('typescript');
    } catch (e) {
      console.warn('Wait for language timeout', e);
    }

    // Verify Language
    expect(await getLanguageId()).toBe('typescript');

    // Verify No Errors (Crucial check for the previous bug)
    await expect
      .poll(
        async () => {
          const markers = await getMarkers();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errors = markers.filter((m: any) => m.severity === 8);
          return errors;
        },
        { timeout: 10000 }
      )
      .toEqual([]);
  });

  test('should switch back to JavaScript without lingering errors', async () => {
    const jsCode = `
      const x = 100;
      const y = 200;
      console.log(x + y);
    `;

    await setCode(jsCode);
    await waitForLanguage('javascript');

    // Verify Language
    expect(await getLanguageId()).toBe('javascript');

    // Verify No Errors (Ensure TS errors don't persist)
    await expect
      .poll(
        async () => {
          const markers = await getMarkers();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errors = markers.filter((m: any) => m.severity === 8);
          return errors;
        },
        { timeout: 10000 }
      )
      .toEqual([]);
  });

  test('should handle pasting mixed content and stabilize', async () => {
    // Simulating a rapid change or paste
    const complexTs = `
    interface User {
      id: number;
      name: string;
      userType: 'admin' | 'user';
    }
    const u: User = { id: 1, name: 'Test', userType: 'admin' };
    `;

    await setCode(complexTs);
    await waitForLanguage('typescript');

    expect(await getLanguageId()).toBe('typescript');

    await expect
      .poll(
        async () => {
          const markers = await getMarkers();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errors = markers.filter((m: any) => m.severity === 8);
          return errors;
        },
        { timeout: 10000 }
      )
      .toEqual([]);
  });

  test('should not have duplicate identifier errors when switching back to TS', async () => {
    // Switch to JS first
    await setCode("console.log('switching');");
    await waitForLanguage('javascript');

    // Switch back to the same TS code that defines a function/variable
    const tsCode = `
    const myVar: number = 123;

    `;
    await setCode(tsCode);
    await waitForLanguage('typescript');

    expect(await getLanguageId()).toBe('typescript');

    // Check for "Duplicate identifier 'myVar'"
    await expect
      .poll(
        async () => {
          const markers = await getMarkers();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const duplicateErrors = markers.filter((m: any) =>
            m.message.includes('Duplicate identifier')
          );
          return duplicateErrors;
        },
        { timeout: 10000 }
      )
      .toEqual([]);
  });
});
