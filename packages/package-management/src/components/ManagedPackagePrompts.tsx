import { useCallback, useMemo } from 'react';
import type { BasePackageInfo } from '@cheesejs/core';

import type { BasePackageMetadata } from '../hooks';
import { PackagePromptsOverlay } from './PackagePromptsOverlay';

interface PromptActionResult {
  action?: {
    payload: string;
    type: string;
  };
  element?: {
    content?: string | number | boolean | object | null;
  };
}

interface PackageInstallResult {
  error?: string;
  success: boolean;
  version?: string;
}

export interface ManagedPackagePromptsProps {
  addNpmPackage: (name: string, version?: string) => void;
  addPythonPackage: (name: string, version?: string) => void;
  detectedMissingPackages: string[];
  detectedMissingPythonPackages: string[];
  dismissNpmPackage: (pkgName: string) => void;
  dismissPythonPackage: (pkgName: string) => void;
  dismissedNpmPackages: string[];
  dismissedPythonPackages: string[];
  elements: PromptActionResult[];
  installNpmPackage: (name: string) => Promise<PackageInstallResult>;
  installPythonPackage: (name: string) => Promise<PackageInstallResult>;
  npmMetadata: Record<string, BasePackageMetadata>;
  npmPackages: BasePackageInfo[];
  pythonMetadata: Record<string, BasePackageMetadata>;
  pythonPackages: BasePackageInfo[];
  setNpmPackageError: (name: string, error?: string) => void;
  setNpmPackageInstalled: (name: string, version?: string) => void;
  setNpmPackageInstalling: (name: string, installing: boolean) => void;
  setPythonPackageError: (name: string, error?: string) => void;
  setPythonPackageInstalled: (name: string, version?: string) => void;
  setPythonPackageInstalling: (name: string, installing: boolean) => void;
}

/**
 * Coordinates metadata lookup, dismissal state, and install flows for runtime
 * package prompts.
 */
export function ManagedPackagePrompts({
  addNpmPackage,
  addPythonPackage,
  detectedMissingPackages,
  detectedMissingPythonPackages,
  dismissNpmPackage,
  dismissPythonPackage,
  dismissedNpmPackages,
  dismissedPythonPackages,
  elements,
  installNpmPackage,
  installPythonPackage,
  npmMetadata,
  npmPackages,
  pythonMetadata,
  pythonPackages,
  setNpmPackageError,
  setNpmPackageInstalled,
  setNpmPackageInstalling,
  setPythonPackageError,
  setPythonPackageInstalled,
  setPythonPackageInstalling,
}: ManagedPackagePromptsProps) {
  const actionResults = useMemo(
    () => elements.filter((entry) => entry.action),
    [elements]
  );

  const allActionItems = useMemo(
    () => [
      ...actionResults.map((entry) => ({
        isPython: false,
        pkgName: entry.action?.payload as string,
      })),
      ...npmPackages
        .filter(
          (pkg) =>
            !actionResults.some((entry) => entry.action?.payload === pkg.name)
        )
        .filter((pkg) => !pkg.isInstalled)
        .map((pkg) => ({ isPython: false, pkgName: pkg.name })),
      ...detectedMissingPackages
        .filter((pkgName) => {
          if (
            actionResults.some((entry) => entry.action?.payload === pkgName)
          ) {
            return false;
          }
          const existingPkg = npmPackages.find((pkg) => pkg.name === pkgName);
          if (existingPkg?.isInstalled) {
            return false;
          }
          return !existingPkg;
        })
        .map((pkgName) => ({ isPython: false, pkgName })),
      ...pythonPackages
        .filter((pkg) => !pkg.isInstalled)
        .map((pkg) => ({ isPython: true, pkgName: pkg.name })),
      ...detectedMissingPythonPackages
        .filter((pkgName) => {
          const existingPkg = pythonPackages.find(
            (pkg) => pkg.name === pkgName
          );
          if (existingPkg?.isInstalled) {
            return false;
          }
          return !existingPkg;
        })
        .map((pkgName) => ({ isPython: true, pkgName })),
    ],
    [
      actionResults,
      detectedMissingPackages,
      detectedMissingPythonPackages,
      npmPackages,
      pythonPackages,
    ]
  );

  const visibleActionItems = useMemo(
    () =>
      allActionItems
        .filter((item) => {
          if (item.isPython) {
            return !dismissedPythonPackages.includes(item.pkgName);
          }
          return !dismissedNpmPackages.includes(item.pkgName);
        })
        .map((item) => ({
          isPython: item.isPython,
          metadata: item.isPython
            ? (pythonMetadata[item.pkgName] as BasePackageMetadata | undefined)
            : (npmMetadata[item.pkgName] as BasePackageMetadata | undefined),
          pkgInfo: item.isPython
            ? pythonPackages.find((pkg) => pkg.name === item.pkgName)
            : npmPackages.find((pkg) => pkg.name === item.pkgName),
          pkgName: item.pkgName,
        })),
    [
      allActionItems,
      dismissedNpmPackages,
      dismissedPythonPackages,
      npmPackages,
      npmMetadata,
      pythonMetadata,
      pythonPackages,
    ]
  );

  const handleInstallNpmPackage = useCallback(
    async (packageName: string) => {
      addNpmPackage(packageName);
      setNpmPackageInstalling(packageName, true);

      try {
        const result = await installNpmPackage(packageName);
        if (result.success) {
          setNpmPackageInstalled(packageName, result.version);
        } else {
          setNpmPackageError(packageName, result.error);
        }
      } catch (error) {
        setNpmPackageError(
          packageName,
          error instanceof Error ? error.message : 'Installation failed'
        );
      }
    },
    [
      addNpmPackage,
      installNpmPackage,
      setNpmPackageError,
      setNpmPackageInstalled,
      setNpmPackageInstalling,
    ]
  );

  const handleInstallPythonPackage = useCallback(
    async (packageName: string) => {
      addPythonPackage(packageName);
      setPythonPackageInstalling(packageName, true);

      try {
        const result = await installPythonPackage(packageName);
        if (result.success) {
          setPythonPackageInstalled(packageName, result.version);
        } else {
          setPythonPackageError(packageName, result.error);
        }
      } catch (error) {
        setPythonPackageError(
          packageName,
          error instanceof Error ? error.message : 'Installation failed'
        );
      }
    },
    [
      addPythonPackage,
      installPythonPackage,
      setPythonPackageError,
      setPythonPackageInstalled,
      setPythonPackageInstalling,
    ]
  );

  return (
    <PackagePromptsOverlay
      items={visibleActionItems}
      onDismiss={(pkgName, isPython) => {
        if (isPython) {
          dismissPythonPackage(pkgName);
        } else {
          dismissNpmPackage(pkgName);
        }
      }}
      onInstall={(pkgName, isPython) => {
        if (isPython) {
          void handleInstallPythonPackage(pkgName);
        } else {
          void handleInstallNpmPackage(pkgName);
        }
      }}
    />
  );
}
