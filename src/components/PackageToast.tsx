/**
 * PackageToast Component
 *
 * Memoized toast component for displaying package installation prompts.
 * Extracted from Result.tsx for better performance and maintainability.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  AlertCircle,
  Loader2,
  Package as PackageIcon,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface PackageToastProps {
  pkgName: string;
  isPython: boolean;
  isInstalling?: boolean;
  isInstalled?: boolean;
  error?: string;
  version?: string;
  description?: string;
  isLoading?: boolean;
  doesNotExist?: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export const PackageToast = memo(function PackageToast({
  pkgName,
  isPython,
  isInstalling = false,
  error,
  version,
  description,
  isLoading = false,
  doesNotExist = false,
  onInstall,
  onDismiss,
}: PackageToastProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="pointer-events-auto bg-popover/95 backdrop-blur-md border border-border shadow-xl rounded-lg overflow-hidden"
    >
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-muted rounded-md">
              {isPython ? (
                <span className="text-lg">🐍</span>
              ) : (
                <PackageIcon className="size-4.5 text-primary" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm font-semibold truncate">
                  {pkgName}
                </span>
                {version && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                    v{version}
                  </span>
                )}
              </div>
              {description && (
                <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                  {description}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded"
            aria-label={`Dismiss ${pkgName}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {isInstalling ? (
            <span className="text-info text-xs flex items-center gap-2 bg-info/10 px-3 py-1.5 rounded-md border border-info/20 w-full justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t('packages.installing', 'Installing...')}
            </span>
          ) : error ? (
            <div className="flex flex-col gap-2 w-full">
              <span className="text-destructive text-xs flex items-center gap-2 bg-destructive/10 p-2 rounded border border-destructive/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{error}</span>
              </span>
              <button
                onClick={onInstall}
                className="w-full px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />{' '}
                {t('packages.retry', 'Retry')}
              </button>
            </div>
          ) : doesNotExist ? (
            <span className="text-destructive text-xs flex items-center gap-2 bg-destructive/10 px-3 py-1.5 rounded-md border border-destructive/20 w-full justify-center">
              <AlertCircle className="w-3.5 h-3.5" />{' '}
              {t('packages.notFound', 'Package not found')}
            </span>
          ) : isLoading ? (
            <span className="text-muted-foreground text-xs flex items-center gap-2 w-full justify-center py-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />{' '}
              {t('packages.checking', 'Checking...')}
            </span>
          ) : (
            <button
              onClick={onInstall}
              className="w-full px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />{' '}
              {isPython
                ? t('packages.installPython', 'Install via micropip')
                : t('packages.install', 'Install Package')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
