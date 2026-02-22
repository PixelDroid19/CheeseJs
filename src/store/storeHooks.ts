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
    PythonPackagesState, PythonPackageInfo
};

type StoreHook<TState> = {
    (): TState;
    <T>(selector: (state: TState) => T): T;
    getState: () => TState;
    setState: (partial: Partial<TState> | ((state: TState) => Partial<TState> | TState), replace?: boolean) => void;
    subscribe: (listener: (state: TState, prevState: TState) => void) => () => void;
};

export const useCodeStore = ((selector?: (state: CodeState) => any) => {
    return useAppStore(selector ? (state) => selector(state.code) : (state) => state.code as any);
}) as StoreHook<CodeState>;

export const useSettingsStore = ((selector?: (state: SettingsState) => any) => {
    return useAppStore(selector ? (state) => selector(state.settings) : (state) => state.settings as any);
}) as StoreHook<SettingsState>;

export const useLanguageStore = ((selector?: (state: LanguageState) => any) => {
    return useAppStore(selector ? (state) => selector(state.language) : (state) => state.language as any);
}) as StoreHook<LanguageState>;

export const useHistoryStore = ((selector?: (state: HistoryState) => any) => {
    return useAppStore(selector ? (state) => selector(state.history) : (state) => state.history as any);
}) as StoreHook<HistoryState>;

export const useSnippetsStore = ((selector?: (state: SnippetsState) => any) => {
    return useAppStore(selector ? (state) => selector(state.snippets) : (state) => state.snippets as any);
}) as StoreHook<SnippetsState>;

export const useChatStore = ((selector?: (state: ChatState) => any) => {
    return useAppStore(selector ? (state) => selector(state.chat) : (state) => state.chat as any);
}) as StoreHook<ChatState>;

export const useAISettingsStore = ((selector?: (state: AISettingsState) => any) => {
    return useAppStore(selector ? (state) => selector(state.aiSettings) : (state) => state.aiSettings as any);
}) as StoreHook<AISettingsState>;

export const useRagStore = ((selector?: (state: RagState) => any) => {
    return useAppStore(selector ? (state) => selector(state.rag) : (state) => state.rag as any);
}) as StoreHook<RagState>;

export const usePackagesStore = ((selector?: (state: PackagesState) => any) => {
    return useAppStore(selector ? (state) => selector(state.packages) : (state) => state.packages as any);
}) as StoreHook<PackagesState>;

export const usePythonPackagesStore = ((selector?: (state: PythonPackagesState) => any) => {
    return useAppStore(selector ? (state) => selector(state.pythonPackages) : (state) => state.pythonPackages as any);
}) as StoreHook<PythonPackagesState>;

function attachZustandMethods(
    hook: any,
    sliceKey: keyof AppState
) {
    hook.getState = () => useAppStore.getState()[sliceKey] as any;
    hook.setState = (partial: any, replace?: boolean) => {
        useAppStore.setState((state: any) => ({
            ...state,
            [sliceKey]: replace ? partial : { ...state[sliceKey], ...(typeof partial === 'function' ? partial(state[sliceKey]) : partial) }
        }));
    };
    hook.subscribe = (listener: (state: any, prevState: any) => void) => {
        return (useAppStore as any).subscribe(
            (state: AppState) => state[sliceKey],
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
