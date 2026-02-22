
import { useAppStore } from '../index';
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../storeHooks';
import { act } from '@testing-library/react';

describe('useChatStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    act(() => {
      useAppStore.getState().chat.clearChat();
      useChatStore.setState({ isChatOpen: false });
    });
  });

  describe('initial state', () => {
    it('should have empty messages and idle phase', () => {
      const state = useAppStore.getState().chat;
      expect(state.messages).toEqual([]);
      expect(state.isStreaming).toBe(false);
      expect(state.currentStreamingContent).toBe('');
      expect(state.isChatOpen).toBe(false);
      expect(state.activeRun).toBeNull();
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
        useAppStore.getState().chat.addMessage({ role: 'user', content: 'Hello' });
      });
      const msgs = useAppStore.getState().chat.messages;
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
      const msgs = useAppStore.getState().chat.messages;
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
        useAppStore.getState().chat.updateLastAssistantMessage('new content');
      });
      expect(useAppStore.getState().chat.messages[0].content).toBe('new content');
    });
  });

  describe('clearChat', () => {
    it('should reset all chat state', () => {
      act(() => {
        useAppStore.getState().chat.addMessage({ role: 'user', content: 'hi' });
        useAppStore.getState().chat.setStreaming(true);
        useAppStore.getState().chat.setStreamingContent('partial');
        useAppStore.getState().chat.setAgentPhase('thinking');
        useAppStore.getState().chat.setPendingChange({
          originalCode: 'a',
          newCode: 'b',
          action: 'replaceAll',
        });
        useAppStore.getState().chat.clearChat();
      });
      const state = useAppStore.getState().chat;
      expect(state.messages).toEqual([]);
      expect(state.isStreaming).toBe(false);
      expect(state.currentStreamingContent).toBe('');
      expect(state.activeRun).toBeNull();
      expect(state.pendingChange).toBeNull();
    });
  });

  describe('streaming', () => {
    it('should set and append streaming content', () => {
      act(() => {
        useAppStore.getState().chat.setStreaming(true);
        useAppStore.getState().chat.setStreamingContent('Hello');
        useAppStore.getState().chat.appendStreamingContent(' World');
      });
      const state = useAppStore.getState().chat;
      expect(state.isStreaming).toBe(true);
      expect(state.currentStreamingContent).toBe('Hello World');
    });

    it('should finalize streaming by creating assistant message', () => {
      act(() => {
        useAppStore.getState().chat.setStreaming(true);
        useAppStore.getState().chat.setStreamingContent('Final answer');
        useAppStore.getState().chat.finalizeStreaming();
      });
      const state = useAppStore.getState().chat;
      expect(state.isStreaming).toBe(false);
      expect(state.currentStreamingContent).toBe('');
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('assistant');
      expect(state.messages[0].content).toBe('Final answer');
    });
  });

  describe('chat open/close', () => {
    it('should set chat open state', () => {
      act(() => {
        useAppStore.getState().chat.setChatOpen(true);
      });
      expect(useAppStore.getState().chat.isChatOpen).toBe(true);
    });

    it('should toggle chat', () => {
      act(() => {
        useAppStore.getState().chat.toggleChat();
      });
      expect(useAppStore.getState().chat.isChatOpen).toBe(true);
      act(() => {
        useAppStore.getState().chat.toggleChat();
      });
      expect(useAppStore.getState().chat.isChatOpen).toBe(false);
    });
  });

  describe('agent phase', () => {
    it('should set agent phase with default message', () => {
      act(() => {
        useAppStore.getState().chat.setAgentPhase('thinking');
      });
      const state = useAppStore.getState().chat;
      expect(state.activeRun?.status).toBe('thinking');
      expect(state.activeRun?.message).toBe('Analyzing your request...');
    });

    it('should set agent phase with custom message', () => {
      act(() => {
        useAppStore.getState().chat.setAgentPhase('generating', 'Custom msg');
      });
      expect(useAppStore.getState().chat.activeRun?.message).toBe('Custom msg');
    });

    it('should provide default messages for each phase', () => {
      act(() => useAppStore.getState().chat.setAgentPhase('generating'));
      expect(useAppStore.getState().chat.activeRun?.message).toBe(
        'Generating code...'
      );

      act(() => useAppStore.getState().chat.setAgentPhase('applying'));
      expect(useAppStore.getState().chat.activeRun?.message).toBe(
        'Preparing changes...'
      );

      act(() => useAppStore.getState().chat.setAgentPhase('idle'));
      expect(useAppStore.getState().chat.activeRun?.status).toBe('idle');
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
        useAppStore.getState().chat.setPendingChange(change);
      });
      expect(useAppStore.getState().chat.pendingChange).toEqual(change);

      act(() => {
        useAppStore.getState().chat.clearPendingChange();
      });
      expect(useAppStore.getState().chat.pendingChange).toBeNull();
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
        useAppStore.getState().chat.setActivePlan(plan);
      });
      expect(useAppStore.getState().chat.activePlan?.goal).toBe('Improve UX');

      act(() => {
        useAppStore.getState().chat.clearActivePlan();
      });
      expect(useAppStore.getState().chat.activePlan).toBeNull();
    });

    it('should update plan status, current task, and task notes', () => {
      const now = Date.now();
      act(() => {
        useAppStore.getState().chat.setActivePlan({
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
        useAppStore.getState().chat.setPlanStatus('running');
        useAppStore.getState().chat.setCurrentPlanTaskIndex(0);
        useChatStore
          .getState()
          .updatePlanTaskStatus('task-1', 'completed', 'Done successfully');
      });

      const state = useAppStore.getState().chat;
      expect(state.activePlan?.status).toBe('running');
      expect(state.activePlan?.currentTaskIndex).toBe(0);
      expect(state.activePlan?.tasks[0].status).toBe('completed');
      expect(state.activePlan?.tasks[0].notes).toBe('Done successfully');
    });
  });

  describe('thinking visibility', () => {
    it('should toggle showThinking preference', () => {
      act(() => {
        useAppStore.getState().chat.setShowThinking(true);
      });
      expect(useAppStore.getState().chat.showThinking).toBe(true);

      act(() => {
        useAppStore.getState().chat.setShowThinking(false);
      });
      expect(useAppStore.getState().chat.showThinking).toBe(false);
    });
  });

  describe('applied change history', () => {
    it('should push history and clear redo on new change', () => {
      const state = useAppStore.getState().chat;
      act(() => {
        state.pushAppliedChange({
          action: 'replaceAll',
          originalCode: 'const a = 1;',
          newCode: 'const a = 2;',
        });
      });

      expect(useAppStore.getState().chat.appliedChanges).toHaveLength(1);
      expect(useAppStore.getState().chat.redoChanges).toHaveLength(0);
    });

    it('should undo and redo applied changes', () => {
      const state = useAppStore.getState().chat;
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

      const undone = useAppStore.getState().chat.undoAppliedChange();
      expect(undone?.newCode).toBe('C');
      expect(useAppStore.getState().chat.appliedChanges).toHaveLength(1);
      expect(useAppStore.getState().chat.redoChanges).toHaveLength(1);

      const redone = useAppStore.getState().chat.redoAppliedChange();
      expect(redone?.newCode).toBe('C');
      expect(useAppStore.getState().chat.appliedChanges).toHaveLength(2);
      expect(useAppStore.getState().chat.redoChanges).toHaveLength(0);
    });
  });
});
