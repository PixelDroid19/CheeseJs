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
}

// Helper to wrap set/get for nested slices
function createNestedSlice<TState, TSlice>(
    set: any,
    get: any,
    sliceKey: keyof TState,
    sliceCreator: StateCreator<TSlice>
): TSlice {
    const nestedSet = (partial: any, replace?: boolean) => {
        set((state: any) => {
            const nextSlice = typeof partial === 'function' ? partial(state[sliceKey]) : partial;
            return {
                ...state,
                [sliceKey]: replace ? nextSlice : { ...state[sliceKey], ...nextSlice }
            };
        }, replace);
    };
    const nestedGet = () => get()[sliceKey];
    return sliceCreator(nestedSet as any, nestedGet as any, {} as any);
}

export const useAppStore = create<AppState>()(
    subscribeWithSelector(
        persist(
            (set, get) => ({
                code: createNestedSlice(set, get, 'code', createCodeSlice),
                settings: createNestedSlice(set, get, 'settings', createSettingsSlice),
                history: createNestedSlice(set, get, 'history', createHistorySlice),
                snippets: createNestedSlice(set, get, 'snippets', createSnippetsSlice),
                language: createNestedSlice(set, get, 'language', createLanguageSlice),
                chat: createNestedSlice(set, get, 'chat', createChatSlice),
                aiSettings: createNestedSlice(set, get, 'aiSettings', createAISettingsSlice),
                rag: createNestedSlice(set, get, 'rag', createRagSlice),
                packages: createNestedSlice(set, get, 'packages', createPackagesSlice),
                pythonPackages: createNestedSlice(set, get, 'pythonPackages', createPythonPackagesSlice),
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
                }),
                merge: (persistedState: any, currentState: AppState) => {
                    if (!persistedState) return currentState;

                    // Helper to merge a slice while preserving functions from currentState
                    const mergeSlice = (key: keyof AppState) => {
                        if (persistedState[key] && currentState[key]) {
                            return {
                                ...currentState[key],
                                ...persistedState[key]
                            };
                        }
                        return persistedState[key] || currentState[key];
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
                    } as AppState;
                }
            }
        )
    )
);


// Initialize rag progress listener
initRagProgressListener(useAppStore);
