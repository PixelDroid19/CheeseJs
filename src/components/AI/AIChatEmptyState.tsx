import { m } from 'framer-motion';
import {
  BookOpen,
  Code,
  FileCode,
  FileText,
  FolderOpen,
  Search,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

interface AIChatEmptyStateProps {
  onQuickAction: (prompt: string) => void;
}

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

const capabilities = [
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
];

export function AIChatEmptyState({ onQuickAction }: AIChatEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5 pt-2">
      <p className="text-xs text-muted-foreground text-center">
        {t(
          'chat.quickActionsHint',
          'Choose a quick action or type your request below.'
        )}
      </p>

      <div className="flex flex-wrap gap-2 justify-center">
        {quickActions.map((action, i) => (
          <m.button
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onQuickAction(action.prompt)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 rounded-lg min-h-11',
              'bg-card border border-border',
              'text-foreground text-xs font-medium',
              'transition-all duration-200',
              'hover:bg-accent hover:border-primary/30'
            )}
            aria-label={action.label}
          >
            <action.icon className="w-3.5 h-3.5 text-primary" />
            <span>{action.label}</span>
          </m.button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {capabilities.map((cap, i) => (
          <m.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            className="flex flex-col items-center p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-accent/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <cap.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm font-medium text-foreground">{cap.title}</p>
            <p className="text-xs text-muted-foreground text-center mt-0.5">
              {cap.desc}
            </p>
          </m.div>
        ))}
      </div>
    </div>
  );
}
