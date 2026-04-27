import {
  getExecutionLanguage,
  getLanguageDisplayName,
  isExecutableLanguage,
  useEditorTabsStore,
  useSettingsStore,
} from '../store/storeHooks';
import { useAppStore } from '../store/index';
import { executionEngine } from '../lib/execution/ExecutionEngine';
import { useEffect, useCallback } from 'react';

let executionCounter = 0;
const executionToTabMap = new Map<string, string>();

function createExecutionId(tabId: string): string {
  executionCounter += 1;
  return `exec-${Date.now()}-${executionCounter}-${tabId}`;
}

function getMappedTabId(executionId: string): string | null {
  return executionToTabMap.get(executionId) ?? null;
}

function setMappedTabId(executionId: string, tabId: string): void {
  executionToTabMap.set(executionId, tabId);
}

function clearMappedExecution(executionId: string): void {
  executionToTabMap.delete(executionId);
}

function clearMappedExecutionsForTab(tabId: string): void {
  for (const [executionId, mappedTabId] of executionToTabMap.entries()) {
    if (mappedTabId === tabId) {
      executionToTabMap.delete(executionId);
    }
  }
}

export function useCodeRunner() {
  const { setTabPromptRequest } = useEditorTabsStore();

  const {
    showTopLevelResults,
    loopProtection,
    showUndefined,
    magicComments,
    workingDirectory,
  } = useSettingsStore();

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
      const mappedTabId = getMappedTabId(request.id);
      const fallbackTabId = useEditorTabsStore
        .getState()
        .tabs.some((tab) => tab.id === request.id)
        ? request.id
        : null;
      const targetTabId = mappedTabId ?? fallbackTabId;

      if (targetTabId) {
        setTabPromptRequest(
          targetTabId,
          request.message,
          request.type === 'alert-request' ? 'alert' : 'text',
          request.id
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

      const {
        tabs,
        setTabPromptRequest,
        setTabExecuting,
        setTabResults,
        clearTabResults,
      } = useEditorTabsStore.getState();
      const callerTab = tabs.find((t) => t.id === callerTabId);

      const sourceCode = codeToRun ?? callerTab?.code ?? '';

      // Cancel previous execution for this tab ONLY
      executionEngine.cancel(callerTabId);
      setTabPromptRequest(callerTabId, null);

      // Remove stale mappings for this tab
      clearMappedExecutionsForTab(callerTabId);

      // Detect language
      const detectLanguage = useAppStore.getState().language.detectLanguage;
      const detected = detectLanguage(sourceCode);
      const currentLang = detected.monacoId;

      if (!isExecutableLanguage(currentLang)) {
        setTabExecuting(callerTabId, false);
        setTabResults(callerTabId, [
          {
            element: {
              content: `❌ Unsupported Language: ${getLanguageDisplayName(currentLang)} \n\nThis editor can execute JavaScript, TypeScript, Python, C, and C++ code.\n\nDetected language: ${currentLang} \nSupported languages: javascript, typescript, python, c, cpp`,
            },
            type: 'error',
          },
        ]);
        return;
      }

      clearTabResults(callerTabId);
      setTabExecuting(callerTabId, true);

      const execLanguage = getExecutionLanguage(currentLang);
      if (!execLanguage) {
        setTabExecuting(callerTabId, false);
        setTabResults(callerTabId, [
          {
            element: {
              content: `❌ No execution runtime is configured for ${getLanguageDisplayName(currentLang)} (${currentLang}).`,
            },
            type: 'error',
          },
        ]);
        return;
      }

      const executionId = createExecutionId(callerTabId);
      setMappedTabId(executionId, callerTabId);

      await executionEngine.run(
        callerTabId,
        executionId,
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
                consoleType: result.consoleType as
                  | 'log'
                  | 'warn'
                  | 'error'
                  | 'info'
                  | 'table'
                  | 'dir',
              },
              type: result.type,
            });
          },
          onError: (errorMsg) => {
            useEditorTabsStore.getState().appendTabResult(callerTabId, {
              element: { content: errorMsg },
              type: 'error',
            });
            clearMappedExecution(executionId);
            useEditorTabsStore.getState().setTabExecuting(callerTabId, false);
          },
          onComplete: (historyData) => {
            useAppStore.getState().history.addToHistory(historyData);
            useEditorTabsStore.getState().setTabExecuting(callerTabId, false);
            useEditorTabsStore
              .getState()
              .setTabPromptRequest(callerTabId, null);
            clearMappedExecution(executionId);
          },
        }
      );
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
