/**
 * Agent Thinking Indicator
 * Shows animated status while the AI agent is working
 */
import { motion } from 'framer-motion';
import { Brain, Loader2, Sparkles, Pencil } from 'lucide-react';
import clsx from 'clsx';
import type { AgentPhase } from '../../store/useChatStore';

interface AgentThinkingIndicatorProps {
  phase: AgentPhase;
  message?: string;
  className?: string;
}

const phaseConfig: Record<
  AgentPhase,
  {
    icon: typeof Brain;
    color: string;
    dotColor: string;
    defaultMessage: string;
  }
> = {
  idle: {
    icon: Brain,
    color: 'text-muted-foreground',
    dotColor: 'bg-muted-foreground',
    defaultMessage: '',
  },
  thinking: {
    icon: Brain,
    color: 'text-primary',
    dotColor: 'bg-primary',
    defaultMessage: 'Analyzing your request...',
  },
  generating: {
    icon: Sparkles,
    color: 'text-primary',
    dotColor: 'bg-primary',
    defaultMessage: 'Generating code...',
  },
  applying: {
    icon: Pencil,
    color: 'text-primary',
    dotColor: 'bg-primary',
    defaultMessage: 'Preparing changes...',
  },
};

export function AgentThinkingIndicator({
  phase,
  message,
  className,
}: AgentThinkingIndicatorProps) {
  if (phase === 'idle') return null;

  const config = phaseConfig[phase];
  const Icon = config.icon;
  const displayMessage = message || config.defaultMessage;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      role="status"
      aria-live="polite"
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-muted/50 border border-border',
        className
      )}
    >
      {/* Animated icon */}
      <div className="relative">
        {phase === 'generating' ? (
          <Loader2 className={clsx('w-4 h-4 animate-spin', config.color)} />
        ) : (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon className={clsx('w-4 h-4', config.color)} />
          </motion.div>
        )}

        {/* Pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>

      {/* Status message */}
      <span className="text-sm text-muted-foreground">{displayMessage}</span>

      {/* Typing dots animation */}
      <div className="flex gap-0.5 ml-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={clsx('w-1 h-1 rounded-full', config.dotColor)}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
