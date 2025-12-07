import { useEffect, lazy, Suspense } from 'react'
import FloatingToolbar from './components/FloatingToolbar'
import { Layout } from './components/Layout'
import { useSettingsStore } from './store/useSettingsStore'
import { usePackagesStore, type PackagesState } from './store/usePackagesStore'

// Lazy load Settings (modal, not critical path)
const Settings = lazy(() => import('./components/Settings/Settings'))

// Keep Editor and Result as regular imports since they're in the critical render path
// and react-split needs direct children
import CodeEditor from './components/Editor'
import ResultDisplay from './components/Result'
import { InputTooltip } from './components/InputTooltip'

function App() {
  const { setMagicComments } = useSettingsStore()
  const addPackage = usePackagesStore((state: PackagesState) => state.addPackage)
  const setPackageInstalled = usePackagesStore((state: PackagesState) => state.setPackageInstalled)

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
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
      <FloatingToolbar />
      <InputTooltip />
      <Layout>
        <CodeEditor />
        <ResultDisplay />
      </Layout>
    </>
  )
}

export default App
