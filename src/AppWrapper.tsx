import { useEffect } from 'react'
import { useWebContainerStore } from './store/useWebContainerStore'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingIndicator from './components/LoadingIndicator'
import App from './App'

function AppWrapper () {
  const bootWebContainer = useWebContainerStore(
    (state) => state.bootWebContainer
  )
  const isLoading = useWebContainerStore((state) => state.isLoading)

  useEffect(() => {
    bootWebContainer()
  }, [bootWebContainer])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e]">
        <LoadingIndicator message="Initializing WebContainer..." size="lg" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

export default AppWrapper
