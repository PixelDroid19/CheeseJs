/**
 * Hook for managing npm packages via Electron IPC
 */

import { useCallback, useEffect } from 'react'
import { usePackagesStore } from '../store/usePackagesStore'

export function usePackageInstaller() {
  const addPackage = usePackagesStore((state) => state.addPackage)
  const setPackageInstalling = usePackagesStore((state) => state.setPackageInstalling)
  const setPackageInstalled = usePackagesStore((state) => state.setPackageInstalled)
  const setPackageError = usePackagesStore((state) => state.setPackageError)
  const removePackage = usePackagesStore((state) => state.removePackage)
  const incrementInstallAttempt = usePackagesStore((state) => state.incrementInstallAttempt)

  /**
   * Install a package
   */
  const installPackage = useCallback(async (packageName: string) => {
    if (!window.packageManager) {
      console.error('[usePackageInstaller] Package manager not available')
      setPackageError(packageName, 'Package manager not available')
      return { success: false, error: 'Package manager not available' }
    }

    // Add to store if not exists
    addPackage(packageName)
    
    // Mark as installing
    setPackageInstalling(packageName, true)
    incrementInstallAttempt(packageName)

    try {
      console.log(`[usePackageInstaller] Installing ${packageName}...`)
      const result = await window.packageManager.install(packageName)

      if (result.success) {
        console.log(`[usePackageInstaller] Successfully installed ${packageName}@${result.version}`)
        setPackageInstalled(packageName, result.version)
        return result
      } else {
        console.error(`[usePackageInstaller] Failed to install ${packageName}:`, result.error)
        setPackageError(packageName, result.error)
        return result
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[usePackageInstaller] Error installing ${packageName}:`, errorMessage)
      setPackageError(packageName, errorMessage)
      return { success: false, packageName, error: errorMessage }
    }
  }, [addPackage, setPackageInstalling, setPackageInstalled, setPackageError, incrementInstallAttempt])

  /**
   * Uninstall a package
   */
  const uninstallPackage = useCallback(async (packageName: string) => {
    if (!window.packageManager) {
      console.error('[usePackageInstaller] Package manager not available')
      return { success: false, error: 'Package manager not available' }
    }

    try {
      console.log(`[usePackageInstaller] Uninstalling ${packageName}...`)
      const result = await window.packageManager.uninstall(packageName)

      if (result.success) {
        console.log(`[usePackageInstaller] Successfully uninstalled ${packageName}`)
        removePackage(packageName)
        return result
      } else {
        console.error(`[usePackageInstaller] Failed to uninstall ${packageName}:`, result.error)
        return result
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[usePackageInstaller] Error uninstalling ${packageName}:`, errorMessage)
      return { success: false, packageName, error: errorMessage }
    }
  }, [removePackage])

  /**
   * Load installed packages from disk on mount
   */
  const loadInstalledPackages = useCallback(async () => {
    if (!window.packageManager) return

    try {
      const result = await window.packageManager.list()
      if (result.success && result.packages) {
        for (const pkg of result.packages) {
          addPackage(pkg.name, pkg.version)
          setPackageInstalled(pkg.name, pkg.version)
        }
        console.log(`[usePackageInstaller] Loaded ${result.packages.length} installed packages`)
      }
    } catch (error) {
      console.error('[usePackageInstaller] Error loading installed packages:', error)
    }
  }, [addPackage, setPackageInstalled])

  // Load installed packages on mount
  useEffect(() => {
    loadInstalledPackages()
  }, [loadInstalledPackages])

  return {
    installPackage,
    uninstallPackage,
    loadInstalledPackages
  }
}
