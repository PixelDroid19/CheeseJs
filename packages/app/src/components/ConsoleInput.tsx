import { ConsoleInputPanel } from '@cheesejs/runtime-shell';
import { useEditorTabsStore } from '../store/storeHooks';
import { hostBridge } from '../host/hostBridge';

export function ConsoleInput() {
  const { tabs, activeTabId, setTabPromptRequest } = useEditorTabsStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const promptRequest = activeTab?.promptRequest || null;
  const promptType = activeTab?.promptType || 'text';
  const promptExecutionId = activeTab?.promptExecutionId || null;

  return (
    <ConsoleInputPanel
      key={`${promptExecutionId ?? activeTabId ?? 'none'}:${promptType}:${promptRequest ?? ''}`}
      promptRequest={promptRequest}
      promptType={promptType}
      onSubmit={(input) => {
        const targetExecutionId = promptExecutionId || activeTabId;
        if (targetExecutionId) {
          hostBridge.codeRunner?.sendJSInputResponse(targetExecutionId, input);
        }
        if (activeTabId) setTabPromptRequest(activeTabId, null);
      }}
    />
  );
}
