/**
 * Shared package list component used by both npm and Python package managers.
 */

import React from 'react';
import clsx from 'clsx';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import type { BasePackageInfo } from '../store/createPackageStore';

interface PackageListProps {
  packages: BasePackageInfo[];
  packageName: string;
  onPackageNameChange: (name: string) => void;
  onAddPackage: () => void;
  onRemovePackage: (name: string) => void;
  onRetryInstall: (name: string) => void;
  isLoading?: boolean;
  /** Translation strings */
  strings: {
    placeholder: string;
    addTitle: string;
    removeTitle: string;
    emptyMessage: string;
    loadingMessage?: string;
    installingText?: string;
    retryText?: string;
  };
  /** Packages that should not show the delete button */
  protectedPackages?: string[];
}

export function PackageList({
  packages,
  packageName,
  onPackageNameChange,
  onAddPackage,
  onRemovePackage,
  onRetryInstall,
  isLoading = false,
  strings,
  protectedPackages = [],
}: PackageListProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onAddPackage();
    }
  };

  return (
    <>
      {/* Add Package Input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={packageName}
          onChange={(e) => onPackageNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={strings.placeholder}
          className={clsx(
            'flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-ring',
            'bg-background text-foreground border-border'
          )}
        />
        <button
          onClick={onAddPackage}
          disabled={!packageName.trim()}
          className={clsx(
            'px-3 py-2 rounded-md transition-colors flex items-center justify-center',
            packageName.trim()
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
          title={strings.addTitle}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Packages List */}
      <div
        className={clsx(
          'flex-1 overflow-auto border rounded-md',
          'border-border bg-background'
        )}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span>{strings.loadingMessage || 'Loading...'}</span>
            </div>
          </div>
        ) : packages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {strings.emptyMessage}
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
                        <span className="text-xs">
                          {strings.installingText || 'Installing...'}
                        </span>
                      </div>
                    ) : pkg.error ? (
                      <button
                        onClick={() => onRetryInstall(pkg.name)}
                        className="flex items-center gap-1 text-destructive hover:text-destructive/80"
                        title={`Error: ${pkg.error}. Click to retry.`}
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span className="text-xs">
                          {strings.retryText || 'Retry'}
                        </span>
                      </button>
                    ) : pkg.isInstalled ? (
                      <div className="text-success">✓</div>
                    ) : (
                      <div className="text-muted-foreground text-xs">
                        Pending
                      </div>
                    )}
                  </div>
                </div>

                {!protectedPackages.includes(pkg.name) && (
                  <button
                    onClick={() => onRemovePackage(pkg.name)}
                    className="p-2 ml-2 rounded-md transition-colors text-destructive hover:bg-destructive/10"
                    title={strings.removeTitle}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
