
import type {
  ChatMessage,
  ChatMessageMetadata,
} from '../features/ai-agent/types';
import type { ChatMessagePart } from '../features/ai-agent/types';
import type {
  ExecutionPlan,
  PlanExecutionStatus,
  PlanTaskStatus,
} from '../features/ai-agent/types';

export type AgentRunStatus =
  | 'idle'
  | 'accepted'
  | 'thinking'
  | 'generating'
  | 'applying'
  | 'completed'
  | 'error'
  | 'aborted';

export interface PendingCodeChange {
  originalCode: string;
  newCode: string;
  action: 'insert' | 'replaceSelection' | 'replaceAll';
  description?: string;
}

export interface AgentRunState {
  id: number;
  mode: string;
  status: AgentRunStatus;
  startedAt: number;
  message?: string;
  endedAt?: number;
  error?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingContent: string;
  isChatOpen: boolean;
  showThinking: boolean;

  // Pending code change for diff view
  pendingChange: PendingCodeChange | null;

  // Integrated plan state
  activePlan: ExecutionPlan | null;

  // Run lifecycle (for agent observability)
  activeRun: AgentRunState | null;

  // Applied change history for undo/redo
  appliedChanges: PendingCodeChange[];
  redoChanges: PendingCodeChange[];

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearChat: () => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  finalizeStreaming: (payload?: {
    content?: string;
    contentParts?: ChatMessagePart[];
    metadata?: ChatMessageMetadata;
  }) => void;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
  setShowThinking: (show: boolean) => void;

  // Pending change actions
  setPendingChange: (change: PendingCodeChange | null) => void;
  clearPendingChange: () => void;

  // Plan actions
  setActivePlan: (plan: ExecutionPlan | null) => void;
  setPlanStatus: (status: PlanExecutionStatus) => void;
  setCurrentPlanTaskIndex: (index: number) => void;
  updatePlanTaskStatus: (
    taskId: string,
    status: PlanTaskStatus,
    notes?: string
  ) => void;
  clearActivePlan: () => void;

  // Run lifecycle actions
  startRunLifecycle: (params: { id: number; mode: string }) => void;
  updateRunLifecycle: (params: {
    status: AgentRunStatus;
    message?: string;
    endedAt?: number;
    error?: string;
  }) => void;
  clearRunLifecycle: () => void;

  // Applied change history actions
  pushAppliedChange: (change: PendingCodeChange) => void;
  undoAppliedChange: () => PendingCodeChange | null;
  redoAppliedChange: () => PendingCodeChange | null;
  clearChangeHistory: () => void;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function getDefaultContentParts(
  role: ChatMessage['role'],
  content: string
): ChatMessagePart[] {
  if (!content.trim()) return [];

  if (role === 'assistant') {
    return [{ type: 'markdown', text: content }];
  }

  return [{ type: 'text', text: content }];
}

export const createChatSlice: import('zustand').StateCreator<ChatState> = (set, get) => ({
  messages: [],
  isStreaming: false,
  currentStreamingContent: '',
  isChatOpen: false,
  showThinking: false,
  pendingChange: null,
  activePlan: null,
  activeRun: null,
  appliedChanges: [],
  redoChanges: [],

  addMessage: (message) =>
    set((state) => {
      // Limit messages in memory to 30 to save RAM
      const currentMessages = state.messages.slice(-29);
      return {
        messages: [
          ...currentMessages,
          {
            ...message,
            id: generateId(),
            timestamp: Date.now(),
            contentParts:
              message.contentParts && message.contentParts.length > 0
                ? message.contentParts
                : getDefaultContentParts(message.role, message.content),
          },
        ],
      };
    }),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;

      if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content,
          contentParts: getDefaultContentParts('assistant', content),
        };
      }

      return { messages };
    }),

  clearChat: () =>
    set({
      messages: [],
      currentStreamingContent: '',
      isStreaming: false,
      pendingChange: null,
      activePlan: null,
      activeRun: null,
      appliedChanges: [],
      redoChanges: [],
    }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setStreamingContent: (content) =>
    set({ currentStreamingContent: content }),

  appendStreamingContent: (chunk) =>
    set((state) => ({
      currentStreamingContent: state.currentStreamingContent + chunk,
    })),

  finalizeStreaming: (payload) => {
    const state = get();
    const resolvedContent = payload?.content ?? state.currentStreamingContent;
    const resolvedParts = payload?.contentParts;
    const hasStructuredParts = Boolean(
      resolvedParts && resolvedParts.length > 0
    );
    if (resolvedContent || hasStructuredParts) {
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: generateId(),
            role: 'assistant',
            content: resolvedContent,
            timestamp: Date.now(),
            contentParts:
              hasStructuredParts && resolvedParts
                ? resolvedParts
                : getDefaultContentParts('assistant', resolvedContent),
            metadata: payload?.metadata,
          },
        ],
        currentStreamingContent: '',
        isStreaming: false,
      }));
    } else {
      set({ isStreaming: false });
    }
  },

  setChatOpen: (open) => set({ isChatOpen: open }),

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

  setShowThinking: (showThinking) => set({ showThinking }),

  // Pending change management
  setPendingChange: (change) => set({ pendingChange: change }),

  clearPendingChange: () => set({ pendingChange: null }),

  setActivePlan: (plan) => set({ activePlan: plan }),

  setPlanStatus: (status) =>
    set((state) => ({
      activePlan: state.activePlan
        ? {
          ...state.activePlan,
          status,
          updatedAt: Date.now(),
        }
        : null,
    })),

  setCurrentPlanTaskIndex: (index) =>
    set((state) => ({
      activePlan: state.activePlan
        ? {
          ...state.activePlan,
          currentTaskIndex: index,
          updatedAt: Date.now(),
        }
        : null,
    })),

  updatePlanTaskStatus: (taskId, status, notes) =>
    set((state) => ({
      activePlan: state.activePlan
        ? {
          ...state.activePlan,
          tasks: state.activePlan.tasks.map((task) =>
            task.id === taskId
              ? {
                ...task,
                status,
                notes,
              }
              : task
          ),
          updatedAt: Date.now(),
        }
        : null,
    })),

  clearActivePlan: () => set({ activePlan: null }),

  startRunLifecycle: ({ id, mode }) =>
    set({
      activeRun: {
        id,
        mode,
        status: 'accepted',
        startedAt: Date.now(),
      },
    }),

  updateRunLifecycle: ({ status, message, endedAt, error }) =>
    set((state) => ({
      activeRun: state.activeRun
        ? {
          ...state.activeRun,
          status,
          message: message ?? state.activeRun.message,
          endedAt: endedAt ?? state.activeRun.endedAt,
          error,
        }
        : null,
    })),

  clearRunLifecycle: () => set({ activeRun: null }),

  pushAppliedChange: (change) =>
    set((state) => {
      const nextApplied = [...state.appliedChanges, change].slice(-50);
      return {
        appliedChanges: nextApplied,
        redoChanges: [],
      };
    }),

  undoAppliedChange: () => {
    const state = get();
    const change = state.appliedChanges[state.appliedChanges.length - 1];
    if (!change) return null;

    set({
      appliedChanges: state.appliedChanges.slice(0, -1),
      redoChanges: [...state.redoChanges, change],
    });

    return change;
  },

  redoAppliedChange: () => {
    const state = get();
    const change = state.redoChanges[state.redoChanges.length - 1];
    if (!change) return null;

    set({
      redoChanges: state.redoChanges.slice(0, -1),
      appliedChanges: [...state.appliedChanges, change].slice(-50),
    });

    return change;
  },

  clearChangeHistory: () => set({ appliedChanges: [], redoChanges: [] }),
});

export const partializeChat = (state: ChatState) => ({
  messages: state.messages.slice(-20), // Keep only last 20 messages to save storage
  isChatOpen: state.isChatOpen,
  showThinking: state.showThinking,
  activePlan: state.activePlan,
  activeRun: state.activeRun,
  appliedChanges: state.appliedChanges.slice(-20),
  redoChanges: state.redoChanges.slice(-20),
});

export { useChatStore } from './storeHooks';
