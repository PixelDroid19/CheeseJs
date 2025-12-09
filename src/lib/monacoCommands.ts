/**
 * Monaco Commands Registry
 *
 * Provides idempotent command registration for Monaco editor.
 * Prevents duplicate command registration errors when components remount.
 */

import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { usePackagesStore } from '../store/usePackagesStore';
import { usePythonPackagesStore } from '../store/usePythonPackagesStore';

// Track registered commands to prevent duplicates
const registeredCommands = new Set<string>();

/**
 * Safely register a Monaco command, preventing duplicate registration errors.
 * Returns true if the command was registered, false if it already existed.
 */
function safeRegisterCommand(
  monaco: Monaco,
  commandId: string,
  handler: (accessor: unknown, ...args: unknown[]) => void | Promise<void>
): boolean {
  if (registeredCommands.has(commandId)) {
    console.log(`[MonacoCommands] Command "${commandId}" already registered, skipping`);
    return false;
  }

  try {
    monaco.editor.registerCommand(commandId, handler);
    registeredCommands.add(commandId);
    console.log(`[MonacoCommands] Registered command: ${commandId}`);
    return true;
  } catch (error) {
    // Command might already exist from a previous Monaco instance
    console.warn(`[MonacoCommands] Failed to register "${commandId}":`, error);
    registeredCommands.add(commandId); // Mark as registered to prevent retries
    return false;
  }
}

/**
 * Register all package management commands for Monaco.
 * This function is idempotent - safe to call multiple times.
 */
export function registerPackageCommands(
  monaco: Monaco,
  editorInstance: editor.IStandaloneCodeEditor,
  runCode: (code: string) => void
): void {
  // NPM Package Commands
  safeRegisterCommand(
    monaco,
    'cheeseJS.installPackage',
    async (_accessor: unknown, packageName: string) => {
      console.log('[MonacoCommands] Installing package:', packageName);
      if (window.packageManager) {
        usePackagesStore.getState().addPackage(packageName);
        usePackagesStore.getState().setPackageInstalling(packageName, true);
        const result = await window.packageManager.install(packageName);
        if (result.success) {
          usePackagesStore.getState().setPackageInstalled(packageName, result.version);
        } else {
          usePackagesStore.getState().setPackageError(packageName, result.error);
        }
      } else {
        usePackagesStore.getState().addPackage(packageName);
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.installAndRun',
    async (_accessor: unknown, packageName: string) => {
      console.log('[MonacoCommands] Installing package and running:', packageName);
      if (window.packageManager) {
        usePackagesStore.getState().addPackage(packageName);
        usePackagesStore.getState().setPackageInstalling(packageName, true);
        const result = await window.packageManager.install(packageName);
        if (result.success) {
          usePackagesStore.getState().setPackageInstalled(packageName, result.version);
          const code = editorInstance.getValue();
          runCode(code);
        } else {
          usePackagesStore.getState().setPackageError(packageName, result.error);
        }
      } else {
        usePackagesStore.getState().addPackage(packageName);
        setTimeout(() => {
          const code = editorInstance.getValue();
          runCode(code);
        }, 100);
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.retryInstall',
    async (_accessor: unknown, packageName: string) => {
      console.log('[MonacoCommands] Retrying install:', packageName);
      const store = usePackagesStore.getState();
      store.resetPackageAttempts(packageName);
      store.setPackageInstalling(packageName, true);
      if (window.packageManager) {
        const result = await window.packageManager.install(packageName);
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
    async (_accessor: unknown, packageName: string) => {
      console.log('[MonacoCommands] Uninstalling package:', packageName);
      if (window.packageManager) {
        const result = await window.packageManager.uninstall(packageName);
        if (result.success) {
          usePackagesStore.getState().removePackage(packageName);
        }
      } else {
        usePackagesStore.getState().removePackage(packageName);
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.viewOnNpm',
    (_accessor: unknown, packageName: string) => {
      console.log('[MonacoCommands] Opening npm for:', packageName);
      window.open(`https://www.npmjs.com/package/${packageName}`, '_blank');
    }
  );

  // Python Package Commands
  safeRegisterCommand(
    monaco,
    'cheeseJS.installPythonPackage',
    async (_accessor: unknown, packageName: string) => {
      console.log('[MonacoCommands] Installing Python package:', packageName);
      if (window.pythonPackageManager) {
        usePythonPackagesStore.getState().addPackage(packageName);
        usePythonPackagesStore.getState().setPackageInstalling(packageName, true);
        const result = await window.pythonPackageManager.install(packageName);
        if (result.success) {
          usePythonPackagesStore.getState().setPackageInstalled(packageName, result.version);
        } else {
          usePythonPackagesStore.getState().setPackageError(packageName, result.error);
        }
      } else {
        usePythonPackagesStore.getState().addPackage(packageName);
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.installPythonPackageAndRun',
    async (_accessor: unknown, packageName: string) => {
      console.log('[MonacoCommands] Installing Python package and running:', packageName);
      if (window.pythonPackageManager) {
        usePythonPackagesStore.getState().addPackage(packageName);
        usePythonPackagesStore.getState().setPackageInstalling(packageName, true);
        const result = await window.pythonPackageManager.install(packageName);
        if (result.success) {
          usePythonPackagesStore.getState().setPackageInstalled(packageName, result.version);
          const code = editorInstance.getValue();
          runCode(code);
        } else {
          usePythonPackagesStore.getState().setPackageError(packageName, result.error);
        }
      } else {
        usePythonPackagesStore.getState().addPackage(packageName);
        setTimeout(() => {
          const code = editorInstance.getValue();
          runCode(code);
        }, 100);
      }
    }
  );

  safeRegisterCommand(
    monaco,
    'cheeseJS.retryPythonInstall',
    async (_accessor: unknown, packageName: string) => {
      console.log('[MonacoCommands] Retrying Python install:', packageName);
      const store = usePythonPackagesStore.getState();
      store.resetPackageAttempts(packageName);
      store.setPackageInstalling(packageName, true);
      if (window.pythonPackageManager) {
        const result = await window.pythonPackageManager.install(packageName);
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
    (_accessor: unknown, packageName: string) => {
      console.log('[MonacoCommands] Opening PyPI for:', packageName);
      window.open(`https://pypi.org/project/${packageName}/`, '_blank');
    }
  );
}

/**
 * Check if a command is already registered.
 */
export function isCommandRegistered(commandId: string): boolean {
  return registeredCommands.has(commandId);
}

/**
 * Clear the registered commands set (useful for testing).
 */
export function clearRegisteredCommands(): void {
  registeredCommands.clear();
}

