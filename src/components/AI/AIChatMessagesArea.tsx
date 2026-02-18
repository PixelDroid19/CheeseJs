import { AnimatePresence } from 'framer-motion';
import { Bot, Loader2, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ToolInvocation } from '../../features/ai-agent/codeAgent';
import type { AgentPhase } from '../../store/useChatStore';
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
  agentPhase: AgentPhase;
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
}: AIChatMessagesAreaProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <AnimatePresence>
        {agentPhase !== 'idle' && (
          <AgentThinkingIndicator
            phase={agentPhase}
            message={thinkingMessage}
            className="mb-2"
          />
        )}
      </AnimatePresence>

      {lastError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive font-medium">
            {t(
              'chat.errorTitle',
              'Something failed while processing your request.'
            )}
          </p>
          <p className="text-xs text-destructive/90 mt-1">{lastError}</p>
          {lastFailedPrompt && (
            <button
              onClick={() => onRetryLast(lastFailedPrompt)}
              className="mt-2 px-3 py-2 text-xs rounded-md bg-destructive/20 hover:bg-destructive/30 text-destructive font-medium transition-colors"
            >
              {t('chat.retryLast', 'Retry last request')}
            </button>
          )}
        </div>
      )}

      {!isConfigured && (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <Bot className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            {t(
              'chat.notConfigured',
              'Configure your AI provider in Settings to start chatting.'
            )}
          </p>
        </div>
      )}

      {isConfigured && messages.length === 0 && !isStreaming && (
        <AIChatEmptyState onQuickAction={onQuickAction} />
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
        <ChatMessage
          key={message.id}
          message={message}
          onInsertCode={onInsertCode}
        />
      ))}

      {toolInvocations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <Wrench className="w-3 h-3 text-primary" />
            <span>{t('chat.toolActivity', 'Tool activity')}</span>
          </div>
          {toolInvocations.map((invocation) => (
            <ToolInvocationCard key={invocation.id} invocation={invocation} />
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
          <span className="inline-block w-1 h-3 bg-primary animate-pulse" />
        </div>
      )}

      {isStreaming && !currentStreamingContent && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{t('chat.generating', 'Generating response...')}</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
