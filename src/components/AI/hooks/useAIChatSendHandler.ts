import { useCallback, useRef } from 'react';
import {
  createCodeAgent,
  type AgentCallbacks,
  type AgentExecutionMode,
  type ToolInvocation,
  sanitizeAssistantOutput,
  isDirectEditIntent,
  extractCodeForDirectEdit,
  buildStructuredPlanPrompt,
} from '../../../features/ai-agent/codeAgent';
import { buildAssistantMessagePayload } from '../../../features/ai-agent/messageParts';
import { getDefaultProfileForMode } from '../../../features/ai-agent/agentProfiles';
import {
  scrubSensitiveData,
  getSensitiveDataSummary,
} from '../../../features/ai-agent/scrubber';
import type { ToolAccessPolicy } from '../../../features/ai-agent/toolPolicy';
import type { SendHandlerDeps } from './aiChatTypes';

export function useAIChatSendHandler(deps: SendHandlerDeps) {
  const activeRunRef = useRef<{
    id: number;
    controller: AbortController;
  } | null>(null);
  const runCounterRef = useRef(0);

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
      const messageToSend = textInput || deps.input;
      if (!messageToSend.trim() || deps.isStreaming || !deps.isConfigured)
        return;
      deps.setLastError(null);

      const userMessage = messageToSend.trim();

      if (userMessage === '/clear') {
        deps.clearChat();
        deps.setToolInvocations([]);
        deps.setInput('');
        return;
      }

      if (userMessage === '/compact') {
        deps.handleCompactContext();
        deps.setInput('');
        return;
      }

      if (userMessage === '/plan') {
        deps.setExecutionMode('plan');
        deps.addMessage({
          role: 'system',
          content:
            'Plan mode enabled. Define your objective and click "Generate plan".',
        });
        deps.setInput('');
        return;
      }

      if (userMessage === '/agent') {
        deps.setExecutionMode('agent');
        deps.addMessage({
          role: 'system',
          content: 'Agent mode enabled.',
        });
        deps.setInput('');
        return;
      }

      const isVerifierRequest =
        deps.enableVerifierSubagent && /^@verifier\b/i.test(userMessage);
      const normalizedUserMessage = isVerifierRequest
        ? userMessage.replace(/^@verifier\b\s*/i, '').trim() ||
        'Run a quick validation for the current context.'
        : userMessage;

      const directEditIntent = isDirectEditIntent(normalizedUserMessage);
      const selectedMode: AgentExecutionMode = options?.forcedMode
        ? options.forcedMode
        : isVerifierRequest
          ? 'verifier'
          : deps.executionMode === 'plan' && directEditIntent
            ? 'agent'
            : deps.executionMode;

      const perRequestPolicyLayers: ToolAccessPolicy[] = [
        {
          allow: deps.toolPolicy.allow,
          deny: deps.toolPolicy.deny,
          allowGroups: deps.toolPolicy.allowGroups,
          denyGroups: deps.toolPolicy.denyGroups,
        },
      ];

      if (selectedMode === 'verifier') {
        perRequestPolicyLayers.push({ denyGroups: ['write'] });
      }

      if (deps.executionMode === 'plan' && selectedMode === 'agent') {
        deps.addMessage({
          role: 'system',
          content:
            'Auto-switched to Agent mode for this request so changes can be applied directly to the editor.',
        });
      }

      const codeContext = deps.includeCode ? deps.code : undefined;

      if (
        deps.provider !== 'local' &&
        !deps.strictLocalMode &&
        !isAutoCorrection &&
        !options?.skipCloudWarning
      ) {
        const sensitiveItems = codeContext
          ? getSensitiveDataSummary(codeContext)
          : [];

        if (sensitiveItems.length > 0) {
          deps.setCloudWarning({
            pending: true,
            sensitiveItems,
            pendingMessage: normalizedUserMessage,
            pendingCode: codeContext,
          });
          return;
        }
      }

      deps.setLastFailedPrompt(normalizedUserMessage);
      if (!options?.suppressUserMessage) {
        deps.addMessage({
          role: 'user',
          content: userMessage,
          codeContext,
        });
      }

      if (!isAutoCorrection) {
        deps.setInput('');
      }

      const runId = runCounterRef.current + 1;
      runCounterRef.current = runId;
      const abortController = new AbortController();
      activeRunRef.current = { id: runId, controller: abortController };
      deps.startRunLifecycle({ id: runId, mode: selectedMode });

      deps.setStreaming(true);
      deps.setStreamingContent('');
      deps.setToolInvocations([]);

      const isAbortError = (error: unknown) => {
        if (abortController.signal.aborted) return true;
        if (!(error instanceof Error)) return false;
        const normalized = `${error.name} ${error.message}`.toLowerCase();
        return normalized.includes('abort') || normalized.includes('cancel');
      };

      try {
        const { getCurrentApiKey, getCurrentModel } = deps;
        const apiKey = getCurrentApiKey();
        const model = getCurrentModel();
        const localCfg = deps.getLocalConfig();
        const customCfg = deps.getCustomConfig();

        const safeCodeContext =
          deps.provider !== 'local' && codeContext
            ? scrubSensitiveData(codeContext)
            : codeContext;

        const runAgent = async (
          disableTools: boolean,
          mode: AgentExecutionMode
        ): Promise<string> => {
          let toolEditApplied = false;
          const toolInvocationsById = new Map<string, ToolInvocation>();
          const baseCallbacks = deps.createAgentCallbacks();
          const trackedCallbacks: AgentCallbacks = {
            ...baseCallbacks,
            onToolInvocation: (invocation) => {
              toolInvocationsById.set(invocation.id, invocation);
              baseCallbacks.onToolInvocation?.(invocation);
            },
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
            deps.provider,
            apiKey,
            model,
            deps.provider === 'local'
              ? { baseURL: localCfg.baseURL, modelId: localCfg.modelId }
              : undefined,
            trackedCallbacks,
            deps.provider !== 'local' ? customCfg : undefined,
            {
              mode,
              disableTools,
              profile:
                mode === 'agent'
                  ? deps.agentProfile
                  : getDefaultProfileForMode(mode),
              toolPolicyLayers: perRequestPolicyLayers,
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
                deps.updateRunLifecycle({ status: 'thinking', message: 'Searching knowledge base...' });
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
          if (deps.pinnedDocIds.length > 0) {
            try {
              deps.updateRunLifecycle({ status: 'thinking', message: 'Loading pinned documentation...' });
              pinnedContext = await deps.getPinnedDocsContext();
            } catch (e) {
              console.warn('Failed to get pinned docs:', e);
            }
          }

          const allContext = pinnedContext + ragContext;
          const extraSystem = safeCodeContext
            ? `Context - Current code in editor (${deps.language}):\n\`\`\`${deps.language}\n${safeCodeContext}\n\`\`\`\n\n${allContext}`
            : allContext || undefined;

          const thinkingMessage =
            mode === 'plan'
              ? 'Planning approach...'
              : mode === 'verifier'
                ? 'Running verification...'
                : 'Analyzing your request...';

          deps.updateRunLifecycle({ status: 'thinking', message: thinkingMessage });
          const streamResult = trackedAgent.stream({
            prompt: fullPrompt,
            extraSystem,
            abortSignal: abortController.signal,
          });
          deps.updateRunLifecycle({
            status: 'generating',
            message: mode === 'plan'
              ? 'Building execution plan...'
              : 'Generating response...'
          });

          let fullText = '';
          let visibleText = '';

          if (streamResult && streamResult.textStream) {
            for await (const chunk of streamResult.textStream) {
              fullText += chunk;
              const sanitized = sanitizeAssistantOutput(fullText, {
                showThinking: deps.showThinking,
              });
              if (sanitized.length < visibleText.length) {
                deps.setStreamingContent(sanitized);
                visibleText = sanitized;
                continue;
              }
              const delta = sanitized.slice(visibleText.length);
              if (delta) {
                deps.appendStreamingContent(delta);
              }
              visibleText = sanitized;
            }



            if (mode === 'agent' && directEditIntent && !toolEditApplied) {
              const fallbackCode = extractCodeForDirectEdit(
                sanitizeAssistantOutput(fullText, {
                  showThinking: deps.showThinking,
                })
              );
              if (fallbackCode) {
                trackedCallbacks.onReplaceAll?.(fallbackCode);
              } else if (!disableTools) {
                throw new Error(
                  'Direct edit requested but no tool call or code payload was produced.'
                );
              }
            }

            const assistantPayload = buildAssistantMessagePayload({
              rawText: fullText,
              showThinking: deps.showThinking,
              toolInvocations: Array.from(toolInvocationsById.values()),
              runId,
              mode,
              model,
              status: 'final',
            });

            deps.finalizeStreaming(assistantPayload);
            deps.updateRunLifecycle({ status: 'completed', endedAt: Date.now() });
            return assistantPayload.content;
          }

          const result = await trackedAgent.generate({
            prompt: fullPrompt,
            extraSystem,
            abortSignal: abortController.signal,
          });
          if (!result.text) {
            throw new Error('No response from agent');
          }

          deps.setStreamingContent(
            sanitizeAssistantOutput(result.text, {
              showThinking: deps.showThinking,
            })
          );


          if (mode === 'agent' && directEditIntent && !toolEditApplied) {
            const fallbackCode = extractCodeForDirectEdit(
              sanitizeAssistantOutput(result.text, {
                showThinking: deps.showThinking,
              })
            );
            if (fallbackCode) {
              trackedCallbacks.onReplaceAll?.(fallbackCode);
            } else if (!disableTools) {
              throw new Error(
                'Direct edit requested but no tool call or code payload was produced.'
              );
            }
          }

          const assistantPayload = buildAssistantMessagePayload({
            rawText: result.text,
            showThinking: deps.showThinking,
            toolInvocations: Array.from(toolInvocationsById.values()),
            runId,
            mode,
            model,
            status: 'final',
          });

          deps.finalizeStreaming(assistantPayload);
          deps.updateRunLifecycle({ status: 'completed', endedAt: Date.now() });
          return assistantPayload.content;
        };

        try {
          return await runAgent(false, selectedMode);
        } catch (agentError) {
          if (isAbortError(agentError)) {
            deps.finalizeStreaming();
            deps.updateRunLifecycle({ status: 'aborted', endedAt: Date.now() });
            return undefined;
          }

          console.warn('[AIChat] Standard agent failed, retrying...');
          try {
            deps.setStreamingContent('');
            return await runAgent(true, selectedMode);
          } catch (retryError) {
            if (isAbortError(retryError)) {
              deps.finalizeStreaming();
              deps.updateRunLifecycle({ status: 'aborted', endedAt: Date.now() });
              return undefined;
            }

            console.error('[AIChat] Legacy retry failed:', retryError);
            if (directEditIntent) {
              deps.addMessage({
                role: 'system',
                content:
                  'No pude aplicar cambios en el editor automáticamente. Intenta pedir: "reemplaza todo el archivo con el código completo" o habilita una respuesta con bloque de código completo.',
              });
            }
            deps.addMessage({
              role: 'assistant',
              content: `Error: ${agentError instanceof Error ? agentError.message : 'Unknown error'}`,
            });
            deps.setLastError(
              agentError instanceof Error
                ? agentError.message
                : 'Unknown error while processing request'
            );
            deps.updateRunLifecycle({
              status: 'error',
              endedAt: Date.now(),
              error:
                agentError instanceof Error
                  ? agentError.message
                  : 'Unknown error while processing request',
            });
            deps.setStreaming(false);
            return undefined;
          }
        }
      } catch (error) {
        if (isAbortError(error)) {
          deps.finalizeStreaming();
          deps.updateRunLifecycle({ status: 'aborted', endedAt: Date.now() });
          return undefined;
        }

        console.error('[AIChat] Send error:', error);
        deps.addMessage({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        deps.setLastError(
          error instanceof Error
            ? error.message
            : 'Unknown error while processing request'
        );
        deps.updateRunLifecycle({
          status: 'error',
          endedAt: Date.now(),
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error while processing request',
        });
        deps.setStreaming(false);
        return undefined;
      } finally {
        if (activeRunRef.current?.id === runId) {
          activeRunRef.current = null;
        }
      }
    },
    [deps]
  );

  const handleCancelGeneration = useCallback(
    (onCanceled?: () => void) => {
      const activeRun = activeRunRef.current;
      if (!activeRun) return;

      activeRun.controller.abort();
      activeRunRef.current = null;
      deps.updateRunLifecycle({ status: 'aborted', endedAt: Date.now() });
      deps.finalizeStreaming();
      onCanceled?.();
    },
    [deps]
  );

  return {
    handleSend,
    handleCancelGeneration,
  };
}
