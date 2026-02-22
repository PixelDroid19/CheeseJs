import { useAppStore, type AppState } from './index';
import type { CodeState } from './useCodeStore';
import { SettingsState, type Theme } from './useSettingsStore';
import {
    type LanguageState,
    type DetectionResult,
    type LanguageInfo,
    detectLanguageSync,
    detectLanguageAsync,
    isLanguageExecutable,
    initializeLanguageDetection,
    getLanguageDisplayName,
    setMonacoInstance
} from './useLanguageStore';
import type { HistoryState } from './useHistoryStore';
import { SnippetsState, type Snippet } from './useSnippetsStore';
import {
    type ChatState,
    type AgentPhase,
    type AgentRunStatus,
    type PendingCodeChange,
    type AgentRunState
} from './useChatStore';
import { type PackagesState, type PackageInfo } from './usePackagesStore';
import { type PythonPackagesState, type PythonPackageInfo } from './usePythonPackagesStore';
import {
    type AISettingsState,
    type ToolPolicySettings,
    type LocalServerConfig,
    type AgentExecutionMode
} from './useAISettingsStore';
import {
    type RagState,
    type RagConfig,
    type RegisteredDocument,
    type SubStep,
} from './useRagStore';
import { type EditorTabsState, type EditorTab } from './useEditorTabsStore';

export {
    detectLanguageSync,
    detectLanguageAsync,
    isLanguageExecutable,
    initializeLanguageDetection,
    getLanguageDisplayName,
    setMonacoInstance
};

export type {
    CodeState,
    SettingsState, Theme,
    LanguageState, DetectionResult, LanguageInfo,
    HistoryState,
    SnippetsState, Snippet,
    ChatState, AgentPhase, AgentRunStatus, PendingCodeChange, AgentRunState,
    AISettingsState, ToolPolicySettings, LocalServerConfig, AgentExecutionMode,
    RagState, RagConfig, RegisteredDocument, SubStep,
    PackagesState, PackageInfo,
    PythonPackagesState, PythonPackageInfo,
    EditorTabsState, EditorTab
};

type StoreHook<TState> = {
    (): TState;
    <T>(selector: (state: TState) => T): T;
    getState: () => TState;
    setState: (partial: Partial<TState> | ((state: TState) => Partial<TState> | TState), replace?: boolean) => void;
    subscribe: (listener: (state: TState, prevState: TState) => void) => () => void;
};

export const useCodeStore = (<T,>(selector?: (state: CodeState) => T) => {
    return useAppStore(selector ? (state) => selector(state.code) : (state) => state.code as unknown as T);
}) as StoreHook<CodeState>;

export const useSettingsStore = (<T,>(selector?: (state: SettingsState) => T) => {
    return useAppStore(selector ? (state) => selector(state.settings) : (state) => state.settings as unknown as T);
}) as StoreHook<SettingsState>;

export const useLanguageStore = (<T,>(selector?: (state: LanguageState) => T) => {
    return useAppStore(selector ? (state) => selector(state.language) : (state) => state.language as unknown as T);
}) as StoreHook<LanguageState>;

export const useHistoryStore = (<T,>(selector?: (state: HistoryState) => T) => {
    return useAppStore(selector ? (state) => selector(state.history) : (state) => state.history as unknown as T);
}) as StoreHook<HistoryState>;

export const useSnippetsStore = (<T,>(selector?: (state: SnippetsState) => T) => {
    return useAppStore(selector ? (state) => selector(state.snippets) : (state) => state.snippets as unknown as T);
}) as StoreHook<SnippetsState>;

export const useChatStore = (<T,>(selector?: (state: ChatState) => T) => {
    return useAppStore(selector ? (state) => selector(state.chat) : (state) => state.chat as unknown as T);
}) as StoreHook<ChatState>;

export const useAISettingsStore = (<T,>(selector?: (state: AISettingsState) => T) => {
    return useAppStore(selector ? (state) => selector(state.aiSettings) : (state) => state.aiSettings as unknown as T);
}) as StoreHook<AISettingsState>;

export const useRagStore = (<T,>(selector?: (state: RagState) => T) => {
    return useAppStore(selector ? (state) => selector(state.rag) : (state) => state.rag as unknown as T);
}) as StoreHook<RagState>;

export const usePackagesStore = (<T,>(selector?: (state: PackagesState) => T) => {
    return useAppStore(selector ? (state) => selector(state.packages) : (state) => state.packages as unknown as T);
}) as StoreHook<PackagesState>;

export const usePythonPackagesStore = (<T,>(selector?: (state: PythonPackagesState) => T) => {
    return useAppStore(selector ? (state) => selector(state.pythonPackages) : (state) => state.pythonPackages as unknown as T);
}) as StoreHook<PythonPackagesState>;

export const useEditorTabsStore = (<T,>(selector?: (state: EditorTabsState) => T) => {
    return useAppStore(selector ? (state) => selector(state.editorTabs) : (state) => state.editorTabs as unknown as T);
}) as StoreHook<EditorTabsState>;

function attachZustandMethods<T>(
    hook: StoreHook<T>,
    sliceKey: keyof AppState
) {
    hook.getState = () => useAppStore.getState()[sliceKey] as unknown as T;
    hook.setState = (partial: Partial<T> | ((state: T) => Partial<T> | T), replace?: boolean) => {
        useAppStore.setState((state: AppState) => ({
            ...state,
            [sliceKey]: replace ? partial : { ...(state[sliceKey] as object), ...(typeof partial === 'function' ? (partial as (s: T) => Partial<T> | T)(state[sliceKey] as unknown as T) : partial) }
        }) as unknown as AppState);
    };
    hook.subscribe = (listener: (state: T, prevState: T) => void) => {
        return useAppStore.subscribe(
            (state: AppState) => state[sliceKey] as unknown as T,
            listener
        );
    };
}

attachZustandMethods(useCodeStore, 'code');
attachZustandMethods(useSettingsStore, 'settings');
attachZustandMethods(useLanguageStore, 'language');
attachZustandMethods(useHistoryStore, 'history');
attachZustandMethods(useSnippetsStore, 'snippets');
attachZustandMethods(useChatStore, 'chat');
attachZustandMethods(useAISettingsStore, 'aiSettings');
attachZustandMethods(useRagStore, 'rag');
attachZustandMethods(usePackagesStore, 'packages');
attachZustandMethods(usePythonPackagesStore, 'pythonPackages');
attachZustandMethods(useEditorTabsStore, 'editorTabs');
