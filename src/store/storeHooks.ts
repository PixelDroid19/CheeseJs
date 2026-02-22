import { useAppStore } from './index';
import type { CodeState } from './useCodeStore';
import type { SettingsState } from './useSettingsStore';
import type { LanguageState } from './useLanguageStore';
import type { HistoryState } from './useHistoryStore';
import type { SnippetsState } from './useSnippetsStore';
import type { ChatState } from './useChatStore';

export const useCodeStore = <T>(selector?: (state: CodeState) => T) => {
    return useAppStore(selector ? (state) => selector(state.code) : (state) => state.code as any);
};

export const useSettingsStore = <T>(selector?: (state: SettingsState) => T) => {
    return useAppStore(selector ? (state) => selector(state.settings) : (state) => state.settings as any);
};

export const useLanguageStore = <T>(selector?: (state: LanguageState) => T) => {
    return useAppStore(selector ? (state) => selector(state.language) : (state) => state.language as any);
};

export const useHistoryStore = <T>(selector?: (state: HistoryState) => T) => {
    return useAppStore(selector ? (state) => selector(state.history) : (state) => state.history as any);
};

export const useSnippetsStore = <T>(selector?: (state: SnippetsState) => T) => {
    return useAppStore(selector ? (state) => selector(state.snippets) : (state) => state.snippets as any);
};

export const useChatStore = <T>(selector?: (state: ChatState) => T) => {
    return useAppStore(selector ? (state) => selector(state.chat) : (state) => state.chat as any);
};
