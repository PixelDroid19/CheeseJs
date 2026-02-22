// Tool Invocation UI Components for AI Agent
// Shows when the agent executes tools and handles approval requests
import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Play,
  Code,
  FileText,
  Edit,
  Search,
  FolderOpen,
  Database,
  Trash2,
  FilePlus2,
  Check,
  X,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type {
  ToolInvocation,
  ToolInvocationState,
} from '../../features/ai-agent/codeAgent';

interface ToolInvocationUIProps {
  invocation: ToolInvocation;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}

// Get icon for tool - returns a React element to avoid static component lint issue
function getToolIcon(toolName: string): React.ReactNode {
  const iconClass = 'w-3.5 h-3.5';
  switch (toolName) {
    case 'executeCode':
      return <Play className={iconClass} />;
    case 'readEditorContent':
      return <FileText className={iconClass} />;
    case 'getSelectedCode':
      return <Code className={iconClass} />;
    case 'insertCode':
      return <Edit className={iconClass} />;
    case 'replaceSelection':
      return <Edit className={iconClass} />;
    case 'analyzeCode':
      return <Search className={iconClass} />;
    case 'readFile':
      return <FileText className={iconClass} />;
    case 'writeFile':
      return <FilePlus2 className={iconClass} />;
    case 'listFiles':
      return <FolderOpen className={iconClass} />;
    case 'searchInFiles':
      return <Search className={iconClass} />;
    case 'searchDocumentation':
      return <Database className={iconClass} />;
    case 'deleteFile':
      return <Trash2 className={iconClass} />;
    case 'getWorkspacePath':
      return <FolderOpen className={iconClass} />;
    default:
      return <Code className={iconClass} />;
  }
}

// Get human-readable tool name
function getToolLabel(toolName: string): string {
  switch (toolName) {
    case 'executeCode':
      return 'Execute Code';
    case 'readEditorContent':
      return 'Read Editor';
    case 'getSelectedCode':
      return 'Get Selection';
    case 'insertCode':
      return 'Insert Code';
    case 'replaceSelection':
      return 'Replace Code';
    case 'analyzeCode':
      return 'Analyze Code';
    case 'readFile':
      return 'Read File';
    case 'writeFile':
      return 'Write File';
    case 'listFiles':
      return 'List Files';
    case 'searchInFiles':
      return 'Search Files';
    case 'searchDocumentation':
      return 'Search Docs';
    case 'deleteFile':
      return 'Delete File';
    case 'getWorkspacePath':
      return 'Workspace Path';
    default:
      return toolName;
  }
}

// Get state indicator
function getStateIndicator(state: ToolInvocationState) {
  switch (state) {
    case 'pending':
      return { icon: Loader2, color: 'text-muted-foreground', animate: true };
    case 'running':
      return { icon: Loader2, color: 'text-primary', animate: true };
    case 'approval-requested':
      return { icon: AlertCircle, color: 'text-primary', animate: false };
    case 'approved':
      return { icon: Check, color: 'text-primary', animate: false };
    case 'denied':
      return { icon: X, color: 'text-destructive', animate: false };
    case 'completed':
      return { icon: Check, color: 'text-primary', animate: false };
    case 'error':
      return { icon: AlertCircle, color: 'text-destructive', animate: false };
    default:
      return { icon: Loader2, color: 'text-muted-foreground', animate: false };
  }
}

export function ToolInvocationCard({
  invocation,
  onApprove,
  onDeny,
}: ToolInvocationUIProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const toolIcon = getToolIcon(invocation.toolName);
  const stateIndicator = getStateIndicator(invocation.state);
  const StateIcon = stateIndicator.icon;
  const needsApproval = invocation.state === 'approval-requested';
  const iconTone = needsApproval
    ? 'text-primary bg-primary/10'
    : invocation.state === 'error' || invocation.state === 'denied'
      ? 'text-destructive bg-destructive/10'
      : invocation.state === 'completed' || invocation.state === 'approved'
        ? 'text-primary bg-primary/10'
        : 'text-muted-foreground bg-muted';

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'rounded-lg border overflow-hidden',
        needsApproval
          ? 'border-primary/30 bg-primary/5'
          : invocation.state === 'error'
            ? 'border-destructive/30 bg-destructive/5'
            : 'border-border bg-muted/30'
      )}
    >
      {/* Header */}
      <button
        type="button"
        className={clsx(
          'w-full text-left flex items-center gap-2 px-3 py-3 min-h-11 hover:bg-muted/50 transition-colors',
          needsApproval && 'bg-primary/10'
        )}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={`tool-details-${invocation.id}`}
        aria-label={t(
          'chat.toolToggleDetails',
          `Toggle details for ${getToolLabel(invocation.toolName)}`
        )}
      >
        <div className={clsx('p-1 rounded', iconTone)}>{toolIcon}</div>

        <span className="flex-1 text-sm font-medium text-foreground">
          {getToolLabel(invocation.toolName)}
        </span>

        <StateIcon
          className={clsx(
            'w-4 h-4',
            stateIndicator.color,
            stateIndicator.animate && 'animate-spin'
          )}
        />

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            id={`tool-details-${invocation.id}`}
            className="border-t border-border"
          >
            <div className="p-3 space-y-2">
              {/* Input */}
              {Boolean(
                invocation.input && Object.keys(invocation.input).length > 0
              ) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('chat.inputLabel', 'Input')}:
                    </p>
                    <pre className="text-xs text-foreground/90 bg-background rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                      {JSON.stringify(invocation.input, null, 2)}
                    </pre>
                  </div>
                )}

              {/* Output */}
              {invocation.output !== undefined &&
                invocation.output !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('chat.outputLabel', 'Output')}:
                    </p>
                    <pre className="text-xs text-foreground/90 bg-background rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                      {typeof invocation.output === 'string'
                        ? invocation.output
                        : JSON.stringify(invocation.output, null, 2)}
                    </pre>
                  </div>
                )}

              {/* Error */}
              {invocation.error && (
                <div>
                  <p className="text-xs text-destructive mb-1">
                    {t('chat.errorLabel', 'Error')}:
                  </p>
                  <pre className="text-xs bg-destructive/10 text-destructive rounded p-2 overflow-x-auto">
                    {invocation.error}
                  </pre>
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Approval Buttons */}
      {needsApproval && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-primary/20 bg-primary/5">
          <p className="flex-1 text-xs text-foreground">
            {invocation.approval?.message ||
              t('chat.modifyCodeWarning', 'This action will modify your code')}
          </p>
          <button
            type="button"
            onClick={() => onDeny?.(invocation.id)}
            className={clsx(
              'px-3 py-2 rounded text-xs font-medium transition-colors min-h-9',
              'bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive'
            )}
          >
            {t('chat.deny', 'Deny')}
          </button>
          <button
            type="button"
            onClick={() => onApprove?.(invocation.id)}
            className={clsx(
              'px-3 py-2 rounded text-xs font-medium transition-colors min-h-9',
              'bg-primary/15 hover:bg-primary/25 text-primary'
            )}
          >
            {t('chat.approve', 'Approve')}
          </button>
        </div>
      )}
    </m.div>
  );
}

// Code Preview for approval
interface CodePreviewProps {
  code: string;
  language?: string;
  description?: string;
}

export function CodePreview({
  code,
  language = 'typescript',
  description,
}: CodePreviewProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {description && (
        <div className="px-3 py-2 bg-muted/50 border-b border-border">
          <p className="text-xs text-foreground">{description}</p>
        </div>
      )}
      <div className="px-3 py-1.5 bg-muted/30 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">
          {language}
        </span>
        <span className="text-xs text-muted-foreground">
          {code.split('\n').length} lines
        </span>
      </div>
      <pre className="p-3 text-xs overflow-x-auto max-h-48 overflow-y-auto bg-background">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

// Approval Dialog
interface ApprovalDialogProps {
  isOpen: boolean;
  toolName: string;
  input: Record<string, unknown>;
  onApprove: () => void;
  onDeny: () => void;
}

export function ApprovalDialog({
  isOpen,
  toolName,
  input,
  onApprove,
  onDeny,
}: ApprovalDialogProps) {
  if (!isOpen) return null;

  const code = (input.code || input.newCode) as string | undefined;
  const description = input.description as string | undefined;

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onDeny}
    >
      <m.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg mx-4 rounded-xl bg-background border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary/5">
          <div className="p-2 rounded-full bg-primary/15">
            <AlertCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Approval Required</h3>
            <p className="text-sm text-muted-foreground">
              The AI wants to{' '}
              {toolName === 'insertCode' ? 'insert code' : 'modify your code'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {description && (
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-sm text-foreground">{description}</p>
            </div>
          )}

          {code && (
            <CodePreview
              code={code}
              description={
                toolName === 'insertCode' ? 'Code to insert:' : 'New code:'
              }
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-border bg-muted/20">
          <button
            onClick={onDeny}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive'
            )}
          >
            Deny
          </button>
          <button
            onClick={onApprove}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-primary hover:bg-primary/90 text-primary-foreground'
            )}
          >
            Approve & Apply
          </button>
        </div>
      </m.div>
    </m.div>
  );
}
