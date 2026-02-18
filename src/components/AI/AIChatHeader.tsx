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
    <div className="relative px-3 py-2 border-b border-border bg-muted/40">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-foreground truncate">
            {t('settings.ai.chatPanel', 'AI Chat Panel')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onNewConversation}
            className="p-2.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={t('chat.newConversation', 'New conversation')}
            aria-label={t('chat.newConversation', 'New conversation')}
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={onClose}
            data-testid="close-ai-chat"
            className="p-2.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('settings.close', 'Close')}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
