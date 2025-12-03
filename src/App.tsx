import { useEffect } from 'react'
import CodeEditor from './components/Editor'
import ResultDisplay from './components/Result'
import Settings from './components/Settings/Settings'
import FloatingToolbar from './components/FloatingToolbar'
import { Layout } from './components/Layout'
import { useSettingsStore } from './store/useSettingsStore'
import { usePackagesStore } from './store/usePackagesStore'

function App() {
  const { setMagicComments } = useSettingsStore()
  const addPackage = usePackagesStore((state) => state.addPackage)
  const setPackageInstalled = usePackagesStore((state) => state.setPackageInstalled)

  // Load installed packages from disk on app start
  useEffect(() => {
    const loadInstalledPackages = async () => {
      if (!window.packageManager) return

      try {
        const result = await window.packageManager.list()
        if (result.success && result.packages) {
          for (const pkg of result.packages) {
            addPackage(pkg.name, pkg.version)
            setPackageInstalled(pkg.name, pkg.version)
          }
          console.log(`[App] Loaded ${result.packages.length} installed packages`)
        }
      } catch (error) {
        console.error('[App] Error loading installed packages:', error)
      }
    }

    loadInstalledPackages()
  }, [addPackage, setPackageInstalled])

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
      <Layout>
        <CodeEditor />
        <ResultDisplay />
      </Layout>
    </>
  )
}

export default App
