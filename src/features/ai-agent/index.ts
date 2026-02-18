// AI Module Exports for CheeseJS
// OPTIMIZED: Lazy loading for heavy AI modules to reduce memory usage

// Types (lightweight - always loaded)
export type {
  AIProvider,
  AIProviderConfig,
  AIModel,
  AISettings,
  ChatMessage,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamCallbacks,
  CustomProviderConfig,
} from './types';

export { AI_PROVIDERS, getProviderConfig, getModelConfig } from './types';

// Providers (lightweight validation functions)
export {
  validateApiKeyFormat,
  validateLocalServerURL,
  getProviderDisplayName,
  type ProviderInstance,
  type LocalProviderConfig,
} from './providers';

// Lazy export for createProviderInstance (loads AI SDK)
export { createProviderInstance } from './providers';

// Service - singleton (lazy initialized internally)
export { aiService } from './aiService';

// Prompts (lightweight - no dependencies)
export {
  SYSTEM_PROMPTS,
  buildInlineCompletionPrompt,
  buildChatPrompt,
  buildRefactorPrompt,
  type PromptContext,
} from './prompts';

// Inline Completion Provider - export factory function
export {
  createInlineCompletionProvider,
  clearInlineCompletionCache,
} from './inlineCompletionProvider';

export type { AgentProfile } from './agentProfiles';
export {
  PROFILE_ALLOWED_TOOLS,
  getDefaultProfileForMode,
  isToolAllowedForProfile,
} from './agentProfiles';

export {
  createToolRegistry,
  resolveToolsForExecution,
  type ToolRegistry,
} from './toolRegistry';

export {
  resolveAgentRuntime,
  getSystemPromptForMode,
  type AgentExecutionMode,
  type AgentRuntimeOptions,
  type ResolvedAgentRuntime,
} from './agentRuntime';

// Code Actions
export {
  executeAIAction,
  registerAICodeActions,
  isPendingOperation,
  getPendingOperation,
  type AICodeAction,
} from './aiCodeActions';

// Code Agent types (lightweight)
export type {
  CodeExecutionResult,
  CodeAgentMessage,
  ToolInvocation,
  ToolInvocationState,
  AgentCallbacks,
  CodeAgent,
} from './codeAgent';

// Code Agent factory - lazy loaded when used
export { createCodeAgent } from './codeAgent';
