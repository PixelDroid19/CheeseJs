import { StateCreator } from 'zustand';

export interface LspLanguageConfig {
  name: string;
  command: string;
  args: string[];
  fileExtensions: string[];
  initializationOptions?: Record<string, unknown>;
  enabled?: boolean;
}

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

export const createLspSlice: StateCreator<LspState> = (set, get) => ({
  languages: {},
  lspStatus: {},
  isLoadingLsp: true,

  loadLspConfig: async () => {
    set({ isLoadingLsp: true });
    try {
      const config = await window.lspConfig?.getConfig();
      if (config && config.languages) {
        // Default enabled to true if missing
        const parsed = { ...config.languages };
        for (const key of Object.keys(parsed)) {
          if (parsed[key].enabled === undefined) {
            parsed[key].enabled = true;
          }
        }
        set({ languages: parsed });
      }
    } catch (e) {
      console.error('Failed to load LSP config:', e);
    } finally {
      set({ isLoadingLsp: false });
    }
  },

  saveLspConfig: async () => {
    const { languages } = get();
    try {
      await window.lspConfig?.saveConfig({ languages });
    } catch (e) {
      console.error('Failed to save LSP config:', e);
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

      // Save it out-of-band so we don't have to wait
      window.lspConfig
        ?.saveConfig({ languages: updatedLanguages })
        .catch((e) => {
          console.error('Failed to auto-save LSP config:', e);
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

      window.lspConfig
        ?.saveConfig({ languages: updatedLanguages })
        .catch((e) => {
          console.error('Failed to auto-save LSP config:', e);
        });

      return { languages: updatedLanguages };
    });
  },

  removeLspLanguage: (id) => {
    set((state) => {
      const { [id]: _, ...rest } = state.languages;
      const { [id]: __, ...restStatus } = state.lspStatus;

      window.lspConfig?.saveConfig({ languages: rest }).catch((e) => {
        console.error('Failed to auto-save LSP config:', e);
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

export const partializeLsp = (_state: LspState) => ({
  // Don't persist to indexedDB, we use lsp.json as the source of truth
});
