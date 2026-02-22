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
import type { ToolPolicyPreset } from '../../features/ai-agent/toolPolicy';

type ComposerExecutionMode = 'agent' | 'plan';

interface AIComposerControlsProps {
  executionMode: ComposerExecutionMode;
  onExecutionModeChange: (mode: ComposerExecutionMode) => void;
  agentProfile: AgentProfile;
  onAgentProfileChange: (profile: AgentProfile) => void;
  toolPolicyPreset: ToolPolicyPreset;
  onToolPolicyPresetChange: (
    preset: Exclude<ToolPolicyPreset, 'custom'>
  ) => void;
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
  toolPolicyPreset,
  onToolPolicyPresetChange,
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
    <div className="flex flex-col gap-2.5 w-full">
      {/* Primary Row - Always Visible Tools */}
      <div className="flex flex-wrap items-center gap-2 pb-1">

        {/* Mode Selector */}
        <div className="flex items-center rounded-lg bg-muted/60 p-0.5">
          <button
            onClick={() => onExecutionModeChange('agent')}
            className={clsx(
              'px-2.5 py-1 text-[11px] font-medium rounded-md transition-all',
              executionMode === 'agent'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('chat.modeAgent', 'Agent')}
          </button>
          <button
            onClick={() => onExecutionModeChange('plan')}
            className={clsx(
              'px-2.5 py-1 text-[11px] font-medium rounded-md transition-all',
              executionMode === 'plan'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('chat.modePlan', 'Plan')}
          </button>
        </div>

        {/* Profile Selector (Only in Agent mode) */}
        {executionMode === 'agent' && (
          <div className="flex items-center rounded-lg bg-muted/60 p-0.5 ml-1">
            <button
              onClick={() => onAgentProfileChange('build')}
              className={clsx(
                'px-2.5 py-1 text-[11px] rounded-md transition-all',
                agentProfile === 'build'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('chat.profileBuild', 'Build')}
            </button>
            <button
              onClick={() => onAgentProfileChange('plan')}
              className={clsx(
                'px-2.5 py-1 text-[11px] rounded-md transition-all',
                agentProfile === 'plan'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('chat.profilePlan', 'Read-only')}
            </button>
          </div>
        )}

        {/* Include Context Toggle */}
        <button
          onClick={onToggleIncludeCode}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-all ml-auto',
            includeCode
              ? 'bg-primary/10 text-primary font-medium hover:bg-primary/20'
              : 'bg-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          )}
        >
          <Code className="w-3.5 h-3.5" />
          <span>{t('chat.includeCode', 'Code')}</span>
        </button>

        {/* Generate Plan Button */}
        <button
          onClick={onGeneratePlan}
          disabled={generatePlanDisabled}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-all',
            generatePlanDisabled
              ? 'opacity-50 cursor-not-allowed text-muted-foreground'
              : 'bg-primary/10 text-primary font-medium hover:bg-primary/20'
          )}
        >
          <ListChecks className="w-3.5 h-3.5" />
          <span>{t('chat.generatePlan', 'Plan')}</span>
        </button>

        <button
          onClick={() => setShowAdvanced((prev) => !prev)}
          className={clsx(
            "flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground",
            showAdvanced && "bg-muted/80 text-foreground"
          )}
          title={showAdvanced ? t('chat.lessOptions', 'Less options') : t('chat.moreOptions', 'More options')}
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Secondary Row - Advanced Options */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/40">

          <span className="text-[10px] flex items-center gap-1 text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">
            <span>Ctx:</span>
            <span className="font-medium text-foreground">{estimatedContextTokens}</span>
          </span>

          <div className="flex items-center rounded-lg bg-muted/40 p-0.5 border border-border/40">
            {(['standard', 'safe', 'readonly'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => onToolPolicyPresetChange(preset)}
                className={clsx(
                  'px-2 py-0.5 text-[10px] rounded transition-colors uppercase tracking-wider',
                  toolPolicyPreset === preset || (preset === 'readonly' && toolPolicyPreset === 'custom')
                    ? 'bg-background text-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {preset === 'readonly' && toolPolicyPreset === 'custom' ? 'CST' : preset.slice(0, 3)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={onToggleShowThinking}
              className={clsx(
                'flex items-center justify-center p-1.5 rounded-md transition-colors',
                showThinking
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              title={showThinking ? t('chat.hideThinking', 'Hide thinking') : t('chat.showThinking', 'Show thinking')}
            >
              {showThinking ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onUndoChange}
              disabled={appliedChangesCount === 0}
              className="flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              title={t('chat.undo', 'Undo')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onRedoChange}
              disabled={redoChangesCount === 0}
              className="flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              title={t('chat.redo', 'Redo')}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onIndexCodebase}
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Database className="w-3 h-3" />
              <span>{t('chat.knowledgeBase', 'Index')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
