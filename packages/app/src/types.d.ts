import type {
  CodeRunner,
  HostBridge,
  LspBridgeApi,
  LspConfigApi,
  PackageManager,
  PythonPackageManager,
} from '@cheesejs/core';

declare module 'json-cycle';
declare module 'stringify-object';

declare global {
  interface Window {
    zero?: {
      invoke?: (command: string, payload?: unknown) => Promise<unknown>;
      windows?: {
        close?: (id?: number) => Promise<unknown>;
        focus?: (id?: number) => Promise<unknown>;
      };
    };
    codeRunner: CodeRunner;
    packageManager: PackageManager;
    pythonPackageManager: PythonPackageManager;
    lspConfig: LspConfigApi;
    lspBridge: LspBridgeApi;
    cheeseHost?: HostBridge;
    // E2E testing properties
    monaco?: typeof import('monaco-editor');
    editor?: import('monaco-editor').editor.IStandaloneCodeEditor;
  }
}

// Para hacer posible "import type" de un archivo .d.ts sin top-level export,
// a veces es necesario un simple export:
export {};
