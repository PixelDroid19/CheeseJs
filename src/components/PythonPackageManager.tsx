/**
 * Python Package Manager Component
 *
 * UI for managing Python packages via micropip (PyPI)
 */

import { useState, useEffect, useCallback } from 'react';
import { usePythonPackagesStore } from '../store/usePythonPackagesStore';
import { useTranslation } from 'react-i18next';
import { PackageList } from './PackageList';

export function PythonPackageManager() {
  const { t } = useTranslation();
  const [packageName, setPackageName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    packages,
    addPackage,
    removePackage,
    setPackageInstalling,
    setPackageInstalled,
    setPackageError,
  } = usePythonPackagesStore();

  const loadInstalledPackages = useCallback(async () => {
    try {
      if (!window.pythonPackageManager) return;

      setIsLoading(true);
      const result = await window.pythonPackageManager.listInstalled();

      if (result.success && result.packages) {
        // Update store with installed packages
        result.packages.forEach((name: string) => {
          addPackage(name);
          setPackageInstalled(name);
        });
      }
    } catch (error) {
      console.error('[PythonPackageManager] Error loading packages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [addPackage, setPackageInstalled]);

  // Load installed packages on mount
  useEffect(() => {
    loadInstalledPackages();
  }, [loadInstalledPackages]);

  const handleInstallPackage = async () => {
    if (!packageName.trim()) return;

    const name = packageName.trim();
    setPackageName('');

    // Add to store and mark as installing
    addPackage(name);
    setPackageInstalling(name, true);

    try {
      if (!window.pythonPackageManager) {
        throw new Error('Python package manager not available');
      }

      const result = await window.pythonPackageManager.install(name);

      if (result.success) {
        setPackageInstalled(name);
      } else {
        setPackageError(name, result.error || 'Installation failed');
      }
    } catch (error) {
      setPackageError(
        name,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  const handleRemovePackage = (name: string) => {
    // Note: micropip doesn't support uninstall, just remove from UI
    removePackage(name);
  };

  const handleRetryInstall = async (name: string) => {
    setPackageInstalling(name, true);

    try {
      if (!window.pythonPackageManager) {
        throw new Error('Python package manager not available');
      }

      const result = await window.pythonPackageManager.install(name);

      if (result.success) {
        setPackageInstalled(name);
      } else {
        setPackageError(name, result.error || 'Installation failed');
      }
    } catch (error) {
      setPackageError(
        name,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">
          {t(
            'settings.pypi.description',
            'Manage Python packages for your code. Packages are installed via micropip from PyPI.'
          )}
        </p>
      </div>

      {/* Info Section */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('settings.pypi.info.title', 'How it works:')}
        </h3>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
          <li>
            {t(
              'settings.pypi.info.auto',
              'Packages are detected from import statements'
            )}
          </li>
          <li>
            {t(
              'settings.pypi.info.install',
              'They are installed automatically on first execution'
            )}
          </li>
          <li>
            {t(
              'settings.pypi.info.manual',
              'You can also manually add packages here'
            )}
          </li>
          <li>
            {t(
              'settings.pypi.info.sandbox',
              'All code runs in a secure WebAssembly sandbox'
            )}
          </li>
        </ul>
      </div>

      {/* Limitations Section */}
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        <h3 className="text-sm font-semibold mb-2 text-amber-600 dark:text-amber-400">
          ⚠️ {t('settings.pypi.limitations.title', 'Pyodide Limitations')}
        </h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>
            {t(
              'settings.pypi.limitations.sockets',
              'No native sockets - packages like aiohttp cannot make HTTPS requests'
            )}
          </li>
          <li>
            {t(
              'settings.pypi.limitations.ssl',
              'SSL/TLS not supported - use pyodide.http.pyfetch for HTTP requests'
            )}
          </li>
          <li>
            {t(
              'settings.pypi.limitations.threading',
              'No threading/multiprocessing support'
            )}
          </li>
          <li>
            {t(
              'settings.pypi.limitations.wheels',
              'Only pure Python packages or packages with WebAssembly wheels work'
            )}
          </li>
        </ul>
        <a
          href="https://pyodide.org/en/stable/usage/wasm-constraints.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline mt-2 inline-block"
        >
          {t('settings.pypi.limitations.learnMore', 'Learn more →')}
        </a>
      </div>

      {/* Packages Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('settings.pypi.installedPackages', 'Installed Packages')}
        </h3>

        <PackageList
          packages={packages}
          packageName={packageName}
          onPackageNameChange={setPackageName}
          onAddPackage={handleInstallPackage}
          onRemovePackage={handleRemovePackage}
          onRetryInstall={handleRetryInstall}
          isLoading={isLoading}
          protectedPackages={['micropip']}
          strings={{
            placeholder: t(
              'settings.pypi.placeholder',
              'Package name (e.g., numpy, pandas)'
            ),
            addTitle: t('settings.pypi.add', 'Add'),
            removeTitle: t('settings.pypi.remove', 'Remove package'),
            emptyMessage: t('settings.pypi.empty', 'No packages installed yet'),
            loadingMessage: t('settings.pypi.loading', 'Loading packages...'),
            installingText: t('packages.installing', 'Installing...'),
            retryText: t('packages.retry', 'Retry'),
          }}
        />
      </div>
    </div>
  );
}

export default PythonPackageManager;
