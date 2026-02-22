import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { CodeState, createCodeSlice, partializeCode } from './useCodeStore';
import { SettingsState, createSettingsSlice, partializeSettings } from './useSettingsStore';
import { HistoryState, createHistorySlice, partializeHistory } from './useHistoryStore';
import { SnippetsState, createSnippetsSlice, partializeSnippets } from './useSnippetsStore';
import { LanguageState, createLanguageSlice, partializeLanguage } from './useLanguageStore';
import { ChatState, createChatSlice, partializeChat } from './useChatStore';

export interface AppState {
    code: CodeState;
    settings: SettingsState;
    history: HistoryState;
    snippets: SnippetsState;
    language: LanguageState;
    chat: ChatState;
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
    persist(
        (set, get) => ({
            code: createNestedSlice(set, get, 'code', createCodeSlice),
            settings: createNestedSlice(set, get, 'settings', createSettingsSlice),
            history: createNestedSlice(set, get, 'history', createHistorySlice),
            snippets: createNestedSlice(set, get, 'snippets', createSnippetsSlice),
            language: createNestedSlice(set, get, 'language', createLanguageSlice),
            chat: createNestedSlice(set, get, 'chat', createChatSlice),
        }),
        {
            name: 'cheesejs-app-storage',
            partialize: (state) => ({
                code: partializeCode(state.code),
                settings: partializeSettings(state.settings),
                history: partializeHistory(state.history),
                snippets: partializeSnippets(state.snippets),
                language: partializeLanguage(state.language),
                chat: partializeChat(state.chat),
            }),
        }
    )
);
