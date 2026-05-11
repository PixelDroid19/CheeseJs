import type { LspBridgeApi, LspConfigApi } from './lsp';
import type { PackageManager, PythonPackageManager } from './packages';
import type { CodeRunner } from './runner';

export interface FilesystemBridge {
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
  deleteFile?: (path: string) => Promise<{ success: boolean; error?: string }>;
  getWorkspacePath?: () => Promise<string>;
}

export interface WindowControlsBridge {
  closeApp: () => void;
  maximizeApp: () => void;
  unmaximizeApp: () => void;
  minimizeApp: () => void;
  showContextMenu: () => void;
  onToggleMagicComments: (callback: () => void) => () => void;
}

export interface ExternalBridge {
  openExternal: (url: string) => void;
}

export interface HostBridge {
  codeRunner?: CodeRunner;
  packageManager?: PackageManager;
  pythonPackageManager?: PythonPackageManager;
  lspConfig?: LspConfigApi;
  lspBridge?: LspBridgeApi;
  windowControls: WindowControlsBridge & FilesystemBridge;
  external: ExternalBridge;
}
