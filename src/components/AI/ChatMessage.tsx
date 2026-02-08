// Chat Message Component - Displays individual messages
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import clsx from 'clsx';
import { MarkdownContent } from './MarkdownRenderer';
import type { ChatMessage as ChatMessageType } from '../../features/ai-agent/types';

interface ChatMessageProps {
  message: ChatMessageType;
  onInsertCode?: (code: string) => void;
}

export const ChatMessage = memo(
  ({ message, onInsertCode }: ChatMessageProps) => {
    const isUser = message.role === 'user';

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={clsx(
          'group flex gap-3 px-4 py-3',
          isUser && 'flex-row-reverse'
        )}
      >
        {/* Avatar */}
        <div
          className={clsx(
            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
            isUser
              ? 'bg-primary/10 text-primary'
              : 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary'
          )}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Message Content */}
        <div className={clsx('flex-1 min-w-0', isUser && 'flex justify-end')}>
          <div
            className={clsx(
              'inline-block max-w-[85%]',
              isUser
                ? 'px-4 py-2.5 bg-primary/10 text-foreground rounded-2xl rounded-br-md border border-primary/10'
                : 'text-sm text-foreground/90'
            )}
          >
            {isUser ? (
              <span className="whitespace-pre-wrap leading-relaxed text-sm">
                {message.content}
              </span>
            ) : (
              <MarkdownContent
                content={message.content}
                onInsertCode={onInsertCode}
              />
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

ChatMessage.displayName = 'ChatMessage';
