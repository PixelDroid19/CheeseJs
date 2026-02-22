import type { ToolInvocation } from '../../../features/ai-agent/codeAgent';
import type { AgentProfile } from '../../../features/ai-agent/agentProfiles';
import type { AgentCallbacks } from '../../../features/ai-agent/codeAgent';
import type {
  ChatMessageMetadata,
  ChatMessagePart,
} from '../../../features/ai-agent/types';
import type { ToolPolicySettings } from '../../../store/useAISettingsStore';
import type { AgentRunStatus } from '../../../store/useChatStore';

export interface PendingApprovalState {
  id: string;
  toolName: string;
  message: string;
  input: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

export interface CloudWarningState {
  pending: boolean;
  sensitiveItems: string[];
  pendingMessage: string;
  pendingCode?: string;
}

export interface SendHandlerDeps {
  input: string;
  isStreaming: boolean;
  isConfigured: boolean;
  includeCode: boolean;
  code: string;
  provider: 'local' | 'openai' | 'anthropic' | 'google';
  strictLocalMode: boolean;
  toolPolicy: ToolPolicySettings;
  language: string;
  enableVerifierSubagent: boolean;
  executionMode: 'agent' | 'plan';
  agentProfile: AgentProfile;
  showThinking: boolean;
  pinnedDocIds: string[];

  setInput: (value: string) => void;
  setExecutionMode: (mode: 'agent' | 'plan') => void;
  setToolInvocations: React.Dispatch<React.SetStateAction<ToolInvocation[]>>;
  setCloudWarning: React.Dispatch<React.SetStateAction<CloudWarningState | null>>;
  setLastError: React.Dispatch<React.SetStateAction<string | null>>;
  setLastFailedPrompt: React.Dispatch<React.SetStateAction<string | null>>;

  addMessage: (message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    contentParts?: ChatMessagePart[];
    metadata?: ChatMessageMetadata;
    codeContext?: string;
  }) => void;
  clearChat: () => void;
  handleCompactContext: () => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  finalizeStreaming: (payload?: {
    content?: string;
    contentParts?: ChatMessagePart[];
    metadata?: ChatMessageMetadata;
  }) => void;

  getCurrentApiKey: () => string;
  getCurrentModel: () => string;
  getLocalConfig: () => { baseURL: string; modelId: string };
  getCustomConfig: () => { baseURL?: string; modelId?: string } | undefined;

  createAgentCallbacks: () => AgentCallbacks;
  getPinnedDocsContext: () => Promise<string>;

  startRunLifecycle: (params: { id: number; mode: string }) => void;
  updateRunLifecycle: (params: {
    status: AgentRunStatus;
    message?: string;
    endedAt?: number;
    error?: string;
  }) => void;
}
