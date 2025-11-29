import { useEffect, useRef } from 'react'
import { useWebContainerStore } from './store/useWebContainerStore'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingIndicator from './components/LoadingIndicator'
import { PackageInstaller } from './components/PackageInstaller'
import { TitleBar } from './components/TitleBar'
import App from './App'

function AppWrapper () {
  const bootWebContainer = useWebContainerStore(
    (state) => state.bootWebContainer
  )
  const isLoading = useWebContainerStore((state) => state.isLoading)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      bootWebContainer()
    }
  }, [bootWebContainer])

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-[#1e1e1e]">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingIndicator message="Initializing WebContainer..." size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e]">
      <TitleBar />
      <div className="flex-1 overflow-hidden relative">
        <ErrorBoundary>
          <PackageInstaller />
          <App />
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default AppWrapper
