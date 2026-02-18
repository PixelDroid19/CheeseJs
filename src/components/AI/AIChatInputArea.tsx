import clsx from 'clsx';
import { Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AgentExecutionMode } from '../../store/useAISettingsStore';
import type { AgentProfile } from '../../features/ai-agent/agentProfiles';
import { AIComposerControls } from './AIComposerControls';

interface AIChatInputAreaProps {
  input: string;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  isConfigured: boolean;
  isStreaming: boolean;
  isExecutingPlan: boolean;
  includeCode: boolean;
  executionMode: AgentExecutionMode;
  agentProfile: AgentProfile;
  estimatedContextTokens: number;
  showThinking: boolean;
  appliedChangesCount: number;
  redoChangesCount: number;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onCancel: () => void;
  onExecutionModeChange: (mode: AgentExecutionMode) => void;
  onAgentProfileChange: (profile: AgentProfile) => void;
  onToggleShowThinking: () => void;
  onUndoChange: () => void;
  onRedoChange: () => void;
  onToggleIncludeCode: () => void;
  onIndexCodebase: () => void;
  onGeneratePlan: () => void;
}

export function AIChatInputArea({
  input,
  textAreaRef,
  isConfigured,
  isStreaming,
  isExecutingPlan,
  includeCode,
  executionMode,
  agentProfile,
  estimatedContextTokens,
  showThinking,
  appliedChangesCount,
  redoChangesCount,
  onInputChange,
  onKeyDown,
  onSend,
  onCancel,
  onExecutionModeChange,
  onAgentProfileChange,
  onToggleShowThinking,
  onUndoChange,
  onRedoChange,
  onToggleIncludeCode,
  onIndexCodebase,
  onGeneratePlan,
}: AIChatInputAreaProps) {
  const { t } = useTranslation();

  return (
    <div className="p-3 border-t border-border bg-muted/40">
      <AIComposerControls
        executionMode={executionMode}
        onExecutionModeChange={onExecutionModeChange}
        agentProfile={agentProfile}
        onAgentProfileChange={onAgentProfileChange}
        estimatedContextTokens={estimatedContextTokens}
        showThinking={showThinking}
        onToggleShowThinking={onToggleShowThinking}
        appliedChangesCount={appliedChangesCount}
        redoChangesCount={redoChangesCount}
        onUndoChange={onUndoChange}
        onRedoChange={onRedoChange}
        includeCode={includeCode}
        onToggleIncludeCode={onToggleIncludeCode}
        onIndexCodebase={onIndexCodebase}
        onGeneratePlan={onGeneratePlan}
        generatePlanDisabled={
          executionMode !== 'plan' ||
          !input.trim() ||
          isStreaming ||
          !isConfigured ||
          isExecutingPlan
        }
      />

      <div className="flex items-end gap-2">
        <textarea
          ref={textAreaRef}
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          placeholder={
            isConfigured
              ? t('chat.placeholder', 'Ask about your code...')
              : t('chat.configureFirst', 'Configure AI in Settings first')
          }
          disabled={!isConfigured || isStreaming}
          rows={1}
          className="flex-1 resize-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed min-h-10 max-h-30"
          style={{ height: 'auto' }}
        />
        <button
          onClick={isStreaming ? onCancel : onSend}
          disabled={(!input.trim() && !isStreaming) || !isConfigured}
          aria-label={t('chat.placeholder', 'Ask about your code...')}
          className={clsx(
            'h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-md border transition-colors',
            (!input.trim() && !isStreaming) || !isConfigured
              ? 'bg-muted text-muted-foreground/60 border-border cursor-not-allowed'
              : isStreaming
                ? 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25'
                : 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
          )}
        >
          {isStreaming ? (
            <Square className="w-3.5 h-3.5" />
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        {t('chat.hint', 'Press Enter to send, Shift+Enter for new line')}
      </p>
    </div>
  );
}
