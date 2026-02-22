import { MAX_RESULTS, type ConsoleType } from '../types/workerTypes';
import { executionEngine } from '../lib/execution/ExecutionEngine';

// ============================================================================
// TYPES
// ============================================================================

export interface CodeResultElement {
    content: string | number | boolean | object | null;
    jsType?: string;
    consoleType?: ConsoleType;
}

export interface CodeResult {
    element: CodeResultElement;
    type: 'execution' | 'error';
    lineNumber?: number;
    action?: {
        type: 'install-package';
        payload: string;
    };
}

export interface EditorTab {
    id: string;
    title: string;
    code: string;
    language: string;
    result: CodeResult[];
    isExecuting: boolean;
    isPendingRun: boolean;
    promptRequest: string | null;
    promptType: 'text' | 'alert';
}

export interface EditorTabsState {
    tabs: EditorTab[];
    activeTabId: string | null;

    // Actions
    addTab: (title: string, code?: string, language?: string) => string; // Returns new Tab ID
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;

    // Specific Tab modifiers
    updateTabCode: (id: string, code: string) => void;
    updateTabLanguage: (id: string, language: string) => void;
    updateTabTitle: (id: string, title: string) => void;

    // Execution Context
    setTabExecuting: (id: string, isExecuting: boolean) => void;
    setTabPendingRun: (id: string, isPendingRun: boolean) => void;
    setTabResults: (id: string, results: CodeResult[]) => void;
    appendTabResult: (id: string, resultItem: CodeResult) => void;
    clearTabResults: (id: string) => void;

    // Prompt Context
    setTabPromptRequest: (id: string, message: string | null, type?: 'text' | 'alert') => void;
    pruneTabResults: (id: string) => void;
}

// ============================================================================
// STORE
// ============================================================================

const createDefaultTab = (index: number): EditorTab => ({
    id: `tab-${Date.now()}-${index}`,
    title: `main${index > 1 ? index : ''}.js`,
    code: '',
    language: 'javascript', // Default, logic detects later
    result: [],
    isExecuting: false,
    isPendingRun: false,
    promptRequest: null,
    promptType: 'text',
});

const defaultTab = createDefaultTab(1);

export const createEditorTabsSlice: import('zustand').StateCreator<EditorTabsState> = (set) => ({
    tabs: [defaultTab],
    activeTabId: defaultTab.id,

    addTab: (title, code = '', language = 'javascript') => {
        const newTab: EditorTab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            title,
            code,
            language,
            result: [],
            isExecuting: false,
            isPendingRun: false,
            promptRequest: null,
            promptType: 'text',
        };

        set((state) => ({
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id, // Auto focus new tab
        }));

        return newTab.id;
    },

    closeTab: (id) => {
        executionEngine.cancel(id);

        set((state) => {
            const tabIndex = state.tabs.findIndex((t) => t.id === id);
            if (tabIndex === -1) return state;

            const newTabs = state.tabs.filter((t) => t.id !== id);

            // If closing the last tab, create an empty one
            if (newTabs.length === 0) {
                const fallbackTab = createDefaultTab(1);
                return { tabs: [fallbackTab], activeTabId: fallbackTab.id };
            }

            // If active tab was closed, shift selection
            let nextActiveId = state.activeTabId;
            if (state.activeTabId === id) {
                const nextIndex = Math.max(0, tabIndex - 1);
                nextActiveId = newTabs[nextIndex].id;
            }

            return { tabs: newTabs, activeTabId: nextActiveId };
        });
    },

    setActiveTab: (id) => set({ activeTabId: id }),

    updateTabCode: (id, code) => set((state) => ({
        tabs: state.tabs.map(tab => tab.id === id ? { ...tab, code } : tab)
    })),

    updateTabLanguage: (id, language) => set((state) => ({
        tabs: state.tabs.map(tab => tab.id === id ? { ...tab, language } : tab)
    })),

    updateTabTitle: (id, title) => set((state) => ({
        tabs: state.tabs.map(tab => tab.id === id ? { ...tab, title } : tab)
    })),

    setTabExecuting: (id, isExecuting) => set((state) => ({
        tabs: state.tabs.map(tab => tab.id === id ? { ...tab, isExecuting } : tab)
    })),

    setTabPendingRun: (id, isPendingRun) => set((state) => ({
        tabs: state.tabs.map(tab => tab.id === id ? { ...tab, isPendingRun } : tab)
    })),

    setTabResults: (id, results) => {
        const limited = results.length > MAX_RESULTS ? results.slice(-MAX_RESULTS) : results;
        set((state) => ({
            tabs: state.tabs.map(tab => tab.id === id ? { ...tab, result: limited } : tab)
        }));
    },

    appendTabResult: (id, resultItem) => set((state) => ({
        tabs: state.tabs.map(tab => {
            if (tab.id !== id) return tab;
            const newResults = [...tab.result, resultItem];
            return {
                ...tab,
                result: newResults.length > MAX_RESULTS ? newResults.slice(-MAX_RESULTS) : newResults
            };
        })
    })),

    clearTabResults: (id) => set((state) => ({
        tabs: state.tabs.map(tab => tab.id === id ? { ...tab, result: [], promptRequest: null } : tab)
    })),

    setTabPromptRequest: (id, message, type = 'text') => set((state) => ({
        tabs: state.tabs.map(tab => tab.id === id ? { ...tab, promptRequest: message, promptType: type } : tab)
    })),

    pruneTabResults: (id) => set((state) => ({
        tabs: state.tabs.map(tab => {
            if (tab.id === id && tab.result.length > MAX_RESULTS) {
                return { ...tab, result: tab.result.slice(-MAX_RESULTS) };
            }
            return tab;
        })
    })),
});

export const partializeEditorTabs = (state: EditorTabsState) => ({
    tabs: state.tabs.map(t => ({ id: t.id, title: t.title, code: t.code, language: t.language })),
    activeTabId: state.activeTabId
});
