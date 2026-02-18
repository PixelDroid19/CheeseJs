import { useState } from 'react';
import clsx from 'clsx';
import {
  ChevronDown,
  ChevronUp,
  Code,
  Database,
  Eye,
  EyeOff,
  ListChecks,
  Redo2,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AgentProfile } from '../../features/ai-agent/agentProfiles';

type ComposerExecutionMode = 'agent' | 'plan';

interface AIComposerControlsProps {
  executionMode: ComposerExecutionMode;
  onExecutionModeChange: (mode: ComposerExecutionMode) => void;
  agentProfile: AgentProfile;
  onAgentProfileChange: (profile: AgentProfile) => void;
  estimatedContextTokens: number;
  showThinking: boolean;
  onToggleShowThinking: () => void;
  appliedChangesCount: number;
  redoChangesCount: number;
  onUndoChange: () => void;
  onRedoChange: () => void;
  includeCode: boolean;
  onToggleIncludeCode: () => void;
  onIndexCodebase: () => void;
  onGeneratePlan: () => void;
  generatePlanDisabled: boolean;
}

export function AIComposerControls({
  executionMode,
  onExecutionModeChange,
  agentProfile,
  onAgentProfileChange,
  estimatedContextTokens,
  showThinking,
  onToggleShowThinking,
  appliedChangesCount,
  redoChangesCount,
  onUndoChange,
  onRedoChange,
  includeCode,
  onToggleIncludeCode,
  onIndexCodebase,
  onGeneratePlan,
  generatePlanDisabled,
}: AIComposerControlsProps) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('chat.modeLabel', 'Mode')}
        </span>

        <div className="flex rounded-md border border-border overflow-hidden bg-card">
          <button
            onClick={() => onExecutionModeChange('agent')}
            className={clsx(
              'px-3 py-2 text-xs min-h-10 transition-colors',
              executionMode === 'agent'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            {t('chat.modeAgent', 'Agent')}
          </button>
          <button
            onClick={() => onExecutionModeChange('plan')}
            className={clsx(
              'px-3 py-2 text-xs min-h-10 transition-colors border-l border-border',
              executionMode === 'plan'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            {t('chat.modePlan', 'Plan')}
          </button>
        </div>

        {executionMode === 'agent' && (
          <div className="flex rounded-md border border-border overflow-hidden bg-card">
            <button
              onClick={() => onAgentProfileChange('build')}
              className={clsx(
                'px-3 py-2 text-xs min-h-10 transition-colors',
                agentProfile === 'build'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {t('chat.profileBuild', 'Build')}
            </button>
            <button
              onClick={() => onAgentProfileChange('plan')}
              className={clsx(
                'px-3 py-2 text-xs min-h-10 transition-colors border-l border-border',
                agentProfile === 'plan'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {t('chat.profilePlan', 'Read-only')}
            </button>
          </div>
        )}

        <button
          onClick={onToggleIncludeCode}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded text-xs transition-colors min-h-10',
            includeCode
              ? 'bg-primary/15 text-primary border border-primary/30'
              : 'bg-card text-muted-foreground border border-border hover:border-primary/30'
          )}
        >
          <Code className="w-3 h-3" />
          <span>{t('chat.includeCode', 'Include code')}</span>
        </button>

        <button
          onClick={onGeneratePlan}
          disabled={generatePlanDisabled}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded text-xs min-h-10 border transition-colors',
            generatePlanDisabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed border-border'
              : 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
          )}
        >
          <ListChecks className="w-3 h-3" />
          <span>{t('chat.generatePlan', 'Generate plan')}</span>
        </button>

        <button
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-2 rounded text-xs min-h-10 border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          {showAdvanced ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <span>
            {showAdvanced
              ? t('chat.lessOptions', 'Less options')
              : t('chat.moreOptions', 'More options')}
          </span>
        </button>
      </div>

      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-md border border-border/70 bg-card/40">
          <span className="text-[10px] px-2 py-1 rounded-full bg-accent text-muted-foreground border border-border">
            {t('chat.contextTokens', 'ctx')} ~{estimatedContextTokens} tok
          </span>

          <button
            onClick={onToggleShowThinking}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded text-xs min-h-10 border transition-colors',
              showThinking
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-card text-muted-foreground border-border hover:border-primary/30'
            )}
          >
            {showThinking ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
            <span>
              {showThinking
                ? t('chat.hideThinking', 'Hide thinking')
                : t('chat.showThinking', 'Show thinking')}
            </span>
          </button>

          <button
            onClick={onUndoChange}
            disabled={appliedChangesCount === 0}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded text-xs min-h-10 border transition-colors',
              appliedChangesCount === 0
                ? 'bg-muted text-muted-foreground cursor-not-allowed border-border'
                : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
            )}
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('chat.undo', 'Undo')}</span>
          </button>

          <button
            onClick={onRedoChange}
            disabled={redoChangesCount === 0}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded text-xs min-h-10 border transition-colors',
              redoChangesCount === 0
                ? 'bg-muted text-muted-foreground cursor-not-allowed border-border'
                : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
            )}
          >
            <Redo2 className="w-3 h-3" />
            <span>{t('chat.redo', 'Redo')}</span>
          </button>

          <span className="text-[10px] px-2 py-1 rounded-md bg-card border border-border text-muted-foreground">
            {t('chat.history', 'History')}: {appliedChangesCount}/
            {redoChangesCount}
          </span>

          <button
            onClick={onIndexCodebase}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs min-h-10 bg-card text-muted-foreground border border-border hover:border-primary/30 transition-colors"
          >
            <Database className="w-3 h-3" />
            <span>{t('chat.knowledgeBase', 'Knowledge base')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
