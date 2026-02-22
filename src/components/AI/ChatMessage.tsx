// Chat Message Component - Displays individual messages
import { memo, useMemo, useState } from 'react';
import { m } from 'framer-motion';
import { Bot, Check, Copy } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { MarkdownContent } from './MarkdownRenderer';
import {
  getChatMessageDisplayContent,
  type ChatMessage as ChatMessageType,
  type ChatMessagePart,
} from '../../features/ai-agent/types';
import { COPY_FEEDBACK_DURATION_MS } from '../../constants';

interface ChatMessageProps {
  message: ChatMessageType;
  onInsertCode?: (code: string) => void;
}

export const ChatMessage = memo(
  ({ message, onInsertCode }: ChatMessageProps) => {
    const { t } = useTranslation();
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);
    const messageText = useMemo(
      () => getChatMessageDisplayContent(message),
      [message]
    );
    const timeLabel = useMemo(() => {
      const date = new Date(message.timestamp);
      if (Number.isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }, [message.timestamp]);

    const handleCopyMessage = async () => {
      try {
        await navigator.clipboard.writeText(messageText);
        setCopied(true);
        setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
      } catch {
        setCopied(false);
      }
    };

    return (
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        role="listitem"
        aria-label={
          isUser
            ? t('chat.userMessage', 'User message')
            : t('chat.assistantMessage', 'Assistant message')
        }
        className={clsx(
          'group flex gap-3 px-4 py-4',
          isUser && 'flex-row-reverse'
        )}
      >
        {/* Avatar */}
        {!isUser && (
          <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-transparent mt-0.5">
            <Bot className="w-5 h-5 text-primary" />
          </div>
        )}

        {/* Message Content */}
        <div className={clsx('flex-1 min-w-0', isUser && 'flex justify-end')}>
          <div
            className={clsx(
              'mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground',
              isUser && 'justify-end'
            )}
          >
            <span className="font-semibold text-foreground/80">
              {isUser
                ? t('chat.youLabel', 'You')
                : t('chat.assistantLabel', 'Assistant')}
            </span>
            {timeLabel && <span aria-hidden="true" className="opacity-70">• {timeLabel}</span>}
          </div>

          <div
            className={clsx(
              'inline-block max-w-[90%]',
              isUser
                ? 'px-4 py-3 bg-muted text-foreground rounded-2xl rounded-tr-sm border border-border/30 shadow-sm'
                : 'text-sm text-foreground/90'
            )}
          >
            {isUser ? (
              <span className="whitespace-pre-wrap leading-relaxed text-sm">
                {messageText}
              </span>
            ) : (
              <AssistantMessageBody
                message={message}
                fallbackContent={messageText}
                onInsertCode={onInsertCode}
              />
            )}
          </div>

          <div
            className={clsx(
              'mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
              isUser && 'justify-end'
            )}
          >
            <button
              type="button"
              onClick={() => void handleCopyMessage()}
              className="inline-flex items-center gap-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted px-2 py-1 text-[11px] transition-colors"
              title={t('chat.copyMessage', 'Copy message')}
              aria-label={t('chat.copyMessage', 'Copy message')}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>
                {copied
                  ? t('chat.copied', 'Copied')
                  : t('chat.copy', 'Copy')}
              </span>
            </button>
          </div>
        </div>
      </m.div>
    );
  }
);

ChatMessage.displayName = 'ChatMessage';

function AssistantMessageBody({
  message,
  fallbackContent,
  onInsertCode,
}: {
  message: ChatMessageType;
  fallbackContent: string;
  onInsertCode?: (code: string) => void;
}) {
  if (!message.contentParts || message.contentParts.length === 0) {
    return <MarkdownContent content={fallbackContent} onInsertCode={onInsertCode} />;
  }

  return (
    <div className="space-y-2">
      {message.contentParts.map((part, index) => (
        <PartRenderer
          key={part.id || `${part.type}-${index}`}
          part={part}
          onInsertCode={onInsertCode}
        />
      ))}
    </div>
  );
}

function PartRenderer({
  part,
  onInsertCode,
}: {
  part: ChatMessagePart;
  onInsertCode?: (code: string) => void;
}) {
  if (part.type === 'markdown') {
    return <MarkdownContent content={part.text} onInsertCode={onInsertCode} />;
  }

  if (part.type === 'text') {
    return <span className="whitespace-pre-wrap text-sm">{part.text}</span>;
  }

  if (part.type === 'reasoning') {
    if (part.collapsed !== false) {
      return (
        <details className="group rounded-lg bg-muted/30 border border-border/40 px-3 py-2 text-xs text-muted-foreground transition-all hover:bg-muted/50 mb-2">
          <summary className="cursor-pointer select-none font-medium text-foreground/70 flex items-center gap-2 group-open:mb-2 transition-colors hover:text-foreground">
            <span className="flex-1 opacity-80">Pensamiento del modelo (Reasoning)</span>
          </summary>
          <div className="pl-3 border-l-2 border-primary/30 whitespace-pre-wrap leading-relaxed opacity-90 overflow-hidden text-muted-foreground">
            {part.text}
          </div>
        </details>
      );
    }

    return (
      <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground border-l-2 border-border/50 whitespace-pre-wrap leading-relaxed">
        {part.text}
      </div>
    );
  }

  if (part.type === 'status') {
    const tone =
      part.level === 'error'
        ? 'bg-destructive/10 text-destructive'
        : part.level === 'warning'
          ? 'bg-amber-500/10 text-amber-600'
          : part.level === 'success'
            ? 'bg-primary/10 text-primary'
            : 'bg-muted/40 text-muted-foreground';

    return (
      <div className={clsx('rounded-md px-2.5 py-1.5 text-xs', tone)}>
        {part.text}
      </div>
    );
  }

  if (part.type === 'tool-call') {
    const stateTone =
      part.state === 'error' || part.state === 'denied'
        ? 'bg-destructive/10 text-destructive'
        : part.state === 'completed' || part.state === 'approved'
          ? 'bg-primary/10 text-primary'
          : 'bg-muted/30 text-muted-foreground';

    return (
      <div className={clsx('rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1.5', stateTone)}>
        <span className="font-semibold">{part.toolName}</span>
        {part.state ? <span className="opacity-80">{`• ${part.state}`}</span> : null}
        {part.summary ? <span className="opacity-80 truncate" title={part.summary}>{`— ${part.summary}`}</span> : null}
      </div>
    );
  }

  return null;
}
