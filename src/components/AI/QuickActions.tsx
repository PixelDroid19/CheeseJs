/**
 * Quick Actions Component
 * Horizontal bar with common AI actions
 */
import { motion } from 'framer-motion';
import { MessageSquare, Bug, Wand2, Sparkles, FileCode } from 'lucide-react';
import clsx from 'clsx';

interface QuickAction {
  id: string;
  icon: typeof MessageSquare;
  label: string;
  prompt: string;
  color: string;
}

const defaultActions: QuickAction[] = [
  {
    id: 'explain',
    icon: MessageSquare,
    label: 'Explain',
    prompt:
      'Explain what this code does in simple terms. Break down the logic step by step.',
    color: 'text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10',
  },
  {
    id: 'fix',
    icon: Bug,
    label: 'Fix Bug',
    prompt:
      'Review this code for bugs and potential issues. If you find any, provide the corrected code.',
    color: 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10',
  },
  {
    id: 'refactor',
    icon: Wand2,
    label: 'Refactor',
    prompt:
      'Refactor this code to improve readability and maintainability. Keep the same functionality.',
    color: 'text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10',
  },
  {
    id: 'improve',
    icon: Sparkles,
    label: 'Improve',
    prompt:
      'Suggest improvements for this code including better patterns, performance optimizations, and best practices.',
    color: 'text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10',
  },
  {
    id: 'document',
    icon: FileCode,
    label: 'Document',
    prompt:
      'Add comprehensive documentation comments (JSDoc/TSDoc) to this code explaining functions, parameters, and return values.',
    color: 'text-muted-foreground hover:text-green-500 hover:bg-green-500/10',
  },
];

interface QuickActionsProps {
  onAction: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}

export function QuickActions({
  onAction,
  disabled,
  className,
}: QuickActionsProps) {
  return (
    <div className={clsx('flex flex-wrap gap-1.5', className)}>
      {defaultActions.map((action, index) => (
        <motion.button
          key={action.id}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
          onClick={() => onAction(action.prompt)}
          disabled={disabled}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
            'border border-border/40 bg-card/30',
            'transition-all duration-150',
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : clsx(action.color, 'hover:border-current/20 hover:shadow-sm')
          )}
          title={action.prompt}
        >
          <action.icon className="w-3.5 h-3.5" />
          <span>{action.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
