// AI Integration Types for CheeseJS

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'local';

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  models: AIModel[];
  defaultModel: string;
  supportsCustomURL?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  maxTokens: number;
  supportsStreaming: boolean;
}

export interface CustomProviderConfig {
  baseURL?: string;
  modelId?: string;
}

export interface AISettings {
  provider: AIProvider;
  apiKeys: Record<AIProvider, string>;
  selectedModels: Record<AIProvider, string>;
  customConfigs: Record<AIProvider, CustomProviderConfig>;
  enableInlineCompletion: boolean;
  enableChat: boolean;
  maxTokens: number;
  temperature: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  codeContext?: string;
}

export interface AICompletionRequest {
  prompt: string;
  context?: {
    language: string;
    codeBefore: string;
    codeAfter: string;
    selectedCode?: string;
  };
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIStreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface AICodeAction {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
}

// Provider configurations with available models
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'local',
    name: 'Local (LM Studio, Ollama, etc.)',
    models: [
      {
        id: 'custom',
        name: 'Custom Model',
        maxTokens: 32000,
        supportsStreaming: true,
      },
    ],
    defaultModel: 'custom',
    supportsCustomURL: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        maxTokens: 128000,
        supportsStreaming: true,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        maxTokens: 128000,
        supportsStreaming: true,
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        maxTokens: 128000,
        supportsStreaming: true,
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        maxTokens: 16385,
        supportsStreaming: true,
      },
      {
        id: 'custom',
        name: 'Custom Model',
        maxTokens: 128000,
        supportsStreaming: true,
      },
    ],
    defaultModel: 'gpt-4o-mini',
    supportsCustomURL: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'custom',
        name: 'Custom Model',
        maxTokens: 200000,
        supportsStreaming: true,
      },
    ],
    defaultModel: 'claude-3-5-haiku-20241022',
    supportsCustomURL: true,
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        maxTokens: 1000000,
        supportsStreaming: true,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        maxTokens: 2000000,
        supportsStreaming: true,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        maxTokens: 1000000,
        supportsStreaming: true,
      },
    ],
    defaultModel: 'gemini-2.0-flash',
    supportsCustomURL: false,
  },
];

// Helper to get provider config
export function getProviderConfig(
  provider: AIProvider
): AIProviderConfig | undefined {
  return AI_PROVIDERS.find((p) => p.id === provider);
}

// Helper to get model config
export function getModelConfig(
  provider: AIProvider,
  modelId: string
): AIModel | undefined {
  const providerConfig = getProviderConfig(provider);
  return providerConfig?.models.find((m) => m.id === modelId);
}
