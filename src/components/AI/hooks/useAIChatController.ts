import { FOCUS_DELAY_MS } from '../../../constants';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../../store/useChatStore';
import { useAISettingsStore } from '../../../store/useAISettingsStore';
import { useCodeStore } from '../../../store/useCodeStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { useRagStore } from '../../../store/useRagStore';
import {
  createCodeAgent,
  type ToolInvocation,
  type AgentCallbacks,
  type AgentExecutionMode,
  processEditorActions,
  sanitizeAssistantOutput,
  isDirectEditIntent,
  extractCodeForDirectEdit,
  buildStructuredPlanPrompt,
  extractExecutionPlanFromText,
} from '../../../features/ai-agent/codeAgent';
import { getDefaultProfileForMode } from '../../../features/ai-agent/agentProfiles';
import {
  scrubSensitiveData,
  getSensitiveDataSummary,
} from '../../../features/ai-agent/scrubber';

export interface PendingApprovalState {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

export interface CloudWarningState {
  pending: boolean;
  sensitiveItems: string[];
  pendingMessage: string;
  pendingCode?: string;
}

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
  const activeRunRef = useRef<{
    id: number;
    controller: AbortController;
  } | null>(null);
  const runCounterRef = useRef(0);

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
    agentPhase,
    thinkingMessage,
    pendingChange,
    activePlan,
    setAgentPhase,
    setPendingChange,
    clearPendingChange,
    setActivePlan,
    setPlanStatus,
    setCurrentPlanTaskIndex,
    updatePlanTaskStatus,
    clearActivePlan,
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
    setProvider,
    setStrictLocalMode,
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingContent, toolInvocations]);

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
        setAgentPhase('applying', 'Review changes...');
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

        setAgentPhase('applying', 'Review changes...');
        setPendingChange({
          action: 'replaceSelection',
          originalCode,
          newCode,
          description: 'Replacement for selected code',
        });
      },
      onReplaceAll: (newCode: string) => {
        setAgentPhase('applying', 'Review changes...');
        setPendingChange({
          action: 'replaceAll',
          originalCode: code,
          newCode,
          description: 'Complete file refactor',
        });
      },
      onToolInvocation: handleToolInvocation,
    };
  }, [code, language, handleToolInvocation, setAgentPhase, setPendingChange]);

  const handleSend = useCallback(
    async (
      textInput?: string,
      isAutoCorrection: boolean = false,
      options?: {
        forcedMode?: AgentExecutionMode;
        suppressUserMessage?: boolean;
        skipCloudWarning?: boolean;
        structuredPlanOutput?: boolean;
      }
    ): Promise<string | undefined> => {
      const messageToSend = textInput || input;
      if (!messageToSend.trim() || isStreaming || !isConfigured) return;
      setLastError(null);

      const userMessage = messageToSend.trim();

      if (userMessage === '/clear') {
        clearChat();
        setToolInvocations([]);
        setInput('');
        return;
      }

      if (userMessage === '/compact') {
        handleCompactContext();
        setInput('');
        return;
      }

      if (userMessage === '/plan') {
        setExecutionMode('plan');
        addMessage({
          role: 'system',
          content:
            'Plan mode enabled. Define your objective and click "Generate plan".',
        });
        setInput('');
        return;
      }

      if (userMessage === '/agent') {
        setExecutionMode('agent');
        addMessage({
          role: 'system',
          content: 'Agent mode enabled.',
        });
        setInput('');
        return;
      }

      const isVerifierRequest =
        enableVerifierSubagent && /^@verifier\b/i.test(userMessage);
      const normalizedUserMessage = isVerifierRequest
        ? userMessage.replace(/^@verifier\b\s*/i, '').trim() ||
          'Run a quick validation for the current context.'
        : userMessage;

      const directEditIntent = isDirectEditIntent(normalizedUserMessage);
      const selectedMode: AgentExecutionMode = options?.forcedMode
        ? options.forcedMode
        : isVerifierRequest
          ? 'verifier'
          : executionMode === 'plan' && directEditIntent
            ? 'agent'
            : executionMode;

      if (executionMode === 'plan' && selectedMode === 'agent') {
        addMessage({
          role: 'system',
          content:
            'Auto-switched to Agent mode for this request so changes can be applied directly to the editor.',
        });
      }

      const codeContext = includeCode ? code : undefined;

      if (
        provider !== 'local' &&
        !strictLocalMode &&
        !isAutoCorrection &&
        !options?.skipCloudWarning
      ) {
        const sensitiveItems = codeContext
          ? getSensitiveDataSummary(codeContext)
          : [];

        if (sensitiveItems.length > 0) {
          setCloudWarning({
            pending: true,
            sensitiveItems,
            pendingMessage: normalizedUserMessage,
            pendingCode: codeContext,
          });
          return;
        }
      }

      setLastFailedPrompt(normalizedUserMessage);
      if (!options?.suppressUserMessage) {
        addMessage({
          role: 'user',
          content: userMessage,
          codeContext,
        });
      }

      if (!isAutoCorrection) {
        setInput('');
      }

      const runId = runCounterRef.current + 1;
      runCounterRef.current = runId;
      const abortController = new AbortController();
      activeRunRef.current = { id: runId, controller: abortController };

      setStreaming(true);
      setStreamingContent('');
      setToolInvocations([]);

      const isAbortError = (error: unknown) => {
        if (abortController.signal.aborted) return true;
        if (!(error instanceof Error)) return false;
        const normalized = `${error.name} ${error.message}`.toLowerCase();
        return normalized.includes('abort') || normalized.includes('cancel');
      };

      try {
        const apiKey = getCurrentApiKey();
        const model = getCurrentModel();
        const localCfg = getLocalConfig();
        const customCfg = getCustomConfig();

        const safeCodeContext =
          provider !== 'local' && codeContext
            ? scrubSensitiveData(codeContext)
            : codeContext;

        const runAgent = async (
          disableTools: boolean,
          mode: AgentExecutionMode
        ): Promise<string> => {
          let toolEditApplied = false;
          const baseCallbacks = createAgentCallbacks();
          const trackedCallbacks: AgentCallbacks = {
            ...baseCallbacks,
            onInsertCode: (newCode) => {
              toolEditApplied = true;
              baseCallbacks.onInsertCode?.(newCode);
            },
            onReplaceSelection: (newCode) => {
              toolEditApplied = true;
              baseCallbacks.onReplaceSelection?.(newCode);
            },
            onReplaceAll: (newCode) => {
              toolEditApplied = true;
              baseCallbacks.onReplaceAll?.(newCode);
            },
          };

          const trackedAgent = createCodeAgent(
            provider,
            apiKey,
            model,
            provider === 'local'
              ? { baseURL: localCfg.baseURL, modelId: localCfg.modelId }
              : undefined,
            trackedCallbacks,
            provider !== 'local' ? customCfg : undefined,
            {
              mode,
              disableTools,
              profile:
                mode === 'agent'
                  ? agentProfile
                  : getDefaultProfileForMode(mode),
            }
          );

          let fullPrompt = normalizedUserMessage;
          if (options?.structuredPlanOutput && mode === 'plan') {
            fullPrompt = buildStructuredPlanPrompt(normalizedUserMessage);
          }
          if (isAutoCorrection) {
            fullPrompt = `Review and fix the following code based on this error:\n\n${userMessage}\n\nIMPORTANT: Return the FULL corrected code using the appropriate tool.`;
          }

          let ragContext = '';
          const docsMatch = userMessage.match(/@(docs|kb)\s*(?:\(([^)]+)\))?/i);
          if (docsMatch && window.rag) {
            const searchQuery =
              docsMatch[2] ||
              userMessage.replace(/@(docs|kb)\s*(?:\([^)]+\))?/i, '').trim();
            if (searchQuery) {
              try {
                setAgentPhase('thinking', 'Searching knowledge base...');
                const pipelineResult = await window.rag.searchPipeline(
                  searchQuery,
                  {
                    maxContextTokens: 4000,
                    includeAttribution: true,
                  }
                );
                if (pipelineResult.success && pipelineResult.result?.context) {
                  ragContext =
                    '\n\n--- Knowledge Base Context ---\n' +
                    pipelineResult.result.context +
                    '\n--- End Knowledge Base Context ---\n\n';
                }
              } catch (e) {
                console.warn('RAG pipeline search failed:', e);
              }
            }
            fullPrompt = userMessage
              .replace(/@(docs|kb)\s*(?:\([^)]+\))?/i, '')
              .trim();
          }

          let pinnedContext = '';
          if (pinnedDocIds.length > 0) {
            try {
              setAgentPhase('thinking', 'Loading pinned documentation...');
              pinnedContext = await getPinnedDocsContext();
            } catch (e) {
              console.warn('Failed to get pinned docs:', e);
            }
          }

          const allContext = pinnedContext + ragContext;
          const prompt = safeCodeContext
            ? `Context - Current code in editor (${language}):\n\`\`\`${language}\n${safeCodeContext}\n\`\`\`${allContext}\n\nUser: ${fullPrompt}`
            : allContext
              ? `${allContext}User: ${fullPrompt}`
              : fullPrompt;

          const thinkingMessage =
            mode === 'plan'
              ? 'Planning approach...'
              : mode === 'verifier'
                ? 'Running verification...'
                : 'Analyzing your request...';

          setAgentPhase('thinking', thinkingMessage);
          const streamResult = trackedAgent.stream({
            prompt,
            abortSignal: abortController.signal,
          });
          setAgentPhase(
            'generating',
            mode === 'plan'
              ? 'Building execution plan...'
              : 'Generating response...'
          );

          let fullText = '';
          let visibleText = '';

          if (streamResult && streamResult.textStream) {
            for await (const chunk of streamResult.textStream) {
              fullText += chunk;
              const sanitized = sanitizeAssistantOutput(fullText, {
                showThinking,
              });
              if (sanitized.length < visibleText.length) {
                setStreamingContent(sanitized);
                visibleText = sanitized;
                continue;
              }
              const delta = sanitized.slice(visibleText.length);
              if (delta) {
                appendStreamingContent(delta);
              }
              visibleText = sanitized;
            }

            if (disableTools || fullText.includes('<<<EDITOR_ACTION>>>')) {
              await processEditorActions(fullText, trackedCallbacks);
            }

            if (mode === 'agent' && directEditIntent && !toolEditApplied) {
              const fallbackCode = extractCodeForDirectEdit(
                sanitizeAssistantOutput(fullText, { showThinking })
              );
              if (fallbackCode) {
                trackedCallbacks.onReplaceAll?.(fallbackCode);
              } else if (!disableTools) {
                throw new Error(
                  'Direct edit requested but no tool call or code payload was produced.'
                );
              }
            }

            finalizeStreaming();
            return sanitizeAssistantOutput(fullText, { showThinking });
          }

          const result = await trackedAgent.generate({
            prompt,
            abortSignal: abortController.signal,
          });
          if (!result.text) {
            throw new Error('No response from agent');
          }

          setStreamingContent(
            sanitizeAssistantOutput(result.text, { showThinking })
          );
          if (disableTools || result.text.includes('<<<EDITOR_ACTION>>>')) {
            await processEditorActions(result.text, trackedCallbacks);
          }

          if (mode === 'agent' && directEditIntent && !toolEditApplied) {
            const fallbackCode = extractCodeForDirectEdit(
              sanitizeAssistantOutput(result.text, { showThinking })
            );
            if (fallbackCode) {
              trackedCallbacks.onReplaceAll?.(fallbackCode);
            } else if (!disableTools) {
              throw new Error(
                'Direct edit requested but no tool call or code payload was produced.'
              );
            }
          }
          finalizeStreaming();
          return sanitizeAssistantOutput(result.text, { showThinking });
        };

        try {
          return await runAgent(false, selectedMode);
        } catch (agentError) {
          if (isAbortError(agentError)) {
            finalizeStreaming();
            setAgentPhase('idle');
            return undefined;
          }

          console.warn('[AIChat] Standard agent failed, retrying...');
          try {
            setStreamingContent('');
            return await runAgent(true, selectedMode);
          } catch (retryError) {
            if (isAbortError(retryError)) {
              finalizeStreaming();
              setAgentPhase('idle');
              return undefined;
            }

            console.error('[AIChat] Legacy retry failed:', retryError);
            if (directEditIntent) {
              addMessage({
                role: 'system',
                content:
                  'No pude aplicar cambios en el editor automáticamente. Intenta pedir: "reemplaza todo el archivo con el código completo" o habilita una respuesta con bloque de código completo.',
              });
            }
            addMessage({
              role: 'assistant',
              content: `Error: ${agentError instanceof Error ? agentError.message : 'Unknown error'}`,
            });
            setLastError(
              agentError instanceof Error
                ? agentError.message
                : 'Unknown error while processing request'
            );
            setStreaming(false);
            setAgentPhase('idle');
            return undefined;
          }
        }
      } catch (error) {
        if (isAbortError(error)) {
          finalizeStreaming();
          setAgentPhase('idle');
          return undefined;
        }

        console.error('[AIChat] Send error:', error);
        addMessage({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        setLastError(
          error instanceof Error
            ? error.message
            : 'Unknown error while processing request'
        );
        setStreaming(false);
        setAgentPhase('idle');
        return undefined;
      } finally {
        if (activeRunRef.current?.id === runId) {
          activeRunRef.current = null;
        }
      }
    },
    [
      input,
      isStreaming,
      isConfigured,
      includeCode,
      code,
      provider,
      strictLocalMode,
      language,
      addMessage,
      setStreaming,
      setStreamingContent,
      appendStreamingContent,
      finalizeStreaming,
      getCurrentApiKey,
      getCurrentModel,
      getLocalConfig,
      getCustomConfig,
      createAgentCallbacks,
      setAgentPhase,
      clearChat,
      handleCompactContext,
      enableVerifierSubagent,
      executionMode,
      agentProfile,
      setExecutionMode,
      getPinnedDocsContext,
      pinnedDocIds,
      showThinking,
    ]
  );

  const handleCancelGeneration = useCallback(() => {
    const activeRun = activeRunRef.current;
    if (!activeRun) return;

    activeRun.controller.abort();
    activeRunRef.current = null;
    finalizeStreaming();
    setAgentPhase('idle');
    addMessage({
      role: 'system',
      content: t('chat.generationStopped', 'Generation stopped by user.'),
    });
  }, [finalizeStreaming, setAgentPhase, addMessage, t]);

  const handleUndoChange = useCallback(() => {
    const change = undoAppliedChange();
    if (!change) return;

    setCode(change.originalCode);
    if (window.editor) {
      window.editor.setValue(change.originalCode);
    }

    addMessage({
      role: 'system',
      content: t('chat.revertedLastChange', 'Last change reverted.'),
    });
  }, [undoAppliedChange, setCode, addMessage, t]);

  const handleRedoChange = useCallback(() => {
    const change = redoAppliedChange();
    if (!change) return;

    setCode(change.newCode);
    if (window.editor) {
      window.editor.setValue(change.newCode);
    }

    addMessage({
      role: 'system',
      content: t('chat.redidLastChange', 'Last reverted change applied again.'),
    });
  }, [redoAppliedChange, setCode, addMessage, t]);

  const handleGeneratePlan = useCallback(async () => {
    const goal = input.trim();
    if (!goal || isStreaming || !isConfigured) return;

    clearActivePlan();
    setExecutionMode('plan');

    const assistantText = await handleSend(goal, false, {
      forcedMode: 'plan',
      structuredPlanOutput: true,
    });

    if (!assistantText) {
      setLastError('No plan response received from the agent.');
      return;
    }

    const parsedPlan = extractExecutionPlanFromText(assistantText);
    if (!parsedPlan) {
      setLastError(
        'The plan response was not structured correctly. Please try again.'
      );
      addMessage({
        role: 'system',
        content:
          'Plan parsing failed. Try requesting the plan again with more explicit scope.',
      });
      return;
    }

    setActivePlan(parsedPlan);
    addMessage({
      role: 'system',
      content: `Plan ready: ${parsedPlan.tasks.length} tasks prepared. Review and click "Execute plan" when ready.`,
    });
  }, [
    input,
    isStreaming,
    isConfigured,
    clearActivePlan,
    setExecutionMode,
    handleSend,
    setActivePlan,
    addMessage,
  ]);

  const handleExecutePlan = useCallback(async () => {
    if (!activePlan || activePlan.tasks.length === 0 || isExecutingPlan) return;

    setIsExecutingPlan(true);
    setPlanStatus('running');

    for (let i = 0; i < activePlan.tasks.length; i += 1) {
      const task = activePlan.tasks[i];
      const dependenciesDone = task.dependencies.every((dependencyId) => {
        const depTask = useChatStore
          .getState()
          .activePlan?.tasks.find((t) => t.id === dependencyId);
        return depTask?.status === 'completed';
      });

      setCurrentPlanTaskIndex(i);

      if (!dependenciesDone) {
        updatePlanTaskStatus(
          task.id,
          'skipped',
          'Skipped because dependencies were not completed.'
        );
        continue;
      }

      updatePlanTaskStatus(task.id, 'running');
      addMessage({
        role: 'system',
        content: `Executing step ${i + 1}/${activePlan.tasks.length}: ${task.title}`,
      });

      const taskResult = await handleSend(task.prompt, false, {
        forcedMode: 'agent',
        suppressUserMessage: true,
        skipCloudWarning: true,
      });

      if (!taskResult) {
        updatePlanTaskStatus(
          task.id,
          'failed',
          'Execution failed: no response from agent.'
        );
        setPlanStatus('failed');
        setIsExecutingPlan(false);
        setLastError(`Plan execution failed at step ${i + 1}: ${task.title}`);
        return;
      }

      updatePlanTaskStatus(task.id, 'completed', taskResult.slice(0, 180));
    }

    setPlanStatus('completed');
    setIsExecutingPlan(false);
    addMessage({
      role: 'system',
      content: 'Plan execution completed successfully.',
    });
  }, [
    activePlan,
    isExecutingPlan,
    setPlanStatus,
    setCurrentPlanTaskIndex,
    updatePlanTaskStatus,
    addMessage,
    handleSend,
  ]);

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

  const handleApprove = useCallback(() => {
    if (pendingApproval) {
      pendingApproval.resolve(true);
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  const handleDeny = useCallback(() => {
    if (pendingApproval) {
      pendingApproval.resolve(false);
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  const handleNewConversation = useCallback(() => {
    clearChat();
    clearActivePlan();
    setToolInvocations([]);
    setLastError(null);
    setLastFailedPrompt(null);
    clearChangeHistory();
  }, [clearChat, clearActivePlan, clearChangeHistory]);

  const handleAcceptPendingChange = useCallback(() => {
    if (!pendingChange) return;

    const beforeCode = window.editor?.getValue() ?? code;
    let afterCode = beforeCode;

    if (pendingChange.action === 'replaceAll') {
      setCode(pendingChange.newCode);
      if (window.editor) {
        window.editor.setValue(pendingChange.newCode);
      }
      afterCode = pendingChange.newCode;
    } else if (pendingChange.action === 'insert') {
      if (window.editor) {
        const position = window.editor.getPosition();
        if (position) {
          window.editor.executeEdits('ai-agent-diff', [
            {
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
              text: pendingChange.newCode,
              forceMoveMarkers: true,
            },
          ]);
          afterCode = window.editor.getValue();
        }
      } else {
        afterCode = code + '\n' + pendingChange.newCode;
        setCode(afterCode);
      }
    } else if (pendingChange.action === 'replaceSelection') {
      if (window.editor) {
        const selection = window.editor.getSelection();
        if (selection) {
          window.editor.executeEdits('ai-agent-diff', [
            {
              range: selection,
              text: pendingChange.newCode,
              forceMoveMarkers: true,
            },
          ]);
          afterCode = window.editor.getValue();
        }
      } else {
        afterCode = pendingChange.newCode;
        setCode(pendingChange.newCode);
      }
    }

    pushAppliedChange({
      action: 'replaceAll',
      originalCode: beforeCode,
      newCode: afterCode,
      description: pendingChange.description || 'AI change applied to editor',
    });

    addMessage({
      role: 'system',
      content: t('chat.changeApplied', 'Change applied to editor.'),
    });

    clearPendingChange();
  }, [
    pendingChange,
    code,
    setCode,
    pushAppliedChange,
    addMessage,
    t,
    clearPendingChange,
  ]);

  const handleRejectPendingChange = useCallback(() => {
    clearPendingChange();
  }, [clearPendingChange]);

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
    agentPhase,
    thinkingMessage,
    pendingChange,
    activePlan,
    showThinking,
    appliedChanges,
    redoChanges,
    enableChat,
    executionMode,
    agentProfile,
    isConfigured,
    provider,
    estimatedContextTokens,
    setInput,
    setIncludeCode,
    setExecutionMode,
    setAgentProfile,
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
