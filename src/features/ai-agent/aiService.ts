// Central AI Service for CheeseJS
// Using AI SDK 6 - https://ai-sdk.dev/docs
// OPTIMIZED: Reduced memory usage, cleanup methods
import { generateText, streamText, type CoreMessage } from 'ai';
import {
  createProviderInstance,
  type ProviderInstance,
  type LocalProviderConfig,
} from './providers';
import {
  SYSTEM_PROMPTS,
  buildInlineCompletionPrompt,
  buildChatPrompt,
  buildRefactorPrompt,
  type PromptContext,
} from './prompts';
import type {
  AIProvider,
  AICompletionResponse,
  AIStreamCallbacks,
  ChatMessage,
  CustomProviderConfig,
} from './types';

class AIService {
  private providerInstance: ProviderInstance | null = null;
  private currentProvider: AIProvider | null = null;

  // Initialize or update provider
  configure(
    provider: AIProvider,
    apiKey: string,
    modelId: string,
    localConfig?: LocalProviderConfig,
    customConfig?: CustomProviderConfig
  ): void {
    // For local provider, check baseURL instead of apiKey
    if (provider === 'local') {
      if (!localConfig?.baseURL) {
        this.cleanup();
        return;
      }
    } else if (!apiKey) {
      this.cleanup();
      return;
    }

    try {
      // Clean up previous instance before creating new one
      this.cleanup();

      this.providerInstance = createProviderInstance(
        provider,
        apiKey,
        modelId,
        localConfig,
        customConfig
      );
      this.currentProvider = provider;
      const displayModel =
        localConfig?.modelId || customConfig?.modelId || modelId;
      console.log(`[AIService] Configured with ${provider}/${displayModel}`);
    } catch (error) {
      console.error('[AIService] Failed to configure:', error);
      this.cleanup();
      throw error;
    }
  }

  // Cleanup resources
  cleanup(): void {
    this.providerInstance = null;
    this.currentProvider = null;
  }

  // Check if service is ready
  isReady(): boolean {
    return this.providerInstance !== null;
  }

  // Get current provider type
  getProviderType(): AIProvider | null {
    return this.currentProvider;
  }

  // Generate inline completion - optimized for code completion
  async generateInlineCompletion(
    context: PromptContext,
    maxTokens: number = 100 // Reduced from 150
  ): Promise<string> {
    if (!this.providerInstance) {
      throw new Error('AI service not configured');
    }

    const prompt = buildInlineCompletionPrompt(context);

    try {
      const result = await generateText({
        model: this.providerInstance.model,
        system: SYSTEM_PROMPTS.inlineCompletion,
        prompt,
        maxTokens,
      });

      return result.text.trim();
    } catch (error) {
      console.error('[AIService] Inline completion failed:', error);
      throw error;
    }
  }

  // Generate text completion (non-streaming)
  async generateCompletion(
    prompt: string,
    options?: {
      systemPrompt?: string;
      maxTokens?: number;
    }
  ): Promise<AICompletionResponse> {
    if (!this.providerInstance) {
      throw new Error('AI service not configured');
    }

    const {
      systemPrompt = SYSTEM_PROMPTS.codeAssistant,
      maxTokens = 1024, // Reduced from 2048
    } = options || {};

    try {
      const result = await generateText({
        model: this.providerInstance.model,
        system: systemPrompt,
        prompt,
        maxTokens,
      });

      return {
        text: result.text,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
            }
          : undefined,
      };
    } catch (error) {
      console.error('[AIService] Completion failed:', error);
      throw error;
    }
  }

  // Convert ChatMessage[] to CoreMessage[] - limit history to save memory
  private convertToCoreMessages(
    messages: ChatMessage[],
    language?: string
  ): CoreMessage[] {
    // Only keep last 10 messages to reduce memory
    const recentMessages = messages.slice(-10);

    return recentMessages
      .filter((msg) => msg.role !== 'system')
      .map((msg): CoreMessage => {
        const content = msg.codeContext
          ? buildChatPrompt(msg.content, msg.codeContext, language)
          : msg.content;

        return {
          role: msg.role as 'user' | 'assistant',
          content,
        };
      });
  }

  // Stream chat response using AI SDK 6 streamText
  async streamChat(
    messages: ChatMessage[],
    codeContext: string | undefined,
    language: string | undefined,
    callbacks: AIStreamCallbacks,
    options?: {
      maxTokens?: number;
    }
  ): Promise<void> {
    if (!this.providerInstance) {
      throw new Error('AI service not configured');
    }

    const { maxTokens = 1500 } = options || {}; // Reduced from 2048
    const coreMessages = this.convertToCoreMessages(messages, language);

    try {
      callbacks.onStart?.();

      const result = streamText({
        model: this.providerInstance.model,
        system: SYSTEM_PROMPTS.codeAssistant,
        messages: coreMessages,
        maxTokens,
      });

      let fullText = '';

      for await (const chunk of result.textStream) {
        fullText += chunk;
        callbacks.onToken?.(chunk);
      }

      callbacks.onComplete?.(fullText);
    } catch (error) {
      console.error('[AIService] Stream chat failed:', error);
      callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  // Refactor code with specific action
  async refactorCode(
    action: 'explain' | 'refactor' | 'document' | 'fix',
    code: string,
    language: string,
    callbacks?: AIStreamCallbacks
  ): Promise<string> {
    if (!this.providerInstance) {
      throw new Error('AI service not configured');
    }

    const prompt = buildRefactorPrompt(action, code, language);

    try {
      if (callbacks) {
        callbacks.onStart?.();

        const result = streamText({
          model: this.providerInstance.model,
          system: SYSTEM_PROMPTS.codeAssistant,
          prompt,
          maxTokens: 2048, // Reduced from 4096
        });

        let fullText = '';

        for await (const chunk of result.textStream) {
          fullText += chunk;
          callbacks.onToken?.(chunk);
        }

        callbacks.onComplete?.(fullText);
        return fullText;
      } else {
        const result = await generateText({
          model: this.providerInstance.model,
          system: SYSTEM_PROMPTS.codeAssistant,
          prompt,
          maxTokens: 2048,
        });

        return result.text;
      }
    } catch (error) {
      console.error('[AIService] Refactor failed:', error);
      callbacks?.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  // Test connection with a simple prompt
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.providerInstance) {
      return { success: false, message: 'AI service not configured' };
    }

    try {
      const result = await generateText({
        model: this.providerInstance.model,
        prompt: 'Say OK',
        maxTokens: 5,
      });

      if (result.text && result.text.length > 0) {
        return {
          success: true,
          message: `Connected to ${this.providerInstance.provider}/${this.providerInstance.modelId}`,
        };
      }

      return { success: false, message: 'Empty response from model' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message };
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
