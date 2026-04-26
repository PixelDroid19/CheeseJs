import { lazy } from 'react';
import { AppShell, useWorkbenchBootstrap } from '@cheesejs/frontend';
import FloatingToolbar from './components/FloatingToolbar';
import { useSettingsStore } from './store/storeHooks';
import { useAppStore } from './store';
import { appEventBus } from './events/appEventBus';
import { usePackageInstaller } from './hooks/usePackageInstaller';
import { subscribeToMagicCommentsShortcut } from './host/electronShortcuts';

// Lazy load Settings (modal, not critical path)
const Settings = lazy(() => import('./components/Settings/Settings'));

// Keep Editor and Result as regular imports since they're in the critical render path
// and react-split needs direct children
import CodeEditor from './components/Editor';
import ResultDisplay from './components/Result';
import { InputTooltip } from './components/InputTooltip';

function App() {
  const { setMagicComments } = useSettingsStore();
  const { loadInstalledPackages } = usePackageInstaller();

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
