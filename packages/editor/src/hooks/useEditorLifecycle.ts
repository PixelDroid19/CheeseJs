import { useCallback, useEffect, useRef } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

/** Language detection result used during editor bootstrapping. */
export interface EditorLanguageDetectionResult {
  monacoId: string;
  confidence: number;
}

/** External services injected into the reusable editor lifecycle hook. */
export interface EditorLifecycleServices {
  configureMonaco: (instance: Monaco) => void;
  registerLanguage: (instance: Monaco) => void;
  setupTypeAcquisition: (instance: Monaco) => (() => void) | null;
  registerEditorCommands: (
    instance: Monaco,
    editorInstance: editor.IStandaloneCodeEditor,
    runCode: (code: string) => void
  ) => void;
  exposeGlobals: (
    editorInstance: editor.IStandaloneCodeEditor,
    monacoInstance: Monaco
  ) => void;
}

/** Parameters required to wire the editor lifecycle. */
export interface UseEditorLifecycleParams {
  setMonacoInstance: (instance: Monaco) => void;
  initializeModel: () => Promise<void>;
  applyLanguageToMonaco: (model: editor.ITextModel) => void;
  setLanguage: (lang: string) => void;
  detectLanguageAsync: (code: string) => Promise<EditorLanguageDetectionResult>;
  runCode: (code: string) => void;
  cleanupModels: (editorInstance: editor.IStandaloneCodeEditor) => void;
  services: EditorLifecycleServices;
}

/**
 * Manages Monaco editor startup and teardown while delegating app-specific
 * side effects through injected services.
 */
export function useEditorLifecycle({
  setMonacoInstance,
  initializeModel,
  applyLanguageToMonaco,
  setLanguage,
  detectLanguageAsync,
  runCode,
  cleanupModels,
  services,
}: UseEditorLifecycleParams) {
  const ataDisposeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (ataDisposeRef.current) {
        ataDisposeRef.current();
      }
    };
  }, []);

  const handleEditorWillMount = useCallback(
    (monacoInstance: Monaco) => {
      services.configureMonaco(monacoInstance);
      setMonacoInstance(monacoInstance);
      services.registerLanguage(monacoInstance);

      initializeModel().catch((err: unknown) => {
        console.warn(
          '[Editor] Language detection model initialization failed:',
          err
        );
      });
    },
    [services, setMonacoInstance, initializeModel]
  );

  const handleEditorDidMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
      const model = editorInstance.getModel();
      if (model) {
        applyLanguageToMonaco(model);
      }

      services.exposeGlobals(editorInstance, monacoInstance);

      const initialCode = editorInstance.getValue();
      if (initialCode && initialCode.trim().length > 10) {
        detectLanguageAsync(initialCode)
          .then((detected) => {
            const currentModel = editorInstance.getModel();
            if (
              currentModel &&
              !currentModel.isDisposed() &&
              detected.monacoId !== currentModel.getLanguageId()
            ) {
              monacoInstance.editor.setModelLanguage(
                currentModel,
                detected.monacoId
              );
              setLanguage(detected.monacoId);
            }
          })
          .catch((err: unknown) => console.error(err));
      }

      ataDisposeRef.current = services.setupTypeAcquisition(monacoInstance);
      cleanupModels(editorInstance);
      services.registerEditorCommands(monacoInstance, editorInstance, runCode);
    },
    [
      runCode,
      cleanupModels,
      detectLanguageAsync,
      setLanguage,
      applyLanguageToMonaco,
      services,
    ]
  );

  return {
    handleEditorWillMount,
    handleEditorDidMount,
  };
}
