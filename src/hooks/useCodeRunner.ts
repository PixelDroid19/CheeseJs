import { useEditorTabsStore, useSettingsStore, getLanguageDisplayName } from '../store/storeHooks';
import { useAppStore } from '../store/index';
import { executionEngine } from '../lib/execution/ExecutionEngine';
import { useEffect, useCallback } from 'react';

export function useCodeRunner() {
  const { setTabPromptRequest } = useEditorTabsStore();

  const { showTopLevelResults, loopProtection, showUndefined, magicComments, workingDirectory } =
    useSettingsStore();

  // Remove global cancel on unmount to allow background tab execution
  useEffect(() => {
    return () => {
      // Background execution is supported, no global cancel here.
    };
  }, []);

  // Listen for JS input requests (synchronous prompt)
  useEffect(() => {
    if (!window.codeRunner?.onJSInputRequest) return;

    const unsubscribe = window.codeRunner.onJSInputRequest((request) => {
      if (request.id) {
        setTabPromptRequest(
          request.id,
          request.message,
          request.type === 'alert-request' ? 'alert' : 'text'
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [setTabPromptRequest]);

  const runCode = useCallback(
    async (codeToRun?: string) => {
      const callerTabId = useEditorTabsStore.getState().activeTabId;
      if (!callerTabId) return;

      const debounceTimer = setTimeout(async () => {
        const { tabs, setTabPromptRequest, setTabExecuting, setTabResults, clearTabResults } = useEditorTabsStore.getState();
        const callerTab = tabs.find(t => t.id === callerTabId);

        const sourceCode = codeToRun ?? callerTab?.code ?? '';

        // Cancel previous execution for this tab ONLY
        executionEngine.cancel(callerTabId);
        setTabPromptRequest(callerTabId, null);

        // Detect language
        const detectLanguage = useAppStore.getState().language.detectLanguage;
        const detected = detectLanguage(sourceCode);
        const currentLang = detected.monacoId;

        if (!useAppStore.getState().language.isExecutable(currentLang)) {
          setTabExecuting(callerTabId, false);
          setTabResults(callerTabId, [
            {
              element: {
                content: `❌ Unsupported Language: ${getLanguageDisplayName(currentLang)} \n\nThis editor can execute JavaScript, TypeScript and Python code.\n\nDetected language: ${currentLang} \nSupported languages: javascript, typescript, python`,
              },
              type: 'error',
            },
          ]);
          return;
        }

        clearTabResults(callerTabId);
        setTabExecuting(callerTabId, true);

        const execLanguage = currentLang === 'python' ? 'python' : currentLang === 'typescript' ? 'typescript' : 'javascript';

        await executionEngine.run(
          callerTabId,
          sourceCode,
          execLanguage,
          {
            showUndefined,
            showTopLevelResults,
            loopProtection,
            magicComments,
            workingDirectory,
          },
          {
            onOutput: (result) => {
              useEditorTabsStore.getState().appendTabResult(callerTabId, {
                lineNumber: result.lineNumber,
                element: {
                  content: result.content,
                  jsType: result.jsType,
                  consoleType: result.consoleType as 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir',
                },
                type: result.type,
              });
            },
            onError: (errorMsg) => {
              useEditorTabsStore.getState().appendTabResult(callerTabId, {
                element: { content: errorMsg },
                type: 'error',
              });
            },
            onComplete: (historyData) => {
              useAppStore.getState().history.addToHistory(historyData);
              useEditorTabsStore.getState().setTabExecuting(callerTabId, false);
              useEditorTabsStore.getState().setTabPromptRequest(callerTabId, null);
            }
          }
        );

      }, 0); // No deferral wait needed.

      return () => clearTimeout(debounceTimer);
    },
    [
      showTopLevelResults,
      loopProtection,
      showUndefined,
      magicComments,
      workingDirectory,
    ]
  );

  return {
    runCode,
  };
}
