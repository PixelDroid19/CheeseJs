import { useMemo } from 'react';
import { ManagedPackagePrompts } from '@cheesejs/package-management';
import { useEditorTabsStore } from '../store/storeHooks';
import { usePackagesStore } from '../store/storeHooks';
import { usePythonPackagesStore } from '../store/storeHooks';
import { usePackageMetadata } from '../hooks/usePackageMetadata';
import { usePythonPackageMetadata } from '../hooks/usePythonPackageMetadata';
import {
  installNpmPackage,
  installPythonPackage,
} from '../host/packageManagement';

export function PackagePrompts() {
  const { tabs, activeTabId } = useEditorTabsStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const elements = useMemo(() => activeTab?.result || [], [activeTab?.result]);
  const {
    packages,
    addPackage,
    setPackageInstalling,
    setPackageInstalled,
    setPackageError,
    detectedMissingPackages,
  } = usePackagesStore();
  const {
    packages: pythonPackages,
    addPackage: addPythonPackage,
    setPackageInstalling: setPythonPackageInstalling,
    setPackageInstalled: setPythonPackageInstalled,
    setPackageError: setPythonPackageError,
    detectedMissingPackages: detectedMissingPythonPackages,
  } = usePythonPackagesStore();
  const { packageMetadata, dismissedPackages, setDismissedPackages } =
    usePackageMetadata(detectedMissingPackages);
  const {
    packageMetadata: pythonPackageMetadata,
    dismissedPackages: dismissedPythonPackages,
    setDismissedPackages: setDismissedPythonPackages,
  } = usePythonPackageMetadata(detectedMissingPythonPackages);

  return (
    <ManagedPackagePrompts
      elements={elements}
      npmPackages={packages}
      pythonPackages={pythonPackages}
      detectedMissingPackages={detectedMissingPackages}
      detectedMissingPythonPackages={detectedMissingPythonPackages}
      npmMetadata={packageMetadata}
      pythonMetadata={pythonPackageMetadata}
      dismissedNpmPackages={dismissedPackages}
      dismissedPythonPackages={dismissedPythonPackages}
      dismissNpmPackage={(pkgName) => {
        setDismissedPackages((prev) => [...prev, pkgName]);
      }}
      dismissPythonPackage={(pkgName) => {
        setDismissedPythonPackages((prev) => [...prev, pkgName]);
      }}
      addNpmPackage={addPackage}
      setNpmPackageInstalling={setPackageInstalling}
      setNpmPackageInstalled={setPackageInstalled}
      setNpmPackageError={setPackageError}
      addPythonPackage={addPythonPackage}
      setPythonPackageInstalling={setPythonPackageInstalling}
      setPythonPackageInstalled={setPythonPackageInstalled}
      setPythonPackageError={setPythonPackageError}
      installNpmPackage={installNpmPackage}
      installPythonPackage={installPythonPackage}
    />
  );
}
