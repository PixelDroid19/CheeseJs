// Code Agent using AI SDK 6
// Full agent with filesystem tools, code execution, and editor integration
import { generateText, streamText, stepCountIs } from 'ai';
import { createProviderInstance, type LocalProviderConfig } from './providers';
import type { AgentProfile } from './agentProfiles';
import {
  resolveAgentRuntime,
  type AgentExecutionMode,
  type AgentRuntimeOptions,
} from './agentRuntime';
import { createToolRegistry, resolveToolsForExecution } from './toolRegistry';
import type {
  AIProvider,
  CustomProviderConfig,
  ExecutionPlan,
  PlanTask,
} from './types';

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
  stream: (options: { prompt: string; abortSignal?: AbortSignal }) => {
    textStream: AsyncIterable<string>;
  };
  generate: (options: {
    prompt: string;
    abortSignal?: AbortSignal;
  }) => Promise<{ text: string }>;
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

export function sanitizeAssistantOutput(
  rawText: string,
  options?: { showThinking?: boolean }
): string {
  if (!rawText) return '';

  let sanitized = rawText;
  const showThinking = options?.showThinking ?? false;

  // Never surface internal editor action envelopes in chat text.
  sanitized = sanitized.replace(
    /<<<EDITOR_ACTION>>>[\s\S]*?<<<END_ACTION>>>/g,
    ''
  );

  if (!showThinking) {
    // Remove fully closed hidden-reasoning blocks.
    sanitized = sanitized.replace(/<think>[\s\S]*?<\/think>/gi, '');
    sanitized = sanitized.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

    // Hide trailing, unclosed reasoning blocks while streaming.
    const hideTrailingBlock = (
      text: string,
      openTag: string,
      closeTag: string
    ) => {
      const lower = text.toLowerCase();
      const openIndex = lower.lastIndexOf(openTag);
      const closeIndex = lower.lastIndexOf(closeTag);
      return openIndex > closeIndex ? text.slice(0, openIndex) : text;
    };

    sanitized = hideTrailingBlock(sanitized, '<think>', '</think>');
    sanitized = hideTrailingBlock(sanitized, '<reasoning>', '</reasoning>');
  }

  return sanitized.trim();
}

export function isDirectEditIntent(message: string): boolean {
  const intentRegex =
    /(create|write|implement|build|make|add|fix|refactor|update|edit|replace|rewrite|function|archivo|crear|escribe|implementa|construye|agrega|corrige|refactoriza|edita|modifica|reemplaza|reescribe|funci[oó]n)/i;
  return intentRegex.test(message);
}

export function extractCodeForDirectEdit(responseText: string): string | null {
  if (!responseText) return null;

  // Prefer explicit fenced code blocks.
  const codeFenceMatch = responseText.match(/```(?:[\w.+-]+)?\n([\s\S]*?)```/);
  if (codeFenceMatch?.[1]?.trim()) {
    return codeFenceMatch[1].trim();
  }

  const normalized = responseText.trim();
  const looksLikeCode =
    /(^|\n)\s*(function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|class\s+\w+|import\s+.+from\s+['"]|export\s+(default\s+)?(function|const|class)|def\s+\w+\s*\(|if\s*\(|for\s*\(|while\s*\()/m.test(
      normalized
    );

  if (looksLikeCode) {
    return normalized;
  }

  return null;
}

const PLAN_JSON_START = '<<<PLAN_JSON_START>>>';
const PLAN_JSON_END = '<<<PLAN_JSON_END>>>';

export function buildStructuredPlanPrompt(userRequest: string): string {
  return [
    `Create an actionable development plan for this request: ${userRequest}`,
    '',
    'Return two sections:',
    '1) Human summary in markdown (short).',
    `2) Machine-readable JSON between markers ${PLAN_JSON_START} and ${PLAN_JSON_END}.`,
    '',
    'JSON schema:',
    '{',
    '  "goal": "string",',
    '  "assumptions": ["string"],',
    '  "tasks": [',
    '    {',
    '      "id": "task-1",',
    '      "title": "string",',
    '      "description": "string",',
    '      "dependencies": ["task-x"],',
    '      "prompt": "single clear instruction for autonomous execution"',
    '    }',
    '  ]',
    '}',
    '',
    'Constraints:',
    '- 3 to 8 tasks max',
    '- Each task must be executable independently',
    '- dependencies should only reference existing task ids',
  ].join('\n');
}

export function extractExecutionPlanFromText(
  responseText: string
): ExecutionPlan | null {
  const start = responseText.indexOf(PLAN_JSON_START);
  const end = responseText.indexOf(PLAN_JSON_END);
  if (start === -1 || end === -1 || end <= start) return null;

  const rawJson = responseText
    .slice(start + PLAN_JSON_START.length, end)
    .trim();

  try {
    const parsed = JSON.parse(rawJson) as {
      goal?: string;
      assumptions?: string[];
      tasks?: Array<{
        id?: string;
        title?: string;
        description?: string;
        dependencies?: string[];
        prompt?: string;
      }>;
    };

    if (
      !parsed.goal ||
      !Array.isArray(parsed.tasks) ||
      parsed.tasks.length === 0
    ) {
      return null;
    }

    const normalizedTasks: PlanTask[] = parsed.tasks
      .map((task, index) => {
        const id = task.id?.trim() || `task-${index + 1}`;
        return {
          id,
          title: task.title?.trim() || `Task ${index + 1}`,
          description: task.description?.trim() || '',
          dependencies: Array.isArray(task.dependencies)
            ? task.dependencies.filter(Boolean)
            : [],
          prompt:
            task.prompt?.trim() ||
            `Execute task ${id}: ${task.title?.trim() || `Task ${index + 1}`}`,
          status: 'pending' as const,
        };
      })
      .filter((task) => task.prompt.length > 0);

    if (normalizedTasks.length === 0) return null;

    const now = Date.now();
    return {
      id: `plan_${now}`,
      goal: parsed.goal,
      assumptions: Array.isArray(parsed.assumptions)
        ? parsed.assumptions.filter(Boolean)
        : [],
      tasks: normalizedTasks,
      status: 'ready',
      createdAt: now,
      updatedAt: now,
      currentTaskIndex: 0,
    };
  } catch {
    return null;
  }
}

function getTools(
  callbacks?: AgentCallbacks,
  mode: AgentExecutionMode = 'agent',
  profile?: AgentProfile
) {
  return resolveToolsForExecution(createToolRegistry(callbacks), mode, profile);
}

// Create a simple agent - compatible with all providers
export function createCodeAgent(
  provider: AIProvider,
  apiKey: string,
  modelId: string,
  localConfig?: LocalProviderConfig,
  callbacks?: AgentCallbacks,
  customConfig?: CustomProviderConfig,
  optionsOrDisable?: boolean | AgentRuntimeOptions
): SimpleAgent {
  const { mode, disableTools, profile, systemPrompt, maxSteps } =
    resolveAgentRuntime(optionsOrDisable);
  const providerInstance = createProviderInstance(
    provider,
    apiKey,
    modelId,
    localConfig,
    customConfig
  );
  const tools = disableTools ? undefined : getTools(callbacks, mode, profile);

  return {
    stream: ({ prompt, abortSignal }) => {
      return {
        textStream: (async function* () {
          const result = streamText({
            model: providerInstance.model,
            system: systemPrompt,
            prompt,
            tools,
            stopWhen: stepCountIs(maxSteps),
            abortSignal,
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

    generate: async ({ prompt, abortSignal }) => {
      const result = await generateText({
        model: providerInstance.model,
        system: systemPrompt,
        prompt,
        tools,
        stopWhen: stepCountIs(maxSteps),
        abortSignal,
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

export type { AgentExecutionMode, AgentRuntimeOptions } from './agentRuntime';
