import { useRef, useCallback, useEffect } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import { useCodeStore } from '../store/useCodeStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { usePackagesStore } from '../store/usePackagesStore'
import { themes } from '../themes'
import { useDebouncedFunction } from '../hooks/useDebouce'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { registerMonacoProviders, disposeMonacoProviders } from '../lib/monacoProviders'
import type { editor, IDisposable } from 'monaco-editor'

function CodeEditor () {
  const code = useCodeStore((state) => state.code)
  const language = useCodeStore((state) => state.language)
  const { themeName, fontSize } = useSettingsStore()

  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const { runCode } = useCodeRunner()

  useEffect(() => {
    const handleFormat = () => {
      monacoRef.current?.getAction('editor.action.formatDocument')?.run()
    }
    window.addEventListener('trigger-format', handleFormat)
    return () => window.removeEventListener('trigger-format', handleFormat)
  }, [])

  const handleEditorWillMount = useCallback((monaco: Monaco) => {
    // Register all themes
    Object.entries(themes).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as editor.IStandaloneThemeData)
    })
    
    // Configure language features for JavaScript
    monaco.languages.setLanguageConfiguration('javascript', {
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
      wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
      indentationRules: {
        increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/,
        decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*[\}\]\)].*$/
      }
    })
    
    // Configure language features for TypeScript
    monaco.languages.setLanguageConfiguration('typescript', {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
        ['<', '>']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '`', close: '`', notIn: ['string', 'comment'] },
        { open: '<', close: '>', notIn: ['string', 'comment'] }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '`', close: '`' },
        { open: '<', close: '>' }
      ],
      folding: {
        markers: {
          start: /^\s*\/\/#region\b/,
          end: /^\s*\/\/#endregion\b/
        }
      },
      wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
      indentationRules: {
        increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/,
        decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*[\}\]\)].*$/
      }
    })
    
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true)
    
    // Configure TypeScript/JavaScript language features
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    })
    
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      allowJs: true
    })
    
    // Lazy-load Monaco providers when JavaScript or TypeScript is used
    const disposables: IDisposable[] = []
    
    disposables.push(
      monaco.languages.onLanguage('javascript', () => {
        // Providers will be registered on editor mount
      })
    )
    
    disposables.push(
      monaco.languages.onLanguage('typescript', () => {
        // Providers will be registered on editor mount
      })
    )
    
    return () => {
      disposables.forEach((d) => d.dispose())
    }
  }, [])

  const handleEditorDidMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      monacoRef.current = editorInstance

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

      // Cleanup on unmount
      return () => {
        disposeMonacoProviders()
      }
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
    <div>
      <Editor
        defaultLanguage="typescript"
        language={language}
        theme={themeName}
        options={{
          dragAndDrop: true,
          minimap: {
            enabled: false
          },
          overviewRulerLanes: 0,
          scrollbar: {
            vertical: 'hidden'
          },
          fontSize,
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
          contextmenu: false // Disable Monaco's context menu to use native
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
