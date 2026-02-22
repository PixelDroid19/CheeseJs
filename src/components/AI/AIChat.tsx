import { m, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { AIChatHeader } from './AIChatHeader';
import { AIChatMessagesArea } from './AIChatMessagesArea';
import { AIChatInputArea } from './AIChatInputArea';
import { DiffView } from './DiffView';
import { CloudWarningDialog } from './CloudWarningDialog';
import { ApprovalDialog } from './ToolInvocationUI';
import { useAIChatController } from './hooks/useAIChatController';

export function AIChat() {
  const { t } = useTranslation();
  const {
    input,
    includeCode,
    toolInvocations,
    pendingApproval,
    cloudWarning,
    lastError,
    lastFailedPrompt,
    isExecutingPlan,
    messagesEndRef,
    textAreaRef,
    messages,
    isStreaming,
    currentStreamingContent,
    isChatOpen,
    agentPhase,
    thinkingMessage,
    pendingChange,
    activePlan,
    showThinking,
    appliedChanges,
    redoChanges,
    enableChat,
    executionMode,
    agentProfile,
    toolPolicyPreset,
    isConfigured,
    provider,
    estimatedContextTokens,
    setExecutionMode,
    setAgentProfile,
    setToolPolicyPreset,
    setShowThinking,
    setChatOpen,
    toggleChat,
    clearActivePlan,
    handleSend,
    handleCancelGeneration,
    handleUndoChange,
    handleRedoChange,
    handleGeneratePlan,
    handleExecutePlan,
    handleInputChange,
    handleKeyDown,
    handleApprove,
    handleDeny,
    handleInsertCode,
    handleIndexCodebase,
    handleNewConversation,
    handleAcceptPendingChange,
    handleRejectPendingChange,
    handleCloudConfirm,
    handleCloudCancel,
    handleEnableLocalMode,
    setIncludeCode,
  } = useAIChatController();

  if (!enableChat) return null;

  return (
    <>
      <m.button
        onClick={toggleChat}
        data-testid="toggle-chat"
        aria-label={t('settings.ai.chatPanel', 'AI Chat Panel')}
        className={clsx(
          'fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          isChatOpen && 'opacity-0 pointer-events-none'
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageSquare className="w-5 h-5" />
      </m.button>

      <AnimatePresence>
        {isChatOpen && (
          <m.div
            initial={{ opacity: 0, x: 200, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 200, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-4 bottom-4 top-16 w-[420px] max-w-[calc(100vw-1.5rem)] z-50 flex flex-col rounded-xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] overflow-hidden bg-background border border-border/50"
          >
            <AIChatHeader
              onNewConversation={handleNewConversation}
              onClose={() => setChatOpen(false)}
            />

            <AIChatMessagesArea
              messages={messages}
              isStreaming={isStreaming}
              currentStreamingContent={currentStreamingContent}
              agentPhase={agentPhase}
              thinkingMessage={thinkingMessage}
              lastError={lastError}
              lastFailedPrompt={lastFailedPrompt}
              isConfigured={isConfigured}
              activePlan={activePlan}
              isExecutingPlan={isExecutingPlan}
              toolInvocations={toolInvocations}
              messagesEndRef={messagesEndRef}
              onRetryLast={(prompt) => void handleSend(prompt, false)}
              onQuickAction={(prompt) => void handleSend(prompt)}
              onExecutePlan={() => void handleExecutePlan()}
              onClearPlan={clearActivePlan}
              onInsertCode={handleInsertCode}
              onToolApprove={handleApprove}
              onToolDeny={handleDeny}
            />

            <AIChatInputArea
              input={input}
              textAreaRef={textAreaRef}
              isConfigured={isConfigured}
              isStreaming={isStreaming}
              isExecutingPlan={isExecutingPlan}
              includeCode={includeCode}
              executionMode={executionMode}
              agentProfile={agentProfile}
              toolPolicyPreset={toolPolicyPreset}
              estimatedContextTokens={estimatedContextTokens}
              showThinking={showThinking}
              appliedChangesCount={appliedChanges.length}
              redoChangesCount={redoChanges.length}
              onInputChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onSend={() => void handleSend()}
              onCancel={handleCancelGeneration}
              onExecutionModeChange={setExecutionMode}
              onAgentProfileChange={setAgentProfile}
              onToolPolicyPresetChange={setToolPolicyPreset}
              onToggleShowThinking={() => setShowThinking(!showThinking)}
              onUndoChange={handleUndoChange}
              onRedoChange={handleRedoChange}
              onToggleIncludeCode={() => setIncludeCode(!includeCode)}
              onIndexCodebase={() => void handleIndexCodebase()}
              onGeneratePlan={() => void handleGeneratePlan()}
            />
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingApproval && (
          <ApprovalDialog
            isOpen={true}
            toolName={pendingApproval.toolName}
            input={{ ...pendingApproval.input, description: pendingApproval.message }}
            onApprove={() => handleApprove(pendingApproval.id)}
            onDeny={() => handleDeny(pendingApproval.id)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingChange && (
          <DiffView
            change={pendingChange}
            onAccept={handleAcceptPendingChange}
            onReject={handleRejectPendingChange}
          />
        )}
      </AnimatePresence>

      <CloudWarningDialog
        isOpen={cloudWarning?.pending ?? false}
        providerName={
          provider === 'openai'
            ? 'OpenAI'
            : provider === 'anthropic'
              ? 'Anthropic'
              : provider === 'google'
                ? 'Google AI'
                : provider
        }
        sensitiveItems={cloudWarning?.sensitiveItems || []}
        onConfirm={handleCloudConfirm}
        onCancel={handleCloudCancel}
        onEnableLocalMode={handleEnableLocalMode}
      />
    </>
  );
}
