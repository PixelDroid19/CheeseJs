import { useState } from 'react';
import { NpmPackageManagerPanel } from '@cheesejs/package-management';
import { usePackagesStore } from '../store/storeHooks';
import { useSettingsStore } from '../store/storeHooks';
import { usePackageInstaller } from '../hooks/usePackageInstaller';

export function PackageManager() {
  const [packageName, setPackageName] = useState('');
  const packages = usePackagesStore((state) => state.packages);
  const {
    npmRcContent,
    setNpmRcContent,
    autoInstallPackages,
    setAutoInstallPackages,
    autoRunAfterInstall,
    setAutoRunAfterInstall,
  } = useSettingsStore();
  const { installPackage, uninstallPackage } = usePackageInstaller();

  const handleAddPackage = async () => {
    if (!packageName.trim()) return;

    const name = packageName.trim();
    setPackageName('');

    // Install the package via Electron IPC
    await installPackage(name);
  };

  const handleRemovePackage = async (pkg: string) => {
    await uninstallPackage(pkg);
  };

  const handleRetryInstall = async (pkg: string) => {
    await installPackage(pkg);
  };

  return (
    <NpmPackageManagerPanel
      packages={packages}
      packageName={packageName}
      onPackageNameChange={setPackageName}
      onAddPackage={handleAddPackage}
      onRemovePackage={handleRemovePackage}
      onRetryInstall={handleRetryInstall}
      npmRcContent={npmRcContent}
      onNpmRcContentChange={setNpmRcContent}
      autoInstallPackages={autoInstallPackages}
      onAutoInstallPackagesChange={setAutoInstallPackages}
      autoRunAfterInstall={autoRunAfterInstall}
      onAutoRunAfterInstallChange={setAutoRunAfterInstall}
    />
  );
}
