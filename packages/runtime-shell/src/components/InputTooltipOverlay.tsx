import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CodeRunner } from '@cheesejs/core';

interface InputRequest {
  id: string;
  prompt: string;
  line: number;
  requestId?: string;
}

export interface InputTooltipOverlayProps {
  codeRunner?: Pick<
    CodeRunner,
    'onInputRequest' | 'onResult' | 'sendInputResponse'
  >;
  getLineTop?: (line: number) => number | null;
}

/**
 * Floating input tooltip used for Python `input()` requests.
 */
export function InputTooltipOverlay({
  codeRunner,
  getLineTop,
}: InputTooltipOverlayProps) {
  const { t } = useTranslation();
  const [request, setRequest] = useState<InputRequest | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const currentExecutionIdRef = useRef<string | null>(null);

  const clearRequest = useCallback(() => {
    setRequest(null);
    setValue('');
    currentExecutionIdRef.current = null;
  }, []);

  useEffect(() => {
    const unsubscribeInput = codeRunner?.onInputRequest((incomingRequest) => {
      if (
        currentExecutionIdRef.current &&
        currentExecutionIdRef.current !== incomingRequest.id
      ) {
        clearRequest();
      }

      currentExecutionIdRef.current = incomingRequest.id;
      setRequest({
        id: incomingRequest.id,
        prompt:
          incomingRequest.data.prompt ||
          t('input.defaultPrompt', 'Enter value:'),
        line: incomingRequest.data.line,
        requestId: incomingRequest.data.requestId,
      });
      setValue('');
    });

    const unsubscribeResult = codeRunner?.onResult((result) => {
      if (
        currentExecutionIdRef.current &&
        result.id === currentExecutionIdRef.current &&
        (result.type === 'complete' || result.type === 'error')
      ) {
        clearRequest();
      }
    });

    return () => {
      unsubscribeInput?.();
      unsubscribeResult?.();
    };
  }, [clearRequest, codeRunner, t]);

  useEffect(() => {
    if (request && inputRef.current) {
      inputRef.current.focus();
    }
  }, [request]);

  const handleSubmit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      if (request) {
        codeRunner?.sendInputResponse(request.id, value, request.requestId);
        clearRequest();
      }
    },
    [clearRequest, codeRunner, request, value]
  );

  const handleCancel = useCallback(() => {
    if (request) {
      codeRunner?.sendInputResponse(request.id, '', request.requestId);
      clearRequest();
    }
  }, [clearRequest, codeRunner, request]);

  const position = (() => {
    if (!request || !getLineTop) {
      return { top: 100, left: 50 };
    }

    const lineTop = getLineTop(request.line);
    if (lineTop === null) {
      return { top: 100, left: 50 };
    }

    return {
      top: lineTop + 24,
      left: 50,
    };
  })();

  return (
    <AnimatePresence>
      {request && (
        <m.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="fixed z-100 rounded-lg border border-border bg-card p-4 shadow-2xl"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            minWidth: '320px',
            maxWidth: '500px',
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="px-2 py-1 rounded text-xs font-mono font-semibold bg-primary text-primary-foreground">
              input()
            </span>
            <span className="text-sm font-medium text-foreground">
              {request.prompt}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSubmit();
                } else if (event.key === 'Escape') {
                  handleCancel();
                }
              }}
              placeholder={t('input.placeholder', 'Enter a value...')}
              className="flex-1 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-input border border-border text-foreground"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="px-3 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              title={t('input.submit', 'Submit')}
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-2 rounded bg-muted text-muted-foreground hover:opacity-80 transition-opacity"
              title={t('input.cancel', 'Cancel')}
            >
              <X className="w-4 h-4" />
            </button>
          </form>

          <div className="text-xs mt-2 text-muted-foreground opacity-70">
            {t('input.hint', 'Press Enter to submit, Escape to cancel')}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
