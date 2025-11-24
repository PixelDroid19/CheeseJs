import { create } from 'zustand'

interface CodeResultElement {
  content: string | number | boolean | object | null;
}

interface CodeResult {
  element: CodeResultElement;
  type: 'execution' | 'error';
  lineNumber?: number;
}

interface CodeState {
  code: string;
  language: string;
  result: CodeResult[];
  setCode: (code: string) => void;
  setLanguage: (language: string) => void;
  setResult: (result: CodeResult[]) => void;
  appendResult: (resultItem: CodeResult) => void;
  clearResult: () => void;
}

export const useCodeStore = create<CodeState>((set) => ({
  code: '',
  language: 'typescript',
  result: [],
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setResult: (result) => set({ result }),
  appendResult: (resultItem) =>
    set((state) => ({ result: [...state.result, resultItem] })),
  clearResult: () => set({ result: [] })
}))
