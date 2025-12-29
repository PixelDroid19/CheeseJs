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
import { AIChat } from './components/AI/AIChat';

function App() {
  const { setMagicComments } = useSettingsStore();
  const addPackage = usePackagesStore(
    (state: PackagesState) => state.addPackage
  );
  const setPackageInstalled = usePackagesStore(
    (state: PackagesState) => state.setPackageInstalled
  );

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
      <AIChat />
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
    </>
  );
}

export default App;
