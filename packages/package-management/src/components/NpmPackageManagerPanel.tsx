import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import clsx from 'clsx';
import type { BasePackageInfo } from '@cheesejs/core';
import { Toggle, Tooltip } from '@cheesejs/ui';

import { PackageList } from './PackageList';

export interface NpmPackageManagerPanelProps {
  autoInstallPackages: boolean;
  autoRunAfterInstall: boolean;
  npmRcContent: string;
  onAddPackage: () => Promise<void> | void;
  onAutoInstallPackagesChange: (value: boolean) => void;
  onAutoRunAfterInstallChange: (value: boolean) => void;
  onNpmRcContentChange: (value: string) => void;
  onPackageNameChange: (value: string) => void;
  onRemovePackage: (name: string) => Promise<void> | void;
  onRetryInstall: (name: string) => Promise<void> | void;
  packageName: string;
  packages: BasePackageInfo[];
}

export function NpmPackageManagerPanel({
  autoInstallPackages,
  autoRunAfterInstall,
  npmRcContent,
  onAddPackage,
  onAutoInstallPackagesChange,
  onAutoRunAfterInstallChange,
  onNpmRcContentChange,
  onPackageNameChange,
  onRemovePackage,
  onRetryInstall,
  packageName,
  packages,
}: NpmPackageManagerPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {t(
            'settings.npm.description',
            'Manage npm packages for your code. Packages are automatically installed when detected in imports.'
          )}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('settings.npm.configuration', 'Configuration (.npmrc)')}
        </h3>
        <textarea
          value={npmRcContent}
          onChange={(event) => onNpmRcContentChange(event.target.value)}
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

      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('settings.npm.automation', 'Automation')}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between min-h-10">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground">
                {t('settings.advanced.autoInstallPackages')}
              </span>
              <HelpIcon
                content={t('settings.advanced.autoInstallPackagesTooltip')}
              />
            </div>
            <Toggle
              checked={autoInstallPackages}
              onChange={onAutoInstallPackagesChange}
            />
          </div>

          <div className="flex items-center justify-between min-h-10">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground">
                {t('settings.advanced.autoRunAfterInstall')}
              </span>
              <HelpIcon
                content={t('settings.advanced.autoRunAfterInstallTooltip')}
              />
            </div>
            <Toggle
              checked={autoRunAfterInstall}
              onChange={onAutoRunAfterInstallChange}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('settings.npm.installedPackages', 'Installed Packages')}
        </h3>

        <PackageList
          packages={packages}
          packageName={packageName}
          onPackageNameChange={onPackageNameChange}
          onAddPackage={() => void onAddPackage()}
          onRemovePackage={(name) => void onRemovePackage(name)}
          onRetryInstall={(name) => void onRetryInstall(name)}
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

function HelpIcon({ content }: { content: string }) {
  return (
    <Tooltip content={content}>
      <HelpCircle
        size={15}
        className={clsx(
          'transition-colors text-muted-foreground hover:text-foreground'
        )}
      />
    </Tooltip>
  );
}
