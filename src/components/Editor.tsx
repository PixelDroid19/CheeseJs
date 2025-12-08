import { useRef, useCallback, useEffect, useState } from 'react';
import LoadingIndicator from './LoadingIndicator';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import { useCodeStore, CodeState } from '../store/useCodeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePackagesStore } from '../store/usePackagesStore';
import { usePythonPackagesStore } from '../store/usePythonPackagesStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useDebouncedFunction } from '../hooks/useDebounce';
import { useCodeRunner } from '../hooks/useCodeRunner';
import {
  registerMonacoProviders,
  disposeMonacoProviders,
} from '../lib/monacoProviders';
import {
  registerPythonMonacoProviders,
  disposePythonMonacoProviders,
} from '../lib/python/pythonMonacoProviders';
import { setupTypeAcquisition } from '../lib/ata';
import { registerPythonLanguage } from '../lib/python';
import { editor } from 'monaco-editor';
import { configureMonaco } from '../utils/monaco-config';
import { EditorErrorBoundary } from './editor-error-boundary';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

loader.config({ monaco });

function CodeEditor() {
  const code = useCodeStore((state: CodeState) => state.code);
  const setCode = useCodeStore((state: CodeState) => state.setCode);
  const { themeName, fontSize } = useSettingsStore();
  const [_isEditorReady, setIsEditorReady] = useState(false);

  // Use centralized language store
  const language = useLanguageStore((state) => state.currentLanguage);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const detectLanguageAsync = useLanguageStore(
    (state) => state.detectLanguageAsync
  );
  const setMonacoInstance = useLanguageStore(
    (state) => state.setMonacoInstance
  );
  const applyLanguageToMonaco = useLanguageStore(
    (state) => state.applyLanguageToMonaco
  );
  const initializeModel = useLanguageStore((state) => state.initializeModel);

  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<Monaco | null>(null);
  const ataDisposeRef = useRef<(() => void) | null>(null);
  const lastCursorPositionRef = useRef<monaco.IPosition | null>(null);
  const lastLocalCodeRef = useRef<string | null>(null);

  const { runCode } = useCodeRunner();

  useEffect(() => {
    const handleFormat = () => {
      monacoRef.current?.getAction('editor.action.formatDocument')?.run();
    };
    window.addEventListener('trigger-format', handleFormat);

    return () => {
      window.removeEventListener('trigger-format', handleFormat);
      // Dispose Monaco providers on unmount
      disposeMonacoProviders();
      disposePythonMonacoProviders();
      // Dispose ATA subscription
      if (ataDisposeRef.current) {
        ataDisposeRef.current();
      }
    };
  }, []);

  // Restore cursor position and focus when language changes (which triggers a model switch)
  const cleanupModels = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      const currentModel = editorInstance.getModel();
      const currentUri = currentModel?.uri.toString();

      if (monacoInstanceRef.current) {
        const models = monacoInstanceRef.current.editor.getModels();

        models.forEach((m: editor.ITextModel) => {
          const uri = m.uri.toString();
          // Don't dispose the current model OR the result output model
          if (
            uri !== currentUri &&
            !uri.includes('result-output.js') &&
            !m.isDisposed()
          ) {
            if (uri.startsWith('inmemory') || uri.startsWith('file:')) {
              try {
                m.dispose();
              } catch (e) {
                console.error('[Editor] Error disposing model:', e);
              }
            }
          }
        });
      }
    },
    []
  );

  useEffect(() => {
    if (monacoRef.current) {
      // Sync content if needed
      const model = monacoRef.current.getModel();
      const currentVal = model?.getValue();

      if (model && currentVal !== code) {
        // If the update matches what we just typed locally, ignore it
        if (code === lastLocalCodeRef.current) {
          return;
        }

        // If the editor has focus, we prioritize local state to prevent
        // race conditions where the store lags behind fast typing.
        // We assume any valid external update (like loading a snippet)
        // will come from a UI interaction that momentarily takes focus away.
        if (monacoRef.current.hasTextFocus()) {
          return;
        }

        // If the code is different, update it
        // Use executeEdits to preserve undo stack and potential cursor logic if possible
        // But setValue is safer for full replacements
        model.setValue(code);

        // For external updates (like loading a snippet), move cursor to end of file
        // instead of trying to restore previous position which might be invalid
        const lineCount = model.getLineCount();
        const maxCol = model.getLineMaxColumn(lineCount);
        const pos = { lineNumber: lineCount, column: maxCol };

        monacoRef.current.setPosition(pos);
        monacoRef.current.revealPosition(pos);

        // Delay focus to ensure UI is ready and prevent focus stealing
        setTimeout(() => {
          if (monacoRef.current) {
            monacoRef.current.focus();
          }
        }, 250);
      }

      // ONLY cleanup models if language changed, not on every code change
      // cleanupModels(monacoRef.current)
    }
  }, [language, code]); // Removed cleanupModels from dependencies to avoid loop

  // Effect to handle language changes and cleanup
  useEffect(() => {
    if (monacoRef.current && monacoInstanceRef.current) {
      const model = monacoRef.current.getModel();
      if (model && !model.isDisposed()) {
        // Use centralized applyLanguageToMonaco
        applyLanguageToMonaco(model);
      }
    }
  }, [language, applyLanguageToMonaco]);

  const handleEditorWillMount = useCallback(
    (monaco: Monaco) => {
      monacoInstanceRef.current = monaco;
      configureMonaco(monaco);

      // Register Monaco instance in centralized store
      setMonacoInstance(monaco);

      // Register Python language with syntax highlighting
      registerPythonLanguage(monaco);

      // Initialize ML model without blocking
      initializeModel().catch((err) => {
        console.warn(
          '[Editor] Language detection model initialization failed:',
          err
        );
        // Non-critical error, continue
      });
    },
    [setMonacoInstance, initializeModel]
  );

  const handleEditorDidMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      monacoRef.current = editorInstance;
      setIsEditorReady(true);

      // Initial language application
      const model = editorInstance.getModel();
      if (model) {
        applyLanguageToMonaco(model);
      }

      // Expose monaco to window for E2E testing
      // Always expose for Electron app (needed for Playwright E2E tests)
      // @ts-expect-error - Exposing monaco to window for testing
      window.monaco = monaco;
      // @ts-expect-error - Exposing editor to window for testing
      window.editor = editorInstance;
      // @ts-expect-error - Exposing store to window for testing
      window.useCodeStore = useCodeStore;

      // Detect language from initial code using ML (async)
      const initialCode = editorInstance.getValue();
      if (initialCode && initialCode.trim().length > 10) {
        detectLanguageAsync(initialCode)
          .then((detected) => {
            const model = editorInstance.getModel();
            if (
              model &&
              !model.isDisposed() &&
              detected.monacoId !== model.getLanguageId()
            ) {
              console.log(
                `[Editor] Initial ML detection: ${detected.monacoId} (confidence: ${(detected.confidence * 100).toFixed(1)}%)`
              );
              monaco.editor.setModelLanguage(model, detected.monacoId);
              setLanguage(detected.monacoId);
            }
          })
          .catch(console.error);
      }

      // Setup ATA
      ataDisposeRef.current = setupTypeAcquisition(monaco);

      // Register hover and code action providers
      registerMonacoProviders(monaco, editorInstance);

      // Register Python providers
      registerPythonMonacoProviders(monaco, editorInstance);

      // Cleanup old models immediately on mount
      cleanupModels(editorInstance);

      // Register custom commands for package management using Monaco's command system
      // This is required for CodeActions to work properly (addAction doesn't work with CodeAction commands)
      monaco.editor.registerCommand(
        'cheeseJS.installPackage',
        async (_accessor: unknown, packageName: string) => {
          console.log('[Editor] Installing package:', packageName);
          if (window.packageManager) {
            usePackagesStore.getState().addPackage(packageName);
            usePackagesStore.getState().setPackageInstalling(packageName, true);
            const result = await window.packageManager.install(packageName);
            if (result.success) {
              usePackagesStore
                .getState()
                .setPackageInstalled(packageName, result.version);
            } else {
              usePackagesStore
                .getState()
                .setPackageError(packageName, result.error);
            }
          } else {
            usePackagesStore.getState().addPackage(packageName);
          }
        }
      );

      // Track cursor position to ensure we always have the latest position
      // even if the user didn't type (just moved cursor)
      editorInstance.onDidChangeCursorPosition((e) => {
        lastCursorPositionRef.current = e.position;
      });

      monaco.editor.registerCommand(
        'cheeseJS.installAndRun',
        async (_accessor: unknown, packageName: string) => {
          console.log('[Editor] Installing package and running:', packageName);
          if (window.packageManager) {
            usePackagesStore.getState().addPackage(packageName);
            usePackagesStore.getState().setPackageInstalling(packageName, true);
            const result = await window.packageManager.install(packageName);
            if (result.success) {
              usePackagesStore
                .getState()
                .setPackageInstalled(packageName, result.version);
              // Run code after successful install
              const code = editorInstance.getValue();
              runCode(code);
            } else {
              usePackagesStore
                .getState()
                .setPackageError(packageName, result.error);
            }
          } else {
            usePackagesStore.getState().addPackage(packageName);
            setTimeout(() => {
              const code = editorInstance.getValue();
              runCode(code);
            }, 100);
          }
        }
      );

      monaco.editor.registerCommand(
        'cheeseJS.retryInstall',
        async (_accessor: unknown, packageName: string) => {
          console.log('[Editor] Retrying install:', packageName);
          const store = usePackagesStore.getState();
          store.resetPackageAttempts(packageName);
          store.setPackageInstalling(packageName, true);
          if (window.packageManager) {
            const result = await window.packageManager.install(packageName);
            if (result.success) {
              store.setPackageInstalled(packageName, result.version);
            } else {
              store.setPackageError(packageName, result.error);
            }
          }
        }
      );

      monaco.editor.registerCommand(
        'cheeseJS.uninstallPackage',
        async (_accessor: unknown, packageName: string) => {
          console.log('[Editor] Uninstalling package:', packageName);
          if (window.packageManager) {
            const result = await window.packageManager.uninstall(packageName);
            if (result.success) {
              usePackagesStore.getState().removePackage(packageName);
            }
          } else {
            usePackagesStore.getState().removePackage(packageName);
          }
        }
      );

      monaco.editor.registerCommand(
        'cheeseJS.viewOnNpm',
        (_accessor: unknown, packageName: string) => {
          console.log('[Editor] Opening npm for:', packageName);
          window.open(`https://www.npmjs.com/package/${packageName}`, '_blank');
        }
      );

      // Python package management commands
      monaco.editor.registerCommand(
        'cheeseJS.installPythonPackage',
        async (_accessor: unknown, packageName: string) => {
          console.log('[Editor] Installing Python package:', packageName);
          if (window.pythonPackageManager) {
            usePythonPackagesStore.getState().addPackage(packageName);
            usePythonPackagesStore
              .getState()
              .setPackageInstalling(packageName, true);
            const result =
              await window.pythonPackageManager.install(packageName);
            if (result.success) {
              usePythonPackagesStore
                .getState()
                .setPackageInstalled(packageName, result.version);
            } else {
              usePythonPackagesStore
                .getState()
                .setPackageError(packageName, result.error);
            }
          } else {
            usePythonPackagesStore.getState().addPackage(packageName);
          }
        }
      );

      monaco.editor.registerCommand(
        'cheeseJS.installPythonPackageAndRun',
        async (_accessor: unknown, packageName: string) => {
          console.log(
            '[Editor] Installing Python package and running:',
            packageName
          );
          if (window.pythonPackageManager) {
            usePythonPackagesStore.getState().addPackage(packageName);
            usePythonPackagesStore
              .getState()
              .setPackageInstalling(packageName, true);
            const result =
              await window.pythonPackageManager.install(packageName);
            if (result.success) {
              usePythonPackagesStore
                .getState()
                .setPackageInstalled(packageName, result.version);
              // Run code after successful install
              const code = editorInstance.getValue();
              runCode(code);
            } else {
              usePythonPackagesStore
                .getState()
                .setPackageError(packageName, result.error);
            }
          } else {
            usePythonPackagesStore.getState().addPackage(packageName);
            setTimeout(() => {
              const code = editorInstance.getValue();
              runCode(code);
            }, 100);
          }
        }
      );

      monaco.editor.registerCommand(
        'cheeseJS.retryPythonInstall',
        async (_accessor: unknown, packageName: string) => {
          console.log('[Editor] Retrying Python install:', packageName);
          const store = usePythonPackagesStore.getState();
          store.resetPackageAttempts(packageName);
          store.setPackageInstalling(packageName, true);
          if (window.pythonPackageManager) {
            const result =
              await window.pythonPackageManager.install(packageName);
            if (result.success) {
              store.setPackageInstalled(packageName, result.version);
            } else {
              store.setPackageError(packageName, result.error);
            }
          }
        }
      );

      monaco.editor.registerCommand(
        'cheeseJS.viewOnPyPI',
        (_accessor: unknown, packageName: string) => {
          console.log('[Editor] Opening PyPI for:', packageName);
          window.open(`https://pypi.org/project/${packageName}/`, '_blank');
        }
      );
    },
    [runCode, cleanupModels, detectLanguageAsync, setLanguage]
  );

  const debouncedRunner = useDebouncedFunction(runCode, 150);

  // Language detection - use refs to avoid stale closures in callbacks
  const lastDetectedRef = useRef<string>('typescript');
  const detectionInProgressRef = useRef<boolean>(false);
  const detectLanguageSync = useLanguageStore((state) => state.detectLanguage);

  // Refs for values that change frequently - prevents callback recreation
  const languageRef = useRef(language);
  languageRef.current = language;

  const setLanguageRef = useRef(setLanguage);
  setLanguageRef.current = setLanguage;

  const detectLanguageAsyncRef = useRef(detectLanguageAsync);
  detectLanguageAsyncRef.current = detectLanguageAsync;

  const detectLanguageSyncRef = useRef(detectLanguageSync);
  detectLanguageSyncRef.current = detectLanguageSync;

  // ML detection with debounce - refines heuristic results for ambiguous cases
  const debouncedLanguageDetection = useDebouncedFunction(
    async (value: string) => {
      if (detectionInProgressRef.current || !value || value.trim().length === 0)
        return;

      detectionInProgressRef.current = true;
      try {
        const detected = await detectLanguageAsyncRef.current(value);
        const currentLang = languageRef.current;

        // Only update if ML has good confidence and differs from current
        if (detected.monacoId !== currentLang && detected.confidence > 0.7) {
          console.log(
            `[Editor] ML refined: ${detected.monacoId} (${(detected.confidence * 100).toFixed(0)}%, was ${currentLang})`
          );
          lastDetectedRef.current = detected.monacoId;
          setLanguageRef.current(detected.monacoId);
        }
      } catch (error) {
        console.error('[Editor] ML detection failed:', error);
      } finally {
        detectionInProgressRef.current = false;
      }
    },
    250
  ); // Slightly longer debounce - ML is for refinement

  const handler = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        if (monacoRef.current) {
          lastCursorPositionRef.current = monacoRef.current.getPosition();
        }
        lastLocalCodeRef.current = value;
        setCode(value);

        // Immediate heuristic detection for snappy feedback
        // Only applies if confidence >= 0.9 (definitive patterns)
        try {
          const quick = detectLanguageSyncRef.current(value);
          const currentLang = languageRef.current;

          if (
            quick &&
            quick.monacoId !== currentLang &&
            quick.confidence >= 0.9
          ) {
            console.log(
              `[Editor] Heuristic: ${quick.monacoId} (${(quick.confidence * 100).toFixed(0)}%)`
            );
            lastDetectedRef.current = quick.monacoId;
            setLanguageRef.current(quick.monacoId);
          }
        } catch (e) {
          console.warn('[Editor] Heuristic failed:', e);
        }

        // Queue ML detection for refinement (handles ambiguous cases)
        debouncedLanguageDetection(value);
        debouncedRunner(value);
      }
    },
    [debouncedRunner, debouncedLanguageDetection, setCode] // Minimal deps - uses refs
  );

  return (
    <div className="h-full w-full">
      <Editor
        // Use a generic path - we control language via setModelLanguage
        path="code.txt"
        defaultLanguage="typescript"
        // Pass language prop to help Monaco - but we also set it manually
        language={language}
        theme={themeName}
        loading={<LoadingIndicator message="Initializing Editor..." />}
        options={{
          automaticLayout: true,
          dragAndDrop: true,
          minimap: {
            enabled: false, // Keeping disabled as per original, but user can change if requested
          },
          padding: {
            top: 16,
            bottom: 16,
          },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
          },
          fontSize,
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          wordWrap: 'on',
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          tabCompletion: 'on',
          lightbulb: {
            enabled: editor.ShowLightbulbIconMode.On,
          },
          hover: {
            enabled: true,
            delay: 300,
            sticky: true,
          },
          parameterHints: {
            enabled: true,
          },
          suggest: {
            showWords: true,
            showModules: true,
            showFunctions: true,
            showVariables: true,
          },
          contextmenu: true, // Enabled context menu
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
    <EditorErrorBoundary>
      <CodeEditor />
    </EditorErrorBoundary>
  );
}
