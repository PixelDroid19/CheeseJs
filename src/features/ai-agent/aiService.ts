// Central AI Service for CheeseJS
// Using AI SDK 6 - https://ai-sdk.dev/docs
// OPTIMIZED: Reduced memory usage, cleanup methods, circuit breaker
import { generateText, streamText, type ModelMessage } from 'ai';
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

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 3; // Number of failures before opening circuit
const CIRCUIT_BREAKER_RESET_MS = 30000; // Time before trying again after circuit opens

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

class AIService {
  private providerInstance: ProviderInstance | null = null;
  private currentProvider: AIProvider | null = null;

  // Circuit breaker for connection failures
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
  };

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

      // Reset circuit breaker on successful configuration
      this.resetCircuitBreaker();

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

  // Circuit breaker methods
  private isCircuitOpen(): boolean {
    if (!this.circuitBreaker.isOpen) return false;

    // Check if we should try again
    if (
      Date.now() - this.circuitBreaker.lastFailureTime >
      CIRCUIT_BREAKER_RESET_MS
    ) {
      console.log(
        '[AIService] Circuit breaker: attempting to close circuit (half-open state)'
      );
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = 0;
      return false;
    }

    return true;
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      console.warn(
        `[AIService] Circuit breaker OPEN after ${this.circuitBreaker.failures} failures. ` +
          `Will retry in ${CIRCUIT_BREAKER_RESET_MS / 1000}s`
      );
    }
  }

  private recordSuccess(): void {
    if (this.circuitBreaker.failures > 0) {
      this.circuitBreaker.failures = 0;
      if (this.circuitBreaker.isOpen) {
        console.log('[AIService] Circuit breaker: closed (recovered)');
      }
      this.circuitBreaker.isOpen = false;
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false,
    };
  }

  // Check if an error is a connection error
  private isConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('network error') ||
      message.includes('failed to fetch') ||
      message.includes('aborted') ||
      message.includes('cancelled')
    );
  }

  // Generate inline completion - optimized for code completion
  async generateInlineCompletion(
    context: PromptContext,
    maxTokens: number = 150
  ): Promise<string> {
    if (!this.providerInstance) {
      throw new Error('AI service not configured');
    }

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      // Silently fail - don't log, just return empty
      throw new Error('Circuit breaker open');
    }

    const prompt = buildInlineCompletionPrompt(context);

    try {
      const result = await generateText({
        model: this.providerInstance.model,
        system: SYSTEM_PROMPTS.inlineCompletion,
        prompt,
        maxOutputTokens: maxTokens,
      });

      this.recordSuccess();
      return result.text.trim();
    } catch (error) {
      // Record failure for circuit breaker
      if (this.isConnectionError(error)) {
        this.recordFailure();
        // Don't spam console for connection errors
        if (this.circuitBreaker.failures === 1) {
          console.warn('[AIService] Connection failed, circuit breaker active');
        }
      } else {
        // Log other errors
        console.error('[AIService] Inline completion failed:', error);
      }
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

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      throw new Error('Circuit breaker open');
    }

    const { systemPrompt = SYSTEM_PROMPTS.codeAssistant, maxTokens = 1024 } =
      options || {};

    try {
      const result = await generateText({
        model: this.providerInstance.model,
        system: systemPrompt,
        prompt,
        maxOutputTokens: maxTokens,
      });

      this.recordSuccess();

      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;

      return {
        text: result.text,
        usage: result.usage
          ? {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              totalTokens: inputTokens + outputTokens,
            }
          : undefined,
      };
    } catch (error) {
      if (this.isConnectionError(error)) {
        this.recordFailure();
      }
      console.error('[AIService] Completion failed:', error);
      throw error;
    }
  }

  // Convert ChatMessage[] to ModelMessage[] - limit history to save memory
  private convertToModelMessages(
    messages: ChatMessage[],
    language?: string
  ): ModelMessage[] {
    // Only keep last 10 messages to reduce memory
    const recentMessages = messages.slice(-10);

    return recentMessages
      .filter((msg) => msg.role !== 'system')
      .map((msg): ModelMessage => {
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
    _codeContext: string | undefined,
    language: string | undefined,
    callbacks: AIStreamCallbacks,
    options?: {
      maxTokens?: number;
    }
  ): Promise<void> {
    if (!this.providerInstance) {
      throw new Error('AI service not configured');
    }

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      callbacks.onError?.(new Error('Service temporarily unavailable'));
      return;
    }

    const { maxTokens = 1500 } = options || {};
    const modelMessages = this.convertToModelMessages(messages, language);

    try {
      callbacks.onStart?.();

      const result = streamText({
        model: this.providerInstance.model,
        system: SYSTEM_PROMPTS.codeAssistant,
        messages: modelMessages,
        maxOutputTokens: maxTokens,
      });

      let fullText = '';

      for await (const chunk of result.textStream) {
        fullText += chunk;
        callbacks.onToken?.(chunk);
      }

      this.recordSuccess();
      callbacks.onComplete?.(fullText);
    } catch (error) {
      if (this.isConnectionError(error)) {
        this.recordFailure();
      }
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

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      throw new Error('Service temporarily unavailable');
    }

    const prompt = buildRefactorPrompt(action, code, language);

    try {
      if (callbacks) {
        callbacks.onStart?.();

        const result = streamText({
          model: this.providerInstance.model,
          system: SYSTEM_PROMPTS.codeAssistant,
          prompt,
          maxOutputTokens: 2048,
        });

        let fullText = '';

        for await (const chunk of result.textStream) {
          fullText += chunk;
          callbacks.onToken?.(chunk);
        }

        this.recordSuccess();
        callbacks.onComplete?.(fullText);
        return fullText;
      } else {
        const result = await generateText({
          model: this.providerInstance.model,
          system: SYSTEM_PROMPTS.codeAssistant,
          prompt,
          maxOutputTokens: 2048,
        });

        this.recordSuccess();
        return result.text;
      }
    } catch (error) {
      if (this.isConnectionError(error)) {
        this.recordFailure();
      }
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
        maxOutputTokens: 5,
      });

      if (result.text && result.text.length > 0) {
        this.recordSuccess();
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
