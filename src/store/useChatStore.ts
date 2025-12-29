import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../features/ai-agent/types';

// Agent phase type for thinking state UI
export type AgentPhase = 'idle' | 'thinking' | 'generating' | 'applying';

// Pending code change for diff view
export interface PendingCodeChange {
  originalCode: string;
  newCode: string;
  action: 'insert' | 'replaceSelection' | 'replaceAll';
  description?: string;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingContent: string;
  isChatOpen: boolean;

  // Agent thinking state
  agentPhase: AgentPhase;
  thinkingMessage: string;

  // Pending code change for diff view
  pendingChange: PendingCodeChange | null;

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearChat: () => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  finalizeStreaming: () => void;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;

  // Agent phase actions
  setAgentPhase: (phase: AgentPhase, message?: string) => void;

  // Pending change actions
  setPendingChange: (change: PendingCodeChange | null) => void;
  clearPendingChange: () => void;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isStreaming: false,
      currentStreamingContent: '',
      isChatOpen: false,
      agentPhase: 'idle',
      thinkingMessage: '',
      pendingChange: null,

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
            };
          }

          return { messages };
        }),

      clearChat: () =>
        set({
          messages: [],
          currentStreamingContent: '',
          isStreaming: false,
          agentPhase: 'idle',
          thinkingMessage: '',
          pendingChange: null,
        }),

      setStreaming: (streaming) => set({ isStreaming: streaming }),

      setStreamingContent: (content) =>
        set({ currentStreamingContent: content }),

      appendStreamingContent: (chunk) =>
        set((state) => ({
          currentStreamingContent: state.currentStreamingContent + chunk,
        })),

      finalizeStreaming: () => {
        const state = get();
        if (state.currentStreamingContent) {
          set((s) => ({
            messages: [
              ...s.messages,
              {
                id: generateId(),
                role: 'assistant',
                content: s.currentStreamingContent,
                timestamp: Date.now(),
              },
            ],
            currentStreamingContent: '',
            isStreaming: false,
            agentPhase: 'idle',
            thinkingMessage: '',
          }));
        } else {
          set({ isStreaming: false, agentPhase: 'idle', thinkingMessage: '' });
        }
      },

      setChatOpen: (open) => set({ isChatOpen: open }),

      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

      // Agent phase management
      setAgentPhase: (phase, message) =>
        set({
          agentPhase: phase,
          thinkingMessage: message || getDefaultPhaseMessage(phase),
        }),

      // Pending change management
      setPendingChange: (change) => set({ pendingChange: change }),

      clearPendingChange: () => set({ pendingChange: null }),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        messages: state.messages.slice(-20), // Keep only last 20 messages to save storage
        isChatOpen: state.isChatOpen,
      }),
    }
  )
);

// Default messages for each phase
function getDefaultPhaseMessage(phase: AgentPhase): string {
  switch (phase) {
    case 'thinking':
      return 'Analyzing your request...';
    case 'generating':
      return 'Generating code...';
    case 'applying':
      return 'Preparing changes...';
    default:
      return '';
  }
}
