import { useEffect } from 'react'
import { useWebContainerStore } from './store/useWebContainerStore'
import App from './App'

function AppWrapper () {
  const bootWebContainer = useWebContainerStore(
    (state) => state.bootWebContainer
  )

  useEffect(() => {
    bootWebContainer()
  }, [bootWebContainer])

  return <App />
}

export default AppWrapper
