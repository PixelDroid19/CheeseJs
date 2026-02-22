import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ArrowDown, Bot, Loader2, Radio, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ToolInvocation } from '../../features/ai-agent/codeAgent';
import type { AgentRunStatus } from '../../store/useChatStore';
import type { ChatMessage as ChatMessageType } from '../../features/ai-agent/types';
import type { ExecutionPlan } from '../../features/ai-agent/types';
import { AgentThinkingIndicator } from './AgentThinkingIndicator';
import { ChatMessage } from './ChatMessage';
import { AIChatEmptyState } from './AIChatEmptyState';
import { AIPlanBoard } from './AIPlanBoard';
import { ToolInvocationCard } from './ToolInvocationUI';

interface AIChatMessagesAreaProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  currentStreamingContent: string;
  agentPhase: AgentRunStatus;
  thinkingMessage?: string;
  lastError: string | null;
  lastFailedPrompt: string | null;
  isConfigured: boolean;
  activePlan: ExecutionPlan | null;
  isExecutingPlan: boolean;
  toolInvocations: ToolInvocation[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onRetryLast: (prompt: string) => void;
  onQuickAction: (prompt: string) => void;
  onExecutePlan: () => void;
  onClearPlan: () => void;
  onInsertCode: (code: string) => void;
  onToolApprove: (id: string) => void;
  onToolDeny: (id: string) => void;
}

export function AIChatMessagesArea({
  messages,
  isStreaming,
  currentStreamingContent,
  agentPhase,
  thinkingMessage,
  lastError,
  lastFailedPrompt,
  isConfigured,
  activePlan,
  isExecutingPlan,
  toolInvocations,
  messagesEndRef,
  onRetryLast,
  onQuickAction,
  onExecutePlan,
  onClearPlan,
  onInsertCode,
  onToolApprove,
  onToolDeny,
}: AIChatMessagesAreaProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  const updatePinnedState = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;

    const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setIsPinnedToBottom(distanceToBottom <= 40);
  }, []);

  const scrollToLatest = useCallback(
    (behavior: 'auto' | 'smooth' = 'smooth') => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    },
    [messagesEndRef]
  );

  useEffect(() => {
    if (isPinnedToBottom) {
      scrollToLatest(isStreaming ? 'auto' : 'smooth');
    }
  }, [
    isPinnedToBottom,
    isStreaming,
    messages,
    currentStreamingContent,
    toolInvocations,
    agentPhase,
    scrollToLatest,
  ]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scroll-smooth"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label={t('chat.messages', 'Chat messages')}
      onScroll={updatePinnedState}
    >
      {isStreaming && (
        <div className="sticky top-0 z-10 -mt-4 mb-2 flex justify-center pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-[11px] font-medium text-primary shadow-sm backdrop-blur-md">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>{t('chat.streaming', 'Generating')}</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {agentPhase && agentPhase !== 'idle' && agentPhase !== 'completed' && agentPhase !== 'aborted' && agentPhase !== 'error' && (
          <AgentThinkingIndicator
            phase={agentPhase}
            message={thinkingMessage}
            className="mb-2 opacity-80"
          />
        )}
      </AnimatePresence>

      {lastError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 mx-2">
          <p className="text-sm text-destructive font-medium flex items-center gap-2">
            {t(
              'chat.errorTitle',
              'Something went wrong'
            )}
          </p>
          <p className="text-xs text-destructive/80 mt-1">{lastError}</p>
          {lastFailedPrompt && (
            <button
              onClick={() => onRetryLast(lastFailedPrompt)}
              className="mt-3 px-3 py-1.5 text-xs rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium transition-colors"
            >
              {t('chat.retryLast', 'Retry')}
            </button>
          )}
        </div>
      )}

      {!isConfigured && (
        <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center px-4 opacity-70">
          <Bot className="w-10 h-10 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-sm font-medium">
            {t(
              'chat.notConfigured',
              'Please configure your AI provider in Settings to continue.'
            )}
          </p>
        </div>
      )}

      {isConfigured && messages.length === 0 && !isStreaming && (
        <div className="mt-8">
          <AIChatEmptyState onQuickAction={onQuickAction} />
        </div>
      )}

      {activePlan && (
        <AIPlanBoard
          activePlan={activePlan}
          isStreaming={isStreaming}
          isExecutingPlan={isExecutingPlan}
          onExecutePlan={onExecutePlan}
          onClearPlan={onClearPlan}
        />
      )}

      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} onInsertCode={onInsertCode} />
      ))}

      {toolInvocations.length > 0 && (
        <div
          className="space-y-3 px-2"
          role="region"
          aria-label={t('chat.toolActivity', 'Tool activity')}
        >
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <Wrench className="w-3.5 h-3.5 text-primary" />
            <span>{t('chat.toolActivity', 'Activity')}</span>
          </div>
          {toolInvocations.map((invocation) => (
            <ToolInvocationCard
              key={invocation.id}
              invocation={invocation}
              onApprove={onToolApprove}
              onDeny={onToolDeny}
            />
          ))}
        </div>
      )}

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
              timestamp:
                messages.length > 0
                  ? messages[messages.length - 1].timestamp + 1
                  : 1,
            }}
            onInsertCode={onInsertCode}
          />
          <span className="inline-block w-1.5 h-3.5 bg-primary/70 animate-pulse ml-12 rounded-full" />
        </div>
      )}

      {isStreaming && !currentStreamingContent && (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground ml-12 opacity-70 py-4"
          aria-live="polite"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('chat.generating', 'Thinking...')}</span>
        </div>
      )}

      {!isPinnedToBottom && (messages.length > 0 || isStreaming) && (
        <div className="sticky bottom-4 z-10 flex justify-center pointer-events-none pb-2">
          <button
            type="button"
            onClick={() => {
              scrollToLatest('smooth');
              setIsPinnedToBottom(true);
            }}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/90 px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground shadow-md transition-all hover:text-foreground hover:bg-muted backdrop-blur-sm"
            aria-label={t('chat.jumpToLatest', 'Jump to latest message')}
            title={t('chat.jumpToLatest', 'Jump to latest message')}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span>{t('chat.latest', 'Scroll to Latest')}</span>
          </button>
        </div>
      )}

      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
}
