import { useRef, useEffect } from 'react';
import { useCodeStore } from '../store/useCodeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Terminal, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export function ConsolePanel() {
  const { t } = useTranslation();
  const elements = useCodeStore((state) => state.result);
  const clearResult = useCodeStore((state) => state.clearResult);
  const { showConsole, setShowConsole, fontSize } = useSettingsStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [elements]);

  if (!showConsole) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[40] bg-background border-t border-border shadow-2xl flex flex-col h-64">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('console.title', 'Console')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearResult}
            className="p-1.5 hover:bg-muted rounded text-muted-foreground transition-colors"
            title={t('console.clear', 'Clear Console')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowConsole(false)}
            className="p-1.5 hover:bg-muted rounded text-muted-foreground transition-colors"
            title={t('console.close', 'Close Console')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Console Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono selection:bg-primary/30"
        style={{ fontSize: Math.max(12, fontSize - 2) }}
      >
        {elements.length === 0 ? (
          <div className="text-muted-foreground/50 italic flex items-center justify-center h-full">
            {t('console.empty', 'No output yet...')}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {elements.map((el, i) => (
              <div
                key={i}
                className={clsx(
                  'py-0.5 border-l-2 pl-3 transition-colors',
                  el.type === 'error'
                    ? 'border-destructive/50 bg-destructive/5'
                    : el.element?.consoleType === 'warn'
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : el.element?.consoleType === 'info'
                        ? 'border-blue-500/50 bg-blue-500/5'
                        : 'border-transparent hover:bg-muted/30'
                )}
              >
                <div className="flex items-start gap-3">
                  {el.lineNumber && (
                    <span className="text-[10px] text-muted-foreground/40 mt-1 w-8 text-right shrink-0">
                      L{el.lineNumber}
                    </span>
                  )}
                  <div
                    className={clsx(
                      'whitespace-pre-wrap break-all leading-relaxed',
                      el.type === 'error'
                        ? 'text-destructive'
                        : el.element?.consoleType === 'warn'
                          ? 'text-amber-500'
                          : el.element?.consoleType === 'info'
                            ? 'text-blue-400'
                            : 'text-foreground/90'
                    )}
                  >
                    {typeof el.element?.content === 'object'
                      ? JSON.stringify(el.element.content, null, 2)
                      : String(el.element?.content || '')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
