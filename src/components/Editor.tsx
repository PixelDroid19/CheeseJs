import { useRef, useCallback, useEffect } from 'react';
import LoadingIndicator from './LoadingIndicator';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

import { useEditorTabsStore } from '../store/storeHooks';
import { useSettingsStore } from '../store/storeHooks';
import { useLanguageStore } from '../store/storeHooks';
import { useCodeRunner } from '../hooks/useCodeRunner';

import { setupMonacoEnvironment } from '../utils/monaco-config';
import { RecoverableErrorBoundary } from './RecoverableErrorBoundary';
import { EditorFallback } from './ErrorFallbacks';
import { TabBar } from './TabBar';
import { CODE_RUNNER_DEBOUNCE_MS } from '../constants';
import { useDebouncedFunction } from '../hooks/useDebounce';

import { useEditorFormat } from '../hooks/editor/useEditorFormat';
import { useEditorCodeSync } from '../hooks/editor/useEditorCodeSync';
import { useEditorModels } from '../hooks/editor/useEditorModels';
import { useEditorChangeHandler } from '../hooks/editor/useEditorChangeHandler';
import { useEditorLifecycle } from '../hooks/editor/useEditorLifecycle';

// Setup Monaco workers before initialization
setupMonacoEnvironment();

loader.config({ monaco });

function CodeEditor() {
  const { tabs, activeTabId, updateTabCode, updateTabLanguage } = useEditorTabsStore();
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const setCode = useCallback((code: string) => updateTabCode(activeTab.id, code), [activeTab.id, updateTabCode]);
  const code = activeTab.code;
  const { themeName, fontSize, fontLigatures } = useSettingsStore();

  const prevLanguageRef = useRef(activeTab.language);
  const language = activeTab.language;

  // We need to keep a bridge between EditorTabs Language and the global Monaco Language Detector
  const detectLanguageAsync = useLanguageStore((state) => state.detectLanguageAsync);
  const detectLanguageSync = useLanguageStore((state) => state.detectLanguage);

  const setLanguage = useCallback((lang: string) => {
    updateTabLanguage(activeTab.id, lang);
    useLanguageStore.getState().setLanguage(lang);
  }, [activeTab.id, updateTabLanguage]);
  const setMonacoInstance = useLanguageStore((state) => state.setMonacoInstance);
  const applyLanguageToMonaco = useLanguageStore((state) => state.applyLanguageToMonaco);
  const initializeModel = useLanguageStore((state) => state.initializeModel);
  const incrementDetectionVersion = useLanguageStore((state) => state.incrementDetectionVersion);
  const getDetectionVersion = useLanguageStore((state) => state.getDetectionVersion);

  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<Monaco | null>(null);
  const lastCursorPositionRef = useRef<monaco.IPosition | null>(null);
  const lastLocalCodeRef = useRef<string | null>(null);

  const { runCode } = useCodeRunner();
  const debouncedRunner = useDebouncedFunction(runCode, CODE_RUNNER_DEBOUNCE_MS);

  useEditorFormat(monacoRef);
  useEditorCodeSync(monacoRef, code, lastLocalCodeRef);

  const { cleanupModels } = useEditorModels(
    monacoRef,
    monacoInstanceRef,
    language,
    applyLanguageToMonaco
  );

  const { handleEditorWillMount: lifecycleWillMount, handleEditorDidMount: lifecycleDidMount } = useEditorLifecycle({
    setMonacoInstance,
    initializeModel,
    applyLanguageToMonaco,
    setLanguage,
    detectLanguageAsync,
    runCode,
    cleanupModels,
  });

  const handleEditorWillMount = useCallback((monacoInstance: Monaco) => {
    monacoInstanceRef.current = monacoInstance;
    lifecycleWillMount(monacoInstance);
  }, [lifecycleWillMount]);

  const handleEditorDidMount = useCallback((editorInstance: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    monacoRef.current = editorInstance;
    editorInstance.onDidChangeCursorPosition((e) => {
      lastCursorPositionRef.current = e.position;
    });
    lifecycleDidMount(editorInstance, monacoInstance);
  }, [lifecycleDidMount]);

  const handler = useEditorChangeHandler({
    monacoRef,
    setCode,
    lastLocalCodeRef,
    lastCursorPositionRef,
    debouncedRunner,
    language,
    setLanguage,
    detectLanguageSync,
    detectLanguageAsync,
    incrementDetectionVersion,
    getDetectionVersion
  });

  const monacoPath = `inmemory://model/${activeTab.id}.ts`;

  // Apply to monaco global when language changes (for the current active tab)
  useEffect(() => {
    if (monacoRef.current && prevLanguageRef.current !== activeTab.language) {
      useLanguageStore.getState().setLanguage(activeTab.language);
      prevLanguageRef.current = activeTab.language;
    }
  }, [activeTab.language]);

  return (
    <div className="flex flex-col h-full w-full">
      <TabBar />
      <div className="flex-1 relative">
        {activeTab && monacoPath ? ( // Conditionally render Editor if activeTab and monacoPath exist
          <Editor
            path={monacoPath}
            defaultLanguage="typescript"
            language={language}
            theme={themeName}
            loading={<LoadingIndicator message="Initializing Editor..." />}
            options={{
              automaticLayout: true,
              dragAndDrop: true,
              minimap: { enabled: false },
              padding: { top: 16, bottom: 16 },
              scrollbar: { vertical: 'auto', horizontal: 'auto' },
              fontSize,
              fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
              fontLigatures: fontLigatures,
              wordWrap: 'on',
              quickSuggestions: { other: true, comments: false, strings: true },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnCommitCharacter: true,
              tabCompletion: 'on',
              lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.On },
              hover: { enabled: true, delay: 300, sticky: true },
              parameterHints: { enabled: true },
              suggest: { showWords: true, showModules: true, showFunctions: true, showVariables: true },
              contextmenu: true,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
            }}
            onChange={handler}
            defaultValue={code}
            beforeMount={handleEditorWillMount}
            onMount={handleEditorDidMount}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No active tab. Please create a new tab.
          </div>
        )}
      </div>
    </div>
  );
}

export default function WrappedCodeEditor() {
  return (
    <RecoverableErrorBoundary
      fallback={<EditorFallback />}
      componentName="CodeEditor"
    >
      <CodeEditor />
    </RecoverableErrorBoundary>
  );
}
