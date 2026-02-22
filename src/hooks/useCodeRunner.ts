import { useCallback, useEffect } from 'react';
import { useCodeStore, type CodeState } from '../store/useCodeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  getLanguageDisplayName,
} from '../store/useLanguageStore';
import { useAppStore } from '../store';

import { executionEngine } from '../lib/execution/ExecutionEngine';

export function useCodeRunner() {
  const code = useCodeStore((state: CodeState) => state.code);
  const setCode = useCodeStore((state: CodeState) => state.setCode);
  const setResult = useCodeStore((state: CodeState) => state.setResult);
  const appendResult = useCodeStore((state: CodeState) => state.appendResult);
  const clearResult = useCodeStore((state: CodeState) => state.clearResult);
  const setIsExecuting = useCodeStore(
    (state: CodeState) => state.setIsExecuting
  );
  const setPromptRequest = useCodeStore(
    (state: CodeState) => state.setPromptRequest
  );

  const { showTopLevelResults, loopProtection, showUndefined, magicComments } =
    useSettingsStore();

  // Cancel execution on unmount
  useEffect(() => {
    return () => {
      executionEngine.cancel();
    };
  }, []);

  // Listen for JS input requests (synchronous prompt)
  useEffect(() => {
    if (!window.codeRunner?.onJSInputRequest) return;

    const unsubscribe = window.codeRunner.onJSInputRequest((request) => {
      // Use custom UI prompt instead of native prompt (which is blocked/unsupported in Electron renderer)
      setPromptRequest(
        request.message,
        request.type === 'alert-request' ? 'alert' : 'text'
      );
    });

    return () => {
      unsubscribe();
    };
  }, [setPromptRequest]);

  const runCode = useCallback(
    async (codeToRun?: string) => {
      const debounceTimer = setTimeout(async () => {
        const sourceCode = codeToRun ?? code;

        // Cancel previous execution
        executionEngine.cancel();
        setPromptRequest(null);

        // Detect language
        const detectLanguage = useAppStore.getState().language.detectLanguage;
        const detected = detectLanguage(sourceCode);
        const currentLang = detected.monacoId;

        if (!useAppStore.getState().language.isExecutable(currentLang)) {
          setIsExecuting(false);
          setResult([
            {
              element: {
                content: `❌ Unsupported Language: ${getLanguageDisplayName(currentLang)}\n\nThis editor can execute JavaScript, TypeScript and Python code.\n\nDetected language: ${currentLang}\nSupported languages: javascript, typescript, python`,
              },
              type: 'error',
            },
          ]);
          return;
        }

        clearResult();
        setIsExecuting(true);

        const execLanguage = currentLang === 'python' ? 'python' : currentLang === 'typescript' ? 'typescript' : 'javascript';

        await executionEngine.run(
          sourceCode,
          execLanguage,
          {
            showUndefined,
            showTopLevelResults,
            loopProtection,
            magicComments,
          },
          {
            onOutput: (result) => {
              appendResult({
                lineNumber: result.lineNumber,
                element: {
                  content: result.content,
                  jsType: result.jsType,
                  consoleType: result.consoleType as any,
                },
                type: result.type,
              });
            },
            onError: (errorMsg) => {
              setResult([{ element: { content: errorMsg }, type: 'error' }]);
            },
            onComplete: (historyData) => {
              useAppStore.getState().history.addToHistory(historyData);
              setIsExecuting(false);
              setPromptRequest(null);
            },
          }
        );

        // Fallback for immediate errors where onComplete isn't called normally
        if (codeToRun !== undefined) {
          setCode(codeToRun);
        }
      }, 300);

      return () => clearTimeout(debounceTimer);
    },
    [
      setResult,
      setCode,
      appendResult,
      clearResult,
      setIsExecuting,
      code,
      showTopLevelResults,
      loopProtection,
      showUndefined,
      magicComments,
      setPromptRequest,
    ]
  );

  return {
    runCode,
  };
}
