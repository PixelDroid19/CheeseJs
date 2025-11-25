import { useRef, useCallback, useEffect } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import { useCodeStore } from '../store/useCodeStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { usePackagesStore } from '../store/usePackagesStore'
import { themes } from '../themes'
import { useDebouncedFunction } from '../hooks/useDebounce'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { registerMonacoProviders, disposeMonacoProviders } from '../lib/monacoProviders'
import { setupTypeAcquisition } from '../lib/ata'
import type { editor, languages } from 'monaco-editor'

function CodeEditor () {
  const code = useCodeStore((state) => state.code)
  const language = useCodeStore((state) => state.language)
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

    // Compiler options for both JS and TS
    const compilerOptions: languages.typescript.CompilerOptions = {
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      allowJs: true,
      checkJs: true,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowSyntheticDefaultImports: true,
      // Disable unused warnings as per user request
      noUnusedLocals: false,
      noUnusedParameters: false
    }

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions)
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions)

    // Eager sync for better performance in small files
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true)
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)

    // Diagnostics options
    const diagnosticsOptions = {
      noSemanticValidation: false,
      noSyntaxValidation: false
    }
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions)
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions)
  }, [])

  const handleEditorDidMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      monacoRef.current = editorInstance

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
            enabled: true
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
