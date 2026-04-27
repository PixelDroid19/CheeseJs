import { useEffect } from 'react';
import { FloatingToolbar as FrontendFloatingToolbar } from '@cheesejs/frontend';
import { useRuntimeStatus } from '@cheesejs/runtime-shell';
import { useCodeRunner } from '../hooks/useCodeRunner';
import { useSettingsStore } from '../store/storeHooks';
import { useLanguageStore } from '../store/storeHooks';
import { useEditorTabsStore } from '../store/storeHooks';
import { usePackagesStore } from '../store/storeHooks';
import { usePythonPackagesStore } from '../store/storeHooks';
import { SnippetsMenu } from './SnippetsMenu';
import { appEventBus } from '../events/appEventBus';

export default function FloatingToolbar() {
  const { runCode } = useCodeRunner();
  const toggleSettings = useSettingsStore((state) => state.toggleSettings);
  const currentLanguage = useLanguageStore((state) => state.currentLanguage);
  const { isLoading: isRuntimeLoading, message: runtimeMessage } =
    useRuntimeStatus(
      currentLanguage === 'python' ? 'python' : 'javascript',
      window.codeRunner
    );

  const { tabs, activeTabId } = useEditorTabsStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isExecuting = activeTab?.isExecuting || false;
  const isPendingRun = activeTab?.isPendingRun || false;

  const packages = usePackagesStore((state) => state.packages);
  const pythonPackages = usePythonPackagesStore((state) => state.packages);
  const isInstallingPackage =
    packages.some((p) => p.installing) ||
    pythonPackages.some((p) => p.installing);

  const isBusy =
    (isRuntimeLoading && currentLanguage === 'python') ||
    isExecuting ||
    isPendingRun ||
    isInstallingPackage;

  let busyMessage = '';
  if (isInstallingPackage) {
    busyMessage = 'Installing packages...';
  } else if (isRuntimeLoading && currentLanguage === 'python') {
    busyMessage = runtimeMessage || 'Loading Python...';
  } else if (isExecuting || isPendingRun) {
    busyMessage = 'Running code...';
  }

  useEffect(() => {
    const unsubscribeRun = appEventBus.subscribe(
      'workbench.run.requested',
      (payload) => {
        runCode(payload?.code);
      }
    );
    const unsubscribeSettings = appEventBus.subscribe(
      'workbench.settings.toggle.requested',
      () => {
        toggleSettings();
      }
    );

    return () => {
      unsubscribeRun();
      unsubscribeSettings();
    };
  }, [runCode, toggleSettings]);

  return (
    <FrontendFloatingToolbar
      eventBus={appEventBus}
      isBusy={isBusy}
      busyMessage={busyMessage}
      snippetsMenu={<SnippetsMenu />}
    />
  );
}
