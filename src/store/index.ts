import { create, StateCreator } from 'zustand';
import { persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware';
import { CodeState, createCodeSlice, partializeCode } from './useCodeStore';
import { SettingsState, createSettingsSlice, partializeSettings } from './useSettingsStore';
import { HistoryState, createHistorySlice, partializeHistory } from './useHistoryStore';
import { SnippetsState, createSnippetsSlice, partializeSnippets } from './useSnippetsStore';
import { LanguageState, createLanguageSlice, partializeLanguage } from './useLanguageStore';
import { ChatState, createChatSlice, partializeChat } from './useChatStore';
import { createAISettingsSlice, partializeAISettings, type AISettingsState } from './useAISettingsStore';
import { createRagSlice, partializeRag, initRagProgressListener, type RagState } from './useRagStore';
import { createPackagesSlice, type PackagesState, partializePackages } from './usePackagesStore';
import { createPythonPackagesSlice, type PythonPackagesState } from './usePythonPackagesStore';
import { createEditorTabsSlice, type EditorTabsState, partializeEditorTabs } from './useEditorTabsStore';
import { idbStorage } from './idbStorage';

export interface AppState {
    code: CodeState;
    settings: SettingsState;
    history: HistoryState;
    snippets: SnippetsState;
    language: LanguageState;
    chat: ChatState;
    aiSettings: AISettingsState;
    rag: RagState;
    packages: PackagesState;
    pythonPackages: PythonPackagesState;
    editorTabs: EditorTabsState;
}

// Helper to wrap set/get for nested slices
function createNestedSlice<TState, TSlice>(
    set: (partial: TState | Partial<TState> | ((state: TState) => TState | Partial<TState>), replace?: boolean) => void,
    get: () => TState,
    sliceKey: keyof TState,
    sliceCreator: StateCreator<TSlice, [], []>
): TSlice {
    const nestedSet = (partial: TSlice | Partial<TSlice> | ((state: TSlice) => TSlice | Partial<TSlice>), replace?: boolean) => {
        set((state: TState) => {
            const currentSlice = state[sliceKey] as unknown as TSlice;
            const nextSlice = typeof partial === 'function' ? (partial as (s: TSlice) => TSlice | Partial<TSlice>)(currentSlice) : partial;
            return {
                ...state,
                [sliceKey]: replace ? nextSlice : { ...(state[sliceKey] as object), ...(nextSlice as object) }
            } as unknown as TState | Partial<TState>;
        }, replace);
    };
    const nestedGet = () => get()[sliceKey] as unknown as TSlice;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return sliceCreator(nestedSet as any, nestedGet as any, {} as any);
}

export const useAppStore = create<AppState>()(
    subscribeWithSelector(
        persist(
            (set, get) => ({
                code: createNestedSlice(set as never, get as never, 'code', createCodeSlice),
                settings: createNestedSlice(set as never, get as never, 'settings', createSettingsSlice),
                history: createNestedSlice(set as never, get as never, 'history', createHistorySlice),
                snippets: createNestedSlice(set as never, get as never, 'snippets', createSnippetsSlice),
                language: createNestedSlice(set as never, get as never, 'language', createLanguageSlice),
                chat: createNestedSlice(set as never, get as never, 'chat', createChatSlice),
                aiSettings: createNestedSlice(set as never, get as never, 'aiSettings', createAISettingsSlice),
                rag: createNestedSlice(set as never, get as never, 'rag', createRagSlice),
                packages: createNestedSlice(set as never, get as never, 'packages', createPackagesSlice),
                pythonPackages: createNestedSlice(set as never, get as never, 'pythonPackages', createPythonPackagesSlice),
                editorTabs: createNestedSlice(set as never, get as never, 'editorTabs', createEditorTabsSlice),
            }),
            {
                name: 'cheesejs-app-storage',
                storage: createJSONStorage(() => idbStorage),
                partialize: (state) => ({
                    code: partializeCode(state.code),
                    settings: partializeSettings(state.settings),
                    history: partializeHistory(state.history),
                    snippets: partializeSnippets(state.snippets),
                    language: partializeLanguage(state.language),
                    chat: partializeChat(state.chat),
                    aiSettings: partializeAISettings(state.aiSettings),
                    rag: partializeRag(state.rag),
                    packages: partializePackages(state.packages),
                    pythonPackages: partializePackages(state.pythonPackages),
                    editorTabs: partializeEditorTabs(state.editorTabs),
                }),
                merge: (persistedState: unknown, currentState: AppState) => {
                    const ps = persistedState as Partial<AppState> | null | undefined;
                    if (!ps) return currentState;

                    // Helper to merge a slice while preserving functions from currentState
                    const mergeSlice = <K extends keyof AppState>(key: K): AppState[K] => {
                        const persistedSlice = ps[key] as unknown;
                        if (persistedSlice && currentState[key]) {
                            return {
                                ...currentState[key],
                                ...(persistedSlice as object)
                            } as AppState[K];
                        }
                        return (persistedSlice as AppState[K]) || currentState[key];
                    };

                    return {
                        ...currentState,
                        code: mergeSlice('code'),
                        settings: mergeSlice('settings'),
                        history: mergeSlice('history'),
                        snippets: mergeSlice('snippets'),
                        language: mergeSlice('language'),
                        chat: mergeSlice('chat'),
                        aiSettings: mergeSlice('aiSettings'),
                        rag: mergeSlice('rag'),
                        packages: mergeSlice('packages'),
                        pythonPackages: mergeSlice('pythonPackages'),
                        editorTabs: mergeSlice('editorTabs')
                    } as AppState;
                }
            }
        )
    )
);


// Initialize rag progress listener
initRagProgressListener(useAppStore);
