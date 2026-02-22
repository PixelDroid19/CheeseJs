import { ipcMain } from 'electron';
import type { WorkerPoolManager } from '../WorkerPoolManager';
import {
  installPackage,
  uninstallPackage,
  listInstalledPackages,
  getNodeModulesPath,
} from '../../packages/packageManager';

export interface PackageHandlersConfig {
  workerPool: WorkerPoolManager;
}

export function registerPackageHandlers({
  workerPool,
}: PackageHandlersConfig): void {
  // ============================================================================
  // PACKAGE MANAGEMENT HANDLERS (JavaScript/TypeScript)
  // ============================================================================

  ipcMain.handle(
    'install-package',
    async (_event: unknown, packageName: string) => {
      try {
        const result = await installPackage(packageName);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return { success: false, packageName, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'uninstall-package',
    async (_event: unknown, packageName: string) => {
      try {
        const result = await uninstallPackage(packageName);

        // Clear the require cache in all workers
        if (result.success) {
          workerPool.clearRequireCache(packageName);
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return { success: false, packageName, error: errorMessage };
      }
    }
  );

  ipcMain.handle('list-packages', async () => {
    try {
      const packages = await listInstalledPackages();
      return { success: true, packages };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, packages: [], error: errorMessage };
    }
  });

  ipcMain.handle('get-node-modules-path', () => {
    return getNodeModulesPath();
  });
}
