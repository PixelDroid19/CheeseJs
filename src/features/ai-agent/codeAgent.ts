// Code Agent using AI SDK 6
// Full agent with filesystem tools, code execution, and editor integration
import { generateText, streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod/v3';
import { createProviderInstance, type LocalProviderConfig } from './providers';
import { SYSTEM_PROMPTS } from './prompts';
import type { AIProvider, CustomProviderConfig } from './types';

// Workaround for AI SDK / zod type inference issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createTool = tool as any;

// Filesystem helpers - work in both Electron and browser environments
async function readFile(
  path: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    if (window.electronAPI?.readFile) {
      return await window.electronAPI.readFile(path);
    }
    return { success: false, error: 'File system not available in browser' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function writeFile(
  path: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (window.electronAPI?.writeFile) {
      return await window.electronAPI.writeFile(path, content);
    }
    return { success: false, error: 'File system not available in browser' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function listFiles(
  path: string,
  recursive: boolean = false
): Promise<{ success: boolean; files?: string[]; error?: string }> {
  try {
    if (window.electronAPI?.listFiles) {
      return await window.electronAPI.listFiles(path, recursive);
    }
    return { success: false, error: 'File system not available in browser' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function searchInFiles(
  pattern: string,
  directory: string
): Promise<{
  success: boolean;
  results?: Array<{ file: string; line: number; content: string }>;
  error?: string;
}> {
  try {
    if (window.electronAPI?.searchInFiles) {
      return await window.electronAPI.searchInFiles(pattern, directory);
    }
    return { success: false, error: 'File system not available in browser' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function executeCommand(
  command: string,
  cwd?: string
): Promise<{
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}> {
  try {
    if (window.electronAPI?.executeCommand) {
      return await window.electronAPI.executeCommand(command, cwd);
    }
    return {
      success: false,
      error: 'Command execution not available in browser',
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function deleteFile(
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (window.electronAPI?.deleteFile) {
      return await window.electronAPI.deleteFile(path);
    }
    return { success: false, error: 'File system not available in browser' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getWorkspacePath(): Promise<string> {
  try {
    if (window.electronAPI?.getWorkspacePath) {
      return await window.electronAPI.getWorkspacePath();
    }
    return process.cwd?.() || '/';
  } catch {
    return '/';
  }
}

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

You have access to powerful tools to help the user with coding tasks.

## Editor Tools
Use these tools to manipulate the code editor directly:
- **replaceAll**: Replace the entire code in the editor with new content
- **insert**: Insert code at the current cursor position
- **replaceSelection**: Replace the currently selected code
- **searchDocumentation**: Search the documentation (RAG) for relevant information

## Filesystem Tools
You have full access to the user's filesystem (when running in Electron):
- **readFile**: Read the contents of any file. Supports optional line ranges (startLine, endLine)
- **writeFile**: Create or overwrite a file with new content
- **listFiles**: List files and directories in a path. Set recursive=true for deep listing
- **searchInFiles**: Search for text or regex patterns across files in a directory
- **executeCommand**: Run shell commands (use with caution - explain what you're doing)
- **deleteFile**: Delete a file or directory (use with caution)
- **getWorkspacePath**: Get the current workspace/project root path

## Guidelines
- Use tools whenever you need to write, modify, or analyze code
- Don't just output code in markdown unless specifically asked for an explanation
- For filesystem operations, always confirm with the user before destructive actions
- When exploring a project, start with getWorkspacePath and listFiles to understand the structure
- Use readFile to examine specific files, and writeFile to make changes
- Use searchInFiles to find code patterns, function definitions, or usages
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
    replaceAll: createTool({
      description: 'Replace the entire code in the editor',
      inputSchema: z.object({
        code: z.string().describe('The full code to write'),
        explanation: z
          .string()
          .optional()
          .describe('Explanation of the change'),
      }),
      execute: async (params: { code: string; explanation?: string }) => {
        const { code, explanation } = params;
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
    insert: createTool({
      description: 'Insert code at the current cursor position',
      inputSchema: z.object({
        code: z.string().describe('The code to insert'),
        explanation: z
          .string()
          .optional()
          .describe('Explanation of the change'),
      }),
      execute: async (params: { code: string; explanation?: string }) => {
        const { code, explanation } = params;
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
    replaceSelection: createTool({
      description: 'Replace the currently selected code',
      inputSchema: z.object({
        code: z.string().describe('The new code'),
        explanation: z
          .string()
          .optional()
          .describe('Explanation of the change'),
      }),
      execute: async (params: { code: string; explanation?: string }) => {
        const { code, explanation } = params;
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
    searchDocumentation: createTool({
      description: 'Search the documentation for relevant information (RAG)',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
      }),
      execute: async (params: { query: string }) => {
        const { query } = params;
        const invocationId = `tool_${Date.now()}_searchDocumentation`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'searchDocumentation',
          state: 'running',
          input: { query },
        });

        let result: string;
        try {
          if (typeof window !== 'undefined' && window.rag) {
            const pipelineResult = await window.rag.searchPipeline(query, {
              maxContextTokens: 4000,
              includeAttribution: true,
            });
            if (pipelineResult.success && pipelineResult.result?.context) {
              result = pipelineResult.result.context;
              if (!result) result = 'No relevant documentation found.';
            } else {
              result =
                'Error searching documentation: ' +
                (pipelineResult.error || 'Unknown error');
            }
          } else {
            result = 'RAG system is not available in this environment.';
          }
        } catch (error) {
          result = 'Error searching documentation: ' + String(error);
        }

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'searchDocumentation',
          state: 'completed',
          input: { query },
          output: { success: true, resultCount: result.length },
        });

        return { result };
      },
    }),
    // ========== NEW FILESYSTEM TOOLS ==========
    readFile: createTool({
      description: 'Read the contents of a file from the filesystem',
      inputSchema: z.object({
        path: z.string().describe('The file path to read'),
        startLine: z
          .number()
          .optional()
          .describe('Starting line number (1-based)'),
        endLine: z.number().optional().describe('Ending line number (1-based)'),
      }),
      execute: async (params: {
        path: string;
        startLine?: number;
        endLine?: number;
      }) => {
        const { path, startLine, endLine } = params;
        const invocationId = `tool_${Date.now()}_readFile`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'readFile',
          state: 'running',
          input: { path, startLine, endLine },
        });

        const result = await readFile(path);

        let content = result.content || '';
        if (result.success && content && (startLine || endLine)) {
          const lines = content.split('\n');
          const start = (startLine || 1) - 1;
          const end = endLine || lines.length;
          content = lines.slice(start, end).join('\n');
        }

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'readFile',
          state: result.success ? 'completed' : 'error',
          input: { path, startLine, endLine },
          output: result.success
            ? { success: true, lines: content.split('\n').length }
            : undefined,
          error: result.error,
        });

        return result.success
          ? { success: true, content }
          : { success: false, error: result.error };
      },
    }),
    writeFile: createTool({
      description:
        'Write content to a file (creates the file if it does not exist)',
      inputSchema: z.object({
        path: z.string().describe('The file path to write'),
        content: z.string().describe('The content to write'),
      }),
      execute: async (params: { path: string; content: string }) => {
        const { path, content } = params;
        const invocationId = `tool_${Date.now()}_writeFile`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'writeFile',
          state: 'running',
          input: { path, contentLength: content.length },
        });

        const result = await writeFile(path, content);

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'writeFile',
          state: result.success ? 'completed' : 'error',
          input: { path, contentLength: content.length },
          output: result.success ? { success: true } : undefined,
          error: result.error,
        });

        return result;
      },
    }),
    listFiles: createTool({
      description: 'List files and directories in a given path',
      inputSchema: z.object({
        path: z.string().describe('The directory path to list'),
        recursive: z
          .boolean()
          .optional()
          .describe('Whether to list files recursively'),
      }),
      execute: async (params: { path: string; recursive?: boolean }) => {
        const { path, recursive = false } = params;
        const invocationId = `tool_${Date.now()}_listFiles`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'listFiles',
          state: 'running',
          input: { path, recursive },
        });

        const result = await listFiles(path, recursive);

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'listFiles',
          state: result.success ? 'completed' : 'error',
          input: { path, recursive },
          output: result.success
            ? { success: true, count: result.files?.length }
            : undefined,
          error: result.error,
        });

        return result;
      },
    }),
    searchInFiles: createTool({
      description:
        'Search for a pattern (text or regex) in files within a directory',
      inputSchema: z.object({
        pattern: z.string().describe('The search pattern (text or regex)'),
        directory: z.string().describe('The directory to search in'),
      }),
      execute: async (params: { pattern: string; directory: string }) => {
        const { pattern, directory } = params;
        const invocationId = `tool_${Date.now()}_searchInFiles`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'searchInFiles',
          state: 'running',
          input: { pattern, directory },
        });

        const result = await searchInFiles(pattern, directory);

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'searchInFiles',
          state: result.success ? 'completed' : 'error',
          input: { pattern, directory },
          output: result.success
            ? { success: true, matchCount: result.results?.length }
            : undefined,
          error: result.error,
        });

        return result;
      },
    }),
    executeCommand: createTool({
      description: 'Execute a shell command (use with caution)',
      inputSchema: z.object({
        command: z.string().describe('The command to execute'),
        cwd: z
          .string()
          .optional()
          .describe('Working directory for the command'),
      }),
      execute: async (params: { command: string; cwd?: string }) => {
        const { command, cwd } = params;
        const invocationId = `tool_${Date.now()}_executeCommand`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'executeCommand',
          state: 'running',
          input: { command, cwd },
        });

        const result = await executeCommand(command, cwd);

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'executeCommand',
          state: result.success ? 'completed' : 'error',
          input: { command, cwd },
          output: result.success
            ? { success: true, stdout: result.stdout?.slice(0, 500) }
            : undefined,
          error: result.error || result.stderr,
        });

        return result;
      },
    }),
    deleteFile: createTool({
      description: 'Delete a file or directory',
      inputSchema: z.object({
        path: z.string().describe('The path to delete'),
      }),
      execute: async (params: { path: string }) => {
        const { path } = params;
        const invocationId = `tool_${Date.now()}_deleteFile`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'deleteFile',
          state: 'running',
          input: { path },
        });

        const result = await deleteFile(path);

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'deleteFile',
          state: result.success ? 'completed' : 'error',
          input: { path },
          output: result.success ? { success: true } : undefined,
          error: result.error,
        });

        return result;
      },
    }),
    getWorkspacePath: createTool({
      description: 'Get the current workspace/project path',
      inputSchema: z.object({}),
      execute: async () => {
        const invocationId = `tool_${Date.now()}_getWorkspacePath`;
        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'getWorkspacePath',
          state: 'running',
          input: {},
        });

        const path = await getWorkspacePath();

        callbacks?.onToolInvocation?.({
          id: invocationId,
          toolName: 'getWorkspacePath',
          state: 'completed',
          input: {},
          output: { success: true, path },
        });

        return { success: true, path };
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
            stopWhen: stepCountIs(5),
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
        stopWhen: stepCountIs(5),
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
