import { useState, useEffect } from 'react'
import CodeEditor from './components/Editor'
import ResultDisplay from './components/Result'
import Settings from './components/Settings/Settings'
import FloatingToolbar from './components/FloatingToolbar'
import Split from 'react-split'
import { useSettingsStore } from './store/useSettingsStore'

function App () {
  const { uiFontSize, setMagicComments } = useSettingsStore()
  
  useEffect(() => {
    document.documentElement.style.fontSize = `${uiFontSize}px`
  }, [uiFontSize])

  useEffect(() => {
    if (window.electronAPI?.onToggleMagicComments) {
      window.electronAPI.onToggleMagicComments(() => {
        const current = useSettingsStore.getState().magicComments
        setMagicComments(!current)
      })
    }
  }, [setMagicComments])

  const [direction] = useState(() => {
    const storedDirection = window.localStorage.getItem('split-direction')
    if (storedDirection) return storedDirection
    return 'horizontal'
  })

  const [sizes, setSizes] = useState(() => {
    const storedSizes = window.localStorage.getItem('split-sizes')
    if (storedSizes) return JSON.parse(storedSizes)
    return [50, 50]
  })

  function handleDragEnd (e: number[]) {
    const [left, right] = e
    setSizes([left, right])
    window.localStorage.setItem('split-sizes', JSON.stringify([left, right]))
  }

  return (
    <>
      <Settings />
      <FloatingToolbar />
      <Split
        className={`flex ${direction} h-full overflow-hidden`}
        sizes={sizes}
        gutterSize={4}
        cursor="col-resize"
        onDragEnd={handleDragEnd}
      >
        <CodeEditor />
        <ResultDisplay />
      </Split>
    </>
  )
}

export default App
