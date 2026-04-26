import { useEffect, useRef } from 'react';
import type { CheeseJsEventBus } from '@cheesejs/core';

export interface WorkbenchBootstrapOptions {
  eventBus: CheeseJsEventBus;
  loadInstalledPackages: () => Promise<void>;
  subscribeToMagicCommentsShortcut?: (
    callback: () => void
  ) => (() => void) | void;
  toggleMagicComments: () => void;
}

/**
 * Wires renderer bootstrap concerns into the shared frontend package while the
 * host keeps ownership of Electron-specific services.
 */
export function useWorkbenchBootstrap({
  eventBus,
  loadInstalledPackages,
  subscribeToMagicCommentsShortcut,
  toggleMagicComments,
}: WorkbenchBootstrapOptions) {
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    const unsubscribeBootstrap = eventBus.subscribe(
      'packages.bootstrap.requested',
      () => {
        void loadInstalledPackages();
      }
    );
    const unsubscribeMagicComments = eventBus.subscribe(
      'settings.magic-comments.toggle.requested',
      () => {
        toggleMagicComments();
      }
    );

    return () => {
      unsubscribeBootstrap();
      unsubscribeMagicComments();
    };
  }, [eventBus, loadInstalledPackages, toggleMagicComments]);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }

    hasBootstrappedRef.current = true;
    eventBus.emit('packages.bootstrap.requested');
  }, [eventBus]);

  useEffect(() => {
    return subscribeToMagicCommentsShortcut?.(() => {
      eventBus.emit('settings.magic-comments.toggle.requested');
    });
  }, [eventBus, subscribeToMagicCommentsShortcut]);
}
