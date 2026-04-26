import { create } from 'zustand';
import {
  createHistorySlice,
  type HistoryState,
  partializeHistory,
} from '@cheesejs/core/state/useHistoryStore';
import {
  createPackagesSlice,
  type PackagesState,
  partializePackages,
} from '@cheesejs/core/state/usePackagesStore';
import {
  createPythonPackagesSlice,
  type PythonPackagesState,
} from '@cheesejs/core/state/usePythonPackagesStore';
import {
  createSettingsSlice,
  type SettingsState,
  partializeSettings,
} from '@cheesejs/core/state/useSettingsStore';
import {
  createSnippetsSlice,
  type SnippetsState,
  partializeSnippets,
} from '@cheesejs/core/state/useSnippetsStore';
import { idbStorage } from '@cheesejs/core/persistence/idbStorage';
import {
  persist,
  subscribeWithSelector,
  createJSONStorage,
} from 'zustand/middleware';
import { createNestedSlice } from '@cheesejs/core';
import { executionEngine } from '../lib/execution/ExecutionEngine';
import {
  LanguageState,
  createLanguageSlice,
  partializeLanguage,
} from './useLanguageStore';
import {
  createEditorTabsSlice,
  type EditorTabsState,
  partializeEditorTabs,
} from './useEditorTabsStore';
import { createLspSlice, type LspState, partializeLsp } from './useLspStore';

export interface AppState {
  settings: SettingsState;
  history: HistoryState;
  snippets: SnippetsState;
  language: LanguageState;
  packages: PackagesState;
  pythonPackages: PythonPackagesState;
  editorTabs: EditorTabsState;
  lsp: LspState;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        settings: createNestedSlice(
          set as never,
          get as never,
          'settings',
          createSettingsSlice
        ),
        history: createNestedSlice(
          set as never,
          get as never,
          'history',
          createHistorySlice
        ),
        snippets: createNestedSlice(
          set as never,
          get as never,
          'snippets',
          createSnippetsSlice
        ),
        language: createNestedSlice(
          set as never,
          get as never,
          'language',
          createLanguageSlice
        ),
        packages: createNestedSlice(
          set as never,
          get as never,
          'packages',
          createPackagesSlice
        ),
        pythonPackages: createNestedSlice(
          set as never,
          get as never,
          'pythonPackages',
          createPythonPackagesSlice
        ),
        editorTabs: createNestedSlice(
          set as never,
          get as never,
          'editorTabs',
          createEditorTabsSlice({
            cancelExecution: executionEngine.cancel.bind(executionEngine),
          })
        ),
        lsp: createNestedSlice(
          set as never,
          get as never,
          'lsp',
          createLspSlice
        ),
      }),
      {
        name: 'cheesejs-app-storage',
        storage: createJSONStorage(() => idbStorage),
        partialize: (state) => ({
          settings: partializeSettings(state.settings),
          history: partializeHistory(state.history),
          snippets: partializeSnippets(state.snippets),
          language: partializeLanguage(state.language),
          packages: partializePackages(state.packages),
          pythonPackages: partializePackages(state.pythonPackages),
          editorTabs: partializeEditorTabs(state.editorTabs),
          lsp: partializeLsp(state.lsp),
        }),
        merge: (persistedState: unknown, currentState: AppState) => {
          const ps = persistedState as Partial<AppState> | null | undefined;
          if (!ps) return currentState;

          // Helper to merge a slice while preserving functions from currentState
          const mergeSlice = <K extends keyof AppState>(
            key: K
          ): AppState[K] => {
            const persistedSlice = ps[key] as unknown;
            if (persistedSlice && currentState[key]) {
              return {
                ...currentState[key],
                ...(persistedSlice as object),
              } as AppState[K];
            }
            return (persistedSlice as AppState[K]) || currentState[key];
          };

          return {
            ...currentState,
            settings: mergeSlice('settings'),
            history: mergeSlice('history'),
            snippets: mergeSlice('snippets'),
            language: mergeSlice('language'),
            packages: mergeSlice('packages'),
            pythonPackages: mergeSlice('pythonPackages'),
            editorTabs: mergeSlice('editorTabs'),
            lsp: mergeSlice('lsp'),
          } as AppState;
        },
      }
    )
  )
);
