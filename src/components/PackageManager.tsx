import React, { useState } from 'react'
import { usePackagesStore } from '../store/usePackagesStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { usePackageInstaller } from '../hooks/usePackageInstaller'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { Plus, Trash2, RefreshCw } from 'lucide-react'

export function PackageManager () {
  const { t } = useTranslation()
  const [packageName, setPackageName] = useState('')
  const packages = usePackagesStore((state) => state.packages)
  const { npmRcContent, setNpmRcContent } = useSettingsStore()
  const { installPackage, uninstallPackage } = usePackageInstaller()

  const handleAddPackage = async () => {
    if (!packageName.trim()) return

    const name = packageName.trim()
    setPackageName('')
    
    // Install the package via Electron IPC
    await installPackage(name)
  }

  const handleRemovePackage = async (pkg: string) => {
    await uninstallPackage(pkg)
  }

  const handleRetryInstall = async (pkg: string) => {
    await installPackage(pkg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPackage()
    }
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">
          {t('settings.npm.description', 'Manage npm packages for your code. Packages are automatically installed when detected in imports.')}
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
            "w-full h-32 px-3 py-2 text-sm rounded-md font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring",
            "bg-background text-foreground border-border border"
          )}
          placeholder={t('settings.npm.registryPlaceholder', 'registry=https://registry.npmjs.org/')}
          spellCheck={false}
        />
      </div>

      {/* Packages Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('settings.npm.installedPackages', 'Installed Packages')}
        </h3>

        {/* Add Package Input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('settings.npm.placeholder', 'Package name (e.g., lodash)')}
            className={clsx(
              "flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-ring",
              "bg-background text-foreground border-border"
            )}
          />
          <button
            onClick={handleAddPackage}
            disabled={!packageName.trim()}
            className={clsx(
              "px-3 py-2 rounded-md transition-colors flex items-center justify-center",
              packageName.trim() 
                ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            title={t('settings.npm.add', 'Add')}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Packages List */}
        <div className={clsx(
          "flex-1 overflow-auto border rounded-md",
          "border-border bg-background"
        )}>
          {packages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t('settings.npm.empty', 'No packages installed yet')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {packages.map((pkg) => (
                <div
                  key={pkg.name}
                  className="flex items-center justify-between p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {pkg.name}
                      </div>
                      {pkg.version && (
                        <div className="text-xs text-muted-foreground">
                          v{pkg.version}
                        </div>
                      )}
                      {pkg.error && (
                        <div className="text-xs text-destructive">
                          Error: {pkg.error}
                        </div>
                      )}
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center">
                      {pkg.installing ? (
                        <div className="flex items-center gap-2 text-info">
                          <div className="w-4 h-4 border-2 border-info border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs">Installing...</span>
                        </div>
                      ) : pkg.error ? (
                        <button
                          onClick={() => handleRetryInstall(pkg.name)}
                          className="flex items-center gap-1 text-destructive hover:text-destructive/80"
                          title={`Error: ${pkg.error}. Click to retry.`}
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span className="text-xs">Retry</span>
                        </button>
                      ) : pkg.isInstalled ? (
                        <div className="text-success">
                          ✓
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-xs">
                          Pending
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemovePackage(pkg.name)}
                    className="p-2 ml-2 rounded-md transition-colors text-destructive hover:bg-destructive/10"
                    title={t('settings.npm.remove', 'Remove package')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
