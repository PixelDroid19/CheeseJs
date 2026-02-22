// AI Provider Factory using Vercel AI SDK 6
// https://v6.ai-sdk.dev/providers/ai-sdk-providers
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AIProvider, CustomProviderConfig } from './types';
import type { LanguageModel } from 'ai';

export interface ProviderInstance {
  model: LanguageModel;
  provider: AIProvider;
  modelId: string;
}

export interface LocalProviderConfig {
  baseURL: string;
  modelId: string;
  apiKey?: string;
}

type ProxyRequestPayload = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

function isRequestStreaming(body: string | undefined, headers: Headers): boolean {
  const accept = headers.get('accept') || '';
  if (accept.includes('text/event-stream')) return true;
  if (!body) return false;

  return /"stream"\s*:\s*true/i.test(body);
}

async function buildProxyRequestPayload(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ProxyRequestPayload> {
  const request = input instanceof Request ? input : new Request(input, init);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  return {
    url: request.url,
    method: request.method,
    headers,
    body,
  };
}

function createProxyBackedFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const fallbackFetch = async () => fetch(input, init);
    if (typeof window === 'undefined' || !window.aiProxy?.fetch) {
      return fallbackFetch();
    }

    const payload = await buildProxyRequestPayload(input, init);
    const headers = new Headers(payload.headers);
    const useStreamingProxy = isRequestStreaming(payload.body, headers);

    if (useStreamingProxy) {
      let streamController:
        | ReadableStreamDefaultController<Uint8Array>
        | undefined;
      let settled = false;
      let streamHandle: { abort: () => void } | null = null;
      const textEncoder = new TextEncoder();

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
        },
        cancel() {
          streamHandle?.abort();
        },
      });

      if (init?.signal) {
        init.signal.addEventListener('abort', () => {
          streamHandle?.abort();
          streamController?.error(
            new DOMException('The operation was aborted.', 'AbortError')
          );
        });
      }

      return new Promise<Response>(async (resolve, reject) => {
        try {
          streamHandle = await window.aiProxy!.streamFetch(
            payload,
            (chunk) => {
              if (!settled) {
                settled = true;
                resolve(
                  new Response(stream, {
                    status: 200,
                    headers: {
                      'content-type': 'text/event-stream',
                    },
                  })
                );
              }

              streamController?.enqueue(textEncoder.encode(chunk));
            },
            () => {
              if (!settled) {
                settled = true;
                resolve(
                  new Response(stream, {
                    status: 200,
                    headers: {
                      'content-type': 'text/event-stream',
                    },
                  })
                );
              }
              streamController?.close();
            },
            (error) => {
              const message =
                typeof error?.body === 'string' && error.body.length > 0
                  ? error.body
                  : error?.statusText || 'Proxy stream request failed';

              if (!settled) {
                settled = true;
                reject(new Error(message));
              } else {
                streamController?.error(new Error(message));
              }
            }
          );
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('Proxy stream setup failed')
          );
        }
      });
    }

    const response = await window.aiProxy.fetch(payload);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

// Create provider instance based on configuration
export function createProviderInstance(
  provider: AIProvider,
  apiKey: string,
  modelId: string,
  localConfig?: LocalProviderConfig,
  customConfig?: CustomProviderConfig
): ProviderInstance {
  let model: LanguageModel;
  const effectiveModelId = customConfig?.modelId || modelId;
  const proxyFetch = createProxyBackedFetch();

  switch (provider) {
    case 'local': {
      if (!localConfig?.baseURL) {
        throw new Error('Base URL is required for local provider');
      }
      // Use OpenAI-compatible API for local servers (LM Studio, Ollama, etc.)
      const localProvider = createOpenAI({
        baseURL: localConfig.baseURL,
        apiKey: localConfig.apiKey || 'not-needed',
        fetch: proxyFetch,
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
      }
      openaiConfig.fetch = proxyFetch;
      const openai = createOpenAI(openaiConfig);
      // Use .chat() for custom models to ensure compatibility
      model = customConfig?.baseURL
        ? openai.chat(effectiveModelId)
        : openai(effectiveModelId);
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
      anthropicConfig.fetch = proxyFetch;
      const anthropic = createAnthropic(anthropicConfig);
      model = anthropic(effectiveModelId);
      break;
    }
    case 'google': {
      if (!apiKey) {
        throw new Error('API key not configured for Google');
      }
      const google = createGoogleGenerativeAI({ apiKey, fetch: proxyFetch });
      model = google(effectiveModelId);
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return { model, provider, modelId: effectiveModelId };
}

// Validate API key format (basic validation)
export function validateApiKeyFormat(
  provider: AIProvider,
  apiKey: string
): boolean {
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
