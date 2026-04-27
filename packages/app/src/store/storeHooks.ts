import { useAppStore, type AppState } from './index';
import { createScopedStoreHook } from '@cheesejs/core';
import {
  getExecutionLanguage,
  getLanguageDisplayName,
  getRuntimeProviderId,
  isExecutableLanguage,
} from '@cheesejs/languages';
import { type HistoryState } from '@cheesejs/core/state/useHistoryStore';
import {
  type PackageInfo,
  type PackagesState,
} from '@cheesejs/core/state/usePackagesStore';
import {
  type PythonPackageInfo,
  type PythonPackagesState,
} from '@cheesejs/core/state/usePythonPackagesStore';
import {
  SettingsState,
  type Theme,
} from '@cheesejs/core/state/useSettingsStore';
import {
  SnippetsState,
  type Snippet,
} from '@cheesejs/core/state/useSnippetsStore';
import {
  type LanguageState,
  type DetectionResult,
  type LanguageInfo,
  detectLanguageSync,
  detectLanguageAsync,
  initializeLanguageDetection,
  setMonacoInstance,
} from './useLanguageStore';
import { type EditorTabsState, type EditorTab } from './useEditorTabsStore';
import {
  type LspLanguageConfig,
  type LspConnectionStatus,
  type LspState,
} from '@cheesejs/editor/state/useLspStore';

export {
  detectLanguageSync,
  detectLanguageAsync,
  initializeLanguageDetection,
  getExecutionLanguage,
  getLanguageDisplayName,
  getRuntimeProviderId,
  setMonacoInstance,
};

export { isExecutableLanguage };

export type {
  SettingsState,
  Theme,
  LanguageState,
  DetectionResult,
  LanguageInfo,
  HistoryState,
  SnippetsState,
  Snippet,
  PackagesState,
  PackageInfo,
  PythonPackagesState,
  PythonPackageInfo,
  EditorTabsState,
  EditorTab,
  LspState,
  LspLanguageConfig,
  LspConnectionStatus,
};

export const useSettingsStore = createScopedStoreHook<AppState, SettingsState>(
  () => useAppStore,
  'settings'
);

export const useLanguageStore = createScopedStoreHook<AppState, LanguageState>(
  () => useAppStore,
  'language'
);

export const useHistoryStore = createScopedStoreHook<AppState, HistoryState>(
  () => useAppStore,
  'history'
);

export const useSnippetsStore = createScopedStoreHook<AppState, SnippetsState>(
  () => useAppStore,
  'snippets'
);

export const usePackagesStore = createScopedStoreHook<AppState, PackagesState>(
  () => useAppStore,
  'packages'
);

export const usePythonPackagesStore = createScopedStoreHook<
  AppState,
  PythonPackagesState
>(() => useAppStore, 'pythonPackages');

export const useEditorTabsStore = createScopedStoreHook<
  AppState,
  EditorTabsState
>(() => useAppStore, 'editorTabs');

export const useLspStore = createScopedStoreHook<AppState, LspState>(
  () => useAppStore,
  'lsp'
);
