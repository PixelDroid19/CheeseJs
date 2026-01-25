import { useEffect, lazy, Suspense } from 'react';
import FloatingToolbar from './components/FloatingToolbar';
import { Layout } from './components/Layout';
import { useSettingsStore } from './store/useSettingsStore';
import { usePackagesStore, type PackagesState } from './store/usePackagesStore';

// Error boundaries for crash recovery
import { RecoverableErrorBoundary } from './components/RecoverableErrorBoundary';
import { EditorFallback, ResultFallback } from './components/ErrorFallbacks';

// Lazy load Settings (modal, not critical path)
const Settings = lazy(() => import('./components/Settings/Settings'));

// Keep Editor and Result as regular imports since they're in the critical render path
// and react-split needs direct children
import CodeEditor from './components/Editor';
import ResultDisplay from './components/Result';
import { InputTooltip } from './components/InputTooltip';
import { TestPanel } from './components/TestPanel';
import { ConsolePanel } from './components/ConsolePanel';

import { usePluginSystem } from './hooks/usePluginSystem';

function App() {
  const { setMagicComments, showTestPanel } = useSettingsStore();
  const addPackage = usePackagesStore(
    (state: PackagesState) => state.addPackage
  );
  const setPackageInstalled = usePackagesStore(
    (state: PackagesState) => state.setPackageInstalled
  );

  // Initialize plugin system
  usePluginSystem();

  // Load installed packages from disk on app start
  useEffect(() => {
    const loadInstalledPackages = async () => {
      if (!window.packageManager) return;

      try {
        const result = await window.packageManager.list();
        if (result.success && result.packages) {
          for (const pkg of result.packages) {
            addPackage(pkg.name, pkg.version);
            setPackageInstalled(pkg.name, pkg.version);
          }
        }
      } catch (_error) {
        // Error loading packages silently ignored
      }
    };

    loadInstalledPackages();
  }, [addPackage, setPackageInstalled]);

  useEffect(() => {
    if (window.electronAPI?.onToggleMagicComments) {
      window.electronAPI.onToggleMagicComments(() => {
        const current = useSettingsStore.getState().magicComments;
        setMagicComments(!current);
      });
    }
  }, [setMagicComments]);

  return (
    <>
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
      <FloatingToolbar />
      <InputTooltip />

      {/* Main layout with optional test panel */}
      <div className="flex h-full">
        <div className={showTestPanel ? 'flex-1 h-full' : 'w-full h-full'}>
          <Layout>
            <RecoverableErrorBoundary
              fallback={<EditorFallback />}
              componentName="CodeEditor"
              config={{ maxRetries: 3, shouldRecover: true }}
            >
              <CodeEditor />
            </RecoverableErrorBoundary>
            <RecoverableErrorBoundary
              fallback={<ResultFallback />}
              componentName="ResultDisplay"
              config={{ maxRetries: 3, shouldRecover: true }}
            >
              <ResultDisplay />
            </RecoverableErrorBoundary>
          </Layout>
        </div>

        {/* Test Panel Sidebar */}
        {showTestPanel && (
          <div className="w-80 shrink-0">
            <TestPanel />
          </div>
        )}
      </div>

      <ConsolePanel />
    </>
  );
}

export default App;
