import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  clearRegisteredCommands as clearRegisteredCommandsBase,
  isCommandRegistered as isCommandRegisteredBase,
  registerPackageCommands as registerPackageCommandsBase,
} from '@cheesejs/editor/services/monacoPackageCommands';
import { usePackagesStore } from '../store/storeHooks';
import { usePythonPackagesStore } from '../store/storeHooks';

export function registerPackageCommands(
  monaco: Monaco,
  editorInstance: editor.IStandaloneCodeEditor,
  runCode: (code: string) => void
): void {
  registerPackageCommandsBase(monaco, editorInstance, runCode, {
    npmStore: usePackagesStore,
    pythonStore: usePythonPackagesStore,
    packageManager: window.packageManager,
    pythonPackageManager: window.pythonPackageManager,
    openExternal: (url: string) => window.open(url, '_blank'),
  });
}

export function isCommandRegistered(commandId: string): boolean {
  return isCommandRegisteredBase(commandId);
}

export function clearRegisteredCommands(): void {
  clearRegisteredCommandsBase();
}
