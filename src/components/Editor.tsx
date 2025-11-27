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

export interface EditorProps {}

function CodeEditor ({}: EditorProps) {
  const code = useCodeStore((state: CodeState) => state.code)
  const language = useCodeStore((state: CodeState) => state.language)
  const { themeName, fontSize } = useSettingsStore()

  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const ataDisposeRef = useRef<(() => void) | null>(null)

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

  const handleEditorWillMount = useCallback((monaco: Monaco) => {
    // Register all themes
    Object.entries(themes).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as editor.IStandaloneThemeData)
    })

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

    // @ts-ignore - Accessing new top-level typescript namespace
    const ts = (monaco as any).typescript

    // Compiler options for both JS and TS
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
      // @ts-ignore
      window.monaco = monaco
      // @ts-ignore
      window.editor = editorInstance

      // Setup ATA
      ataDisposeRef.current = setupTypeAcquisition(monaco)

      // Register hover and code action providers
      registerMonacoProviders(monaco, editorInstance)

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
    [runCode]
  )

  const debouncedRunner = useDebouncedFunction(runCode, 250)

  const handler = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        debouncedRunner(value)
      }
    },
    [debouncedRunner]
  )

  return (
    <div className="h-full w-full">
      <Editor
        defaultLanguage="typescript"
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
