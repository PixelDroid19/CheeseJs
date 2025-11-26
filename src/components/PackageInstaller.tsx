import { useEffect } from 'react'
import { usePackagesStore } from '../store/usePackagesStore'
import { useWebContainerStore } from '../store/useWebContainerStore'
import { useCodeStore } from '../store/useCodeStore'
import { useCodeRunner } from '../hooks/useCodeRunner'

export function PackageInstaller () {
  const webContainer = useWebContainerStore(state => state.webContainer)
  const packages = usePackagesStore(state => state.packages)
  const isInstalling = usePackagesStore(state => state.isInstalling)
  const setPackageInstalling = usePackagesStore(state => state.setPackageInstalling)
  const setPackageInstalled = usePackagesStore(state => state.setPackageInstalled)
  const setPackageError = usePackagesStore(state => state.setPackageError)
  const detectedMissingPackages = usePackagesStore(state => state.detectedMissingPackages)
  const setDetectedMissingPackages = usePackagesStore(state => state.setDetectedMissingPackages)
  
  const isPendingRun = useCodeStore(state => state.isPendingRun)
  const setIsPendingRun = useCodeStore(state => state.setIsPendingRun)
  const { runCode } = useCodeRunner()

  // Effect to trigger re-run after installation
  useEffect(() => {
    if (!isPendingRun || isInstalling) return

    // Check if all detected missing packages are now installed
    if (detectedMissingPackages.length === 0) return

    const allResolved = detectedMissingPackages.every(missingPkg => {
      const pkg = packages.find(p => p.name === missingPkg)
      return pkg && pkg.isInstalled
    })

    if (allResolved) {
      setIsPendingRun(false)
      setDetectedMissingPackages([])
      runCode()
    }
  }, [
    isPendingRun,
    isInstalling,
    packages,
    detectedMissingPackages,
    runCode,
    setIsPendingRun,
    setDetectedMissingPackages
  ])

  useEffect(() => {
    if (!webContainer || isInstalling) return

    const nextPackage = packages.find(p => !p.isInstalled && !p.installing && !p.error)

    if (nextPackage) {
      installPackage(nextPackage.name)
    }

    async function installPackage (name: string) {
      if (!webContainer) return

      setPackageInstalling(name, true)

      try {
        const process = await webContainer.spawn('npm', ['install', name])

        // Wait for process to finish
        const exitCode = await process.exit

        if (exitCode === 0) {
          setPackageInstalled(name)
        } else {
          setPackageError(name, `Installation failed with exit code ${exitCode}`)
        }
      } catch (err) {
        setPackageError(name, err instanceof Error ? err.message : 'Unknown error')
      }
    }
  }, [packages, isInstalling, webContainer, setPackageInstalling, setPackageInstalled, setPackageError])

  return null
}
