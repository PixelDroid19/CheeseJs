import { FOCUS_DELAY_MS } from '../../../constants';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../../store/storeHooks';
import { useAISettingsStore } from '../../../store/storeHooks';
import { useCodeStore } from '../../../store/storeHooks';
import { useLanguageStore } from '../../../store/storeHooks';
import { useRagStore } from '../../../store/storeHooks';
import {
  type ToolInvocation,
  type AgentCallbacks,
} from '../../../features/ai-agent/codeAgent';
import { useAIChatSendHandler } from './useAIChatSendHandler';
import type { PendingApprovalState, CloudWarningState } from './aiChatTypes';
import { useAIChatPlanHandlers } from './useAIChatPlanHandlers';
import { useAIChatChangeHandlers } from './useAIChatChangeHandlers';

export function useAIChatController() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [includeCode, setIncludeCode] = useState(true);
  const [toolInvocations, setToolInvocations] = useState<ToolInvocation[]>([]);
  const [pendingApproval, setPendingApproval] =
    useState<PendingApprovalState | null>(null);
  const [cloudWarning, setCloudWarning] = useState<CloudWarningState | null>(
    null
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [isExecutingPlan, setIsExecutingPlan] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isStreaming,
    currentStreamingContent,
    isChatOpen,
    addMessage,
    clearChat,
    setStreaming,
    setStreamingContent,
    appendStreamingContent,
    finalizeStreaming,
    setChatOpen,
    toggleChat,
    pendingChange,
    activePlan,
    activeRun,
    setPendingChange,
    clearPendingChange,
    setActivePlan,
    setPlanStatus,
    setCurrentPlanTaskIndex,
    updatePlanTaskStatus,
    clearActivePlan,
    startRunLifecycle,
    updateRunLifecycle,
    clearRunLifecycle,
    showThinking,
    setShowThinking,
    appliedChanges,
    redoChanges,
    pushAppliedChange,
    undoAppliedChange,
    redoAppliedChange,
    clearChangeHistory,
  } = useChatStore();

  const {
    enableChat,
    getCurrentApiKey,
    getCurrentModel,
    provider,
    getLocalConfig,
    getCustomConfig,
    executionMode,
    agentProfile,
    setExecutionMode,
    setAgentProfile,
    enableVerifierSubagent,
    strictLocalMode,
    toolPolicyPreset,
    toolPolicy,
    setProvider,
    setStrictLocalMode,
    setToolPolicyPreset,
  } = useAISettingsStore();

  const code = useCodeStore((state) => state.code);
  const setCode = useCodeStore((state) => state.setCode);
  const language = useLanguageStore((state) => state.currentLanguage);
  const { setModalOpen, getPinnedDocsContext, pinnedDocIds } = useRagStore();

  const isConfigured = Boolean(getCurrentApiKey());

  const estimatedContextTokens = useMemo(() => {
    const messageChars = messages.reduce(
      (acc, msg) => acc + msg.content.length,
      0
    );
    const codeChars = includeCode ? code.length : 0;
    return Math.ceil((messageChars + codeChars) / 4);
  }, [messages, code, includeCode]);

  const handleCompactContext = useCallback(() => {
    if (messages.length === 0) return;

    const summary = messages
      .slice(-8)
      .map(
        (m) => `${m.role === 'user' ? 'U' : 'A'}: ${m.content.slice(0, 120)}`
      )
      .join('\n');

    clearChat();
    addMessage({
      role: 'system',
      content: `Context compacted. Conversation summary:\n\n${summary}`,
    });
  }, [messages, clearChat, addMessage]);

  useEffect(() => {
    if (isChatOpen && textAreaRef.current) {
      setTimeout(() => textAreaRef.current?.focus(), FOCUS_DELAY_MS);
    }
  }, [isChatOpen]);

  const handleToolInvocation = useCallback((invocation: ToolInvocation) => {
    setToolInvocations((prev) => {
      const existing = prev.findIndex((t) => t.id === invocation.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = invocation;
        return updated;
      }
      return [...prev, invocation];
    });
  }, []);

  const handleInsertCode = useCallback(
    (newCode: string) => {
      setCode(newCode);
    },
    [setCode]
  );

  const handleIndexCodebase = useCallback(async () => {
    setModalOpen(true);
  }, [setModalOpen]);

  const createAgentCallbacks = useCallback((): AgentCallbacks => {
    return {
      getEditorContent: () => code,
      getSelectedCode: () => {
        if (window.editor) {
          const selection = window.editor.getSelection();
          if (selection) {
            const model = window.editor.getModel();
            if (model) {
              return model.getValueInRange(selection);
            }
          }
        }
        return '';
      },
      getLanguage: () => language,
      onExecuteCode: async (codeToRun: string) => {
        return {
          success: true,
          output: `Code: ${codeToRun.slice(0, 100)}...`,
        };
      },
      onInsertCode: (newCode: string) => {
        updateRunLifecycle({ status: 'applying', message: 'Review changes...' });
        setPendingChange({
          action: 'insert',
          originalCode: '',
          newCode: newCode,
          description: 'Content to be inserted at cursor',
        });
      },
      onReplaceSelection: (newCode: string) => {
        let originalCode = '';
        if (window.editor) {
          const selection = window.editor.getSelection();
          if (selection) {
            const model = window.editor.getModel();
            if (model) {
              originalCode = model.getValueInRange(selection);
            }
          }
        }

        updateRunLifecycle({ status: 'applying', message: 'Review changes...' });
        setPendingChange({
          action: 'replaceSelection',
          originalCode,
          newCode,
          description: 'Replacement for selected code',
        });
      },
      onReplaceAll: (newCode: string) => {
        updateRunLifecycle({ status: 'applying', message: 'Review changes...' });
        setPendingChange({
          action: 'replaceAll',
          originalCode: code,
          newCode,
          description: 'Complete file refactor',
        });
      },
      onToolInvocation: handleToolInvocation,
      onRequestToolApproval: ({ id, toolName, input, message }) => {
        return new Promise<boolean>((resolve) => {
          setPendingApproval({
            id,
            toolName,
            input,
            message,
            resolve,
          });
        });
      },
    };
  }, [code, language, handleToolInvocation, updateRunLifecycle, setPendingChange]);

  const { handleSend, handleCancelGeneration: cancelGeneration } =
    useAIChatSendHandler({
      input,
      isStreaming,
      isConfigured,
      includeCode,
      code,
      provider,
      strictLocalMode,
      toolPolicy,
      language,
      enableVerifierSubagent,
      executionMode,
      agentProfile,
      showThinking,
      pinnedDocIds,
      setInput,
      setExecutionMode,
      setToolInvocations,
      setCloudWarning,
      setLastError,
      setLastFailedPrompt,
      addMessage,
      clearChat,
      handleCompactContext,
      setStreaming,
      setStreamingContent,
      appendStreamingContent,
      finalizeStreaming,
      getCurrentApiKey,
      getCurrentModel,
      getLocalConfig,
      getCustomConfig,
      createAgentCallbacks,
      getPinnedDocsContext,
      startRunLifecycle,
      updateRunLifecycle,
    });

  const handleCancelGeneration = useCallback(() => {
    cancelGeneration(() => {
      addMessage({
        role: 'system',
        content: t('chat.generationStopped', 'Generation stopped by user.'),
      });
    });
  }, [cancelGeneration, addMessage, t]);

  const { handleUndoChange, handleRedoChange, handleAcceptPendingChange, handleRejectPendingChange } =
    useAIChatChangeHandlers({
      t,
      code,
      pendingChange,
      setCode,
      undoAppliedChange,
      redoAppliedChange,
      pushAppliedChange,
      clearPendingChange,
      addMessage,
    });

  const { handleGeneratePlan, handleExecutePlan } = useAIChatPlanHandlers({
    input,
    isStreaming,
    isConfigured,
    isExecutingPlan,
    activePlan,
    setIsExecutingPlan,
    setLastError,
    clearActivePlan,
    setExecutionMode,
    handleSend,
    setActivePlan,
    addMessage,
    setPlanStatus,
    setCurrentPlanTaskIndex,
    updatePlanTaskStatus,
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  useEffect(() => {
    (
      window as Window & {
        triggerAIAutoCorrection?: (errorMessage: string) => void;
      }
    ).triggerAIAutoCorrection = (errorMessage: string) => {
      if (!isChatOpen) {
        setChatOpen(true);
      }
      setTimeout(() => {
        handleSend(`Fix this error: ${errorMessage}`, true);
      }, 100);
    };

    return () => {
      delete (
        window as Window & {
          triggerAIAutoCorrection?: (errorMessage: string) => void;
        }
      ).triggerAIAutoCorrection;
    };
  }, [handleSend, isChatOpen, setChatOpen]);

  const handleApprove = useCallback(
    (invocationId?: string) => {
      if (!pendingApproval) return;
      if (invocationId && pendingApproval.id !== invocationId) return;

      pendingApproval.resolve(true);
      setPendingApproval(null);
    },
    [pendingApproval]
  );

  const handleDeny = useCallback(
    (invocationId?: string) => {
      if (!pendingApproval) return;
      if (invocationId && pendingApproval.id !== invocationId) return;

      pendingApproval.resolve(false);
      setPendingApproval(null);
    },
    [pendingApproval]
  );

  const handleNewConversation = useCallback(() => {
    clearChat();
    clearActivePlan();
    clearRunLifecycle();
    setToolInvocations([]);
    setLastError(null);
    setLastFailedPrompt(null);
    clearChangeHistory();
  }, [clearChat, clearActivePlan, clearChangeHistory, clearRunLifecycle]);


  const handleCloudConfirm = useCallback(() => {
    if (cloudWarning) {
      setCloudWarning(null);
      void handleSend(cloudWarning.pendingMessage, false);
    }
  }, [cloudWarning, handleSend]);

  const handleCloudCancel = useCallback(() => {
    setCloudWarning(null);
  }, []);

  const handleEnableLocalMode = useCallback(() => {
    setCloudWarning(null);
    setProvider('local');
    setStrictLocalMode(true);
    addMessage({
      role: 'system',
      content:
        'Switched to local-only mode for safety. Your next request will run without sending code to cloud providers.',
    });
  }, [setProvider, setStrictLocalMode, addMessage]);

  return {
    input,
    includeCode,
    toolInvocations,
    pendingApproval,
    cloudWarning,
    lastError,
    lastFailedPrompt,
    isExecutingPlan,
    messagesEndRef,
    textAreaRef,
    messages,
    isStreaming,
    currentStreamingContent,
    isChatOpen,
    agentPhase: activeRun?.status || 'idle',
    thinkingMessage: activeRun?.message,
    pendingChange,
    activePlan,
    showThinking,
    appliedChanges,
    redoChanges,
    enableChat,
    executionMode,
    agentProfile,
    toolPolicyPreset,
    isConfigured,
    provider,
    estimatedContextTokens,
    setInput,
    setIncludeCode,
    setExecutionMode,
    setAgentProfile,
    setToolPolicyPreset,
    setShowThinking,
    setChatOpen,
    toggleChat,
    clearActivePlan,
    handleSend,
    handleCancelGeneration,
    handleUndoChange,
    handleRedoChange,
    handleGeneratePlan,
    handleExecutePlan,
    handleInputChange,
    handleKeyDown,
    handleApprove,
    handleDeny,
    handleInsertCode,
    handleIndexCodebase,
    handleNewConversation,
    handleAcceptPendingChange,
    handleRejectPendingChange,
    handleCloudConfirm,
    handleCloudCancel,
    handleEnableLocalMode,
  };
}
