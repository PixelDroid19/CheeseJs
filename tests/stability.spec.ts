import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  const electronPath = require('electron');
  const appPath = path.join(__dirname, '..');
  const mainScript = path.join(appPath, 'dist-electron/main.js');

  app = await electron.launch({
    executablePath: electronPath,
    args: [mainScript],
  });

  window = await app.firstWindow();
  
  // Capture console logs
  window.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));

  await window.waitForLoadState('domcontentloaded');
  
  // Wait for editor to be ready
  await expect(window.locator('.monaco-editor').first()).toBeVisible({ timeout: 20000 });
  await window.waitForFunction(() => window.monaco !== undefined, { timeout: 20000 });
});

test.afterAll(async () => {
  if (app) {
    await app.close();
  }
});

test.describe('Editor Stability & Language Switching', () => {
  
  const setCode = async (code: string) => {
    await window.evaluate((c) => {
      // @ts-ignore
      const editor = window.editor;
      if (editor) {
        editor.setValue(c);
      }
    }, code);
    // Give time for onChange -> detectLanguage -> setLanguage -> React Render -> Model Switch
    await window.waitForTimeout(1000);
  };

  const getMarkers = async () => {
    return await window.evaluate(() => {
      // @ts-ignore
      const model = window.editor.getModel();
      return window.monaco.editor.getModelMarkers({ resource: model.uri });
    });
  };

  const getLanguageId = async () => {
    return await window.evaluate(() => {
      // @ts-ignore
      return window.editor.getModel().getLanguageId();
    });
  };

  const logModels = async () => {
    return await window.evaluate(() => {
        // @ts-ignore
        return window.monaco.editor.getModels().map(m => ({
            uri: m.uri.toString(),
            lang: m.getLanguageId(),
            value: m.getValue()
        }));
    });
  };

  const getOutputContent = async () => {
    return await window.evaluate(() => {
      // @ts-ignore
      const models = window.monaco.editor.getModels();
      const outputModel = models.find((m: any) => m.uri.toString().includes('result-output.js'));
      return outputModel ? outputModel.getValue() : null;
    });
  };

  const waitForLanguage = async (expectedLang: string) => {
      try {
        await window.waitForFunction((lang) => {
            // @ts-ignore
            return window.editor && window.editor.getModel().getLanguageId() === lang;
        }, expectedLang, { timeout: 10000 });
      } catch (e) {
          const currentLang = await getLanguageId();
          console.error(`Timeout waiting for language ${expectedLang}. Current: ${currentLang}`);
          throw e;
      }
  };

  test('should handle simple JavaScript code without errors and show output', async () => {
    const jsCode = `
      const a = 10;
      const b = 20;
      console.log('Result:', a + b);
    `;
    
    await setCode(jsCode);
    await waitForLanguage('javascript');
    
    // Verify Language
    expect(await getLanguageId()).toBe('javascript');
    
    // Verify No Errors
    await expect.poll(async () => {
        const markers = await getMarkers();
        const errors = markers.filter(m => m.severity === 8);
        return errors;
    }, { timeout: 10000 }).toEqual([]);

    // Verify Output
    await expect.poll(async () => {
      const output = await getOutputContent();
      // Output might be JSON stringified array ["Result:", 30]
      return output;
    }, { timeout: 10000 }).toEqual(expect.stringContaining('30'));
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
        console.log('Timeout waiting for typescript switch. Current models:', JSON.stringify(await logModels(), null, 2));
    }
    
    // Verify Language
    expect(await getLanguageId()).toBe('typescript');
    
    // Verify No Errors (Crucial check for the previous bug)
    await expect.poll(async () => {
        const markers = await getMarkers();
        const errors = markers.filter(m => m.severity === 8);
        return errors;
    }, { timeout: 10000 }).toEqual([]);
  });

  test('should switch back to JavaScript without lingering errors', async () => {
    const jsCode = `console.log('Back to JS');`;
    
    await setCode(jsCode);
    await waitForLanguage('javascript');
    
    // Verify Language
    expect(await getLanguageId()).toBe('javascript');
    
    // Verify No Errors (Ensure TS errors don't persist)
    await expect.poll(async () => {
        const markers = await getMarkers();
        const errors = markers.filter(m => m.severity === 8);
        return errors;
    }, { timeout: 10000 }).toEqual([]);
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
    
    await expect.poll(async () => {
        const markers = await getMarkers();
        const errors = markers.filter(m => m.severity === 8);
        return errors;
    }, { timeout: 10000 }).toEqual([]);
  });
  
  test('should not have duplicate identifier errors when switching back to TS', async () => {
      // Switch to JS first
      await setCode("console.log('reset');");
      await waitForLanguage('javascript');
      
      // Switch back to the same TS code that defines a function/variable
      const tsCode = `
        const myVar: number = 123;
        console.log(myVar);
      `;
      await setCode(tsCode);
      await waitForLanguage('typescript');
      
      expect(await getLanguageId()).toBe('typescript');
      
      // Check for "Duplicate identifier 'myVar'"
      await expect.poll(async () => {
          const markers = await getMarkers();
          const duplicateErrors = markers.filter(m => m.message.includes('Duplicate identifier'));
          return duplicateErrors;
      }, { timeout: 10000 }).toEqual([]);
  });

});
