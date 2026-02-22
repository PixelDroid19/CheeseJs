import type { ToolInvocation } from './codeAgent';
import {
  sanitizeAssistantOutput,
  type AgentExecutionMode,
} from './codeAgent';
import type {
  ChatMessageMetadata,
  ChatMessagePart,
} from './types';

const THINK_BLOCK_REGEX = /<think>([\s\S]*?)<\/think>/gi;

function extractThinkingBlocks(text: string): string[] {
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = THINK_BLOCK_REGEX.exec(text)) !== null) {
    const value = match[1]?.trim();
    if (value) {
      blocks.push(value);
    }
  }

  return blocks;
}

function summarizeToolInvocation(invocation: ToolInvocation): string | undefined {
  if (typeof invocation.output === 'string' && invocation.output.trim()) {
    return invocation.output.slice(0, 140);
  }

  if (invocation.error?.trim()) {
    return invocation.error.slice(0, 140);
  }

  const inputKeys = Object.keys(invocation.input || {});
  if (inputKeys.length > 0) {
    return `input: ${inputKeys.slice(0, 4).join(', ')}`;
  }

  return undefined;
}

function buildToolParts(toolInvocations: ToolInvocation[]): ChatMessagePart[] {
  if (!toolInvocations.length) return [];

  const latestById = new Map<string, ToolInvocation>();
  for (const invocation of toolInvocations) {
    latestById.set(invocation.id, invocation);
  }

  return Array.from(latestById.values()).map((invocation) => ({
    id: invocation.id,
    type: 'tool-call',
    toolName: invocation.toolName,
    state: invocation.state,
    summary: summarizeToolInvocation(invocation),
  }));
}

export interface BuildAssistantMessagePayloadOptions {
  rawText: string;
  showThinking: boolean;
  toolInvocations?: ToolInvocation[];
  runId: number;
  mode: AgentExecutionMode;
  model: string;
  status?: 'partial' | 'final' | 'error';
}

export interface AssistantMessagePayload {
  content: string;
  contentParts: ChatMessagePart[];
  metadata: ChatMessageMetadata;
}

export function buildAssistantMessagePayload(
  options: BuildAssistantMessagePayloadOptions
): AssistantMessagePayload {
  const content = sanitizeAssistantOutput(options.rawText, {
    showThinking: false,
  });

  const contentParts: ChatMessagePart[] = [];

  if (content.trim()) {
    contentParts.push({
      type: 'markdown',
      text: content,
    });
  }

  if (options.showThinking) {
    const thinkingBlocks = extractThinkingBlocks(options.rawText);
    for (const block of thinkingBlocks) {
      contentParts.push({
        type: 'reasoning',
        text: block,
        collapsed: true,
      });
    }
  }

  contentParts.push(...buildToolParts(options.toolInvocations || []));

  return {
    content,
    contentParts,
    metadata: {
      runId: options.runId,
      model: options.model,
      status: options.status || 'final',
      tags: [options.mode],
    },
  };
}
