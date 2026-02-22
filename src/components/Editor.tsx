import { useRef, useCallback } from 'react';
import LoadingIndicator from './LoadingIndicator';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

import { useCodeStore, type CodeState } from '../store/storeHooks';
import { useSettingsStore } from '../store/storeHooks';
import { useLanguageStore } from '../store/storeHooks';
import { useCodeRunner } from '../hooks/useCodeRunner';

import { setupMonacoEnvironment } from '../utils/monaco-config';
import { RecoverableErrorBoundary } from './RecoverableErrorBoundary';
import { EditorFallback } from './ErrorFallbacks';
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
  const code = useCodeStore((state: CodeState) => state.code);
  const setCode = useCodeStore((state: CodeState) => state.setCode);
  const { themeName, fontSize, fontLigatures } = useSettingsStore();

  const language = useLanguageStore((state) => state.currentLanguage);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const detectLanguageAsync = useLanguageStore((state) => state.detectLanguageAsync);
  const detectLanguageSync = useLanguageStore((state) => state.detectLanguage);
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

  const monacoPath = 'inmemory://model/code.ts';

  return (
    <div className="h-full w-full">
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
