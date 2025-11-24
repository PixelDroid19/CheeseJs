import { create } from 'zustand'

interface CodeState {
  code: string;
  language: string;
  result: any[];
  setCode: (code: string) => void;
  setLanguage: (language: string) => void;
  setResult: (result: any[]) => void;
  appendResult: (resultItem: any) => void;
  clearResult: () => void;
}

export const useCodeStore = create<CodeState>((set) => ({
  code: '',
  language: 'typescript',
  result: [],
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setResult: (result) => set({ result }),
  appendResult: (resultItem) => set((state) => ({ result: [...state.result, resultItem] })),
  clearResult: () => set({ result: [] })
}))
