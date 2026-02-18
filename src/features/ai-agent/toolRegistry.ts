import { tool } from 'ai';
import { z } from 'zod/v3';
import {
  getDefaultProfileForMode,
  isToolAllowedForProfile,
  type AgentProfile,
} from './agentProfiles';
import type { AgentCallbacks, AgentExecutionMode } from './codeAgent';

// Workaround for AI SDK / zod type inference issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createTool = tool as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolRegistry = Record<string, any>;

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

function getReadOnlyTools(callbacks?: AgentCallbacks): ToolRegistry {
  return {
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

function getWriteTools(callbacks?: AgentCallbacks): ToolRegistry {
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
  };
}

export function createToolRegistry(callbacks?: AgentCallbacks): ToolRegistry {
  return {
    ...getReadOnlyTools(callbacks),
    ...getWriteTools(callbacks),
  };
}

export function resolveToolsForExecution(
  registry: ToolRegistry,
  mode: AgentExecutionMode,
  profile?: AgentProfile
): ToolRegistry {
  const resolvedProfile = profile || getDefaultProfileForMode(mode);
  const modeSafeRegistry =
    mode === 'agent'
      ? registry
      : Object.fromEntries(
          Object.entries(registry).filter(
            ([toolName]) =>
              ![
                'replaceAll',
                'insert',
                'replaceSelection',
                'writeFile',
                'deleteFile',
              ].includes(toolName)
          )
        );

  return Object.fromEntries(
    Object.entries(modeSafeRegistry).filter(([toolName]) =>
      isToolAllowedForProfile(resolvedProfile, toolName)
    )
  );
}
