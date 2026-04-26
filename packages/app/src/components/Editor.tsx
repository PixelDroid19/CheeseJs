import { useEditorTabsStore } from '../store/storeHooks';
import { useSettingsStore } from '../store/storeHooks';
import { useLanguageStore, useLspStore } from '../store/storeHooks';
import { useCodeRunner } from '../hooks/useCodeRunner';
import { appEventBus } from '../events/appEventBus';
import CodeEditor from '@cheesejs/editor/components/CodeEditor';
import { configureMonaco } from '../utils/monaco-config';
import { registerPythonLanguage } from '../lib/python';
import { setupTypeAcquisition } from '../lib/ata';
import { registerPackageCommands } from '../lib/monacoCommands';
import {
  startLspClient,
  stopLspClient,
  isLspClientActive,
} from '../lib/lsp/monacoClient';

export default function CodeEditorAdapter() {
  const editorTabs = useEditorTabsStore();
  const { themeName, fontSize, fontLigatures } = useSettingsStore();
  const detectLanguageAsync = useLanguageStore(
    (state) => state.detectLanguageAsync
  );
  const detectLanguageSync = useLanguageStore((state) => state.detectLanguage);
  const setMonacoInstance = useLanguageStore(
    (state) => state.setMonacoInstance
  );
  const applyLanguageToMonaco = useLanguageStore(
    (state) => state.applyLanguageToMonaco
  );
  const initializeModel = useLanguageStore((state) => state.initializeModel);
  const incrementDetectionVersion = useLanguageStore(
    (state) => state.incrementDetectionVersion
  );
  const getDetectionVersion = useLanguageStore(
    (state) => state.getDetectionVersion
  );
  const setCurrentLanguage = useLanguageStore((state) => state.setLanguage);
  const { languages, setLspStatus } = useLspStore();
  const { runCode } = useCodeRunner();

  return (
    <CodeEditor
      tabs={editorTabs}
      settings={{ themeName, fontSize, fontLigatures }}
      language={{
        detectLanguageAsync,
        detectLanguageSync,
        setLanguage: (lang: string) => {
          const activeTabId = editorTabs.activeTabId;
          if (activeTabId) {
            editorTabs.updateTabLanguage(activeTabId, lang);
          }
          setCurrentLanguage(lang);
        },
        setCurrentLanguage,
        setMonacoInstance,
        applyLanguageToMonaco,
        initializeModel,
        incrementDetectionVersion,
        getDetectionVersion,
      }}
      runtime={{ runCode }}
      commands={{
        subscribeToFormatRequested: (handler) =>
          appEventBus.subscribe('editor.format.requested', () => {
            handler();
          }),
      }}
      lifecycleServices={{
        configureMonaco,
        registerLanguage: registerPythonLanguage,
        setupTypeAcquisition,
        registerEditorCommands: registerPackageCommands,
        exposeGlobals: (editorInstance, monacoInstance) => {
          Object.assign(window, {
            monaco: monacoInstance,
            editor: editorInstance,
            useEditorTabsStore: useEditorTabsStore,
          });
        },
      }}
      lsp={{
        languages,
        setLspStatus,
        startClient: startLspClient,
        stopClient: stopLspClient,
        isClientActive: isLspClientActive,
      }}
    />
  );
}
