// Code Agent using AI SDK 6
// Simple agent that works with all providers (including local models)
import { generateText, streamText, tool } from 'ai';
import { z } from 'zod';
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
  onExecuteCode?: (
    code: string,
    language: string
  ) => Promise<CodeExecutionResult>;
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

// Keep for backward compatibility with fallback logic in AIChat
export async function processEditorActions(
  text: string,
  callbacks?: AgentCallbacks
) {
  if (!callbacks) return;

  const actionRegex = /<<<EDITOR_ACTION>>>\s*([\s\S]*?)\s*<<<END_ACTION>>>/g;
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      console.log('[CodeAgent] Found editor action block');
      const jsonStr = match[1].trim();
      const action = JSON.parse(jsonStr);

      if (action.action) {
        console.log('[CodeAgent] Executing action:', action.action);
      } else {
        console.warn(
          '[CodeAgent] Action block missing "action" field:',
          action
        );
      }

      if (!action.action || !action.code) continue;

      const invocationId = `action_${Date.now()}`;

      // Report tool invocation start
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
    } catch (error) {
      console.error('[CodeAgent] Failed to parse editor action:', error);
    }
  }
}

const AGENT_SYSTEM_PROMPT = `${SYSTEM_PROMPTS.codeAssistant}

You have access to tools to manipulate the code editor directly.
Use these tools whenever you need to write, modify, or analyze code.
Don't just output code in markdown unless specifically asked for an explanation without code changes.
ALWAYS use the provided tools to make changes to the code.
`;

const LEGACY_SYSTEM_PROMPT = `${SYSTEM_PROMPTS.codeAssistant}

You have DIRECT ACCESS to the code editor.
The current code in the editor is provided to you in the context.

Your PRIMARY GOAL is to help the user by WRITING CODE DIRECTLY into the editor.

To perform actions, you MUST use the following JSON block format:

<<<EDITOR_ACTION>>>
{
  "action": "ACTION_NAME",
  "code": "CODE_CONTENT"
}
<<<END_ACTION>>>

Available Actions:
- "replaceAll": Replace the entire file content. Use this to write a new file or completely rewrite the current code.
- "insert": Insert code at cursor position. Use this to insert a helper function or snippet.
- "replaceSelection": Replace selected code.

Example:
<<<EDITOR_ACTION>>>
{
  "action": "insert",
  "code": "console.log('Hello');"
}
<<<END_ACTION>>>

CRITICAL RULES:
- DO NOT just print the code in a markdown block. The user wants the code IN THE EDITOR.
- Use the JSON block format for ALL code modifications.
`;

function getTools(callbacks?: AgentCallbacks) {
  return {
    replaceAll: tool({
      description: 'Replace the entire code in the editor',
      parameters: z.object({
        code: z.string().describe('The full code to write'),
        explanation: z
          .string()
          .optional()
          .describe('Explanation of the change'),
      }),
      execute: async ({ code, explanation }) => {
        const invocationId = `tool_${Date.now()}_replaceAll`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'replaceAll',
          state: 'running',
          input: { code: code.slice(0, 50) + '...', explanation },
        });

        callbacks?.onReplaceAll?.(code);

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'replaceAll',
          state: 'completed',
          input: { code: code.slice(0, 50) + '...', explanation },
          output: { success: true },
        });
        return { success: true, explanation };
      },
    }),
    insert: tool({
      description: 'Insert code at the current cursor position',
      parameters: z.object({
        code: z.string().describe('The code to insert'),
        explanation: z
          .string()
          .optional()
          .describe('Explanation of the change'),
      }),
      execute: async ({ code, explanation }) => {
        const invocationId = `tool_${Date.now()}_insert`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'insert',
          state: 'running',
          input: { code: code.slice(0, 50) + '...', explanation },
        });

        callbacks?.onInsertCode?.(code);

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'insert',
          state: 'completed',
          input: { code: code.slice(0, 50) + '...', explanation },
          output: { success: true },
        });
        return { success: true, explanation };
      },
    }),
    replaceSelection: tool({
      description: 'Replace the currently selected code',
      parameters: z.object({
        code: z.string().describe('The new code'),
        explanation: z
          .string()
          .optional()
          .describe('Explanation of the change'),
      }),
      execute: async ({ code, explanation }) => {
        const invocationId = `tool_${Date.now()}_replaceSelection`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'replaceSelection',
          state: 'running',
          input: { code: code.slice(0, 50) + '...', explanation },
        });

        callbacks?.onReplaceSelection?.(code);

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'replaceSelection',
          state: 'completed',
          input: { code: code.slice(0, 50) + '...', explanation },
          output: { success: true },
        });
        return { success: true, explanation };
      },
    }),
  };
}

// Create a simple agent - compatible with all providers
export function createCodeAgent(
  provider: AIProvider,
  apiKey: string,
  modelId: string,
  localConfig?: LocalProviderConfig,
  callbacks?: AgentCallbacks,
  customConfig?: CustomProviderConfig,
  disableTools: boolean = false
): SimpleAgent {
  const providerInstance = createProviderInstance(
    provider,
    apiKey,
    modelId,
    localConfig,
    customConfig
  );
  const tools = disableTools ? undefined : getTools(callbacks);
  const systemPrompt = disableTools
    ? LEGACY_SYSTEM_PROMPT
    : AGENT_SYSTEM_PROMPT;

  return {
    stream: ({ prompt }) => {
      return {
        textStream: (async function* () {
          const result = streamText({
            model: providerInstance.model,
            system: systemPrompt,
            prompt,
            tools,
            maxSteps: 5,
          });

          let fullResponse = '';
          for await (const chunk of result.textStream) {
            fullResponse += chunk;
            yield chunk;
          }

          if (disableTools && callbacks) {
            // In legacy mode (no tools), we process the text manually
            await processEditorActions(fullResponse, callbacks);
          }
        })(),
      };
    },

    generate: async ({ prompt }) => {
      const result = await generateText({
        model: providerInstance.model,
        system: systemPrompt,
        prompt,
        tools,
        maxSteps: 5,
      });

      if (disableTools && callbacks) {
        await processEditorActions(result.text, callbacks);
      }

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
