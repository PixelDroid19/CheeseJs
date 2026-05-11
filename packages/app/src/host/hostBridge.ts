import type { HostBridge } from '@cheesejs/core';
import {
  createBrowserCodeRunner,
  createUnavailablePackageManager,
  createUnavailablePythonPackageManager,
} from './browserRuntimeBridge';

interface ZeroNativeApi {
  invoke?: (command: string, payload?: unknown) => Promise<unknown>;
  windows?: {
    close?: (id?: number) => Promise<unknown>;
    focus?: (id?: number) => Promise<unknown>;
  };
}

type HostWindow = Window & {
  zero?: ZeroNativeApi;
};

const browserCodeRunner = createBrowserCodeRunner();
const unavailablePackageManager = createUnavailablePackageManager();
const unavailablePythonPackageManager = createUnavailablePythonPackageManager();

async function invokeZero(win: HostWindow, command: string, payload = {}) {
  if (!win.zero?.invoke) return undefined;
  return win.zero.invoke(command, payload);
}

export function createBrowserHostBridge(win: Window): HostBridge {
  const hostWindow = win as HostWindow;

  return {
    get codeRunner() {
      return win.codeRunner ?? browserCodeRunner;
    },
    get packageManager() {
      return win.packageManager ?? unavailablePackageManager;
    },
    get pythonPackageManager() {
      return win.pythonPackageManager ?? unavailablePythonPackageManager;
    },
    get lspConfig() {
      return win.lspConfig;
    },
    get lspBridge() {
      return win.lspBridge;
    },
    get windowControls() {
      return {
        closeApp: () => {
          void (
            hostWindow.zero?.windows?.close?.() ??
            invokeZero(hostWindow, 'zero-native.window.close')
          );
        },
        maximizeApp: () => undefined,
        unmaximizeApp: () => undefined,
        minimizeApp: () => undefined,
        showContextMenu: () => undefined,
        onToggleMagicComments: () => () => undefined,
      };
    },
    external: {
      openExternal: (url: string) => {
        if (hostWindow.zero?.invoke) {
          void invokeZero(hostWindow, 'cheese.external.open', { url });
          return;
        }

        win.open(url, '_blank');
      },
    },
  };
}

export const hostBridge = createBrowserHostBridge(window);
