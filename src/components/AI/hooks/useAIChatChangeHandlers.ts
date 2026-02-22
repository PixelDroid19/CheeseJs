import { useCallback } from 'react';
import type { PendingCodeChange } from '../../../store/storeHooks';

interface ChangeHandlersDeps {
  t: (key: string, fallback: string) => string;
  code: string;
  pendingChange: PendingCodeChange | null;
  setCode: (code: string) => void;
  undoAppliedChange: () => PendingCodeChange | null;
  redoAppliedChange: () => PendingCodeChange | null;
  pushAppliedChange: (change: PendingCodeChange) => void;
  clearPendingChange: () => void;
  addMessage: (message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    codeContext?: string;
  }) => void;
}

export function useAIChatChangeHandlers(deps: ChangeHandlersDeps) {
  const handleUndoChange = useCallback(() => {
    const change = deps.undoAppliedChange();
    if (!change) return;

    deps.setCode(change.originalCode);
    if (window.editor) {
      window.editor.setValue(change.originalCode);
    }

    deps.addMessage({
      role: 'system',
      content: deps.t('chat.revertedLastChange', 'Last change reverted.'),
    });
  }, [deps]);

  const handleRedoChange = useCallback(() => {
    const change = deps.redoAppliedChange();
    if (!change) return;

    deps.setCode(change.newCode);
    if (window.editor) {
      window.editor.setValue(change.newCode);
    }

    deps.addMessage({
      role: 'system',
      content: deps.t(
        'chat.redidLastChange',
        'Last reverted change applied again.'
      ),
    });
  }, [deps]);

  const handleAcceptPendingChange = useCallback(() => {
    if (!deps.pendingChange) return;

    const beforeCode = window.editor?.getValue() ?? deps.code;
    let afterCode = beforeCode;

    if (deps.pendingChange.action === 'replaceAll') {
      deps.setCode(deps.pendingChange.newCode);
      if (window.editor) {
        window.editor.setValue(deps.pendingChange.newCode);
      }
      afterCode = deps.pendingChange.newCode;
    } else if (deps.pendingChange.action === 'insert') {
      if (window.editor) {
        const position = window.editor.getPosition();
        if (position) {
          window.editor.executeEdits('ai-agent-diff', [
            {
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
              text: deps.pendingChange.newCode,
              forceMoveMarkers: true,
            },
          ]);
          afterCode = window.editor.getValue();
        }
      } else {
        afterCode = deps.code + '\n' + deps.pendingChange.newCode;
        deps.setCode(afterCode);
      }
    } else if (deps.pendingChange.action === 'replaceSelection') {
      if (window.editor) {
        const selection = window.editor.getSelection();
        if (selection) {
          window.editor.executeEdits('ai-agent-diff', [
            {
              range: selection,
              text: deps.pendingChange.newCode,
              forceMoveMarkers: true,
            },
          ]);
          afterCode = window.editor.getValue();
        }
      } else {
        afterCode = deps.pendingChange.newCode;
        deps.setCode(deps.pendingChange.newCode);
      }
    }

    deps.pushAppliedChange({
      action: 'replaceAll',
      originalCode: beforeCode,
      newCode: afterCode,
      description: deps.pendingChange.description || 'AI change applied to editor',
    });

    deps.addMessage({
      role: 'system',
      content: deps.t('chat.changeApplied', 'Change applied to editor.'),
    });

    deps.clearPendingChange();
  }, [deps]);

  const handleRejectPendingChange = useCallback(() => {
    deps.clearPendingChange();
  }, [deps]);

  return {
    handleUndoChange,
    handleRedoChange,
    handleAcceptPendingChange,
    handleRejectPendingChange,
  };
}
