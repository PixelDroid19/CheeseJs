import { useState, useRef, useEffect } from 'react';
import { useCodeStore } from '../store/storeHooks';
import { Send, Terminal, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

export function ConsoleInput() {
  const promptRequest = useCodeStore((state) => state.promptRequest);
  const promptType = useCodeStore((state) => state.promptType);
  const setPromptRequest = useCodeStore((state) => state.setPromptRequest);

  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (promptRequest) {
      // Small delay to ensure render and transition
      const timer = setTimeout(() => {
        if (promptType === 'alert') {
          buttonRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [promptRequest, promptType]);

  if (!promptRequest) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    window.codeRunner.sendJSInputResponse(input);
    setInput('');
    setPromptRequest(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isAlert = promptType === 'alert';

  return (
    <div
      className={clsx(
        'shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'p-3 pr-16 animate-in slide-in-from-bottom-2 duration-200'
      )}
    >
      <div
        className={clsx(
          'max-w-3xl mx-auto w-full rounded-md overflow-hidden border shadow-sm transition-colors',
          isAlert
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-primary/20 bg-muted/30'
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center p-2 gap-3">
          {/* Label / Prompt Text */}
          <div
            className={clsx(
              'flex items-center gap-2 text-sm font-medium min-w-0 shrink',
              isAlert ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
            )}
          >
            {isAlert ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Terminal className="w-4 h-4 shrink-0 text-muted-foreground" />
            )}
            <span
              className="break-words leading-tight"
              data-testid="prompt-message"
            >
              {promptRequest}
            </span>
          </div>

          {/* Input Area - ALWAYS RENDER FOR DEBUGGING */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="relative flex-1 flex items-center bg-background/50 rounded-sm border border-transparent focus-within:border-primary/20 focus-within:bg-background transition-all">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-primary font-bold select-none">
                ›
              </div>
              <input
                ref={inputRef}
                type="text"
                data-testid="console-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none text-sm font-mono focus:ring-0 pl-6 pr-8 py-1.5 placeholder:text-muted-foreground/40 text-foreground"
                placeholder=""
                autoComplete="off"
                autoFocus
              />
              <button
                onClick={() => handleSubmit()}
                data-testid="console-submit"
                className="absolute right-1 p-1 text-muted-foreground hover:text-primary transition-colors rounded-sm hover:bg-muted"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
