import React, { useState } from 'react'
import { usePackagesStore } from '../store/usePackagesStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useTranslation } from 'react-i18next'
import { useThemeColors } from '../hooks/useThemeColors'
import clsx from 'clsx'
import { Plus, Trash2 } from 'lucide-react'

export function PackageManager () {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const [packageName, setPackageName] = useState('')
  const packages = usePackagesStore((state) => state.packages)
  const { npmRcContent, setNpmRcContent } = useSettingsStore()

  const handleAddPackage = () => {
    if (!packageName.trim()) return

    // Add package to store - it will be installed on next code run
    usePackagesStore.getState().addPackage(packageName.trim())
    setPackageName('')
  }

  const handleRemovePackage = (pkg: string) => {
    usePackagesStore.getState().removePackage(pkg)
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
        <p className={clsx("text-sm", colors.textSecondary)}>
          {t('settings.npm.description', 'Manage npm packages for your code. Packages are automatically installed when detected in imports.')}
        </p>
      </div>

      {/* Configuration Section (.npmrc) */}
      <div>
        <h3 className={clsx("text-sm font-semibold mb-3", colors.text)}>
          {t('settings.npm.configuration', 'Configuration (.npmrc)')}
        </h3>
        <textarea
          value={npmRcContent}
          onChange={(e) => setNpmRcContent(e.target.value)}
          className={clsx(
            "w-full h-32 px-3 py-2 text-sm rounded-md font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500",
            colors.inputBg,
            colors.text,
            colors.border,
            "border"
          )}
          placeholder={t('settings.npm.registryPlaceholder', 'registry=https://registry.npmjs.org/')}
          spellCheck={false}
        />
      </div>

      {/* Packages Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className={clsx("text-sm font-semibold mb-3", colors.text)}>
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
              "flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500",
              colors.inputBg,
              colors.text,
              colors.border
            )}
          />
          <button
            onClick={handleAddPackage}
            disabled={!packageName.trim()}
            className={clsx(
              "px-3 py-2 rounded-md transition-colors flex items-center justify-center",
              packageName.trim() 
                ? "bg-blue-500 hover:bg-blue-600 text-white" 
                : clsx(colors.active, colors.textSecondary, "cursor-not-allowed")
            )}
            title={t('settings.npm.add', 'Add')}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Packages List */}
        <div className={clsx(
          "flex-1 overflow-auto border rounded-md",
          colors.border,
          colors.bg
        )}>
          {packages.length === 0 ? (
            <div className={clsx("flex items-center justify-center h-full", colors.textSecondary)}>
              {t('settings.npm.empty', 'No packages installed yet')}
            </div>
          ) : (
            <div className={clsx("divide-y", colors.divider)}>
              {packages.map((pkg) => (
                <div
                  key={pkg.name}
                  className={clsx(
                    "flex items-center justify-between p-3 transition-colors",
                    colors.hover
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1">
                      <div className={clsx("font-medium", colors.text)}>
                        {pkg.name}
                      </div>
                      {pkg.version && (
                        <div className={clsx("text-xs", colors.textSecondary)}>
                          v{pkg.version}
                        </div>
                      )}
                      {pkg.error && (
                        <div className="text-xs text-red-500">
                          Error: {pkg.error}
                        </div>
                      )}
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center">
                      {pkg.installing ? (
                        <div className="flex items-center gap-2 text-blue-500">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs">Installing...</span>
                        </div>
                      ) : pkg.error ? (
                        <div className="text-red-500" title={pkg.error}>
                          ⚠
                        </div>
                      ) : (
                        <div className="text-green-500">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemovePackage(pkg.name)}
                    className={clsx(
                      "p-2 ml-2 rounded-md transition-colors text-red-500 hover:bg-red-500/10",
                    )}
                    title={t('settings.npm.remove', 'Remove package')}
                  >
                    <Trash2 size={16} />
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
