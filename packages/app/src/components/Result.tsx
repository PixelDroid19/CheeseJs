import { useMemo } from 'react';
import { ResultDisplay as FrontendResultDisplay } from '@cheesejs/frontend';
import { useEditorTabsStore } from '../store/storeHooks';
import { useSettingsStore } from '../store/storeHooks';
import { themes } from '../themes';
import { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { ConsoleInput } from './ConsoleInput';
import { PackagePrompts } from './PackagePrompts';

function ResultDisplay() {
  const { tabs, activeTabId } = useEditorTabsStore();
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  );

  const elements = useMemo(() => activeTab?.result || [], [activeTab?.result]);
  const code = activeTab?.code || '';
  const {
    themeName,
    fontSize,
    alignResults,
    consoleFilters,
    setConsoleFilters,
  } = useSettingsStore();

  const toggleFilter = (type: keyof typeof consoleFilters) => {
    setConsoleFilters({ [type]: !consoleFilters[type] });
  };

  const filters = consoleFilters;

  function handleEditorWillMount(monaco: Monaco) {
    // Register all themes
    Object.entries(themes).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as editor.IStandaloneThemeData);
    });

    // Access typescript defaults safely through type casting
    interface TSDefaults {
      setEagerModelSync(value: boolean): void;
    }
    interface TSLanguages {
      javascriptDefaults?: TSDefaults;
    }
    const ts = (monaco.languages as unknown as { typescript: TSLanguages })
      .typescript;
    if (ts?.javascriptDefaults) {
      ts.javascriptDefaults.setEagerModelSync(true);
    }
  }

  return (
    <FrontendResultDisplay
      elements={elements}
      code={code}
      themeName={themeName}
      fontSize={fontSize}
      alignResults={alignResults}
      consoleFilters={filters}
      onToggleFilter={toggleFilter}
      onEditorWillMount={handleEditorWillMount}
      consoleInput={<ConsoleInput />}
      packagePrompts={<PackagePrompts />}
    />
  );
}

export default ResultDisplay;
