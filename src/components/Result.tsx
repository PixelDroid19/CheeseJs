import { useMemo } from 'react';
import { useEditorTabsStore } from '../store/storeHooks';
import { useSettingsStore } from '../store/storeHooks';
import { themes } from '../themes';
import Editor, { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Filter, Wrench } from 'lucide-react';
import clsx from 'clsx';
import { ConsoleInput } from './ConsoleInput';
import { PackagePrompts } from './PackagePrompts';

function ResultDisplay() {
  const { tabs, activeTabId } = useEditorTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);

  const elements = useMemo(() => activeTab?.result || [], [activeTab?.result]);
  const code = activeTab?.code || '';
  const {
    themeName,
    fontSize,
    alignResults,
    consoleFilters,
    setConsoleFilters,
  } = useSettingsStore();

  const executionError = useMemo(
    () =>
      elements?.find(
        (e) => e.type === 'error' || e.element?.consoleType === 'error'
      ),
    [elements]
  );

  const handleAutoFix = () => {
    const win = window as unknown as { triggerAIAutoCorrection?: (content: string) => void };
    if (
      executionError?.element?.content &&
      win.triggerAIAutoCorrection
    ) {
      win.triggerAIAutoCorrection(String(executionError.element.content));
    }
  };



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

  const displayValue = useMemo(() => {
    if (!elements || elements.length === 0) return '';

    // Filter elements based on type
    const filteredElements = elements.filter((e) => {
      if (e.action) return false; // Filter out actions (handled separately)

      if (e.type === 'error') return filters.error;

      // Handle console types
      const consoleType = e.element?.consoleType || 'log';
      if (consoleType === 'warn') return filters.warn;
      if (consoleType === 'error') return filters.error;
      if (consoleType === 'info') return filters.info;

      // Default to log
      return filters.log;
    });

    if (!alignResults) {
      return filteredElements
        .map((data) => data.element?.content || '')
        .join('\n');
    }

    // Align results with source (keep alignment for filtered items if they persist?
    // Actually if we filter out, we probably shouldn't show them at all,
    // but for 'align', we need to respect the line number.
    // If a line is filtered, it should be empty on that line.)

    // To maintain alignment, we iterate original lines, but only content from filtered elements.

    // Better approach: Use filteredElements.
    // If aligned mode is ON, and I filter out errors, the error on line 5 disappears, line 5 has no result.

    const sourceLineCount = code.split('\n').length;
    const maxLine = Math.max(
      sourceLineCount,
      ...filteredElements.map((e) => e.lineNumber || 0)
    );
    const lines = new Array(maxLine).fill('');

    filteredElements.forEach((data) => {
      if (data.lineNumber && data.lineNumber > 0) {
        // Line numbers are 1-based, array is 0-based
        const current = lines[data.lineNumber - 1];
        const content = data.element?.content || '';
        lines[data.lineNumber - 1] = current
          ? `${current} ${content}`
          : content;
      } else {
        // Append results without line numbers (like global errors) to the end
        lines.push(data.element?.content || '');
      }
    });

    // Trim empty lines at the end if they exceed source code
    // (Optional, but keeps it clean)
    return lines.join('\n');
  }, [elements, alignResults, code, filters]);



  return (
    <div
      className="h-full flex flex-col text-foreground bg-background relative overflow-hidden"
      data-testid="result-panel"
    >
      {/* Console Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="mr-2 flex items-center text-muted-foreground">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs font-medium">Filters:</span>
          </div>

          <FilterToggle
            active={filters.log}
            onClick={() => toggleFilter('log')}
            label="Log"
            count={
              elements.filter(
                (e) =>
                  !e.action &&
                  (e.element?.consoleType === 'log' ||
                    (!e.element?.consoleType && e.type !== 'error'))
              ).length
            }
          />
          <FilterToggle
            active={filters.info}
            onClick={() => toggleFilter('info')}
            label="Info"
            color="text-info"
            count={
              elements.filter((e) => e.element?.consoleType === 'info').length
            }
          />
          <FilterToggle
            active={filters.warn}
            onClick={() => toggleFilter('warn')}
            label="Warn"
            color="text-amber-500"
            count={
              elements.filter((e) => e.element?.consoleType === 'warn').length
            }
          />
          <FilterToggle
            active={filters.error}
            onClick={() => toggleFilter('error')}
            label="Error"
            color="text-destructive"
            count={
              elements.filter(
                (e) => e.type === 'error' || e.element?.consoleType === 'error'
              ).length
            }
          />
        </div>
        {executionError && (
          <button
            onClick={handleAutoFix}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-md transition-colors mr-2"
          >
            <Wrench className="w-3.5 h-3.5" />
            Auto-Fix
          </button>
        )}
      </div>

      <div className="flex-1 relative min-h-0">
        <Editor
          theme={themeName}
          path="result-output.js"
          options={{
            automaticLayout: true,
            minimap: {
              enabled: false,
            },
            overviewRulerLanes: 0,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
            },
            fontSize,
            wordWrap: 'on',
            readOnly: true,
            lineNumbers: 'off',
            renderLineHighlight: 'none',
            showUnused: false,
            suggest: {
              selectionMode: 'never',
              previewMode: 'prefix',
            },
          }}
          defaultLanguage="javascript"
          value={displayValue || '// Waiting for output...'}
          beforeMount={handleEditorWillMount}
        />
      </div>

      <ConsoleInput />

      <PackagePrompts />
    </div>
  );
}

export default ResultDisplay;

function FilterToggle({
  active,
  onClick,
  label,
  color,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  count: number;
}) {
  // Only show count if > 0
  const showCount = count > 0;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2 py-1 rounded text-xs font-medium border flex items-center gap-1.5 transition-all select-none',
        active
          ? 'bg-background border-border shadow-sm text-foreground'
          : 'bg-muted/50 border-transparent text-muted-foreground opacity-70 hover:opacity-100'
      )}
    >
      <div
        className={clsx(
          'w-2 h-2 rounded-full',
          active ? color || 'bg-foreground' : 'bg-muted-foreground/50'
        )}
      />
      {label}
      {showCount && (
        <span className="text-[10px] opacity-60 bg-muted px-1 rounded-sm min-w-[14px] text-center">
          {count}
        </span>
      )}
    </button>
  );
}
