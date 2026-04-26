import { useRef, useCallback, useEffect } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

import LoadingIndicator from './LoadingIndicator';
import { EditorTabBar } from './EditorTabBar';
import { CODE_RUNNER_DEBOUNCE_MS } from '../constants';
import { useDebouncedFunction } from '../hooks/useDebounce';
import { useEditorFormat } from '../hooks/useEditorFormat';
import { useEditorCodeSync } from '../hooks/useEditorCodeSync';
import { useEditorModels } from '../hooks/useEditorModels';
import {
  useEditorChangeHandler,
  type UseEditorChangeHandlerParams,
} from '../hooks/useEditorChangeHandler';
import {
  useEditorLifecycle,
  type EditorLifecycleServices,
} from '../hooks/useEditorLifecycle';
import {
  useLspIntegration,
  type EditorLspLanguageConfig,
  type EditorLspStatus,
} from '../hooks/useLspIntegration';
import { setupMonacoEnvironment } from '../utils/monaco-config';
import type { EditorTab } from '../state/useEditorTabsStore';

interface MonacoTypeScriptDefaults {
  setDiagnosticsOptions(options: {
    noSemanticValidation: boolean;
    noSyntaxValidation: boolean;
  }): void;
  setCompilerOptions(options: Record<string, unknown>): void;
  getCompilerOptions(): Record<string, unknown>;
}

/** Minimal language service contract needed by the packaged editor. */
export interface CodeEditorLanguageServices {
  detectLanguageAsync: UseEditorChangeHandlerParams['detectLanguageAsync'];
  detectLanguageSync: UseEditorChangeHandlerParams['detectLanguageSync'];
  setLanguage: (lang: string) => void;
  setCurrentLanguage: (lang: string) => void;
  setMonacoInstance: (instance: Monaco) => void;
  applyLanguageToMonaco: (model: editor.ITextModel) => void;
  initializeModel: () => Promise<void>;
  incrementDetectionVersion: () => number;
  getDetectionVersion: () => number;
}

/** Runtime callbacks required by the packaged editor shell. */
export interface CodeEditorRuntimeServices {
  runCode: (code?: string) => void;
  debounceMs?: number;
}

/** Optional command subscriptions injected by the host shell. */
export interface CodeEditorCommandServices {
  subscribeToFormatRequested?: (handler: () => void) => () => void;
}

/** Settings consumed by the packaged editor shell. */
export interface CodeEditorViewSettings {
  themeName: string;
  fontSize: number;
  fontLigatures: boolean;
}

/** Optional LSP integration dependencies for the packaged editor shell. */
export interface CodeEditorLspServices {
  languages: Record<string, EditorLspLanguageConfig>;
  setLspStatus: (language: string, status: EditorLspStatus) => void;
  startClient: (language: string, fileExtensions: string[]) => Promise<void>;
  stopClient: (language: string) => void;
  isClientActive: (language: string) => boolean;
}

/** Tab-state contract required by the packaged editor shell. */
export interface CodeEditorTabServices {
  tabs: EditorTab[];
  activeTabId: string | null;
  updateTabCode: (id: string, code: string) => void;
  updateTabLanguage: (id: string, language: string) => void;
  setActiveTab: (id: string) => void;
  closeTab: (id: string) => void;
  addTab: (title: string, code?: string, language?: string) => string;
}

/** Props for the packaged Monaco editor shell. */
export interface CodeEditorProps {
  tabs: CodeEditorTabServices;
  settings: CodeEditorViewSettings;
  language: CodeEditorLanguageServices;
  runtime: CodeEditorRuntimeServices;
  commands?: CodeEditorCommandServices;
  lifecycleServices: EditorLifecycleServices;
  lsp?: CodeEditorLspServices;
  loadingMessage?: string;
}

setupMonacoEnvironment();
loader.config({ monaco });

/**
 * Reusable Monaco editor shell used by the host application.
 * App-specific concerns are injected through services so this package remains
 * reusable and testable.
 */
export default function CodeEditor({
  tabs,
  settings,
  language,
  runtime,
  commands,
  lifecycleServices,
  lsp,
  loadingMessage = 'Initializing Editor...',
}: CodeEditorProps) {
  const {
    tabs: editorTabs,
    activeTabId,
    updateTabCode,
    setActiveTab,
    closeTab,
    addTab,
  } = tabs;

  const activeTab =
    editorTabs.find((tab) => tab.id === activeTabId) || editorTabs[0];
  const setCode = useCallback(
    (code: string) => updateTabCode(activeTab.id, code),
    [activeTab.id, updateTabCode]
  );
  const code = activeTab.code;

  const prevLanguageRef = useRef(activeTab.language);
  const currentLanguage = activeTab.language;

  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<Monaco | null>(null);
  const lastCursorPositionRef = useRef<monaco.IPosition | null>(null);
  const lastLocalCodeRef = useRef<string | null>(null);

  const debouncedRunner = useDebouncedFunction(
    runtime.runCode,
    runtime.debounceMs ?? CODE_RUNNER_DEBOUNCE_MS
  );

  useEditorFormat(monacoRef, commands?.subscribeToFormatRequested);
  useEditorCodeSync(monacoRef, code, lastLocalCodeRef);

  useLspIntegration({
    language: currentLanguage,
    languages: lsp?.languages ?? {},
    setLspStatus: lsp?.setLspStatus ?? (() => undefined),
    startClient: lsp?.startClient ?? (async () => undefined),
    stopClient: lsp?.stopClient ?? (() => undefined),
    isClientActive: lsp?.isClientActive ?? (() => false),
  });

  const { cleanupModels } = useEditorModels(
    monacoRef,
    monacoInstanceRef,
    currentLanguage,
    language.applyLanguageToMonaco
  );

  const {
    handleEditorWillMount: lifecycleWillMount,
    handleEditorDidMount: lifecycleDidMount,
  } = useEditorLifecycle({
    setMonacoInstance: language.setMonacoInstance,
    initializeModel: language.initializeModel,
    applyLanguageToMonaco: language.applyLanguageToMonaco,
    setLanguage: language.setLanguage,
    detectLanguageAsync: language.detectLanguageAsync,
    runCode: runtime.runCode,
    cleanupModels,
    services: lifecycleServices,
  });

  const handleEditorWillMount = useCallback(
    (monacoInstance: Monaco) => {
      monacoInstanceRef.current = monacoInstance;

      // Disable built-in JS/TS diagnostics so app-level LSP owns diagnostics.
      const tsDefaults = monaco.languages.typescript as unknown as {
        typescriptDefaults: MonacoTypeScriptDefaults;
        javascriptDefaults: MonacoTypeScriptDefaults;
      };
      tsDefaults.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
      tsDefaults.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
      tsDefaults.typescriptDefaults.setCompilerOptions({
        ...tsDefaults.typescriptDefaults.getCompilerOptions(),
        lib: [],
      });
      tsDefaults.javascriptDefaults.setCompilerOptions({
        ...tsDefaults.javascriptDefaults.getCompilerOptions(),
        lib: [],
      });

      lifecycleWillMount(monacoInstance);
    },
    [lifecycleWillMount]
  );

  const handleEditorDidMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
      monacoRef.current = editorInstance;
      editorInstance.onDidChangeCursorPosition((event) => {
        lastCursorPositionRef.current = event.position;
      });
      lifecycleDidMount(editorInstance, monacoInstance);
    },
    [lifecycleDidMount]
  );

  const handleChange = useEditorChangeHandler({
    monacoRef,
    setCode,
    lastLocalCodeRef,
    lastCursorPositionRef,
    debouncedRunner,
    language: currentLanguage,
    setLanguage: language.setLanguage,
    detectLanguageSync: language.detectLanguageSync,
    detectLanguageAsync: language.detectLanguageAsync,
    incrementDetectionVersion: language.incrementDetectionVersion,
    getDetectionVersion: language.getDetectionVersion,
  });

  const monacoPath = `inmemory://model/${activeTab.id}.ts`;

  useEffect(() => {
    if (monacoRef.current && prevLanguageRef.current !== activeTab.language) {
      language.setCurrentLanguage(activeTab.language);
      prevLanguageRef.current = activeTab.language;
    }
  }, [activeTab.language, language]);

  return (
    <div className="flex flex-col h-full w-full">
      <EditorTabBar
        tabs={editorTabs}
        activeTabId={activeTabId}
        onActivateTab={setActiveTab}
        onCloseTab={closeTab}
        onAddTab={() => addTab(`script-${editorTabs.length + 1}.js`)}
      />
      <div className="flex-1 relative">
        {activeTab && monacoPath ? (
          <Editor
            path={monacoPath}
            defaultLanguage="typescript"
            language={currentLanguage}
            theme={settings.themeName}
            loading={<LoadingIndicator message={loadingMessage} />}
            options={{
              automaticLayout: true,
              dragAndDrop: true,
              minimap: { enabled: false },
              padding: { top: 16, bottom: 16 },
              scrollbar: { vertical: 'auto', horizontal: 'auto' },
              fontSize: settings.fontSize,
              fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
              fontLigatures: settings.fontLigatures,
              wordWrap: 'on',
              quickSuggestions: { other: true, comments: false, strings: true },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnCommitCharacter: true,
              tabCompletion: 'on',
              lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.On },
              hover: { enabled: true, delay: 300, sticky: true },
              parameterHints: { enabled: true },
              suggest: {
                showWords: true,
                showModules: true,
                showFunctions: true,
                showVariables: true,
              },
              contextmenu: true,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
            }}
            onChange={handleChange}
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
