

export interface HistoryItem {
  id: string;
  code: string;
  language: 'javascript' | 'typescript' | 'python';
  timestamp: number;
  status: 'success' | 'error';
  executionTime?: number;
}

export interface HistoryState {
  history: HistoryItem[];
  addToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  // Options
  maxItems: number;
  setMaxItems: (count: number) => void;
}

export const createHistorySlice: import('zustand').StateCreator<HistoryState> = (set) => ({
  history: [],
  maxItems: 50,

  addToHistory: (item) =>
    set((state) => {
      const newItem: HistoryItem = {
        ...item,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      // Add to beginning, limit to maxItems
      const newHistory = [newItem, ...state.history].slice(
        0,
        state.maxItems
      );
      return { history: newHistory };
    }),

  clearHistory: () => set({ history: [] }),

  setMaxItems: (maxItems) => set({ maxItems }),
});

export const partializeHistory = (state: HistoryState) => ({
  history: state.history,
  maxItems: state.maxItems,
});

