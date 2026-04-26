import { useMemo, useState } from 'react';

import { NpmPackageManagerPanel } from './NpmPackageManagerPanel';
import { usePackageInstaller } from '../hooks/usePackageInstaller';
import type { NpmPackageBridge } from '../bridges/packageManagement';
import type {
  NpmPackageSettingsAdapter,
  NpmPackageStoreAdapter,
} from '../types';

export interface NpmPackageManagerProps {
  bridge: NpmPackageBridge;
  settings: NpmPackageSettingsAdapter;
  store: NpmPackageStoreAdapter;
}

/**
 * Connected npm package manager using injected store and host bridge adapters.
 */
export function NpmPackageManager({
  bridge,
  settings,
  store,
}: NpmPackageManagerProps) {
  const [packageName, setPackageName] = useState('');
  const installer = usePackageInstaller({ bridge, store });

  const packages = useMemo(() => store.packages, [store.packages]);

  const handleAddPackage = async () => {
    if (!packageName.trim()) {
      return;
    }

    const name = packageName.trim();
    setPackageName('');
    await installer.installPackage(name);
  };

  return (
    <NpmPackageManagerPanel
      packages={packages}
      packageName={packageName}
      onPackageNameChange={setPackageName}
      onAddPackage={handleAddPackage}
      onRemovePackage={async (name) => {
        await installer.uninstallPackage(name);
      }}
      onRetryInstall={async (name) => {
        await installer.installPackage(name);
      }}
      npmRcContent={settings.npmRcContent}
      onNpmRcContentChange={settings.setNpmRcContent}
      autoInstallPackages={settings.autoInstallPackages}
      onAutoInstallPackagesChange={settings.setAutoInstallPackages}
      autoRunAfterInstall={settings.autoRunAfterInstall}
      onAutoRunAfterInstallChange={settings.setAutoRunAfterInstall}
    />
  );
}
