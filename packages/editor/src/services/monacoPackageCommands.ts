import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export interface PackageInstallResultLike {
  success: boolean;
  version?: string;
  error?: string;
}

export interface PackageStoreActions {
  addPackage: (name: string, version?: string) => void;
  setPackageInstalling: (name: string, installing: boolean) => void;
  setPackageInstalled: (name: string, version?: string) => void;
  setPackageError: (name: string, error?: string) => void;
  resetPackageAttempts: (name: string) => void;
  removePackage: (name: string) => void;
}

export interface PackageManagerLike {
  install: (name: string) => Promise<PackageInstallResultLike>;
  uninstall?: (name: string) => Promise<PackageInstallResultLike>;
}

export interface MonacoPackageCommandServices {
  npmStore: { getState(): PackageStoreActions };
  pythonStore: { getState(): PackageStoreActions };
  packageManager?: PackageManagerLike | null;
  pythonPackageManager?: PackageManagerLike | null;
  openExternal?: (url: string) => void;
}

const registeredCommands = new Set<string>();

function safeRegisterCommand(
  monaco: Monaco,
  commandId: string,
  handler: (accessor: unknown, ...args: unknown[]) => void | Promise<void>
): boolean {
  if (registeredCommands.has(commandId)) {
    return false;
  }

  try {
    monaco.editor.registerCommand(commandId, handler);
    registeredCommands.add(commandId);
    return true;
  } catch (error) {
    console.warn(`[MonacoCommands] Failed to register "${commandId}":`, error);
    registeredCommands.add(commandId);
    return false;
  }
}

/**
 * Registers Monaco commands for npm and Python package management using host
 * store and window-manager adapters supplied by the application.
 */
export function registerPackageCommands(
  monaco: Monaco,
  editorInstance: editor.IStandaloneCodeEditor,
  runCode: (code: string) => void,
  services: MonacoPackageCommandServices
): void {
  const openExternal =
    services.openExternal ?? ((url: string) => window.open(url, '_blank'));

  safeRegisterCommand(
    monaco,
    'cheeseJS.installPackage',
    async (_accessor: unknown, ...args: unknown[]) => {
      const packageName = args[0] as string;
      const store = services.npmStore.getState();

      store.addPackage(packageName);
      if (services.packageManager) {
        store.setPackageInstalling(packageName, true);
        const result = await services.packageManager.install(packageName);
        if (result.success) {
          store.setPackageInstalled(packageName, result.version);
        } else {
          store.setPackageError(packageName, result.error);
        }
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.installAndRun',
    async (_accessor: unknown, ...args: unknown[]) => {
      const packageName = args[0] as string;
      const store = services.npmStore.getState();

      store.addPackage(packageName);
      if (services.packageManager) {
        store.setPackageInstalling(packageName, true);
        const result = await services.packageManager.install(packageName);
        if (result.success) {
          store.setPackageInstalled(packageName, result.version);
          runCode(editorInstance.getValue());
        } else {
          store.setPackageError(packageName, result.error);
        }
      } else {
        setTimeout(() => runCode(editorInstance.getValue()), 100);
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.retryInstall',
    async (_accessor: unknown, ...args: unknown[]) => {
      const packageName = args[0] as string;
      const store = services.npmStore.getState();
      store.resetPackageAttempts(packageName);
      store.setPackageInstalling(packageName, true);
      if (services.packageManager) {
        const result = await services.packageManager.install(packageName);
        if (result.success) {
          store.setPackageInstalled(packageName, result.version);
        } else {
          store.setPackageError(packageName, result.error);
        }
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.uninstallPackage',
    async (_accessor: unknown, ...args: unknown[]) => {
      const packageName = args[0] as string;
      const store = services.npmStore.getState();
      if (services.packageManager?.uninstall) {
        const result = await services.packageManager.uninstall(packageName);
        if (result.success) {
          store.removePackage(packageName);
        }
      } else {
        store.removePackage(packageName);
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.viewOnNpm',
    (_accessor: unknown, ...args: unknown[]) => {
      const packageName = args[0] as string;
      openExternal(`https://www.npmjs.com/package/${packageName}`);
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.installPythonPackage',
    async (_accessor: unknown, ...args: unknown[]) => {
      const packageName = args[0] as string;
      const store = services.pythonStore.getState();

      store.addPackage(packageName);
      if (services.pythonPackageManager) {
        store.setPackageInstalling(packageName, true);
        const result = await services.pythonPackageManager.install(packageName);
        if (result.success) {
          store.setPackageInstalled(packageName, result.version);
        } else {
          store.setPackageError(packageName, result.error);
        }
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.installPythonPackageAndRun',
    async (_accessor: unknown, ...args: unknown[]) => {
      const packageName = args[0] as string;
      const store = services.pythonStore.getState();

      store.addPackage(packageName);
      if (services.pythonPackageManager) {
        store.setPackageInstalling(packageName, true);
        const result = await services.pythonPackageManager.install(packageName);
        if (result.success) {
          store.setPackageInstalled(packageName, result.version);
          runCode(editorInstance.getValue());
        } else {
          store.setPackageError(packageName, result.error);
        }
      } else {
        setTimeout(() => runCode(editorInstance.getValue()), 100);
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.retryPythonInstall',
    async (_accessor: unknown, ...args: unknown[]) => {
      const packageName = args[0] as string;
      const store = services.pythonStore.getState();
      store.resetPackageAttempts(packageName);
      store.setPackageInstalling(packageName, true);
      if (services.pythonPackageManager) {
        const result = await services.pythonPackageManager.install(packageName);
        if (result.success) {
          store.setPackageInstalled(packageName, result.version);
        } else {
          store.setPackageError(packageName, result.error);
        }
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.viewOnPyPI',
    (_accessor: unknown, ...args: unknown[]) => {
      const packageName = args[0] as string;
      openExternal(`https://pypi.org/project/${packageName}/`);
    }
  );
}

export function isCommandRegistered(commandId: string): boolean {
  return registeredCommands.has(commandId);
}

export function clearRegisteredCommands(): void {
  registeredCommands.clear();
}
