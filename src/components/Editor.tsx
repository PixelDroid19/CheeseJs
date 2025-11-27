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
import { themes } from '../themes'
import { useDebouncedFunction } from '../hooks/useDebounce'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { registerMonacoProviders, disposeMonacoProviders } from '../lib/monacoProviders'
import { setupTypeAcquisition } from '../lib/ata'
import { detectLanguage } from '../lib/languageDetector'
import type { languages } from 'monaco-editor'
import { editor } from 'monaco-editor'

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

// export interface EditorProps {}

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
        if (uri !== currentUri && !uri.includes('result-output.js')) {
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
      // Restore cursor position and focus
      if (lastCursorPositionRef.current) {
        monacoRef.current.setPosition(lastCursorPositionRef.current)
        monacoRef.current.focus()
      }

      // Sync content if needed
      const model = monacoRef.current.getModel()
      if (model && model.getValue() !== code) {
        model.setValue(code)
      }
      
      cleanupModels(monacoRef.current)
    }
  }, [language, code, cleanupModels])

  const handleEditorWillMount = useCallback((monaco: Monaco) => {
    monacoInstanceRef.current = monaco
    // Register all themes
    Object.entries(themes).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as editor.IStandaloneThemeData)
    })
    // ... rest of handleEditorWillMount


    // Shared language configuration
    const languageConfig: languages.LanguageConfiguration = {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '`', close: '`', notIn: ['string', 'comment'] }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '`', close: '`' }
      ],
      folding: {
        markers: {
          start: /^\s*\/\/#region\b/,
          end: /^\s*\/\/#endregion\b/
        }
      },
      wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=[{\]}\\|;:'",.<>/?\s]+)/g,
      indentationRules: {
        increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/,
        decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*[}\])].*$/
      }
    }

    // Configure language features for JavaScript
    monaco.languages.setLanguageConfiguration('javascript', languageConfig)

    // Configure language features for TypeScript
    monaco.languages.setLanguageConfiguration('typescript', {
      ...languageConfig,
      brackets: [
        ...(languageConfig.brackets || []),
        ['<', '>']
      ],
      autoClosingPairs: [
        ...(languageConfig.autoClosingPairs || []),
        { open: '<', close: '>', notIn: ['string', 'comment'] }
      ],
      surroundingPairs: [
        ...(languageConfig.surroundingPairs || []),
        { open: '<', close: '>' }
      ]
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = (monaco as any).typescript

    // Compiler options for both JS and TS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const compilerOptions: any = {
      target: ts.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      module: ts.ModuleKind.ESNext,
      allowJs: true,
      checkJs: true,
      noEmit: true,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      reactNamespace: 'React',
      allowSyntheticDefaultImports: true,
      // Disable unused warnings as per user request
      noUnusedLocals: false,
      noUnusedParameters: false
    }

    ts.javascriptDefaults.setCompilerOptions(compilerOptions)
    ts.typescriptDefaults.setCompilerOptions(compilerOptions)

    // Eager sync for better performance in small files
    ts.javascriptDefaults.setEagerModelSync(true)
    ts.typescriptDefaults.setEagerModelSync(true)

    // Diagnostics options
    const diagnosticsOptions = {
      noSemanticValidation: false,
      noSyntaxValidation: false
    }
    ts.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions)
    ts.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions)
  }, [])

  const handleEditorDidMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      monacoRef.current = editorInstance

      // Expose monaco to window for E2E testing
      // @ts-expect-error - Exposing monaco to window for testing
      window.monaco = monaco
      // @ts-expect-error - Exposing editor to window for testing
      window.editor = editorInstance
      // @ts-expect-error - Exposing store to window for testing
      window.useCodeStore = useCodeStore


      // Setup ATA
      ataDisposeRef.current = setupTypeAcquisition(monaco)

      // Register hover and code action providers
      registerMonacoProviders(monaco, editorInstance)
      
      // Cleanup old models immediately on mount
      cleanupModels(editorInstance)

      // Register custom commands for package management
      editorInstance.addAction({
        id: 'cheeseJS.installPackage',
        label: 'Install Package',
        run: (_ed, packageName: string) => {
          usePackagesStore.getState().addPackage(packageName)
        }
      })

      editorInstance.addAction({
        id: 'cheeseJS.installAndRun',
        label: 'Install Package and Run',
        run: async (ed, packageName: string) => {
          usePackagesStore.getState().addPackage(packageName)
          // Wait a bit for state update, then run code
          setTimeout(() => {
            const code = ed.getValue()
            runCode(code)
          }, 100)
        }
      })

      editorInstance.addAction({
        id: 'cheeseJS.retryInstall',
        label: 'Retry Install',
        run: (_ed, packageName: string) => {
          const store = usePackagesStore.getState()
          store.removePackage(packageName)
          store.addPackage(packageName)
        }
      })

      editorInstance.addAction({
        id: 'cheeseJS.uninstallPackage',
        label: 'Uninstall Package',
        run: (_ed, packageName: string) => {
          usePackagesStore.getState().removePackage(packageName)
        }
      })

      editorInstance.addAction({
        id: 'cheeseJS.viewOnNpm',
        label: 'View Package on npm',
        run: (_ed, packageName: string) => {
          window.open(`https://www.npmjs.com/package/${packageName}`, '_blank')
        }
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
        key={language} // Force remount on language change to ensure clean model switch
        path={language === 'typescript' ? 'index.ts' : 'index.js'}
        defaultLanguage={language}
        language={language}
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

export default CodeEditor
