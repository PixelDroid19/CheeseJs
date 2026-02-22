import { Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AIChatHeaderProps {
  onNewConversation: () => void;
  onClose: () => void;
}

export function AIChatHeader({
  onNewConversation,
  onClose,
}: AIChatHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="relative px-4 py-3 border-b border-border/40 bg-background/95 backdrop-blur-sm z-10 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">
            {t('settings.ai.chatPanel', 'AI Chat Panel')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onNewConversation}
            className="p-1.5 rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            title={t('chat.newConversation', 'New conversation')}
            aria-label={t('chat.newConversation', 'New conversation')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            data-testid="close-ai-chat"
            className="p-1.5 rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('settings.close', 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
