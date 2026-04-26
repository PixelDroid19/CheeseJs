import type {
  InstalledPackage,
  PackageInstallResult,
  PackageManager,
  PythonPackageInstallResult,
  PythonPackageManager,
} from '@cheesejs/core';

export type NpmPackageBridge = Pick<
  PackageManager,
  'install' | 'list' | 'uninstall'
>;

export type PythonPackageBridge = Pick<
  PythonPackageManager,
  'install' | 'listInstalled'
>;

/**
 * Creates an injected npm package bridge without coupling the feature package to
 * `window.packageManager` directly.
 */
export function createNpmPackageBridge(
  getManager: () => Partial<NpmPackageBridge> | undefined
): NpmPackageBridge {
  return {
    async install(packageName: string): Promise<PackageInstallResult> {
      const manager = getManager();
      if (!manager?.install) {
        throw new Error('Package manager not available');
      }

      return manager.install(packageName);
    },

    async uninstall(packageName: string): Promise<PackageInstallResult> {
      const manager = getManager();
      if (!manager?.uninstall) {
        throw new Error('Package manager not available');
      }

      return manager.uninstall(packageName);
    },

    async list(): Promise<{
      error?: string;
      packages: InstalledPackage[];
      success: boolean;
    }> {
      const manager = getManager();
      if (!manager?.list) {
        return { success: false, packages: [] };
      }

      return manager.list();
    },
  };
}

/**
 * Creates an injected Python package bridge without coupling the feature package
 * to `window.pythonPackageManager` directly.
 */
export function createPythonPackageBridge(
  getManager: () => Partial<PythonPackageBridge> | undefined
): PythonPackageBridge {
  return {
    async install(packageName: string): Promise<PythonPackageInstallResult> {
      const manager = getManager();
      if (!manager?.install) {
        throw new Error('Python package manager not available');
      }

      return manager.install(packageName);
    },

    async listInstalled(): Promise<{
      error?: string;
      packages: string[];
      success: boolean;
    }> {
      const manager = getManager();
      if (!manager?.listInstalled) {
        return { success: false, packages: [] };
      }

      return manager.listInstalled();
    },
  };
}
