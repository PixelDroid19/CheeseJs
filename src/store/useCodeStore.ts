import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CodeResultElement {
  content: string | number | boolean | object | null;
  jsType?: string;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
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

export interface CodeState {
  code: string;
  result: CodeResult[];
  isExecuting: boolean;
  setCode: (code: string) => void;
  setResult: (result: CodeResult[]) => void;
  appendResult: (resultItem: CodeResult) => void;
  clearResult: () => void;
  setIsExecuting: (isExecuting: boolean) => void;
  isPendingRun: boolean;
  setIsPendingRun: (isPendingRun: boolean) => void;
}

export const useCodeStore = create<CodeState>()(
  persist(
    (set) => ({
      code: 'console.log("Hello World");',
      result: [],
      isExecuting: false,
      isPendingRun: false,
      setCode: (code) => set({ code }),
      setResult: (result) => set({ result }),
      appendResult: (resultItem) =>
        set((state) => ({ result: [...state.result, resultItem] })),
      clearResult: () => set({ result: [] }),
      setIsExecuting: (isExecuting) => set({ isExecuting }),
      setIsPendingRun: (isPendingRun) => set({ isPendingRun })
    }),
    {
      name: 'code-storage', // name of the item in the storage (must be unique)
      partialize: (state) => ({ code: state.code }), // Only persist code
    }
  )
)
