import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../useChatStore';
import { act } from '@testing-library/react';

describe('useChatStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    // clearChat() does NOT reset isChatOpen, and the persist middleware
    // can leak state between tests, so we explicitly reset everything.
    act(() => {
      useChatStore.getState().clearChat();
      useChatStore.setState({ isChatOpen: false });
    });
  });

  describe('initial state', () => {
    it('should have empty messages and idle phase', () => {
      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.isStreaming).toBe(false);
      expect(state.currentStreamingContent).toBe('');
      expect(state.isChatOpen).toBe(false);
      expect(state.agentPhase).toBe('idle');
      expect(state.thinkingMessage).toBe('');
      expect(state.pendingChange).toBeNull();
      expect(state.activePlan).toBeNull();
      expect(state.showThinking).toBe(false);
      expect(state.appliedChanges).toEqual([]);
      expect(state.redoChanges).toEqual([]);
    });
  });

  describe('addMessage', () => {
    it('should add a message with auto-generated id and timestamp', () => {
      act(() => {
        useChatStore.getState().addMessage({ role: 'user', content: 'Hello' });
      });
      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('Hello');
      expect(msgs[0].id).toMatch(/^msg_/);
      expect(msgs[0].timestamp).toBeGreaterThan(0);
    });

    it('should limit messages to 30 in memory', () => {
      act(() => {
        for (let i = 0; i < 35; i++) {
          useChatStore
            .getState()
            .addMessage({ role: 'user', content: `msg ${i}` });
        }
      });
      const msgs = useChatStore.getState().messages;
      expect(msgs.length).toBeLessThanOrEqual(30);
      // Last message should be the most recent
      expect(msgs[msgs.length - 1].content).toBe('msg 34');
    });
  });

  describe('updateLastAssistantMessage', () => {
    it('should update the last assistant message content', () => {
      act(() => {
        useChatStore
          .getState()
          .addMessage({ role: 'assistant', content: 'old' });
        useChatStore.getState().updateLastAssistantMessage('new content');
      });
      expect(useChatStore.getState().messages[0].content).toBe('new content');
    });

    it('should not update if last message is not from assistant', () => {
      act(() => {
        useChatStore.getState().addMessage({ role: 'user', content: 'hi' });
        useChatStore.getState().updateLastAssistantMessage('updated');
      });
      expect(useChatStore.getState().messages[0].content).toBe('hi');
    });
  });

  describe('clearChat', () => {
    it('should reset all chat state', () => {
      act(() => {
        useChatStore.getState().addMessage({ role: 'user', content: 'hi' });
        useChatStore.getState().setStreaming(true);
        useChatStore.getState().setStreamingContent('partial');
        useChatStore.getState().setAgentPhase('thinking');
        useChatStore.getState().setPendingChange({
          originalCode: 'a',
          newCode: 'b',
          action: 'replaceAll',
        });
        useChatStore.getState().clearChat();
      });
      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.isStreaming).toBe(false);
      expect(state.currentStreamingContent).toBe('');
      expect(state.agentPhase).toBe('idle');
      expect(state.thinkingMessage).toBe('');
      expect(state.pendingChange).toBeNull();
    });
  });

  describe('streaming', () => {
    it('should set and append streaming content', () => {
      act(() => {
        useChatStore.getState().setStreaming(true);
        useChatStore.getState().setStreamingContent('Hello');
        useChatStore.getState().appendStreamingContent(' World');
      });
      const state = useChatStore.getState();
      expect(state.isStreaming).toBe(true);
      expect(state.currentStreamingContent).toBe('Hello World');
    });

    it('should finalize streaming by creating assistant message', () => {
      act(() => {
        useChatStore.getState().setStreaming(true);
        useChatStore.getState().setStreamingContent('Final answer');
        useChatStore.getState().finalizeStreaming();
      });
      const state = useChatStore.getState();
      expect(state.isStreaming).toBe(false);
      expect(state.currentStreamingContent).toBe('');
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('assistant');
      expect(state.messages[0].content).toBe('Final answer');
      expect(state.agentPhase).toBe('idle');
    });

    it('should handle finalize with empty content', () => {
      act(() => {
        useChatStore.getState().setStreaming(true);
        useChatStore.getState().setStreamingContent('');
        useChatStore.getState().finalizeStreaming();
      });
      const state = useChatStore.getState();
      expect(state.isStreaming).toBe(false);
      expect(state.messages).toHaveLength(0);
    });
  });

  describe('chat open/close', () => {
    it('should set chat open state', () => {
      act(() => {
        useChatStore.getState().setChatOpen(true);
      });
      expect(useChatStore.getState().isChatOpen).toBe(true);
    });

    it('should toggle chat', () => {
      act(() => {
        useChatStore.getState().toggleChat();
      });
      expect(useChatStore.getState().isChatOpen).toBe(true);
      act(() => {
        useChatStore.getState().toggleChat();
      });
      expect(useChatStore.getState().isChatOpen).toBe(false);
    });
  });

  describe('agent phase', () => {
    it('should set agent phase with default message', () => {
      act(() => {
        useChatStore.getState().setAgentPhase('thinking');
      });
      const state = useChatStore.getState();
      expect(state.agentPhase).toBe('thinking');
      expect(state.thinkingMessage).toBe('Analyzing your request...');
    });

    it('should set agent phase with custom message', () => {
      act(() => {
        useChatStore.getState().setAgentPhase('generating', 'Custom msg');
      });
      expect(useChatStore.getState().thinkingMessage).toBe('Custom msg');
    });

    it('should provide default messages for each phase', () => {
      act(() => useChatStore.getState().setAgentPhase('generating'));
      expect(useChatStore.getState().thinkingMessage).toBe(
        'Generating code...'
      );

      act(() => useChatStore.getState().setAgentPhase('applying'));
      expect(useChatStore.getState().thinkingMessage).toBe(
        'Preparing changes...'
      );

      act(() => useChatStore.getState().setAgentPhase('idle'));
      expect(useChatStore.getState().thinkingMessage).toBe('');
    });
  });

  describe('pending change', () => {
    it('should set and clear pending change', () => {
      const change = {
        originalCode: 'const a = 1;',
        newCode: 'const a = 2;',
        action: 'replaceAll' as const,
        description: 'Updated value',
      };
      act(() => {
        useChatStore.getState().setPendingChange(change);
      });
      expect(useChatStore.getState().pendingChange).toEqual(change);

      act(() => {
        useChatStore.getState().clearPendingChange();
      });
      expect(useChatStore.getState().pendingChange).toBeNull();
    });
  });

  describe('integrated execution plan', () => {
    it('should set and clear active plan', () => {
      const plan = {
        id: 'plan_1',
        goal: 'Improve UX',
        assumptions: ['User has workspace open'],
        tasks: [
          {
            id: 'task-1',
            title: 'Update UI',
            description: 'Adjust chat layout',
            dependencies: [],
            prompt: 'Update panel dimensions',
            status: 'pending' as const,
          },
        ],
        status: 'ready' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        currentTaskIndex: 0,
      };

      act(() => {
        useChatStore.getState().setActivePlan(plan);
      });
      expect(useChatStore.getState().activePlan?.goal).toBe('Improve UX');

      act(() => {
        useChatStore.getState().clearActivePlan();
      });
      expect(useChatStore.getState().activePlan).toBeNull();
    });

    it('should update plan status, current task, and task notes', () => {
      const now = Date.now();
      act(() => {
        useChatStore.getState().setActivePlan({
          id: 'plan_2',
          goal: 'Ship feature',
          assumptions: [],
          tasks: [
            {
              id: 'task-1',
              title: 'Step 1',
              description: 'Do first step',
              dependencies: [],
              prompt: 'Execute step 1',
              status: 'pending',
            },
          ],
          status: 'ready',
          createdAt: now,
          updatedAt: now,
          currentTaskIndex: 0,
        });
      });

      act(() => {
        useChatStore.getState().setPlanStatus('running');
        useChatStore.getState().setCurrentPlanTaskIndex(0);
        useChatStore
          .getState()
          .updatePlanTaskStatus('task-1', 'completed', 'Done successfully');
      });

      const state = useChatStore.getState();
      expect(state.activePlan?.status).toBe('running');
      expect(state.activePlan?.currentTaskIndex).toBe(0);
      expect(state.activePlan?.tasks[0].status).toBe('completed');
      expect(state.activePlan?.tasks[0].notes).toBe('Done successfully');
    });
  });

  describe('thinking visibility', () => {
    it('should toggle showThinking preference', () => {
      act(() => {
        useChatStore.getState().setShowThinking(true);
      });
      expect(useChatStore.getState().showThinking).toBe(true);

      act(() => {
        useChatStore.getState().setShowThinking(false);
      });
      expect(useChatStore.getState().showThinking).toBe(false);
    });
  });

  describe('applied change history', () => {
    it('should push history and clear redo on new change', () => {
      const state = useChatStore.getState();
      act(() => {
        state.pushAppliedChange({
          action: 'replaceAll',
          originalCode: 'const a = 1;',
          newCode: 'const a = 2;',
        });
      });

      expect(useChatStore.getState().appliedChanges).toHaveLength(1);
      expect(useChatStore.getState().redoChanges).toHaveLength(0);
    });

    it('should undo and redo applied changes', () => {
      const state = useChatStore.getState();
      act(() => {
        state.pushAppliedChange({
          action: 'replaceAll',
          originalCode: 'A',
          newCode: 'B',
        });
        state.pushAppliedChange({
          action: 'replaceAll',
          originalCode: 'B',
          newCode: 'C',
        });
      });

      const undone = useChatStore.getState().undoAppliedChange();
      expect(undone?.newCode).toBe('C');
      expect(useChatStore.getState().appliedChanges).toHaveLength(1);
      expect(useChatStore.getState().redoChanges).toHaveLength(1);

      const redone = useChatStore.getState().redoAppliedChange();
      expect(redone?.newCode).toBe('C');
      expect(useChatStore.getState().appliedChanges).toHaveLength(2);
      expect(useChatStore.getState().redoChanges).toHaveLength(0);
    });
  });
});
