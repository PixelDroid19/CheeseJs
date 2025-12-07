/**
 * Python Package Manager Component
 * 
 * UI for managing Python packages via micropip (PyPI)
 */

import React, { useState, useEffect } from 'react'
import { usePythonPackagesStore, type PythonPackageInfo } from '../store/usePythonPackagesStore'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { Plus, Trash2, RefreshCw } from 'lucide-react'

export function PythonPackageManager() {
    const { t } = useTranslation()
    const [packageName, setPackageName] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const {
        packages,
        addPackage,
        removePackage,
        setPackageInstalling,
        setPackageInstalled,
        setPackageError
    } = usePythonPackagesStore()

    // Load installed packages on mount
    useEffect(() => {
        loadInstalledPackages()
    }, [])

    const loadInstalledPackages = async () => {
        try {
            if (!window.pythonPackageManager) return

            setIsLoading(true)
            const result = await window.pythonPackageManager.listInstalled()

            if (result.success && result.packages) {
                // Update store with installed packages
                result.packages.forEach((name: string) => {
                    addPackage(name)
                    setPackageInstalled(name)
                })
            }
        } catch (error) {
            console.error('[PythonPackageManager] Error loading packages:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleInstallPackage = async () => {
        if (!packageName.trim()) return

        const name = packageName.trim()
        setPackageName('')

        // Add to store and mark as installing
        addPackage(name)
        setPackageInstalling(name, true)

        try {
            if (!window.pythonPackageManager) {
                throw new Error('Python package manager not available')
            }

            const result = await window.pythonPackageManager.install(name)

            if (result.success) {
                setPackageInstalled(name)
            } else {
                setPackageError(name, result.error || 'Installation failed')
            }
        } catch (error) {
            setPackageError(name, error instanceof Error ? error.message : 'Unknown error')
        }
    }

    const handleRemovePackage = (name: string) => {
        // Note: micropip doesn't support uninstall, just remove from UI
        removePackage(name)
    }

    const handleRetryInstall = async (name: string) => {
        setPackageInstalling(name, true)

        try {
            if (!window.pythonPackageManager) {
                throw new Error('Python package manager not available')
            }

            const result = await window.pythonPackageManager.install(name)

            if (result.success) {
                setPackageInstalled(name)
            } else {
                setPackageError(name, result.error || 'Installation failed')
            }
        } catch (error) {
            setPackageError(name, error instanceof Error ? error.message : 'Unknown error')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleInstallPackage()
        }
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div>
                <p className="text-sm text-muted-foreground">
                    {t('settings.pypi.description', 'Manage Python packages for your code. Packages are installed via micropip from PyPI.')}
                </p>
            </div>

            {/* Info Section (match NPM layout) */}
            <div>
                <h3 className="text-sm font-semibold mb-3 text-foreground">
                    {t('settings.pypi.info.title', 'How it works:')}
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                    <li>{t('settings.pypi.info.auto', 'Packages are detected from import statements')}</li>
                    <li>{t('settings.pypi.info.install', 'They are installed automatically on first execution')}</li>
                    <li>{t('settings.pypi.info.manual', 'You can also manually add packages here')}</li>
                    <li>{t('settings.pypi.info.sandbox', 'All code runs in a secure WebAssembly sandbox')}</li>
                </ul>
            </div>

            {/* Packages Section */}
            <div className="flex-1 flex flex-col min-h-0">
                <h3 className="text-sm font-semibold mb-3 text-foreground">
                    {t('settings.pypi.installedPackages', 'Installed Packages')}
                </h3>

                {/* Add Package Input */}
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        value={packageName}
                        onChange={(e) => setPackageName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('settings.pypi.placeholder', 'Package name (e.g., numpy, pandas)')}
                        className={clsx(
                            "flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-ring",
                            "bg-background text-foreground border-border"
                        )}
                    />
                    <button
                        onClick={handleInstallPackage}
                        disabled={!packageName.trim()}
                        className={clsx(
                            "px-3 py-2 rounded-md transition-colors flex items-center justify-center",
                            packageName.trim()
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                                : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                        title={t('settings.pypi.add', 'Add')}
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {/* Packages List */}
                <div className={clsx(
                    "flex-1 overflow-auto border rounded-md",
                    "border-border bg-background"
                )}>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span>{t('settings.pypi.loading', 'Loading packages...')}</span>
                            </div>
                        </div>
                    ) : packages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            {t('settings.pypi.empty', 'No packages installed yet')}
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {packages.map((pkg: PythonPackageInfo) => (
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
                                                    <span className="text-xs">{t('packages.installing', 'Installing...')}</span>
                                                </div>
                                            ) : pkg.error ? (
                                                <button
                                                    onClick={() => handleRetryInstall(pkg.name)}
                                                    className="flex items-center gap-1 text-destructive hover:text-destructive/80"
                                                    title={`Error: ${pkg.error}. Click to retry.`}
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    <span className="text-xs">{t('packages.retry', 'Retry')}</span>
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

                                    {/* Hide delete button for core packages */}
                                    {!['micropip'].includes(pkg.name) && (
                                        <button
                                            onClick={() => handleRemovePackage(pkg.name)}
                                            className="p-2 ml-2 rounded-md transition-colors text-destructive hover:bg-destructive/10"
                                            title={t('settings.pypi.remove', 'Remove package')}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PythonPackageManager
