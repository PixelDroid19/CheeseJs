import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AIProvider,
  CustomProviderConfig,
} from '../features/ai-agent/types';
import { AI_PROVIDERS } from '../features/ai-agent/types';

export interface LocalServerConfig {
  baseURL: string;
  modelId: string;
  apiKey?: string; // Optional API token for LM Studio auth
}

interface AISettingsState {
  // Provider and model selection
  provider: AIProvider;
  apiKeys: Record<AIProvider, string>;
  selectedModels: Record<AIProvider, string>;
  customConfigs: Record<AIProvider, CustomProviderConfig>;

  // Local server configuration
  localConfig: LocalServerConfig;

  // Feature toggles
  enableInlineCompletion: boolean;
  enableChat: boolean;
  strictLocalMode: boolean; // Enforces local-only operation, disables cloud providers
  maxTokens: number;
  temperature: number;

  // Actions
  setProvider: (provider: AIProvider) => void;
  setApiKey: (provider: AIProvider, key: string) => void;
  setSelectedModel: (provider: AIProvider, model: string) => void;
  setCustomConfig: (
    provider: AIProvider,
    config: Partial<CustomProviderConfig>
  ) => void;
  setEnableInlineCompletion: (enabled: boolean) => void;
  setEnableChat: (enabled: boolean) => void;
  setStrictLocalMode: (enabled: boolean) => void;
  setMaxTokens: (tokens: number) => void;
  setTemperature: (temp: number) => void;
  setLocalConfig: (config: Partial<LocalServerConfig>) => void;

  // Getters
  getCurrentApiKey: () => string;
  getCurrentModel: () => string;
  getCustomConfig: () => CustomProviderConfig;
  getLocalConfig: () => LocalServerConfig;
  isConfigured: () => boolean;
}

// Get default models for each provider
const defaultModels = AI_PROVIDERS.reduce(
  (acc, provider) => {
    acc[provider.id] = provider.defaultModel;
    return acc;
  },
  {} as Record<AIProvider, string>
);

// Default custom configs
const defaultCustomConfigs: Record<AIProvider, CustomProviderConfig> = {
  openai: { baseURL: '', modelId: '' },
  anthropic: { baseURL: '', modelId: '' },
  google: { baseURL: '', modelId: '' },
  local: { baseURL: '', modelId: '' },
};

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      provider: 'local',
      apiKeys: {
        openai: '',
        anthropic: '',
        google: '',
        local: '',
      },
      selectedModels: defaultModels,
      customConfigs: defaultCustomConfigs,
      enableInlineCompletion: true,
      enableChat: true,
      strictLocalMode: false,
      maxTokens: 2048,
      temperature: 0.7,
      localConfig: {
        baseURL: 'http://127.0.0.1:1234/v1',
        modelId: '',
      },

      // Actions
      setProvider: (provider) => set({ provider }),

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      setSelectedModel: (provider, model) =>
        set((state) => ({
          selectedModels: { ...state.selectedModels, [provider]: model },
        })),

      setCustomConfig: (provider, config) =>
        set((state) => ({
          customConfigs: {
            ...state.customConfigs,
            [provider]: { ...state.customConfigs[provider], ...config },
          },
        })),

      setEnableInlineCompletion: (enabled) =>
        set({ enableInlineCompletion: enabled }),

      setEnableChat: (enabled) => set({ enableChat: enabled }),

      setStrictLocalMode: (enabled) => set({ strictLocalMode: enabled }),

      setMaxTokens: (tokens) => set({ maxTokens: tokens }),

      setTemperature: (temp) => set({ temperature: temp }),

      setLocalConfig: (config) =>
        set((state) => ({
          localConfig: { ...state.localConfig, ...config },
        })),

      // Getters
      getCurrentApiKey: () => {
        const state = get();
        if (state.provider === 'local') {
          return state.localConfig.baseURL ? 'local' : '';
        }
        return state.apiKeys[state.provider] || '';
      },

      getCurrentModel: () => {
        const state = get();
        if (state.provider === 'local') {
          return state.localConfig.modelId || 'custom';
        }
        // Check if custom model is set
        const customConfig = state.customConfigs[state.provider];
        if (customConfig?.modelId) {
          return customConfig.modelId;
        }
        return state.selectedModels[state.provider] || '';
      },

      getCustomConfig: () => {
        const state = get();
        return state.customConfigs[state.provider] || {};
      },

      getLocalConfig: () => {
        return get().localConfig;
      },

      isConfigured: () => {
        const state = get();
        if (state.provider === 'local') {
          return Boolean(
            state.localConfig.baseURL && state.localConfig.baseURL.length > 0
          );
        }
        const apiKey = state.apiKeys[state.provider];
        return Boolean(apiKey && apiKey.length > 0);
      },
    }),
    {
      name: 'ai-settings-storage',
      partialize: (state) => ({
        provider: state.provider,
        apiKeys: state.apiKeys,
        selectedModels: state.selectedModels,
        customConfigs: state.customConfigs,
        enableInlineCompletion: state.enableInlineCompletion,
        enableChat: state.enableChat,
        strictLocalMode: state.strictLocalMode,
        maxTokens: state.maxTokens,
        temperature: state.temperature,
        localConfig: state.localConfig,
      }),
    }
  )
);
