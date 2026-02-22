import clsx from 'clsx';
import { Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AgentExecutionMode } from '../../store/storeHooks';
import type { AgentProfile } from '../../features/ai-agent/agentProfiles';
import type { ToolPolicyPreset } from '../../features/ai-agent/toolPolicy';
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
  toolPolicyPreset: ToolPolicyPreset;
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
  onToolPolicyPresetChange: (
    preset: Exclude<ToolPolicyPreset, 'custom'>
  ) => void;
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
  toolPolicyPreset,
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
  onToolPolicyPresetChange,
  onToggleShowThinking,
  onUndoChange,
  onRedoChange,
  onToggleIncludeCode,
  onIndexCodebase,
  onGeneratePlan,
}: AIChatInputAreaProps) {
  const { t } = useTranslation();

  return (
    <div className="p-4 bg-muted/20 border-t border-border/40">
      <div className="flex flex-col rounded-xl border border-border/50 bg-card shadow-sm focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">

        <div className="flex items-end gap-3 p-3 pb-2">
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
            className="flex-1 resize-none bg-transparent border-none px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] max-h-40"
            style={{ height: 'auto' }}
          />
          <button
            onClick={isStreaming ? onCancel : onSend}
            disabled={(!input.trim() && !isStreaming) || !isConfigured}
            title={isStreaming ? t('chat.cancelGeneration', 'Cancel generation') : t('chat.send', 'Send')}
            aria-label={isStreaming ? t('chat.cancelGeneration', 'Cancel generation') : t('chat.send', 'Send')}
            className={clsx(
              'h-9 w-9 shrink-0 flex items-center justify-center rounded-lg transition-all',
              (!input.trim() && !isStreaming) || !isConfigured
                ? 'bg-transparent text-muted-foreground/40 cursor-not-allowed'
                : isStreaming
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
            )}
          >
            {isStreaming ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <svg
                className="w-4 h-4 translate-x-[2px] translate-y-[-1px]"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <filter id="send-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.2" floodColor="currentColor" />
                  </filter>
                </defs>
                {/* Left wing */}
                <path d="M22 2L2 11L10.5 13L22 2Z" fill="currentColor" fillOpacity="0.6" filter="url(#send-shadow)" />
                {/* Right wing */}
                <path d="M22 2L10.5 13L13 21L22 2Z" fill="currentColor" fillOpacity="0.9" filter="url(#send-shadow)" />
                {/* Inner shadow/fold */}
                <path d="M10.5 13L13 21L12.2 14.5L10.5 13Z" fill="white" fillOpacity="0.2" />
              </svg>
            )}
          </button>
        </div>

        <div className="px-3 pb-3">
          <AIComposerControls
            executionMode={executionMode}
            onExecutionModeChange={onExecutionModeChange}
            agentProfile={agentProfile}
            onAgentProfileChange={onAgentProfileChange}
            toolPolicyPreset={toolPolicyPreset}
            onToolPolicyPresetChange={onToolPolicyPresetChange}
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
        </div>

      </div>

      <p className="text-[10px] text-muted-foreground mt-2 text-center opacity-70">
        {t('chat.hint', 'Press Enter to send, Shift+Enter for new line')}
      </p>
    </div>
  );
}
