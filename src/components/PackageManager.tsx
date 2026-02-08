import { useState } from 'react';
import { usePackagesStore } from '../store/usePackagesStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePackageInstaller } from '../hooks/usePackageInstaller';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { PackageList } from './PackageList';

export function PackageManager() {
  const { t } = useTranslation();
  const [packageName, setPackageName] = useState('');
  const packages = usePackagesStore((state) => state.packages);
  const { npmRcContent, setNpmRcContent } = useSettingsStore();
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
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">
          {t(
            'settings.npm.description',
            'Manage npm packages for your code. Packages are automatically installed when detected in imports.'
          )}
        </p>
      </div>

      {/* Configuration Section (.npmrc) */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('settings.npm.configuration', 'Configuration (.npmrc)')}
        </h3>
        <textarea
          value={npmRcContent}
          onChange={(e) => setNpmRcContent(e.target.value)}
          className={clsx(
            'w-full h-32 px-3 py-2 text-sm rounded-md font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring',
            'bg-background text-foreground border-border border'
          )}
          placeholder={t(
            'settings.npm.registryPlaceholder',
            'registry=https://registry.npmjs.org/'
          )}
          spellCheck={false}
        />
      </div>

      {/* Packages Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('settings.npm.installedPackages', 'Installed Packages')}
        </h3>

        <PackageList
          packages={packages}
          packageName={packageName}
          onPackageNameChange={setPackageName}
          onAddPackage={handleAddPackage}
          onRemovePackage={handleRemovePackage}
          onRetryInstall={handleRetryInstall}
          strings={{
            placeholder: t(
              'settings.npm.placeholder',
              'Package name (e.g., lodash)'
            ),
            addTitle: t('settings.npm.add', 'Add'),
            removeTitle: t('settings.npm.remove', 'Remove package'),
            emptyMessage: t('settings.npm.empty', 'No packages installed yet'),
          }}
        />
      </div>
    </div>
  );
}
