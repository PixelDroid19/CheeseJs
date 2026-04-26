/**
 * Python Package Manager Component
 *
 * UI for managing Python packages via micropip (PyPI)
 */

import { useState, useEffect, useCallback } from 'react';
import { PythonPackageManagerPanel } from '@cheesejs/package-management';
import { usePythonPackagesStore } from '../store/storeHooks';
import {
  installPythonPackage,
  listInstalledPythonPackages,
} from '../host/packageManagement';

export function PythonPackageManager() {
  const [packageName, setPackageName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    packages,
    addPackage,
    removePackage,
    setPackageInstalling,
    setPackageInstalled,
    setPackageError,
  } = usePythonPackagesStore();

  const loadInstalledPackages = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await listInstalledPythonPackages();

      if (result.success && result.packages) {
        // Update store with installed packages
        result.packages.forEach((name: string) => {
          addPackage(name);
          setPackageInstalled(name);
        });
      }
    } catch (error) {
      console.error('[PythonPackageManager] Error loading packages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [addPackage, setPackageInstalled]);

  // Load installed packages on mount
  useEffect(() => {
    loadInstalledPackages();
  }, [loadInstalledPackages]);

  const handleInstallPackage = async () => {
    if (!packageName.trim()) return;

    const name = packageName.trim();
    setPackageName('');

    // Add to store and mark as installing
    addPackage(name);
    setPackageInstalling(name, true);

    try {
      const result = await installPythonPackage(name);

      if (result.success) {
        setPackageInstalled(name);
      } else {
        setPackageError(name, result.error || 'Installation failed');
      }
    } catch (error) {
      setPackageError(
        name,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  const handleRemovePackage = (name: string) => {
    // Note: micropip doesn't support uninstall, just remove from UI
    removePackage(name);
  };

  const handleRetryInstall = async (name: string) => {
    setPackageInstalling(name, true);

    try {
      const result = await installPythonPackage(name);

      if (result.success) {
        setPackageInstalled(name);
      } else {
        setPackageError(name, result.error || 'Installation failed');
      }
    } catch (error) {
      setPackageError(
        name,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  return (
    <PythonPackageManagerPanel
      packages={packages}
      packageName={packageName}
      onPackageNameChange={setPackageName}
      onAddPackage={handleInstallPackage}
      onRemovePackage={handleRemovePackage}
      onRetryInstall={handleRetryInstall}
      isLoading={isLoading}
    />
  );
}

export default PythonPackageManager;
