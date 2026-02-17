// Monaco Code Action Provider for AI-powered refactoring
import type * as Monaco from 'monaco-editor';
import { aiService } from './aiService';
import { useAISettingsStore } from '../../store/useAISettingsStore';
import { useChatStore } from '../../store/useChatStore';

export interface AICodeAction {
  id: string;
  label: string;
  kind: string;
  action: 'explain' | 'refactor' | 'document' | 'fix' | 'chat';
}

// Track pending operations to show loading state
let pendingOperation: string | null = null;

// Execute AI action
export async function executeAIAction(
  editor: Monaco.editor.ICodeEditor,
  action: 'explain' | 'refactor' | 'document' | 'fix' | 'chat',
  selectedCode: string,
  language: string
): Promise<void> {
  const settings = useAISettingsStore.getState();

  // Check if configured
  if (!settings.getCurrentApiKey()) {
    console.warn('[AICodeActions] AI not configured');
    return;
  }

  // Configure service if needed
  if (!aiService.isReady()) {
    try {
      if (settings.provider === 'local') {
        const localCfg = settings.getLocalConfig();
        aiService.configure(settings.provider, '', '', {
          baseURL: localCfg.baseURL,
          modelId: localCfg.modelId,
        });
      } else {
        aiService.configure(
          settings.provider,
          settings.getCurrentApiKey(),
          settings.getCurrentModel()
        );
      }
    } catch (error) {
      console.error('[AICodeActions] Failed to configure AI:', error);
      return;
    }
  }

  pendingOperation = action;

  // Handle chat action - open chat panel with context
  if (action === 'chat') {
    const chatStore = useChatStore.getState();
    chatStore.setChatOpen(true);
    // Pre-fill with the selected code context
    chatStore.addMessage({
      role: 'user',
      content: `Please help me understand and work with this code:\n\n\`\`\`${language}\n${selectedCode}\n\`\`\``,
      codeContext: selectedCode,
    });

    // Stream the response
    try {
      chatStore.setStreaming(true);
      chatStore.setStreamingContent('');

      await aiService.refactorCode('explain', selectedCode, language, {
        onToken: (token) => {
          chatStore.appendStreamingContent(token);
        },
        onComplete: () => {
          chatStore.finalizeStreaming();
        },
        onError: (error) => {
          chatStore.addMessage({
            role: 'assistant',
            content: `Error: ${error.message}`,
          });
          chatStore.setStreaming(false);
        },
      });
    } catch (error) {
      console.error('[AICodeActions] Chat action failed:', error);
      chatStore.setStreaming(false);
    }

    pendingOperation = null;
    return;
  }

  // For refactor/document/fix, apply changes to editor
  try {
    const result = await aiService.refactorCode(action, selectedCode, language);

    // Extract code from response if wrapped in code blocks
    let newCode = result;
    const codeBlockMatch = result.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      newCode = codeBlockMatch[1];
    }

    // For 'explain' action, show in chat instead of replacing
    if (action === 'explain') {
      const chatStore = useChatStore.getState();
      chatStore.setChatOpen(true);
      chatStore.addMessage({
        role: 'assistant',
        content: result,
      });
      pendingOperation = null;
      return;
    }

    // Apply the edit
    const selection = editor.getSelection();
    if (selection) {
      editor.executeEdits('ai-refactor', [
        {
          range: selection,
          text: newCode.trim(),
          forceMoveMarkers: true,
        },
      ]);

      // Format the document after edit
      setTimeout(() => {
        editor.getAction('editor.action.formatDocument')?.run();
      }, 100);
    }
  } catch (error) {
    console.error(`[AICodeActions] ${action} failed:`, error);
    // Show error in chat
    const chatStore = useChatStore.getState();
    chatStore.setChatOpen(true);
    chatStore.addMessage({
      role: 'assistant',
      content: `Failed to ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  pendingOperation = null;
}

// Register AI actions to editor context menu and keybindings
export function registerAICodeActions(
  monaco: typeof Monaco,
  editor: Monaco.editor.IStandaloneCodeEditor
): Monaco.IDisposable[] {
  const disposables: Monaco.IDisposable[] = [];

  // Ctrl+Shift+E - Explain
  disposables.push(
    editor.addAction({
      id: 'ai.explain',
      label: 'AI: Explain Selection',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
      ],
      contextMenuGroupId: 'ai',
      contextMenuOrder: 1,
      precondition: 'editorHasSelection',
      run: async (ed) => {
        const selection = ed.getSelection();
        if (selection) {
          const model = ed.getModel();
          if (model) {
            const selectedCode = model.getValueInRange(selection);
            if (selectedCode.trim()) {
              await executeAIAction(
                ed,
                'explain',
                selectedCode,
                model.getLanguageId()
              );
            }
          }
        }
      },
    })
  );

  // Ctrl+Shift+R - Refactor
  disposables.push(
    editor.addAction({
      id: 'ai.refactor',
      label: 'AI: Refactor Selection',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR,
      ],
      contextMenuGroupId: 'ai',
      contextMenuOrder: 2,
      precondition: 'editorHasSelection',
      run: async (ed) => {
        const selection = ed.getSelection();
        if (selection) {
          const model = ed.getModel();
          if (model) {
            const selectedCode = model.getValueInRange(selection);
            if (selectedCode.trim()) {
              await executeAIAction(
                ed,
                'refactor',
                selectedCode,
                model.getLanguageId()
              );
            }
          }
        }
      },
    })
  );

  // Ctrl+Shift+D - Document
  disposables.push(
    editor.addAction({
      id: 'ai.document',
      label: 'AI: Add Documentation',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD,
      ],
      contextMenuGroupId: 'ai',
      contextMenuOrder: 3,
      precondition: 'editorHasSelection',
      run: async (ed) => {
        const selection = ed.getSelection();
        if (selection) {
          const model = ed.getModel();
          if (model) {
            const selectedCode = model.getValueInRange(selection);
            if (selectedCode.trim()) {
              await executeAIAction(
                ed,
                'document',
                selectedCode,
                model.getLanguageId()
              );
            }
          }
        }
      },
    })
  );

  // Alt+Shift+F - Fix (changed from Ctrl+Shift+F to avoid conflict with Find)
  disposables.push(
    editor.addAction({
      id: 'ai.fix',
      label: 'AI: Fix Issues',
      keybindings: [
        monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      ],
      contextMenuGroupId: 'ai',
      contextMenuOrder: 4,
      precondition: 'editorHasSelection',
      run: async (ed) => {
        const selection = ed.getSelection();
        if (selection) {
          const model = ed.getModel();
          if (model) {
            const selectedCode = model.getValueInRange(selection);
            if (selectedCode.trim()) {
              await executeAIAction(
                ed,
                'fix',
                selectedCode,
                model.getLanguageId()
              );
            }
          }
        }
      },
    })
  );

  // Ctrl+Shift+A - Ask AI (Chat)
  disposables.push(
    editor.addAction({
      id: 'ai.chat',
      label: 'AI: Ask About Selection',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA,
      ],
      contextMenuGroupId: 'ai',
      contextMenuOrder: 5,
      precondition: 'editorHasSelection',
      run: async (ed) => {
        const selection = ed.getSelection();
        if (selection) {
          const model = ed.getModel();
          if (model) {
            const selectedCode = model.getValueInRange(selection);
            if (selectedCode.trim()) {
              await executeAIAction(
                ed,
                'chat',
                selectedCode,
                model.getLanguageId()
              );
            }
          }
        }
      },
    })
  );

  return disposables;
}

export function isPendingOperation(): boolean {
  return pendingOperation !== null;
}

export function getPendingOperation(): string | null {
  return pendingOperation;
}
