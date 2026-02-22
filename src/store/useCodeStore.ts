
import { MAX_RESULTS, type ConsoleType } from '../types/workerTypes';

// ============================================================================
// TYPES
// ============================================================================

interface CodeResultElement {
  content: string | number | boolean | object | null;
  jsType?: string;
  consoleType?: ConsoleType;
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
  // Prompt state
  promptRequest: string | null;
  promptType: 'text' | 'alert';
  setPromptRequest: (message: string | null, type?: 'text' | 'alert') => void;
  // Memory management
  pruneOldResults: () => void;
}

// ============================================================================
// STORE
// ============================================================================

export const createCodeSlice: import('zustand').StateCreator<CodeState> = (set, get) => ({
  code: '',
  result: [],
  isExecuting: false,
  isPendingRun: false,
  promptRequest: null,
  promptType: 'text',

  setCode: (code) => set({ code }),

  setResult: (result) => {
    // Enforce max results on direct set
    const limited =
      result.length > MAX_RESULTS ? result.slice(-MAX_RESULTS) : result;
    set({ result: limited });
  },

  appendResult: (resultItem) =>
    set((state) => {
      const newResults = [...state.result, resultItem];
      // Auto-prune if exceeding limit
      if (newResults.length > MAX_RESULTS) {
        return { result: newResults.slice(-MAX_RESULTS) };
      }
      return { result: newResults };
    }),

  clearResult: () => set({ result: [], promptRequest: null }),

  setIsExecuting: (isExecuting) => set({ isExecuting }),

  setIsPendingRun: (isPendingRun) => set({ isPendingRun }),

  setPromptRequest: (message, type = 'text') =>
    set({ promptRequest: message, promptType: type }),

  // Manual pruning for explicit cleanup
  pruneOldResults: () => {
    const { result } = get();
    if (result.length > MAX_RESULTS) {
      set({ result: result.slice(-MAX_RESULTS) });
    }
  },
});

export const partializeCode = (state: CodeState) => ({ code: state.code });
