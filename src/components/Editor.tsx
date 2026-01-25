import { useRef, useCallback, useEffect, useState } from 'react';
import LoadingIndicator from './LoadingIndicator';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

import { useCodeStore, CodeState } from '../store/useCodeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { registerPackageCommands } from '../lib/monacoCommands';
import { useDebouncedFunction } from '../hooks/useDebounce';
import { useCodeRunner } from '../hooks/useCodeRunner';
import { useExecutionHighlight } from '../hooks/useExecutionHighlight';
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
import {
  configureMonaco,
  setupMonacoEnvironment,
} from '../utils/monaco-config';
import { EditorErrorBoundary } from './editor-error-boundary';
import { VariableInspector } from './VariableInspector';

import { themeManager } from '../lib/themes/theme-manager';

// Setup Monaco workers before initialization
setupMonacoEnvironment();

loader.config({ monaco });

function CodeEditor() {
  const code = useCodeStore((state: CodeState) => state.code);
  const setCode = useCodeStore((state: CodeState) => state.setCode);
  const { themeName, fontSize } = useSettingsStore();
  const [_isEditorReady, setIsEditorReady] = useState(false);

  // Apply plugin themes appropriately
  useEffect(() => {
    if (_isEditorReady && monacoInstanceRef.current) {
      // Check if theme is registered in ThemeManager (plugin or built-in)
      const theme = themeManager.getTheme(themeName);
      if (theme?.definition) {
        // Use ThemeManager to apply theme (handles both Monaco + CSS variables)
        themeManager.applyTheme(themeName).catch((err) => {
          console.warn('[Editor] Failed to apply theme via ThemeManager:', err);
          // Fallback to direct Monaco theme setting
          monacoInstanceRef.current?.editor.setTheme(themeName);
        });
      } else {
        // Fallback to direct Monaco theme setting for built-in themes
        monacoInstanceRef.current.editor.setTheme(themeName);
      }
    }
  }, [themeName, _isEditorReady]);

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
  const incrementDetectionVersion = useLanguageStore(
    (state) => state.incrementDetectionVersion
  );
  const getDetectionVersion = useLanguageStore(
    (state) => state.getDetectionVersion
  );

  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<Monaco | null>(null);
  const ataDisposeRef = useRef<(() => void) | null>(null);
  const lastCursorPositionRef = useRef<monaco.IPosition | null>(null);
  const lastLocalCodeRef = useRef<string | null>(null);
  const isInternalUpdateRef = useRef(false);

  const { runCode } = useCodeRunner();

  // Apply execution line highlighting
  useExecutionHighlight({
    editorRef: monacoRef,
    monacoRef: monacoInstanceRef,
  });

  /**
   * Safely cleanup old Monaco models to prevent memory leaks.
   * Implements multiple safety checks to avoid disposing models that are still in use.
   */
  const cleanupModels = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      // Protected URIs that should never be disposed
      const PROTECTED_URIS = [
        'result-output.js',
        'code.txt',
        'ts:node-globals.d.ts',
        'inmemory://model/', // Base model path
      ];

      const currentModel = editorInstance.getModel();
      const currentUri = currentModel?.uri.toString();

      if (!monacoInstanceRef.current) {
        return;
      }

      const models = monacoInstanceRef.current.editor.getModels();
      const modelsToDispose: editor.ITextModel[] = [];

      // First pass: identify safe models to dispose
      models.forEach((m: editor.ITextModel) => {
        const uri = m.uri.toString();

        // Skip if already disposed
        if (m.isDisposed()) {
          return;
        }

        // Skip current model
        if (uri === currentUri) {
          return;
        }

        // Skip protected URIs
        if (
          PROTECTED_URIS.some((protected_uri) => uri.includes(protected_uri))
        ) {
          return;
        }

        // Only dispose inmemory or file models
        if (!uri.startsWith('inmemory') && !uri.startsWith('file:')) {
          return;
        }

        // Additional safety: check if model has listeners
        // Models with active listeners are likely still in use
        try {
          // Monaco doesn't expose listener count directly, but we can check
          // if getValue throws (would indicate corrupted state)
          m.getValue();
          modelsToDispose.push(m);
        } catch {
          console.warn(
            `[Editor] Skipping model ${uri} - may be in invalid state`
          );
        }
      });

      // Second pass: delayed disposal to give Monaco time to release references
      if (modelsToDispose.length > 0) {
        // Use setTimeout to defer disposal and avoid race conditions
        setTimeout(() => {
          modelsToDispose.forEach((m) => {
            try {
              if (!m.isDisposed()) {
                m.dispose();
              }
            } catch (e) {
              // Silently handle errors - model may have been disposed elsewhere
              console.debug(
                '[Editor] Error disposing model (may be expected):',
                e
              );
            }
          });
        }, 100); // Small delay to allow Monaco to release references
      }
    },
    []
  );

  useEffect(() => {
    const handleFormat = () => {
      monacoRef.current?.getAction('editor.action.formatDocument')?.run();
    };
    window.addEventListener('trigger-format', handleFormat);

    return () => {
      window.removeEventListener('trigger-format', handleFormat);

      // Cleanup models to prevent memory leaks
      if (monacoRef.current) {
        cleanupModels(monacoRef.current);
      }

      // Dispose Monaco providers on unmount
      disposeMonacoProviders();
      disposePythonMonacoProviders();

      // Dispose ATA subscription
      if (ataDisposeRef.current) {
        ataDisposeRef.current();
      }
    };
  }, [cleanupModels]);

  // Expose editor code getter for test panel integration
  useEffect(() => {
    const getEditorCode = () => {
      return monacoRef.current?.getValue() ?? '';
    };

    // Add to window for test panel access
    (window as unknown as { __getEditorCode: () => string }).__getEditorCode =
      getEditorCode;

    // Handle insert-code event from test panel
    const handleInsertCode = (event: CustomEvent<{ code: string }>) => {
      if (monacoRef.current) {
        // Replace entire content with the template
        isInternalUpdateRef.current = true;
        monacoRef.current.setValue(event.detail.code);
        isInternalUpdateRef.current = false;
        // Focus the editor
        monacoRef.current.focus();
      }
    };

    window.addEventListener('insert-code', handleInsertCode as EventListener);

    return () => {
      delete (window as unknown as { __getEditorCode?: () => string })
        .__getEditorCode;
      window.removeEventListener(
        'insert-code',
        handleInsertCode as EventListener
      );
    };
  }, []);

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

        // IMPROVEMENT: Save cursor position and scroll state BEFORE setValue
        const savedPosition = monacoRef.current.getPosition();
        const savedScrollTop = monacoRef.current.getScrollTop();
        const savedScrollLeft = monacoRef.current.getScrollLeft();

        // If the code is different, update it
        isInternalUpdateRef.current = true;
        model.setValue(code);
        isInternalUpdateRef.current = false;

        // IMPROVEMENT: Try to restore cursor position if it's still valid
        // Otherwise, position at a safe location
        if (savedPosition) {
          const newLineCount = model.getLineCount();
          // Clamp the line number to valid range
          const safeLineNumber = Math.min(
            savedPosition.lineNumber,
            newLineCount
          );
          const maxColumn = model.getLineMaxColumn(safeLineNumber);
          // Clamp column to valid range for the line
          const safeColumn = Math.min(savedPosition.column, maxColumn);

          const safePosition = {
            lineNumber: safeLineNumber,
            column: safeColumn,
          };

          monacoRef.current.setPosition(safePosition);
          monacoRef.current.setScrollTop(savedScrollTop);
          monacoRef.current.setScrollLeft(savedScrollLeft);
        } else {
          // Fallback: move cursor to end of file for new content
          const lineCount = model.getLineCount();
          const maxCol = model.getLineMaxColumn(lineCount);
          const pos = { lineNumber: lineCount, column: maxCol };
          monacoRef.current.setPosition(pos);
          monacoRef.current.revealPosition(pos);
        }

        // Only focus if no other element is currently focused (avoid stealing focus)
        if (
          document.activeElement === document.body ||
          document.activeElement?.tagName === 'BODY'
        ) {
          setTimeout(() => {
            if (monacoRef.current) {
              monacoRef.current.focus();
            }
          }, 100);
        }
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
      window.monaco = monaco;
      window.editor = editorInstance;
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

      // Register custom commands for package management (idempotent - safe on remount)
      registerPackageCommands(monaco, editorInstance, runCode);

      // Track cursor position to ensure we always have the latest position
      // even if the user didn't type (just moved cursor)
      editorInstance.onDidChangeCursorPosition((e) => {
        lastCursorPositionRef.current = e.position;
      });
    },
    [
      runCode,
      cleanupModels,
      detectLanguageAsync,
      setLanguage,
      applyLanguageToMonaco,
    ]
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

  const incrementDetectionVersionRef = useRef(incrementDetectionVersion);
  incrementDetectionVersionRef.current = incrementDetectionVersion;

  const getDetectionVersionRef = useRef(getDetectionVersion);
  getDetectionVersionRef.current = getDetectionVersion;

  // ML detection with debounce - refines heuristic results for ambiguous cases
  // Uses version tracking to prevent race conditions
  const debouncedLanguageDetection = useDebouncedFunction(
    async (value: string, versionAtStart: number) => {
      if (detectionInProgressRef.current || !value || value.trim().length === 0)
        return;

      detectionInProgressRef.current = true;
      try {
        const detected = await detectLanguageAsyncRef.current(value);
        const currentLang = languageRef.current;
        const currentVersion = getDetectionVersionRef.current();

        // Check if result is stale (version changed during async detection)
        if (currentVersion !== versionAtStart) {
          return;
        }

        // Also check for isStale flag from store
        if ((detected as { isStale?: boolean }).isStale) {
          return;
        }

        // Only update if ML has good confidence and differs from current
        if (detected.monacoId !== currentLang && detected.confidence > 0.7) {
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
      if (isInternalUpdateRef.current) return;

      if (value !== undefined) {
        if (monacoRef.current) {
          lastCursorPositionRef.current = monacoRef.current.getPosition();
        }
        lastLocalCodeRef.current = value;
        setCode(value);

        // Increment version to invalidate any in-flight async detection
        const newVersion = incrementDetectionVersionRef.current();

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
            lastDetectedRef.current = quick.monacoId;
            setLanguageRef.current(quick.monacoId);
          }
        } catch (e) {
          console.warn('[Editor] Heuristic failed:', e);
        }

        // Queue ML detection for refinement (handles ambiguous cases)
        // Pass current version so we can check for staleness when result arrives
        debouncedLanguageDetection(value, newVersion);
        debouncedRunner(value);
      }
    },
    [debouncedRunner, debouncedLanguageDetection, setCode] // Minimal deps - uses refs
  );

  return (
    <div className="h-full w-full relative editor-container">
      <Editor
        // Use a generic path - we control language via setModelLanguage
        // Using .ts extension ensures TypeScript features work correctly when in TS mode
        path="code.ts"
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
          fontFamily:
            themeName === 'sketchy'
              ? "'Courier Prime', 'Courier New', monospace"
              : "'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: themeName !== 'sketchy', // Disable ligatures for sketchy mode
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
      {/* Variable inspector for visual execution */}
      <VariableInspector />
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
