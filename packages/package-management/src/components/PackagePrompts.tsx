import { useMemo } from 'react';

import { ManagedPackagePrompts } from './ManagedPackagePrompts';
import { usePackageMetadata } from '../hooks/usePackageMetadata';
import { usePythonPackageMetadata } from '../hooks/usePythonPackageMetadata';
import type {
  NpmPackageBridge,
  PythonPackageBridge,
} from '../bridges/packageManagement';
import type {
  NpmPackageStoreAdapter,
  PythonPackageStoreAdapter,
} from '../types';

interface PromptActionResult {
  action?: {
    payload: string;
    type: string;
  };
  element?: {
    content?: string | number | boolean | object | null;
  };
}

export interface PackagePromptsProps {
  elements: PromptActionResult[];
  npmBridge: NpmPackageBridge;
  npmStore: NpmPackageStoreAdapter;
  pythonBridge: PythonPackageBridge;
  pythonStore: PythonPackageStoreAdapter;
}

/**
 * Connected package prompts coordinator using injected stores and bridges.
 */
export function PackagePrompts({
  elements,
  npmBridge,
  npmStore,
  pythonBridge,
  pythonStore,
}: PackagePromptsProps) {
  const { packageMetadata, dismissedPackages, setDismissedPackages } =
    usePackageMetadata(npmStore.detectedMissingPackages);
  const {
    packageMetadata: pythonPackageMetadata,
    dismissedPackages: dismissedPythonPackages,
    setDismissedPackages: setDismissedPythonPackages,
  } = usePythonPackageMetadata(pythonStore.detectedMissingPackages);

  const stableElements = useMemo(() => elements, [elements]);

  return (
    <ManagedPackagePrompts
      elements={stableElements}
      npmPackages={npmStore.packages}
      pythonPackages={pythonStore.packages}
      detectedMissingPackages={npmStore.detectedMissingPackages}
      detectedMissingPythonPackages={pythonStore.detectedMissingPackages}
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
      addNpmPackage={npmStore.addPackage}
      setNpmPackageInstalling={npmStore.setPackageInstalling}
      setNpmPackageInstalled={npmStore.setPackageInstalled}
      setNpmPackageError={npmStore.setPackageError}
      addPythonPackage={pythonStore.addPackage}
      setPythonPackageInstalling={pythonStore.setPackageInstalling}
      setPythonPackageInstalled={pythonStore.setPackageInstalled}
      setPythonPackageError={pythonStore.setPackageError}
      installNpmPackage={npmBridge.install}
      installPythonPackage={pythonBridge.install}
    />
  );
}
