import { useMemo } from 'react'
import { useCodeStore } from '../store/useCodeStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { themes } from '../themes'
import Editor, { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

function Result () {
  const elements = useCodeStore((state) => state.result)
  const code = useCodeStore((state) => state.code)
  const { themeName, fontSize, alignResults } = useSettingsStore()

  function handleEditorWillMount (monaco: Monaco) {
    // Register all themes
    Object.entries(themes).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as editor.IStandaloneThemeData)
    })
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true)
  }

  const displayValue = useMemo(() => {
    if (!elements || elements.length === 0) return ''

    if (!alignResults) {
      return elements.map(data => data.element?.content || '').join('\n')
    }

    // Align results with source
    const sourceLineCount = code.split('\n').length
    const maxLine = Math.max(sourceLineCount, ...elements.map(e => e.lineNumber || 0))
    const lines = new Array(maxLine).fill('')

    elements.forEach((data) => {
      if (data.lineNumber && data.lineNumber > 0) {
        // Line numbers are 1-based, array is 0-based
        // If multiple results on same line, join them
        const current = lines[data.lineNumber - 1]
        const content = data.element?.content || ''
        lines[data.lineNumber - 1] = current ? `${current} ${content}` : content
      } else {
        // If no line number, just append to the end or handle differently?
        // For now, let's just ignore or append to end
      }
    })

    return lines.join('\n')
  }, [elements, alignResults])

  return (
    <div className=" text-cyan-50 bg-[#1e1e1e]">
      <Editor
        theme={themeName}
        options={{
          domReadOnly: true,
          experimentalWhitespaceRendering: 'svg',
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
          readOnly: true,
          lineNumbers: 'off',
          renderLineHighlight: 'none',
          showUnused: false,
          suggest: {
            selectionMode: 'never',
            previewMode: 'prefix'
          }
        }}
        defaultLanguage="javascript"
        value={displayValue}
        beforeMount={handleEditorWillMount}
      />
    </div>
  )
}

export default Result
