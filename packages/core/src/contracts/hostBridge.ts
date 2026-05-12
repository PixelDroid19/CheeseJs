import type { LspBridgeApi, LspConfigApi } from './lsp';
import type { PackageManager, PythonPackageManager } from './packages';
import type { CodeRunner } from './runner';

/** Optional filesystem commands exposed by the active host. */
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

/** Window commands provided by the native shell. */
export interface WindowControlsBridge {
  closeApp: () => void;
  maximizeApp: () => void;
  unmaximizeApp: () => void;
  minimizeApp: () => void;
  showContextMenu: () => void;
  onToggleMagicComments: (callback: () => void) => () => void;
}

/** Host command for opening trusted external URLs outside the app webview. */
export interface ExternalBridge {
  openExternal: (url: string) => void;
}

/**
 * Complete renderer-to-host boundary.
 *
 * UI packages consume this interface instead of reading native globals
 * directly. Native, browser, and test hosts can implement different subsets
 * while keeping the renderer contract stable.
 */
export interface HostBridge {
  codeRunner?: CodeRunner;
  packageManager?: PackageManager;
  pythonPackageManager?: PythonPackageManager;
  lspConfig?: LspConfigApi;
  lspBridge?: LspBridgeApi;
  windowControls: WindowControlsBridge & FilesystemBridge;
  external: ExternalBridge;
}
