import { SnippetsTab as SettingsSnippetsTab } from '@cheesejs/settings';
import { useSnippetsStore, Snippet } from '../../../store/storeHooks';
import { useEditorTabsStore } from '../../../store/storeHooks';
import { useSettingsStore } from '../../../store/storeHooks';

export function SnippetsTab() {
  const { snippets, addSnippet, removeSnippet, updateSnippet } =
    useSnippetsStore();
  const { tabs, activeTabId, updateTabCode } = useEditorTabsStore();
  const { toggleSettings } = useSettingsStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const currentCode = activeTab?.code || '';

  return (
    <SettingsSnippetsTab
      snippets={snippets}
      currentCode={currentCode}
      addSnippet={addSnippet}
      removeSnippet={removeSnippet}
      updateSnippet={updateSnippet}
      onLoadSnippet={(snippet: Snippet) => {
        if (activeTabId) {
          updateTabCode(activeTabId, snippet.code);
        }
        toggleSettings();
      }}
      onAppendSnippet={(snippet: Snippet) => {
        if (activeTabId) {
          updateTabCode(activeTabId, `${currentCode}\n${snippet.code}`);
        }
        toggleSettings();
      }}
    />
  );
}
