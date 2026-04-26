import { useMemo } from 'react';
import {
  createNpmPackageBridge,
  createPythonPackageBridge,
  PackagePrompts,
} from '@cheesejs/package-management';
import { ResultPanel } from '@cheesejs/runtime-shell';
import {
  useEditorTabsStore,
  usePackagesStore,
  usePythonPackagesStore,
  useSettingsStore,
} from '../store/storeHooks';
import { themes } from '../themes';
import { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { ConsoleInput } from './ConsoleInput';

const npmBridge = createNpmPackageBridge(() => window.packageManager);
const pythonBridge = createPythonPackageBridge(
  () => window.pythonPackageManager
);

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
  const npmStore = usePackagesStore();
  const pythonStore = usePythonPackagesStore();

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
    <ResultPanel
      elements={elements}
      code={code}
      themeName={themeName}
      fontSize={fontSize}
      alignResults={alignResults}
      consoleFilters={filters}
      onToggleFilter={toggleFilter}
      onEditorWillMount={handleEditorWillMount}
      consoleInput={<ConsoleInput />}
      packagePrompts={
        <PackagePrompts
          elements={elements}
          npmBridge={npmBridge}
          npmStore={npmStore}
          pythonBridge={pythonBridge}
          pythonStore={pythonStore}
        />
      }
    />
  );
}

export default ResultDisplay;
