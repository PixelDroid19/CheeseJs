import { useEffect } from 'react'
import { useSettingsStore } from './store/useSettingsStore'
import { themesConfig } from './themes'
import ErrorBoundary from './components/ErrorBoundary'
import { TitleBar } from './components/TitleBar'
import App from './App'

function AppWrapper () {
  const { themeName, uiFontSize } = useSettingsStore()

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

  return (
    <div className="flex flex-col h-screen bg-background">
      <TitleBar />
      <div className="flex-1 overflow-hidden relative">
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default AppWrapper
