import type { Page } from '@playwright/test';

export function normalizeOutputText(text: string): string {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isWaitingOutput(text: string): boolean {
  return /waiting\s+for\s+output/i.test(normalizeOutputText(text));
}

async function getMonacoModelSnapshot(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{
            uri?: { toString: () => string };
            getValue: () => string;
            getLanguageId: () => string;
            setValue: (value: string) => void;
          }>;
        };
      };
      editor?: {
        getModel?: () => {
          uri?: { toString: () => string };
          getValue: () => string;
          getLanguageId: () => string;
          setValue: (value: string) => void;
        };
      };
    };

    const models = w.monaco?.editor?.getModels?.() ?? [];
    const outputModel = models.find((m) =>
      m?.uri?.toString?.().includes('result-output')
    );
    const editorModel = w.editor?.getModel?.();
    const inputModel =
      editorModel ?? models.find((m) => m !== outputModel) ?? models[0] ?? null;

    return {
      hasModels: models.length > 0,
      inputValue: inputModel?.getValue?.() ?? '',
      inputLanguage: inputModel?.getLanguageId?.() ?? '',
      outputValue: outputModel?.getValue?.() ?? '',
      modelCount: models.length,
    };
  });
}

export async function ensureMonacoReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        monaco?: { editor?: { getModels?: () => unknown[] } };
      };
      const models = w.monaco?.editor?.getModels?.() ?? [];
      return models.length >= 1;
    },
    { timeout: 30000 }
  );
}

export async function clearOutputModel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{
            uri?: { toString: () => string };
            setValue: (value: string) => void;
          }>;
        };
      };
    };
    const models = w.monaco?.editor?.getModels?.() ?? [];
    const outputModel = models.find((m) =>
      m?.uri?.toString?.().includes('result-output')
    );
    outputModel?.setValue('');
  });

  try {
    await page.waitForFunction(
      () => {
        const w = window as unknown as {
          monaco?: {
            editor?: {
              getModels?: () => Array<{
                uri?: { toString: () => string };
                getValue: () => string;
              }>;
            };
          };
        };

        const models = w.monaco?.editor?.getModels?.() ?? [];
        const outputModel = models.find((m) =>
          m?.uri?.toString?.().includes('result-output')
        );
        return !outputModel || outputModel.getValue() === '';
      },
      { timeout: 2000 }
    );
  } catch {
    // Best effort clear; continue even if Monaco swaps models during rapid transitions.
  }
}

export async function setInputCode(page: Page, code: string): Promise<void> {
  await clearOutputModel(page);

  const writeInputCode = async () => {
    await page.evaluate((c) => {
      const w = window as unknown as {
        monaco?: {
          editor?: {
            getModels?: () => Array<{
              uri?: { toString: () => string };
              setValue: (value: string) => void;
            }>;
          };
        };
        editor?: {
          getModel?: () => { setValue: (value: string) => void };
        };
      };

      const models = w.monaco?.editor?.getModels?.() ?? [];
      const outputModel = models.find((m) =>
        m?.uri?.toString?.().includes('result-output')
      );
      const editorModel = w.editor?.getModel?.();
      const inputModel =
        editorModel ?? models.find((m) => m !== outputModel) ?? models[0];

      inputModel?.setValue(c);
    }, code);
  };

  await writeInputCode();

  const waitForCodeApplied = async () =>
    page.waitForFunction(
      (c) => {
        const w = window as unknown as {
          monaco?: {
            editor?: {
              getModels?: () => Array<{
                uri?: { toString: () => string };
                getValue: () => string;
              }>;
            };
          };
          editor?: {
            getModel?: () => { getValue: () => string };
          };
        };

        const models = w.monaco?.editor?.getModels?.() ?? [];
        const outputModel = models.find((m) =>
          m?.uri?.toString?.().includes('result-output')
        );
        const editorModel = w.editor?.getModel?.();
        const inputModel =
          editorModel ?? models.find((m) => m !== outputModel) ?? models[0];

        return !!inputModel && inputModel.getValue() === c;
      },
      code,
      { timeout: 7000 }
    );

  try {
    await waitForCodeApplied();
  } catch {
    // Monaco can dispose/recreate models during fast language transitions.
    // Retry once to avoid running stale input.
    await page.waitForTimeout(150);
    await writeInputCode();
    await waitForCodeApplied();
  }
}

export async function getInputLanguage(page: Page): Promise<string> {
  const snapshot = await getMonacoModelSnapshot(page);
  return snapshot.inputLanguage;
}

export async function forceInputLanguage(
  page: Page,
  language: 'javascript' | 'typescript' | 'python'
): Promise<void> {
  await page.evaluate((lang) => {
    const w = window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{ uri?: { toString: () => string } }>;
          setModelLanguage?: (model: unknown, language: string) => void;
        };
      };
      editor?: { getModel?: () => unknown };
    };

    const models = w.monaco?.editor?.getModels?.() ?? [];
    const outputModel = models.find((m) =>
      m?.uri?.toString?.().includes('result-output')
    );
    const editorModel = w.editor?.getModel?.();
    const inputModel =
      editorModel ?? models.find((m) => m !== outputModel) ?? models[0];

    if (inputModel && w.monaco?.editor?.setModelLanguage) {
      w.monaco.editor.setModelLanguage(inputModel, lang);
    }
  }, language);
}

export async function getOutputValue(page: Page): Promise<string> {
  const snapshot = await getMonacoModelSnapshot(page);
  return snapshot.outputValue;
}

export async function runAndGetOutput(
  page: Page,
  waitMs = 5000
): Promise<string> {
  await clearOutputModel(page);
  const before = await getOutputValue(page);
  await page.getByRole('button', { name: /Run|Ejecutar/i }).click();

  const deadline = Date.now() + waitMs;
  let current = before;
  const start = Date.now();
  const minAcceptanceMs = 700;

  while (Date.now() < deadline) {
    current = await getOutputValue(page);

    if (
      current &&
      current.trim() !== '' &&
      !isWaitingOutput(current) &&
      current !== before &&
      Date.now() - start >= minAcceptanceMs
    ) {
      // Small stabilization window to avoid returning partial output.
      await page.waitForTimeout(250);
      const settled = await getOutputValue(page);
      if (settled && settled.trim() !== '' && !isWaitingOutput(settled)) {
        return settled;
      }
      return current;
    }

    await page.waitForTimeout(200);
  }

  return current;
}
