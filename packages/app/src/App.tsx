import { lazy } from 'react';
import { AppShell, useWorkbenchBootstrap } from '@cheesejs/frontend';
import {
  createNpmPackageBridge,
  usePackageInstaller,
} from '@cheesejs/package-management';
import FloatingToolbar from './components/FloatingToolbar';
import { usePackagesStore, useSettingsStore } from './store/storeHooks';
import { useAppStore } from './store';
import { appEventBus } from './events/appEventBus';
import { subscribeToMagicCommentsShortcut } from './host/electronShortcuts';

// Lazy load Settings (modal, not critical path)
const Settings = lazy(() => import('./components/Settings/Settings'));

// Keep Editor and Result as regular imports since they're in the critical render path
// and react-split needs direct children
import CodeEditor from './components/Editor';
import ResultDisplay from './components/Result';
import { InputTooltip } from './components/InputTooltip';

const npmBridge = createNpmPackageBridge(() => window.packageManager);

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
      inputTooltip={<InputTooltip />}
      editor={<CodeEditor />}
      result={<ResultDisplay />}
    />
  );
}

export default App;
