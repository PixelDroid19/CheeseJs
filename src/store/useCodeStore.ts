import { create } from 'zustand'

interface CodeResultElement {
  content: string | number | boolean | object | null;
}

interface CodeResult {
  element: CodeResultElement;
  type: 'execution' | 'error';
  lineNumber?: number;
  action?: {
    type: 'install-package';
    payload: string;
  };
}

interface CodeState {
  code: string;
  language: string;
  result: CodeResult[];
  isExecuting: boolean;
  setCode: (code: string) => void;
  setLanguage: (language: string) => void;
  setResult: (result: CodeResult[]) => void;
  appendResult: (resultItem: CodeResult) => void;
  clearResult: () => void;
  setIsExecuting: (isExecuting: boolean) => void;
  isPendingRun: boolean;
  setIsPendingRun: (isPendingRun: boolean) => void;
}

export const useCodeStore = create<CodeState>((set) => ({
  code: '',
  language: 'javascript',
  result: [],
  isExecuting: false,
  isPendingRun: false,
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setResult: (result) => set({ result }),
  appendResult: (resultItem) =>
    set((state) => ({ result: [...state.result, resultItem] })),
  clearResult: () => set({ result: [] }),
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  setIsPendingRun: (isPendingRun) => set({ isPendingRun })
}))

/**
 * Helper function to check if a language is executable in this runtime
 * Only JavaScript and TypeScript can be executed
 */
export function isLanguageExecutable (languageId: string): boolean {
  return languageId === 'javascript' || languageId === 'typescript'
}

/**
 * Helper function to get the display name for a language
 */
export function getLanguageDisplayName (languageId: string): string {
  const displayNames: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    markdown: 'Markdown',
    yaml: 'YAML',
    xml: 'XML'
  }
  return displayNames[languageId] || languageId
}
