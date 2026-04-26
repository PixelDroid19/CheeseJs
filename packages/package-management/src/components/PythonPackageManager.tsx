import { useCallback, useEffect, useState } from 'react';

import { PythonPackageManagerPanel } from './PythonPackageManagerPanel';
import type { PythonPackageBridge } from '../bridges/packageManagement';
import type { PythonPackageStoreAdapter } from '../types';

export interface PythonPackageManagerProps {
  bridge: PythonPackageBridge;
  store: PythonPackageStoreAdapter;
}

/**
 * Connected Python package manager using injected store and host bridge adapters.
 */
export function PythonPackageManager({
  bridge,
  store,
}: PythonPackageManagerProps) {
  const [packageName, setPackageName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadInstalledPackages = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await bridge.listInstalled();

      if (result.success && result.packages) {
        result.packages.forEach((name) => {
          store.addPackage(name);
          store.setPackageInstalled(name);
        });
      }
    } catch (error) {
      console.error('[PythonPackageManager] Error loading packages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [bridge, store]);

  useEffect(() => {
    void loadInstalledPackages();
  }, [loadInstalledPackages]);

  const handleInstallPackage = useCallback(
    async (name: string) => {
      store.addPackage(name);
      store.setPackageInstalling(name, true);

      try {
        const result = await bridge.install(name);

        if (result.success) {
          store.setPackageInstalled(name, result.version);
        } else {
          store.setPackageError(name, result.error || 'Installation failed');
        }
      } catch (error) {
        store.setPackageError(
          name,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    },
    [bridge, store]
  );

  const handleAddPackage = async () => {
    if (!packageName.trim()) {
      return;
    }

    const name = packageName.trim();
    setPackageName('');
    await handleInstallPackage(name);
  };

  const handleRetryInstall = async (name: string) => {
    store.setPackageInstalling(name, true);
    await handleInstallPackage(name);
  };

  return (
    <PythonPackageManagerPanel
      packages={store.packages}
      packageName={packageName}
      onPackageNameChange={setPackageName}
      onAddPackage={handleAddPackage}
      onRemovePackage={store.removePackage}
      onRetryInstall={handleRetryInstall}
      isLoading={isLoading}
    />
  );
}
