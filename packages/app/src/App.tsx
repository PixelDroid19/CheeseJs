import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AppShell, useWorkbenchBootstrap } from '@cheesejs/frontend';
import {
  createNpmPackageBridge,
  usePackageInstaller,
} from '@cheesejs/package-management';
import FloatingToolbar from './components/FloatingToolbar';
import { usePackagesStore, useSettingsStore } from './store/storeHooks';
import { useAppStore } from './store';
import { appEventBus } from './events/appEventBus';
import { subscribeToMagicCommentsShortcut } from './host/nativeShortcuts';
import { hostBridge } from './host/hostBridge';

// Lazy load Settings (modal, not critical path)
const Settings = lazy(() => import('./components/Settings/Settings'));
const CodeEditor = lazy(() => import('./components/Editor'));
const ResultDisplay = lazy(() => import('./components/Result'));
const InputTooltip = lazy(() =>
  import('./components/InputTooltip').then((module) => ({
    default: module.InputTooltip,
  }))
);

const npmBridge = createNpmPackageBridge(() => hostBridge.packageManager);

function LoadingPane({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function DeferredSlot({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  return <>{ready ? children : fallback}</>;
}

function App() {
  const { setMagicComments } = useSettingsStore();
  const packagesStore = usePackagesStore();
  const { loadInstalledPackages } = usePackageInstaller({
    bridge: npmBridge,
    store: packagesStore,
  });

  useWorkbenchBootstrap({
    eventBus: appEventBus,
    loadInstalledPackages,
    subscribeToMagicCommentsShortcut,
    toggleMagicComments: () => {
      const current = useAppStore.getState().settings.magicComments;
      setMagicComments(!current);
    },
  });

  return (
    <AppShell
      settings={<Settings />}
      toolbar={<FloatingToolbar />}
      inputTooltip={
        <Suspense fallback={null}>
          <DeferredSlot fallback={null}>
            <InputTooltip />
          </DeferredSlot>
        </Suspense>
      }
      editor={
        <Suspense fallback={<LoadingPane label="Loading editor..." />}>
          <DeferredSlot fallback={<LoadingPane label="Loading editor..." />}>
            <CodeEditor />
          </DeferredSlot>
        </Suspense>
      }
      result={
        <Suspense fallback={<LoadingPane label="Loading results..." />}>
          <DeferredSlot fallback={<LoadingPane label="Loading results..." />}>
            <ResultDisplay />
          </DeferredSlot>
        </Suspense>
      }
    />
  );
}

export default App;
