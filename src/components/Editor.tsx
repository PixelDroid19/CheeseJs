import { useRef, useCallback, useEffect } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import { useCodeStore } from '../store/useCodeStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { themes } from '../themes'
import { useDebouncedFunction } from '../hooks/useDebouce'
import { useCodeRunner } from '../hooks/useCodeRunner'
import type { editor } from 'monaco-editor'

function EDITOR () {
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
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true)
  }, [])

  const handleEditorDidMount = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    monacoRef.current = editorInstance
  }, [])

  const debouncedRunner = useDebouncedFunction(runCode, 250)

  const handler = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      debouncedRunner(value)
    }
  }, [debouncedRunner])

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
          wordWrap: 'on'
        }}
        onChange={handler}
        defaultValue={code}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
      />
    </div>
  )
}

export default EDITOR
