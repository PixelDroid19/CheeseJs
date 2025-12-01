import { useEffect } from 'react'
import CodeEditor from './components/Editor'
import ResultDisplay from './components/Result'
import Settings from './components/Settings/Settings'
import FloatingToolbar from './components/FloatingToolbar'
import { WebContainerStatus } from './components/WebContainerStatus'
import { Layout } from './components/Layout'
import { useSettingsStore } from './store/useSettingsStore'

function App() {
  const { setMagicComments } = useSettingsStore()

  useEffect(() => {
    if (window.electronAPI?.onToggleMagicComments) {
      window.electronAPI.onToggleMagicComments(() => {
        const current = useSettingsStore.getState().magicComments
        setMagicComments(!current)
      })
    }
  }, [setMagicComments])

  return (
    <>
      <Settings />
      <FloatingToolbar />
      <WebContainerStatus />
      <Layout>
        <CodeEditor />
        <ResultDisplay />
      </Layout>
    </>
  )
}

export default App
