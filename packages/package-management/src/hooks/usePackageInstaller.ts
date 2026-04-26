import { useCallback } from 'react';

import type { NpmPackageBridge } from '../bridges/packageManagement';
import type { NpmPackageStoreAdapter } from '../types';

export interface UsePackageInstallerOptions {
  bridge: NpmPackageBridge;
  store: NpmPackageStoreAdapter;
}

/**
 * Injected npm package installer orchestration for app-level adapters.
 */
export function usePackageInstaller({
  bridge,
  store,
}: UsePackageInstallerOptions) {
  const installPackage = useCallback(
    async (packageName: string) => {
      store.addPackage(packageName);
      store.setPackageInstalling(packageName, true);
      store.incrementInstallAttempt(packageName);

      try {
        const result = await bridge.install(packageName);

        if (result.success) {
          store.setPackageInstalled(packageName, result.version);
          return result;
        }

        console.error(
          `[usePackageInstaller] Failed to install ${packageName}:`,
          result.error
        );
        store.setPackageError(packageName, result.error);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[usePackageInstaller] Error installing ${packageName}:`,
          errorMessage
        );
        store.setPackageError(packageName, errorMessage);
        return { success: false, packageName, error: errorMessage };
      }
    },
    [bridge, store]
  );

  const uninstallPackage = useCallback(
    async (packageName: string) => {
      try {
        const result = await bridge.uninstall(packageName);

        if (result.success) {
          store.removePackage(packageName);
          return result;
        }

        console.error(
          `[usePackageInstaller] Failed to uninstall ${packageName}:`,
          result.error
        );
        return result;
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
    [bridge, store]
  );

  const loadInstalledPackages = useCallback(async () => {
    try {
      const result = await bridge.list();
      if (result.success && result.packages) {
        for (const pkg of result.packages) {
          store.addPackage(pkg.name, pkg.version);
          store.setPackageInstalled(pkg.name, pkg.version);
        }
      }
    } catch (error) {
      console.error(
        '[usePackageInstaller] Error loading installed packages:',
        error
      );
    }
  }, [bridge, store]);

  return {
    installPackage,
    uninstallPackage,
    loadInstalledPackages,
  };
}
