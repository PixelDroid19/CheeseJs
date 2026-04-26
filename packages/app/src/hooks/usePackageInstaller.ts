/**
 * Hook for managing npm packages via Electron IPC
 */

import { useCallback } from 'react';
import { usePackagesStore } from '../store/storeHooks';
import {
  installNpmPackage,
  listInstalledNpmPackages,
  uninstallNpmPackage,
} from '../host/packageManagement';

export function usePackageInstaller() {
  const addPackage = usePackagesStore((state) => state.addPackage);
  const setPackageInstalling = usePackagesStore(
    (state) => state.setPackageInstalling
  );
  const setPackageInstalled = usePackagesStore(
    (state) => state.setPackageInstalled
  );
  const setPackageError = usePackagesStore((state) => state.setPackageError);
  const removePackage = usePackagesStore((state) => state.removePackage);
  const incrementInstallAttempt = usePackagesStore(
    (state) => state.incrementInstallAttempt
  );

  /**
   * Install a package
   */
  const installPackage = useCallback(
    async (packageName: string) => {
      // Add to store if not exists
      addPackage(packageName);

      // Mark as installing
      setPackageInstalling(packageName, true);
      incrementInstallAttempt(packageName);

      try {
        const result = await installNpmPackage(packageName);

        if (result.success) {
          setPackageInstalled(packageName, result.version);
          return result;
        } else {
          console.error(
            `[usePackageInstaller] Failed to install ${packageName}:`,
            result.error
          );
          setPackageError(packageName, result.error);
          return result;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[usePackageInstaller] Error installing ${packageName}:`,
          errorMessage
        );
        setPackageError(packageName, errorMessage);
        return { success: false, packageName, error: errorMessage };
      }
    },
    [
      addPackage,
      setPackageInstalling,
      setPackageInstalled,
      setPackageError,
      incrementInstallAttempt,
    ]
  );

  /**
   * Uninstall a package
   */
  const uninstallPackage = useCallback(
    async (packageName: string) => {
      try {
        const result = await uninstallNpmPackage(packageName);

        if (result.success) {
          removePackage(packageName);
          return result;
        } else {
          console.error(
            `[usePackageInstaller] Failed to uninstall ${packageName}:`,
            result.error
          );
          return result;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[usePackageInstaller] Error uninstalling ${packageName}:`,
          errorMessage
        );
        return { success: false, packageName, error: errorMessage };
      }
    },
    [removePackage]
  );

  /**
   * Load installed packages from disk on mount
   */
  const loadInstalledPackages = useCallback(async () => {
    try {
      const result = await listInstalledNpmPackages();
      if (result.success && result.packages) {
        for (const pkg of result.packages) {
          addPackage(pkg.name, pkg.version);
          setPackageInstalled(pkg.name, pkg.version);
        }
      }
    } catch (error) {
      console.error(
        '[usePackageInstaller] Error loading installed packages:',
        error
      );
    }
  }, [addPackage, setPackageInstalled]);

  return {
    installPackage,
    uninstallPackage,
    loadInstalledPackages,
  };
}
