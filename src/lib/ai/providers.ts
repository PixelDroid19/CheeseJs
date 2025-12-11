// AI Provider Factory using Vercel AI SDK 6
// https://v6.ai-sdk.dev/providers/ai-sdk-providers
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AIProvider, CustomProviderConfig } from './types';
import type { LanguageModelV1 } from 'ai';

export interface ProviderInstance {
  model: LanguageModelV1;
  provider: AIProvider;
  modelId: string;
}

export interface LocalProviderConfig {
  baseURL: string;
  modelId: string;
  apiKey?: string;
}

// Create provider instance based on configuration
export function createProviderInstance(
  provider: AIProvider,
  apiKey: string,
  modelId: string,
  localConfig?: LocalProviderConfig,
  customConfig?: CustomProviderConfig
): ProviderInstance {
  let model: LanguageModelV1;
  const effectiveModelId = customConfig?.modelId || modelId;

  switch (provider) {
    case 'local': {
      if (!localConfig?.baseURL) {
        throw new Error('Base URL is required for local provider');
      }
      // Use OpenAI-compatible API for local servers (LM Studio, Ollama, etc.)
      const localProvider = createOpenAI({
        baseURL: localConfig.baseURL,
        apiKey: localConfig.apiKey || 'not-needed',
        compatibility: 'compatible',
      });
      model = localProvider.chat(localConfig.modelId || modelId);
      break;
    }
    case 'openai': {
      if (!apiKey) {
        throw new Error('API key not configured for OpenAI');
      }
      // Support custom URL for OpenAI-compatible APIs
      const openaiConfig: Parameters<typeof createOpenAI>[0] = { apiKey };
      if (customConfig?.baseURL) {
        openaiConfig.baseURL = customConfig.baseURL;
        openaiConfig.compatibility = 'compatible';
      }
      const openai = createOpenAI(openaiConfig);
      // Use .chat() for custom models to ensure compatibility
      model = customConfig?.baseURL ? openai.chat(effectiveModelId) : openai(effectiveModelId);
      break;
    }
    case 'anthropic': {
      if (!apiKey) {
        throw new Error('API key not configured for Anthropic');
      }
      // Support custom URL for Anthropic-compatible APIs
      const anthropicConfig: Parameters<typeof createAnthropic>[0] = { apiKey };
      if (customConfig?.baseURL) {
        anthropicConfig.baseURL = customConfig.baseURL;
      }
      const anthropic = createAnthropic(anthropicConfig);
      model = anthropic(effectiveModelId);
      break;
    }
    case 'google': {
      if (!apiKey) {
        throw new Error('API key not configured for Google');
      }
      const google = createGoogleGenerativeAI({ apiKey });
      model = google(effectiveModelId);
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return { model, provider, modelId: effectiveModelId };
}

// Validate API key format (basic validation)
export function validateApiKeyFormat(provider: AIProvider, apiKey: string): boolean {
  if (provider === 'local') {
    return true;
  }

  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }

  switch (provider) {
    case 'openai':
      // OpenAI keys start with 'sk-' (allow any key for custom endpoints)
      return apiKey.length > 10;
    case 'anthropic':
      // Anthropic keys start with 'sk-ant-' (allow any key for custom endpoints)
      return apiKey.length > 10;
    case 'google':
      return apiKey.length >= 30;
    default:
      return apiKey.length > 10;
  }
}

// Validate local server URL
export function validateLocalServerURL(url: string): boolean {
  if (!url || url.trim().length === 0) {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Get provider display name
export function getProviderDisplayName(provider: AIProvider): string {
  const names: Record<AIProvider, string> = {
    local: 'Local Server',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google Gemini',
  };
  return names[provider] || provider;
}
