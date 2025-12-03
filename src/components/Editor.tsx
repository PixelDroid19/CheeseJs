import { useRef, useCallback, useEffect } from 'react'
import Editor, { Monaco, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

import { useCodeStore, CodeState } from '../store/useCodeStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { usePackagesStore } from '../store/usePackagesStore'
import { useDebouncedFunction } from '../hooks/useDebounce'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { registerMonacoProviders, disposeMonacoProviders } from '../lib/monacoProviders'
import { setupTypeAcquisition } from '../lib/ata'
import { detectLanguage } from '../lib/languageDetector'
import { editor } from 'monaco-editor'
import { configureMonaco } from '../utils/monaco-config'
import { EditorErrorBoundary } from './editor-error-boundary'

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker()
    }
    return new editorWorker()
  }
}

loader.config({ monaco })

function CodeEditor () {
  const code = useCodeStore((state: CodeState) => state.code)
  const language = useCodeStore((state: CodeState) => state.language)
  const setCode = useCodeStore((state: CodeState) => state.setCode)
  const setLanguage = useCodeStore((state: CodeState) => state.setLanguage)
  const { themeName, fontSize } = useSettingsStore()

  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoInstanceRef = useRef<Monaco | null>(null)
  const ataDisposeRef = useRef<(() => void) | null>(null)
  const lastCursorPositionRef = useRef<monaco.IPosition | null>(null)
  const lastLocalCodeRef = useRef<string | null>(null)

  const { runCode } = useCodeRunner()

  useEffect(() => {
    const handleFormat = () => {
      monacoRef.current?.getAction('editor.action.formatDocument')?.run()
    }
    window.addEventListener('trigger-format', handleFormat)

    return () => {
      window.removeEventListener('trigger-format', handleFormat)
      // Dispose Monaco providers on unmount
      disposeMonacoProviders()
      // Dispose ATA subscription
      if (ataDisposeRef.current) {
        ataDisposeRef.current()
      }
    }
  }, [])

  // Restore cursor position and focus when language changes (which triggers a model switch)
  const cleanupModels = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    const currentModel = editorInstance.getModel()
    const currentUri = currentModel?.uri.toString()
    
    if (monacoInstanceRef.current) {
      const models = monacoInstanceRef.current.editor.getModels()
      
      models.forEach((m: editor.ITextModel) => {
        const uri = m.uri.toString()
        // Don't dispose the current model OR the result output model
        if (uri !== currentUri && !uri.includes('result-output.js') && !m.isDisposed()) {
          if (uri.startsWith('inmemory') || uri.startsWith('file:')) {
             try {
               m.dispose()
             } catch (e) {
               console.error('[Editor] Error disposing model:', e)
             }
          }
        }
      })
    }
  }, [])

  useEffect(() => {
    if (monacoRef.current) {
      // Sync content if needed
      const model = monacoRef.current.getModel()
      const currentVal = model?.getValue()
      
      if (model && currentVal !== code) {
        // If the update matches what we just typed locally, ignore it
        if (code === lastLocalCodeRef.current) {
          return
        }

        // If the editor has focus, we prioritize local state to prevent
        // race conditions where the store lags behind fast typing.
        // We assume any valid external update (like loading a snippet)
        // will come from a UI interaction that momentarily takes focus away.
        if (monacoRef.current.hasTextFocus()) {
          return
        }

        // If the code is different, update it
        // Use executeEdits to preserve undo stack and potential cursor logic if possible
        // But setValue is safer for full replacements
        model.setValue(code)
      
        // For external updates (like loading a snippet), move cursor to end of file
        // instead of trying to restore previous position which might be invalid
        const lineCount = model.getLineCount()
        const maxCol = model.getLineMaxColumn(lineCount)
        const pos = { lineNumber: lineCount, column: maxCol }
        
        monacoRef.current.setPosition(pos)
        monacoRef.current.revealPosition(pos)
        
        // Delay focus to ensure UI is ready and prevent focus stealing
        setTimeout(() => {
          if (monacoRef.current) {
             monacoRef.current.focus()
          }
        }, 250)
      }
      
      // ONLY cleanup models if language changed, not on every code change
      // cleanupModels(monacoRef.current)
    }
  }, [language, code]) // Removed cleanupModels from dependencies to avoid loop

  // Effect to handle language changes and cleanup
  useEffect(() => {
    if (monacoRef.current) {
       const model = monacoRef.current.getModel()
       if (model) {
         // Update the language of the existing model without replacing it
         monaco.editor.setModelLanguage(model, language)
       }
    }
  }, [language])

  const handleEditorWillMount = useCallback((monaco: Monaco) => {
    monacoInstanceRef.current = monaco
    configureMonaco(monaco)
  }, [])

  const handleEditorDidMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      monacoRef.current = editorInstance

      // Expose monaco to window for E2E testing
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        // @ts-expect-error - Exposing monaco to window for testing
        window.monaco = monaco
        // @ts-expect-error - Exposing editor to window for testing
        window.editor = editorInstance
        // @ts-expect-error - Exposing store to window for testing
        window.useCodeStore = useCodeStore
      }


      // Setup ATA
      ataDisposeRef.current = setupTypeAcquisition(monaco)

      // Register hover and code action providers
      registerMonacoProviders(monaco, editorInstance)
      
      // Cleanup old models immediately on mount
      cleanupModels(editorInstance)

      // Register custom commands for package management using Monaco's command system
      // This is required for CodeActions to work properly (addAction doesn't work with CodeAction commands)
      monaco.editor.registerCommand('cheeseJS.installPackage', async (_accessor, packageName: string) => {
        console.log('[Editor] Installing package:', packageName)
        if (window.packageManager) {
          usePackagesStore.getState().addPackage(packageName)
          usePackagesStore.getState().setPackageInstalling(packageName, true)
          const result = await window.packageManager.install(packageName)
          if (result.success) {
            usePackagesStore.getState().setPackageInstalled(packageName, result.version)
          } else {
            usePackagesStore.getState().setPackageError(packageName, result.error)
          }
        } else {
          usePackagesStore.getState().addPackage(packageName)
        }
      })

      // Track cursor position to ensure we always have the latest position
      // even if the user didn't type (just moved cursor)
      editorInstance.onDidChangeCursorPosition((e) => {
        lastCursorPositionRef.current = e.position
      })

      monaco.editor.registerCommand('cheeseJS.installAndRun', async (_accessor, packageName: string) => {
        console.log('[Editor] Installing package and running:', packageName)
        if (window.packageManager) {
          usePackagesStore.getState().addPackage(packageName)
          usePackagesStore.getState().setPackageInstalling(packageName, true)
          const result = await window.packageManager.install(packageName)
          if (result.success) {
            usePackagesStore.getState().setPackageInstalled(packageName, result.version)
            // Run code after successful install
            const code = editorInstance.getValue()
            runCode(code)
          } else {
            usePackagesStore.getState().setPackageError(packageName, result.error)
          }
        } else {
          usePackagesStore.getState().addPackage(packageName)
          setTimeout(() => {
            const code = editorInstance.getValue()
            runCode(code)
          }, 100)
        }
      })

      monaco.editor.registerCommand('cheeseJS.retryInstall', async (_accessor, packageName: string) => {
        console.log('[Editor] Retrying install:', packageName)
        const store = usePackagesStore.getState()
        store.resetPackageAttempts(packageName)
        store.setPackageInstalling(packageName, true)
        if (window.packageManager) {
          const result = await window.packageManager.install(packageName)
          if (result.success) {
            store.setPackageInstalled(packageName, result.version)
          } else {
            store.setPackageError(packageName, result.error)
          }
        }
      })

      monaco.editor.registerCommand('cheeseJS.uninstallPackage', async (_accessor, packageName: string) => {
        console.log('[Editor] Uninstalling package:', packageName)
        if (window.packageManager) {
          const result = await window.packageManager.uninstall(packageName)
          if (result.success) {
            usePackagesStore.getState().removePackage(packageName)
          }
        } else {
          usePackagesStore.getState().removePackage(packageName)
        }
      })

      monaco.editor.registerCommand('cheeseJS.viewOnNpm', (_accessor, packageName: string) => {
        console.log('[Editor] Opening npm for:', packageName)
        window.open(`https://www.npmjs.com/package/${packageName}`, '_blank')
      })
    },
    [runCode, cleanupModels]
  )

  const debouncedRunner = useDebouncedFunction(runCode, 250)

  const handler = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        if (monacoRef.current) {
          lastCursorPositionRef.current = monacoRef.current.getPosition()
        }
        lastLocalCodeRef.current = value
        setCode(value)
        const detected = detectLanguage(value)
        if (detected !== language) {
          setLanguage(detected)
        }
        debouncedRunner(value)
      }
    },
    [debouncedRunner, language, setCode, setLanguage]
  )

  return (
    <div className="h-full w-full">
      <Editor
        // Fixed path to prevent model swapping on language change
        path="index.ts" 
        defaultLanguage="typescript"
        // language prop removed to prevent automatic model recreation by the wrapper
        // We handle language updates manually via monaco.editor.setModelLanguage in useEffect
        theme={themeName}
        options={{
          automaticLayout: true,
          dragAndDrop: true,
          minimap: {
            enabled: false // Keeping disabled as per original, but user can change if requested
          },
          padding: {
            top: 16,
            bottom: 16
          },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto'
          },
          fontSize,
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          wordWrap: 'on',
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          tabCompletion: 'on',
          lightbulb: {
            enabled: editor.ShowLightbulbIconMode.On
          },
          hover: {
            enabled: true,
            delay: 300,
            sticky: true
          },
          parameterHints: {
            enabled: true
          },
          suggest: {
            showWords: true,
            showModules: true,
            showFunctions: true,
            showVariables: true
          },
          contextmenu: true, // Enabled context menu
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on'
        }}
        onChange={handler}
        defaultValue={code}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
      />
    </div>
  )
}

export default function WrappedCodeEditor() {
  return (
    <EditorErrorBoundary>
      <CodeEditor />
    </EditorErrorBoundary>
  )
}