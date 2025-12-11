// Code Agent using AI SDK 6
// Simple agent that works with all providers (including local models)
import { generateText, streamText } from 'ai';
import { createProviderInstance, type LocalProviderConfig } from './providers';
import { SYSTEM_PROMPTS } from './prompts';
import type { AIProvider, CustomProviderConfig } from './types';

// Code execution result type
export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

// Tool invocation state for UI
export type ToolInvocationState = 
  | 'pending'
  | 'running'
  | 'approval-requested'
  | 'approved'
  | 'denied'
  | 'completed'
  | 'error';

export interface ToolInvocation {
  id: string;
  toolName: string;
  state: ToolInvocationState;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  approval?: {
    id: string;
    message: string;
  };
}

// Agent callbacks for editor integration
export interface AgentCallbacks {
  onExecuteCode?: (code: string, language: string) => Promise<CodeExecutionResult>;
  onInsertCode?: (code: string) => void;
  onReplaceSelection?: (code: string) => void;
  onReplaceAll?: (code: string) => void;
  getEditorContent?: () => string;
  getSelectedCode?: () => string;
  getLanguage?: () => string;
  onToolInvocation?: (invocation: ToolInvocation) => void;
}

// Simple agent interface
export interface SimpleAgent {
  stream: (options: { prompt: string }) => {
    textStream: AsyncIterable<string>;
  };
  generate: (options: { prompt: string }) => Promise<{ text: string }>;
}

// Process editor actions from the response
function processEditorActions(text: string, callbacks?: AgentCallbacks): void {
  if (!callbacks) return;

  const actionMatch = text.match(/<<<EDITOR_ACTION>>>\s*([\s\S]*?)\s*<<<END_ACTION>>>/);
  if (!actionMatch) return;

  try {
    const actionJson = actionMatch[1].trim();
    const action = JSON.parse(actionJson);

    if (!action.action || !action.code) return;

    const invocationId = `action_${Date.now()}`;
    
    callbacks.onToolInvocation?.({
      id: invocationId,
      toolName: action.action,
      state: 'running',
      input: { code: action.code.slice(0, 50) + '...' },
    });

    switch (action.action) {
      case 'replaceAll':
        callbacks.onReplaceAll?.(action.code);
        break;
      case 'insert':
        callbacks.onInsertCode?.(action.code);
        break;
      case 'replaceSelection':
        callbacks.onReplaceSelection?.(action.code);
        break;
    }

    callbacks.onToolInvocation?.({
      id: invocationId,
      toolName: action.action,
      state: 'completed',
      input: { code: action.code.slice(0, 50) + '...' },
      output: { success: true },
    });
  } catch {
    // Silent fail
  }
}

const AGENT_SYSTEM_PROMPT = `${SYSTEM_PROMPTS.codeAssistant}

You can MODIFY the editor directly by including a special command at the END of your response.

To write/replace code in the editor, use this EXACT format:
<<<EDITOR_ACTION>>>
{"action": "replaceAll", "code": "YOUR CODE HERE"}
<<<END_ACTION>>>

Actions: "replaceAll" (replace all), "insert" (at cursor), "replaceSelection" (selected code)

When asked to write/create/generate code, ALWAYS include the EDITOR_ACTION block.
Use markdown for explanations.`;

// Create a simple agent - compatible with all providers
export function createCodeAgent(
  provider: AIProvider,
  apiKey: string,
  modelId: string,
  localConfig?: LocalProviderConfig,
  callbacks?: AgentCallbacks,
  customConfig?: CustomProviderConfig
): SimpleAgent {
  const providerInstance = createProviderInstance(provider, apiKey, modelId, localConfig, customConfig);

  return {
    stream: ({ prompt }) => {
      return {
        textStream: (async function* () {
          const result = streamText({
            model: providerInstance.model,
            system: AGENT_SYSTEM_PROMPT,
            prompt,
            maxTokens: 2048,
          });

          let fullText = '';
          for await (const chunk of result.textStream) {
            fullText += chunk;
            yield chunk;
          }
          
          // Process editor actions after streaming
          processEditorActions(fullText, callbacks);
        })(),
      };
    },

    generate: async ({ prompt }) => {
      const result = await generateText({
        model: providerInstance.model,
        system: AGENT_SYSTEM_PROMPT,
        prompt,
        maxTokens: 2048,
      });

      processEditorActions(result.text, callbacks);
      return { text: result.text };
    },
  };
}

// Type for the agent
export type CodeAgent = ReturnType<typeof createCodeAgent>;

// Type for agent messages
export type CodeAgentMessage = {
  role: 'user' | 'assistant';
  content: string;
};
