import type { CodeRunner } from './types/runner';
import type { PackageManager, PythonPackageManager } from './types/packages';
import type { LspBridgeApi, LspConfigApi } from '@cheesejs/core/contracts/lsp';

declare module 'json-cycle';
declare module 'stringify-object';

declare global {
  interface Window {
    electronAPI: {
      closeApp: () => void;
      maximizeApp: () => void;
      unmaximizeApp: () => void;
      minimizeApp: () => void;
      showContextMenu: () => void;
      onToggleMagicComments: (callback: () => void) => () => void;
      // Filesystem operations
      readFile?: (
        path: string,
        options?: { startLine?: number; endLine?: number }
      ) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeFile?: (
        path: string,
        content: string
      ) => Promise<{ success: boolean; error?: string }>;
      listFiles?: (
        path: string,
        recursive?: boolean
      ) => Promise<{ success: boolean; files?: string[]; error?: string }>;
      searchInFiles?: (
        pattern: string,
        directory: string
      ) => Promise<{
        success: boolean;
        results?: Array<{ file: string; line: number; content: string }>;
        error?: string;
      }>;
      deleteFile?: (
        path: string
      ) => Promise<{ success: boolean; error?: string }>;
      getWorkspacePath?: () => Promise<string>;
    };
    codeRunner: CodeRunner;
    packageManager: PackageManager;
    pythonPackageManager: PythonPackageManager;
    lspConfig: LspConfigApi;
    lspBridge: LspBridgeApi;
    // E2E testing properties
    monaco?: typeof import('monaco-editor');
    editor?: import('monaco-editor').editor.IStandaloneCodeEditor;
  }
}

// Para hacer posible "import type" de un archivo .d.ts sin top-level export,
// a veces es necesario un simple export:
export {};
