import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  PlayCircle,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExecutionPlan } from '../../features/ai-agent/types';

interface AIPlanBoardProps {
  activePlan: ExecutionPlan;
  isStreaming: boolean;
  isExecutingPlan: boolean;
  onExecutePlan: () => void;
  onClearPlan: () => void;
}

const planStatusClass = (status: ExecutionPlan['status']) => {
  switch (status) {
    case 'running':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'completed':
      return 'bg-green-500/15 text-green-400 border-green-500/30';
    case 'failed':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const taskStatusIcon = (status: ExecutionPlan['tasks'][number]['status']) => {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />;
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    case 'failed':
      return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    case 'skipped':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

export function AIPlanBoard({
  activePlan,
  isStreaming,
  isExecutingPlan,
  onExecutePlan,
  onClearPlan,
}: AIPlanBoardProps) {
  const { t } = useTranslation();
  const planProgress = `${activePlan.tasks.filter((task) => task.status === 'completed').length}/${activePlan.tasks.length}`;

  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('chat.planBoard', 'Plan board')}
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            {activePlan.goal}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'text-xs px-2 py-1 rounded-md border',
              planStatusClass(activePlan.status)
            )}
          >
            {activePlan.status}
          </span>
          <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground border border-border">
            {planProgress}
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {activePlan.tasks.map((task, index) => (
          <div
            key={task.id}
            className={clsx(
              'rounded-lg border p-2.5 transition-colors',
              activePlan.currentTaskIndex === index &&
                activePlan.status === 'running'
                ? 'border-primary/40 bg-primary/5'
                : 'border-border bg-background/60'
            )}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">{taskStatusIcon(task.status)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground font-medium leading-tight">
                  {index + 1}. {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}
                {task.notes && (
                  <p className="text-xs text-muted-foreground mt-1.5 border-l-2 border-border pl-2">
                    {task.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onExecutePlan}
          disabled={
            isStreaming ||
            isExecutingPlan ||
            activePlan.status === 'running' ||
            activePlan.tasks.length === 0
          }
          className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors min-h-10',
            isStreaming ||
              isExecutingPlan ||
              activePlan.status === 'running' ||
              activePlan.tasks.length === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30'
          )}
        >
          {isExecutingPlan ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <PlayCircle className="w-3.5 h-3.5" />
          )}
          {isExecutingPlan
            ? t('chat.executingPlan', 'Executing plan...')
            : t('chat.executePlan', 'Execute plan')}
        </button>

        <button
          onClick={onClearPlan}
          disabled={isExecutingPlan}
          className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors min-h-10 border',
            isExecutingPlan
              ? 'bg-muted text-muted-foreground cursor-not-allowed border-border'
              : 'bg-card text-muted-foreground hover:text-foreground hover:bg-accent border-border'
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('chat.clearPlan', 'Clear plan')}
        </button>
      </div>
    </div>
  );
}
