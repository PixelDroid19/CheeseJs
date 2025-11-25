import { useState } from 'react'
import { usePackagesStore } from '../store/usePackagesStore'
import { useTranslation } from 'react-i18next'

export function PackageManager() {
  const { t } = useTranslation()
  const [packageName, setPackageName] = useState('')
  const packages = usePackagesStore((state) => state.packages)

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
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-2">NPM Packages</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('settings.npm.description', 'Manage npm packages for your code. Packages are automatically installed when detected in imports.')}
        </p>
      </div>

      {/* Add Package Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('settings.npm.placeholder', 'Package name (e.g., lodash)')}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAddPackage}
          disabled={!packageName.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {t('settings.npm.add', 'Add')}
        </button>
      </div>

      {/* Packages List */}
      <div className="flex-1 overflow-auto border border-gray-300 dark:border-gray-600 rounded-md">
        {packages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {t('settings.npm.empty', 'No packages installed yet')}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {packages.map((pkg) => (
              <div
                key={pkg.name}
                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {pkg.name}
                    </div>
                    {pkg.version && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        v{pkg.version}
                      </div>
                    )}
                    {pkg.error && (
                      <div className="text-xs text-red-500 dark:text-red-400">
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
                      <div className="flex items-center gap-2 text-red-500">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-500">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemovePackage(pkg.name)}
                  disabled={pkg.installing}
                  className="ml-3 p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={t('settings.npm.remove', 'Remove package')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
        <div className="flex gap-2">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">{t('settings.npm.info.title', 'How it works:')}</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>{t('settings.npm.info.auto', 'Packages are automatically detected from import statements')}</li>
              <li>{t('settings.npm.info.install', 'They are installed on first code execution')}</li>
              <li>{t('settings.npm.info.manual', 'You can also manually add packages here')}</li>
              <li>{t('settings.npm.info.webcontainer', 'All packages run in an isolated WebContainer environment')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
