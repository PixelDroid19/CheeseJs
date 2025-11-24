import { useState } from 'react'
import Editor from './components/Editor'
import Result from './components/Result'
import Settings from './components/Settings'
import FloatingToolbar from './components/FloatingToolbar'
import Split from 'react-split'

function App () {
  const [direction] = useState(() => {
    const direction = window.localStorage.getItem('split-direction')
    if (direction) return direction
    return 'horizontal'
  })

  const [sizes, setSizes] = useState(() => {
    const sizes = window.localStorage.getItem('split-sizes')
    if (sizes) return JSON.parse(sizes)
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
        <Editor />
        <Result />
      </Split>
    </>
  )
}

export default App
