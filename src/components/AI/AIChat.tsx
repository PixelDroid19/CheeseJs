// AI Chat Panel
import { FOCUS_DELAY_MS } from '../../constants';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  X,
  Trash2,
  Loader2,
  Bot,
  Wrench,
  Database,
  Code,
  FileText,
  TrendingUp,
  BookOpen,
  Search,
  FolderOpen,
  FileCode,
} from 'lucide-react';
import clsx from 'clsx';
import { useChatStore } from '../../store/useChatStore';
import { useAISettingsStore } from '../../store/useAISettingsStore';
import { useCodeStore } from '../../store/useCodeStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useRagStore } from '../../store/useRagStore';
import {
  createCodeAgent,
  type ToolInvocation,
  type AgentCallbacks,
  processEditorActions,
} from '../../features/ai-agent/codeAgent';
import { ToolInvocationCard, ApprovalDialog } from './ToolInvocationUI';
import { AgentThinkingIndicator } from './AgentThinkingIndicator';
import { DiffView } from './DiffView';
import { CloudWarningDialog } from './CloudWarningDialog';
import {
  scrubSensitiveData,
  getSensitiveDataSummary,
} from '../../features/ai-agent/scrubber';
import { ChatMessage } from './ChatMessage';

export function AIChat() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [includeCode, setIncludeCode] = useState(true);
  const [toolInvocations, setToolInvocations] = useState<ToolInvocation[]>([]);
  const [pendingApproval, setPendingApproval] = useState<{
    id: string;
    toolName: string;
    input: Record<string, unknown>;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const [cloudWarning, setCloudWarning] = useState<{
    pending: boolean;
    sensitiveItems: string[];
    pendingMessage: string;
    pendingCode?: string;
  } | null>(null);

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
    agentPhase,
    thinkingMessage,
    pendingChange,
    setAgentPhase,
    setPendingChange,
    clearPendingChange,
  } = useChatStore();

  const {
    enableChat,
    getCurrentApiKey,
    getCurrentModel,
    provider,
    getLocalConfig,
    getCustomConfig,
    strictLocalMode,
  } = useAISettingsStore();

  const code = useCodeStore((state) => state.code);
  const setCode = useCodeStore((state) => state.setCode);
  const language = useLanguageStore((state) => state.currentLanguage);

  const isConfigured = Boolean(getCurrentApiKey());

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingContent, toolInvocations]);

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen && textAreaRef.current) {
      setTimeout(() => textAreaRef.current?.focus(), FOCUS_DELAY_MS);
    }
  }, [isChatOpen]);

  // Handle tool invocation updates
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

  // Handle code insertion
  const handleInsertCode = useCallback(
    (newCode: string) => {
      setCode(newCode);
    },
    [setCode]
  );

  const { setModalOpen, getPinnedDocsContext, pinnedDocIds } = useRagStore();

  const handleIndexCodebase = useCallback(async () => {
    setModalOpen(true);
  }, [setModalOpen]);

  // Create agent callbacks
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

  // Handle send with agent
  const handleSend = useCallback(
    async (textInput?: string, isAutoCorrection: boolean = false) => {
      const messageToSend = textInput || input;
      if (!messageToSend.trim() || isStreaming || !isConfigured) return;

      const userMessage = messageToSend.trim();
      const codeContext = includeCode ? code : undefined;

      // Cloud provider warning check
      if (provider !== 'local' && !strictLocalMode && !isAutoCorrection) {
        const sensitiveItems = codeContext
          ? getSensitiveDataSummary(codeContext)
          : [];

        if (sensitiveItems.length > 0) {
          setCloudWarning({
            pending: true,
            sensitiveItems,
            pendingMessage: userMessage,
            pendingCode: codeContext,
          });
          return;
        }
      }

      // Proceed with message sending
      addMessage({
        role: 'user',
        content: userMessage,
        codeContext,
      });

      if (!isAutoCorrection) {
        setInput('');
      }
      setStreaming(true);
      setStreamingContent('');
      setToolInvocations([]);

      try {
        const apiKey = getCurrentApiKey();
        const model = getCurrentModel();
        const localCfg = getLocalConfig();
        const customCfg = getCustomConfig();

        const safeCodeContext =
          provider !== 'local' && codeContext
            ? scrubSensitiveData(codeContext)
            : codeContext;

        const runAgent = async (disableTools: boolean) => {
          const currentAgent = createCodeAgent(
            provider,
            apiKey,
            model,
            provider === 'local'
              ? { baseURL: localCfg.baseURL, modelId: localCfg.modelId }
              : undefined,
            createAgentCallbacks(),
            provider !== 'local' ? customCfg : undefined,
            disableTools
          );

          let fullPrompt = userMessage;
          if (isAutoCorrection) {
            fullPrompt = `Review and fix the following code based on this error:\n\n${userMessage}\n\nIMPORTANT: Return the FULL corrected code using the appropriate tool.`;
          }

          // RAG search
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

          // Get pinned docs
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

          setAgentPhase('thinking', 'Analyzing your request...');
          const streamResult = currentAgent.stream({ prompt });
          setAgentPhase('generating', 'Generating response...');

          let fullText = '';

          if (streamResult && streamResult.textStream) {
            for await (const chunk of streamResult.textStream) {
              fullText += chunk;
              appendStreamingContent(chunk);
            }

            if (disableTools || fullText.includes('<<<EDITOR_ACTION>>>')) {
              await processEditorActions(fullText, createAgentCallbacks());
            }

            finalizeStreaming();
          } else {
            const result = await currentAgent.generate({ prompt });
            if (result.text) {
              setStreamingContent(result.text);
              if (disableTools || result.text.includes('<<<EDITOR_ACTION>>>')) {
                await processEditorActions(result.text, createAgentCallbacks());
              }
              finalizeStreaming();
            } else {
              throw new Error('No response from agent');
            }
          }
        };

        try {
          await runAgent(false);
        } catch (agentError) {
          console.warn('[AIChat] Standard agent failed, retrying...');
          try {
            setStreamingContent('');
            await runAgent(true);
          } catch (retryError) {
            console.error('[AIChat] Legacy retry failed:', retryError);
            addMessage({
              role: 'assistant',
              content: `Error: ${agentError instanceof Error ? agentError.message : 'Unknown error'}`,
            });
            setStreaming(false);
          }
        }
      } catch (error) {
        console.error('[AIChat] Send error:', error);
        addMessage({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        setStreaming(false);
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
      getPinnedDocsContext,
      pinnedDocIds,
    ]
  );

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Expose auto-correction function
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

  if (!enableChat) return null;

  // Quick action buttons
  const quickActions = [
    {
      icon: FileText,
      label: 'Explain',
      prompt: 'Explain what this code does in detail',
    },
    {
      icon: Wrench,
      label: 'Fix Bug',
      prompt: 'Find and fix any bugs in this code',
    },
    {
      icon: Code,
      label: 'Refactor',
      prompt: 'Refactor this code to follow best practices',
    },
    {
      icon: TrendingUp,
      label: 'Improve',
      prompt: 'Suggest improvements for performance and readability',
    },
    {
      icon: BookOpen,
      label: 'Document',
      prompt: 'Add comprehensive documentation to this code',
    },
  ];

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        onClick={toggleChat}
        data-testid="toggle-chat"
        className={clsx(
          'fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          isChatOpen && 'opacity-0 pointer-events-none'
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageSquare className="w-5 h-5" />
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-6 bottom-6 top-20 w-[450px] z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-[#1e1e1e] border border-[#2d2d2d]"
          >
            {/* Header */}
            <div className="relative px-3 py-2 border-b border-[#2d2d2d] bg-[#252526]">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => {
                    clearChat();
                    setToolInvocations([]);
                  }}
                  className="p-1.5 rounded hover:bg-[#2d2d2d] text-[#8a8a8a] hover:text-[#cccccc] transition-colors"
                  title="New conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChatOpen(false)}
                  data-testid="close-ai-chat"
                  className="p-1.5 rounded hover:bg-[#2d2d2d] text-[#8a8a8a] hover:text-[#cccccc] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Agent Thinking Indicator */}
              <AnimatePresence>
                {agentPhase !== 'idle' && (
                  <AgentThinkingIndicator
                    phase={agentPhase}
                    message={thinkingMessage}
                    className="mb-2"
                  />
                )}
              </AnimatePresence>

              {!isConfigured && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <Bot className="w-12 h-12 text-[#4a4a4a] mb-3" />
                  <p className="text-[#8a8a8a] text-sm">
                    {t(
                      'chat.notConfigured',
                      'Configure your AI provider in Settings to start chatting.'
                    )}
                  </p>
                </div>
              )}

              {/* Empty State */}
              {isConfigured && messages.length === 0 && !isStreaming && (
                <div className="flex flex-col h-full justify-center">
                  {/* Quick Action Buttons */}
                  <div className="flex flex-wrap gap-2 mb-8 justify-center">
                    {quickActions.map((action, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setInput(action.prompt)}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2 rounded-lg',
                          'bg-[#252526] border border-[#3d3d3d]',
                          'text-[#cccccc] text-xs font-medium',
                          'transition-all duration-200',
                          'hover:bg-[#2d2d2d] hover:border-[#4d4d4d]'
                        )}
                      >
                        <action.icon className="w-3.5 h-3.5" />
                        <span>{action.label}</span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Capabilities Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        icon: Search,
                        title: 'Search',
                        desc: 'Find files and code',
                      },
                      {
                        icon: FolderOpen,
                        title: 'Filesystem',
                        desc: 'Browse and edit files',
                      },
                      {
                        icon: FileCode,
                        title: 'Refactor',
                        desc: 'Edit and improve code',
                      },
                      {
                        icon: BookOpen,
                        title: 'Docs',
                        desc: 'Access knowledge base',
                      },
                    ].map((cap, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                        className="flex flex-col items-center p-4 rounded-xl bg-[#252526] border border-[#2d2d2d] hover:border-[#3d3d3d] hover:bg-[#2a2a2a] transition-all group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#1e1e1e] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                          <cap.icon className="w-5 h-5 text-[#6a6a6a] group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-sm font-medium text-[#cccccc]">
                          {cap.title}
                        </p>
                        <p className="text-xs text-[#6a6a6a] text-center mt-0.5">
                          {cap.desc}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onInsertCode={handleInsertCode}
                />
              ))}

              {/* Tool Invocations */}
              {toolInvocations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#8a8a8a] uppercase">
                    <Wrench className="w-3 h-3" />
                    <span>Tool Activity</span>
                  </div>
                  {toolInvocations.map((invocation) => (
                    <ToolInvocationCard
                      key={invocation.id}
                      invocation={invocation}
                    />
                  ))}
                </div>
              )}

              {/* Streaming */}
              {isStreaming && currentStreamingContent && (
                <div className="space-y-2">
                  <ChatMessage
                    message={{
                      id: 'streaming',
                      role: 'assistant',
                      content: currentStreamingContent.replace(
                        /<<<EDITOR_ACTION>>>[\s\S]*$/,
                        ''
                      ),
                      timestamp: Date.now(),
                    }}
                    onInsertCode={handleInsertCode}
                  />
                  <span className="inline-block w-1 h-3 bg-blue-400 animate-pulse" />
                </div>
              )}

              {isStreaming && !currentStreamingContent && (
                <div className="flex items-center gap-2 text-[#8a8a8a] text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-[#2d2d2d] bg-[#252526]">
              {/* Toggles */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setIncludeCode(!includeCode)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                    includeCode
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-[#2d2d2d] text-[#8a8a8a] border border-[#3d3d3d] hover:border-[#4d4d4d]'
                  )}
                >
                  <Code className="w-3 h-3" />
                  <span>Code Included</span>
                </button>

                <button
                  onClick={handleIndexCodebase}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-[#2d2d2d] text-[#8a8a8a] border border-[#3d3d3d] hover:border-[#4d4d4d] transition-colors"
                >
                  <Database className="w-3 h-3" />
                  <span>Knowledge Base</span>
                </button>
              </div>

              {/* Input */}
              <div className="relative">
                <textarea
                  ref={textAreaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isConfigured
                      ? t('chat.placeholder', 'Ask about your code...')
                      : t(
                          'chat.configureFirst',
                          'Configure AI in Settings first'
                        )
                  }
                  disabled={!isConfigured || isStreaming}
                  rows={1}
                  className="w-full resize-none bg-[#1e1e1e] border border-[#3d3d3d] rounded-lg px-3 py-2 pr-10 text-sm text-[#cccccc] placeholder:text-[#6a6a6a] focus:outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] max-h-[120px]"
                  style={{ height: 'auto' }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isStreaming || !isConfigured}
                  className={clsx(
                    'absolute right-2 bottom-2 p-1.5 rounded transition-colors',
                    !input.trim() || isStreaming || !isConfigured
                      ? 'text-[#4a4a4a] cursor-not-allowed'
                      : 'text-blue-400 hover:bg-blue-500/10'
                  )}
                >
                  {isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-[#6a6a6a] mt-2 text-center">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Approval Dialog */}
      <AnimatePresence>
        {pendingApproval && (
          <ApprovalDialog
            isOpen={true}
            toolName={pendingApproval.toolName}
            input={pendingApproval.input}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        )}
      </AnimatePresence>

      {/* Diff View Modal */}
      <AnimatePresence>
        {pendingChange && (
          <DiffView
            change={pendingChange}
            onAccept={() => {
              if (pendingChange.action === 'replaceAll') {
                setCode(pendingChange.newCode);
                if (window.editor) {
                  window.editor.setValue(pendingChange.newCode);
                }
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
                  }
                } else {
                  setCode(code + '\n' + pendingChange.newCode);
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
                  }
                } else {
                  setCode(pendingChange.newCode);
                }
              }
              clearPendingChange();
            }}
            onReject={() => {
              clearPendingChange();
            }}
          />
        )}
      </AnimatePresence>

      {/* Cloud Warning Dialog */}
      <CloudWarningDialog
        isOpen={cloudWarning?.pending ?? false}
        providerName={
          provider === 'openai'
            ? 'OpenAI'
            : provider === 'anthropic'
              ? 'Anthropic'
              : provider === 'google'
                ? 'Google AI'
                : provider
        }
        sensitiveItems={cloudWarning?.sensitiveItems || []}
        onConfirm={() => {
          if (cloudWarning) {
            setCloudWarning(null);
            handleSend(cloudWarning.pendingMessage, false);
          }
        }}
        onCancel={() => setCloudWarning(null)}
        onEnableLocalMode={() => {
          setCloudWarning(null);
        }}
      />
    </>
  );
}
