import { StateCreator } from 'zustand';
import type {
  LspConfig,
  LspConfigApi,
  LspLanguageConfig,
} from '@cheesejs/core';

export type { LspLanguageConfig };

export type LspConnectionStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface LspState {
  languages: Record<string, LspLanguageConfig>;
  lspStatus: Record<string, LspConnectionStatus>;
  isLoadingLsp: boolean;
  loadLspConfig: () => Promise<void>;
  saveLspConfig: () => Promise<void>;
  updateLspLanguage: (id: string, config: Partial<LspLanguageConfig>) => void;
  toggleLspLanguage: (id: string) => void;
  addLspLanguage: (id: string, config: LspLanguageConfig) => void;
  removeLspLanguage: (id: string) => void;
  setLspStatus: (id: string, status: LspConnectionStatus) => void;
}

export interface LspSliceOptions {
  getLspConfig?: () => LspConfigApi | undefined;
}

export const createLspSlice = (
  options: LspSliceOptions = {}
): StateCreator<LspState> => {
  const { getLspConfig = () => undefined } = options;

  return (set, get) => ({
    languages: {},
    lspStatus: {},
    isLoadingLsp: true,

    loadLspConfig: async () => {
      set({ isLoadingLsp: true });
      try {
        const configApi = getLspConfig();
        const config = await configApi?.getConfig();
        if (config && config.languages) {
          const parsed: LspConfig['languages'] = { ...config.languages };
          for (const key of Object.keys(parsed)) {
            if (parsed[key].enabled === undefined) {
              parsed[key].enabled = true;
            }
          }
          set({ languages: parsed });
        }
      } catch (error) {
        console.error('Failed to load LSP config:', error);
      } finally {
        set({ isLoadingLsp: false });
      }
    },

    saveLspConfig: async () => {
      const { languages } = get();
      try {
        await getLspConfig()?.saveConfig({ languages });
      } catch (error) {
        console.error('Failed to save LSP config:', error);
      }
    },

    updateLspLanguage: (id, newConfig) => {
      set((state) => {
        const updatedLanguages = {
          ...state.languages,
          [id]: {
            ...state.languages[id],
            ...newConfig,
          },
        };

        getLspConfig()
          ?.saveConfig({ languages: updatedLanguages })
          .catch((error) => {
            console.error('Failed to auto-save LSP config:', error);
          });

        return { languages: updatedLanguages };
      });
    },

    toggleLspLanguage: (id) => {
      const lang = get().languages[id];
      if (lang) {
        get().updateLspLanguage(id, { enabled: !lang.enabled });
      }
    },

    addLspLanguage: (id, config) => {
      set((state) => {
        const updatedLanguages = {
          ...state.languages,
          [id]: config,
        };

        getLspConfig()
          ?.saveConfig({ languages: updatedLanguages })
          .catch((error) => {
            console.error('Failed to auto-save LSP config:', error);
          });

        return { languages: updatedLanguages };
      });
    },

    removeLspLanguage: (id) => {
      set((state) => {
        const { [id]: _, ...rest } = state.languages;
        const { [id]: __, ...restStatus } = state.lspStatus;

        getLspConfig()
          ?.saveConfig({ languages: rest })
          .catch((error) => {
            console.error('Failed to auto-save LSP config:', error);
          });

        return { languages: rest, lspStatus: restStatus };
      });
    },

    setLspStatus: (id, status) => {
      set((state) => ({
        lspStatus: { ...state.lspStatus, [id]: status },
      }));
    },
  });
};

export const partializeLsp = (_state: LspState) => ({
  // Don't persist to indexedDB, we use lsp.json as the source of truth
});
