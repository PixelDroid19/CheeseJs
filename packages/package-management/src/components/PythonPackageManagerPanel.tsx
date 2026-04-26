import { useTranslation } from 'react-i18next';
import type { BasePackageInfo } from '@cheesejs/core';

import { PackageList } from './PackageList';

export interface PythonPackageManagerPanelProps {
  isLoading: boolean;
  onAddPackage: () => Promise<void> | void;
  onPackageNameChange: (value: string) => void;
  onRemovePackage: (name: string) => void;
  onRetryInstall: (name: string) => Promise<void> | void;
  packageName: string;
  packages: BasePackageInfo[];
}

export function PythonPackageManagerPanel({
  isLoading,
  onAddPackage,
  onPackageNameChange,
  onRemovePackage,
  onRetryInstall,
  packageName,
  packages,
}: PythonPackageManagerPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {t(
            'settings.pypi.description',
            'Manage Python packages for your code. Packages are installed via micropip from PyPI.'
          )}
        </p>
      </div>

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

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        <h3 className="text-sm font-semibold mb-2 text-amber-600 dark:text-amber-400">
          {'⚠️ '} {t('settings.pypi.limitations.title', 'Pyodide Limitations')}
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

      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('settings.pypi.installedPackages', 'Installed Packages')}
        </h3>

        <PackageList
          packages={packages}
          packageName={packageName}
          onPackageNameChange={onPackageNameChange}
          onAddPackage={() => void onAddPackage()}
          onRemovePackage={onRemovePackage}
          onRetryInstall={(name) => void onRetryInstall(name)}
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
