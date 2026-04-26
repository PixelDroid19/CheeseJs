import { useMemo, type ReactNode } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { Filter } from 'lucide-react';
import clsx from 'clsx';

export interface RuntimeConsoleFilters {
  error: boolean;
  info: boolean;
  log: boolean;
  warn: boolean;
}

export interface RuntimeResultEntry {
  action?: {
    payload: string;
    type: string;
  };
  element?: {
    consoleType?: 'dir' | 'error' | 'info' | 'log' | 'table' | 'warn';
    content?: string | number | boolean | object | null;
  };
  lineNumber?: number;
  type: 'error' | 'execution';
}

export interface ResultPanelProps {
  alignResults: boolean;
  code: string;
  consoleFilters: RuntimeConsoleFilters;
  consoleInput?: ReactNode;
  elements: RuntimeResultEntry[];
  fontSize: number;
  onEditorWillMount?: (monaco: Monaco) => void;
  onToggleFilter: (type: keyof RuntimeConsoleFilters) => void;
  packagePrompts?: ReactNode;
  themeName: string;
  waitingMessage?: string;
}

/**
 * Read-only runtime output panel with filter controls and prompt slots.
 */
export function ResultPanel({
  alignResults,
  code,
  consoleFilters,
  consoleInput,
  elements,
  fontSize,
  onEditorWillMount,
  onToggleFilter,
  packagePrompts,
  themeName,
  waitingMessage = '// Waiting for output...',
}: ResultPanelProps) {
  const displayValue = useMemo(() => {
    if (elements.length === 0) {
      return '';
    }

    const filteredElements = elements.filter((entry) => {
      if (entry.action) {
        return false;
      }

      if (entry.type === 'error') {
        return consoleFilters.error;
      }

      const consoleType = entry.element?.consoleType || 'log';
      if (consoleType === 'warn') {
        return consoleFilters.warn;
      }
      if (consoleType === 'error') {
        return consoleFilters.error;
      }
      if (consoleType === 'info') {
        return consoleFilters.info;
      }

      return consoleFilters.log;
    });

    if (!alignResults) {
      return filteredElements
        .map((entry) => String(entry.element?.content || ''))
        .join('\n');
    }

    const sourceLineCount = code.split('\n').length;
    const maxLine = Math.max(
      sourceLineCount,
      ...filteredElements.map((entry) => entry.lineNumber || 0)
    );
    const lines = new Array(maxLine).fill('');

    filteredElements.forEach((entry) => {
      const content = String(entry.element?.content || '');

      if (entry.lineNumber && entry.lineNumber > 0) {
        const current = lines[entry.lineNumber - 1];
        lines[entry.lineNumber - 1] = current
          ? `${current} ${content}`
          : content;
        return;
      }

      lines.push(content);
    });

    return lines.join('\n');
  }, [alignResults, code, consoleFilters, elements]);

  return (
    <div
      className="h-full flex flex-col text-foreground bg-background relative overflow-hidden"
      data-testid="result-panel"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="mr-2 flex items-center text-muted-foreground">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs font-medium">Filters:</span>
          </div>

          <FilterToggle
            active={consoleFilters.log}
            onClick={() => onToggleFilter('log')}
            label="Log"
            count={
              elements.filter(
                (entry) =>
                  !entry.action &&
                  (entry.element?.consoleType === 'log' ||
                    (!entry.element?.consoleType && entry.type !== 'error'))
              ).length
            }
          />
          <FilterToggle
            active={consoleFilters.info}
            onClick={() => onToggleFilter('info')}
            label="Info"
            color="text-info"
            count={
              elements.filter((entry) => entry.element?.consoleType === 'info')
                .length
            }
          />
          <FilterToggle
            active={consoleFilters.warn}
            onClick={() => onToggleFilter('warn')}
            label="Warn"
            color="text-amber-500"
            count={
              elements.filter((entry) => entry.element?.consoleType === 'warn')
                .length
            }
          />
          <FilterToggle
            active={consoleFilters.error}
            onClick={() => onToggleFilter('error')}
            label="Error"
            color="text-destructive"
            count={
              elements.filter(
                (entry) =>
                  entry.type === 'error' ||
                  entry.element?.consoleType === 'error'
              ).length
            }
          />
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <Editor
          theme={themeName}
          path="result-output.js"
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
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
          value={displayValue || waitingMessage}
          beforeMount={onEditorWillMount}
        />
      </div>

      {consoleInput}

      {packagePrompts}
    </div>
  );
}

function FilterToggle({
  active,
  count,
  color,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  color?: string;
  label: string;
  onClick: () => void;
}) {
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
