import { describe, expect, it, vi } from 'vitest';
import { createBrowserHostBridge } from './hostBridge';
import type { CodeRunner, PackageManager } from '@cheesejs/core';

describe('createBrowserHostBridge', () => {
  it('reads preload globals lazily so tests and host replacements can swap them', () => {
    const win = {
      open: vi.fn(),
      codeRunner: { waitForReady: vi.fn() },
      packageManager: { list: vi.fn() },
    } as unknown as Window;
    const bridge = createBrowserHostBridge(win);

    const nextCodeRunner = { waitForReady: vi.fn() } as unknown as CodeRunner;
    const nextPackageManager = { list: vi.fn() } as unknown as PackageManager;
    Object.assign(win, {
      codeRunner: nextCodeRunner,
      packageManager: nextPackageManager,
    });

    expect(bridge.codeRunner).toBe(nextCodeRunner);
    expect(bridge.packageManager).toBe(nextPackageManager);
  });

  it('routes external links through the host window', () => {
    const open = vi.fn();
    const win = { open } as unknown as Window;
    const bridge = createBrowserHostBridge(win);

    bridge.external.openExternal('https://example.test');

    expect(open).toHaveBeenCalledWith('https://example.test', '_blank');
  });

  it('routes external links and close requests through zero-native when available', () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    const win = {
      open,
      zero: {
        invoke,
        windows: { close },
      },
    } as unknown as Window;
    const bridge = createBrowserHostBridge(win);

    bridge.external.openExternal('https://example.test');
    bridge.windowControls.closeApp();

    expect(invoke).toHaveBeenCalledWith('cheese.external.open', {
      url: 'https://example.test',
    });
    expect(close).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('exposes fallback managers and optional host services without requiring native globals', () => {
    const lspConfig = { getConfig: vi.fn() };
    const lspBridge = { start: vi.fn() };
    const win = {
      open: vi.fn(),
      lspConfig,
      lspBridge,
    } as unknown as Window;
    const bridge = createBrowserHostBridge(win);

    expect(bridge.codeRunner).toBeDefined();
    expect(bridge.packageManager).toBeDefined();
    expect(bridge.pythonPackageManager).toBeDefined();
    expect(bridge.lspConfig).toBe(lspConfig);
    expect(bridge.lspBridge).toBe(lspBridge);
    expect(bridge.windowControls.maximizeApp()).toBeUndefined();
    expect(bridge.windowControls.unmaximizeApp()).toBeUndefined();
    expect(bridge.windowControls.minimizeApp()).toBeUndefined();
    expect(bridge.windowControls.showContextMenu()).toBeUndefined();
    expect(
      bridge.windowControls.onToggleMagicComments(() => undefined)()
    ).toBeUndefined();
  });
});
