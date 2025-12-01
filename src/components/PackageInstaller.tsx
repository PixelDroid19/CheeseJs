import { useEffect, useRef } from 'react'
import { usePackagesStore, MAX_INSTALL_ATTEMPTS } from '../store/usePackagesStore'
import { useWebContainerStore } from '../store/useWebContainerStore'
import { useCodeStore } from '../store/useCodeStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { 
  packageLogger,
  logInstallStart, 
  logInstallSuccess, 
  logInstallFailure,
  logAutoRunPending,
  logAutoRunStart,
  logAutoRunComplete,
  logAutoRunFailed,
  logAutoRunSkipped
} from '../lib/logging/packageLogger'

// Delay between retry attempts (exponential backoff)
const RETRY_DELAYS = [1000, 2000, 4000] // 1s, 2s, 4s

export function PackageInstaller () {
  const webContainer = useWebContainerStore(state => state.webContainer)
  const packages = usePackagesStore(state => state.packages)
  const isInstalling = usePackagesStore(state => state.isInstalling)
  const setPackageInstalling = usePackagesStore(state => state.setPackageInstalling)
  const setPackageInstalled = usePackagesStore(state => state.setPackageInstalled)
  const setPackageError = usePackagesStore(state => state.setPackageError)
  const detectedMissingPackages = usePackagesStore(state => state.detectedMissingPackages)
  const setDetectedMissingPackages = usePackagesStore(state => state.setDetectedMissingPackages)
  const canRetryInstall = usePackagesStore(state => state.canRetryInstall)
  const incrementInstallAttempt = usePackagesStore(state => state.incrementInstallAttempt)
  
  const code = useCodeStore(state => state.code)
  const isPendingRun = useCodeStore(state => state.isPendingRun)
  const setIsPendingRun = useCodeStore(state => state.setIsPendingRun)
  const autoRunAfterInstall = useSettingsStore(state => state.autoRunAfterInstall)

  // Track installation start times for duration logging
  const installStartTimes = useRef<Map<string, number>>(new Map())
  
  // Track if we're currently doing an auto-run to prevent loops
  const isAutoRunning = useRef(false)

  // Log when packages are detected as missing
  useEffect(() => {
    if (detectedMissingPackages.length > 0 && isPendingRun) {
      logAutoRunPending(detectedMissingPackages)
    }
  }, [detectedMissingPackages, isPendingRun])

  // Effect to trigger re-run after all required packages are installed
  useEffect(() => {
    // Skip if no pending run
    if (!isPendingRun) {
      return
    }

    // Check if we're still installing any package
    const stillInstalling = packages.some(p => p.installing)
    if (stillInstalling) {
      return
    }

    // If detectedMissingPackages is empty but isPendingRun is true,
    // it might be a timing issue. Wait for the next render.
    if (detectedMissingPackages.length === 0) {
      // Check if there are packages that were recently added but not yet in detectedMissingPackages
      const hasUninstalledPackages = packages.some(p => !p.isInstalled && !p.installing && !p.error)
      if (hasUninstalledPackages) {
        return
      }
      
      // If all packages in store are installed, check if we can run
      const allStorePackagesInstalled = packages.length > 0 && packages.every(p => p.isInstalled)
      if (!allStorePackagesInstalled) {
        setIsPendingRun(false)
        return
      }
    } else {
      // Check if ALL detected missing packages are now installed
      const allInstalled = detectedMissingPackages.every(pkgName => {
        const pkg = packages.find(p => p.name === pkgName)
        return pkg && pkg.isInstalled === true
      })

      // Check if any package has a permanent error (exceeded retries)
      const hasUnrecoverableError = detectedMissingPackages.some(pkgName => {
        const pkg = packages.find(p => p.name === pkgName)
        return pkg && pkg.error && pkg.installAttempts >= MAX_INSTALL_ATTEMPTS
      })

      if (hasUnrecoverableError) {
        logAutoRunSkipped('Some packages failed to install after maximum retry attempts')
        setIsPendingRun(false)
        setDetectedMissingPackages([])
        return
      }

      if (!allInstalled) {
        return
      }
    }
    
    if (!autoRunAfterInstall) {
      logAutoRunSkipped('Auto-run is disabled in settings')
      setIsPendingRun(false)
      setDetectedMissingPackages([])
      return
    }

    // Prevent re-entry
    if (isAutoRunning.current) {
      return
    }
    
    isAutoRunning.current = true
    const startTime = Date.now()
    logAutoRunStart('package-install')
    
    // Clear state before running
    setIsPendingRun(false)
    setDetectedMissingPackages([])
    
    // Import and use runInWebContainer directly to avoid circular deps
    import('../lib/code/runWebContainer').then(({ runInWebContainer }) => {
      import('../store/useCodeStore').then(({ useCodeStore }) => {
        const { appendResult, clearResult, setIsExecuting } = useCodeStore.getState()
        const { showTopLevelResults, loopProtection, showUndefined, internalLogLevel, npmRcContent, magicComments } = useSettingsStore.getState()
        
        clearResult()
        setIsExecuting(true)
        
        runInWebContainer(
          webContainer!,
          code,
          (result) => appendResult(result),
          { showTopLevelResults, loopProtection, showUndefined, internalLogLevel, npmRcContent, magicComments }
        ).then(() => {
          logAutoRunComplete(startTime)
          setIsExecuting(false)
        }).catch((error) => {
          logAutoRunFailed(error instanceof Error ? error.message : 'Unknown error')
          setIsExecuting(false)
        }).finally(() => {
          isAutoRunning.current = false
        })
      })
    })
  }, [
    isPendingRun,
    packages,
    detectedMissingPackages,
    setIsPendingRun,
    setDetectedMissingPackages,
    autoRunAfterInstall,
    webContainer,
    code
  ])

  useEffect(() => {
    if (!webContainer || isInstalling) return

    // Find next package to install (not installed, not currently installing, no error OR can retry)
    const nextPackage = packages.find(p => {
      if (p.isInstalled || p.installing) return false
      if (p.error) {
        // Check if we can retry
        return canRetryInstall(p.name)
      }
      return true
    })

    if (nextPackage) {
      installPackage(nextPackage.name)
    }

    async function installPackage (name: string) {
      if (!webContainer) return

      // Increment attempt counter and get current attempt number
      const attempt = incrementInstallAttempt(name)
      
      // Check if we've exceeded max attempts
      if (attempt > MAX_INSTALL_ATTEMPTS) {
        logInstallFailure(name, `Exceeded maximum installation attempts (${MAX_INSTALL_ATTEMPTS})`, attempt, false)
        return
      }

      // Calculate retry delay if this is a retry
      if (attempt > 1) {
        const delay = RETRY_DELAYS[attempt - 2] || RETRY_DELAYS[RETRY_DELAYS.length - 1]
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      setPackageInstalling(name, true)
      
      // Log start and track timing
      const startTime = Date.now()
      installStartTimes.current.set(name, startTime)
      logInstallStart(name, attempt, MAX_INSTALL_ATTEMPTS)

      try {
        const process = await webContainer.spawn('npm', ['install', name])

        // Wait for process to finish
        const exitCode = await process.exit

        if (exitCode === 0) {
          installStartTimes.current.delete(name)
          logInstallSuccess(name, undefined, startTime)
          setPackageInstalled(name)
        } else {
          const errorMessage = `Installation failed with exit code ${exitCode}`
          const willRetry = attempt < MAX_INSTALL_ATTEMPTS
          logInstallFailure(name, errorMessage, attempt, willRetry)
          setPackageError(name, errorMessage, `EXIT_CODE_${exitCode}`)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        const willRetry = attempt < MAX_INSTALL_ATTEMPTS
        logInstallFailure(name, errorMessage, attempt, willRetry)
        setPackageError(name, errorMessage, 'SPAWN_ERROR')
      }
    }
  }, [
    packages, 
    isInstalling, 
    webContainer, 
    setPackageInstalling, 
    setPackageInstalled, 
    setPackageError,
    canRetryInstall,
    incrementInstallAttempt
  ])

  // Configure logger based on environment
  useEffect(() => {
    packageLogger.configure({
      consoleOutput: process.env.NODE_ENV === 'development',
      enabled: true
    })
  }, [])

  return null
}
