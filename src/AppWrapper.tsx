import { useEffect, useRef } from 'react'
import { useWebContainerStore } from './store/useWebContainerStore'
import { useSettingsStore } from './store/useSettingsStore'
import { themesConfig } from './themes'
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
  const bootProgress = useWebContainerStore((state) => state.bootProgress)
  const { themeName, uiFontSize } = useSettingsStore()
  const initialized = useRef(false)

  // Apply theme and font size globally
  useEffect(() => {
    const theme = themesConfig[themeName]
    const isDark = theme?.type === 'dark'
    
    document.documentElement.classList.toggle('dark', isDark)
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme.name)
    }
  }, [themeName])

  useEffect(() => {
    document.documentElement.style.fontSize = `${uiFontSize}px`
  }, [uiFontSize])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      bootWebContainer()
    }
  }, [bootWebContainer])

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingIndicator message={bootProgress || "Initializing WebContainer..."} size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
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
