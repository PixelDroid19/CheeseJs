import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Shared types
// ============================================================================

export interface BasePackageMetadata {
  name?: string;
  description?: string;
  version?: string;
  loading?: boolean;
  error?: string;
}

type FetchFn<T extends BasePackageMetadata> = (name: string) => Promise<T>;

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates a hook that fetches & caches package metadata for a list of
 * detected-missing packages.
 *
 * The returned hook avoids re-fetching already-known packages and supports
 * dismissing packages so they are not re-fetched.
 */
export function createPackageMetadataHook<
  T extends BasePackageMetadata = BasePackageMetadata,
>(fetchInfo: FetchFn<T>) {
  return function usePackageMetadataInner(detectedMissingPackages: string[]) {
    const [packageMetadata, setPackageMetadata] = useState<Record<string, T>>(
      {}
    );
    const [dismissedPackages, setDismissedPackages] = useState<string[]>([]);

    useEffect(() => {
      let cancelled = false;

      const fetchMetadata = async () => {
        for (const pkgName of detectedMissingPackages) {
          if (cancelled) break;

          // Use callback form so we don't need packageMetadata in deps
          setPackageMetadata((prev) => {
            if (prev[pkgName]) return prev; // already fetched or loading

            // Fire-and-forget the actual fetch
            fetchInfo(pkgName)
              .then((info) => {
                if (!cancelled) {
                  setPackageMetadata((p) => ({
                    ...p,
                    [pkgName]: info.error
                      ? info
                      : (info as T) || ({ error: 'Failed to fetch info' } as T),
                  }));
                }
              })
              .catch(() => {
                if (!cancelled) {
                  setPackageMetadata((p) => ({
                    ...p,
                    [pkgName]: { error: 'Failed to fetch info' } as T,
                  }));
                }
              });

            return { ...prev, [pkgName]: { loading: true } as T };
          });
        }
      };

      if (detectedMissingPackages.length > 0) {
        fetchMetadata();
      }

      return () => {
        cancelled = true;
      };
    }, [detectedMissingPackages]);

    const dismissPackage = useCallback((pkgName: string) => {
      setDismissedPackages((prev) => [...prev, pkgName]);
    }, []);

    const clearDismissed = useCallback(() => {
      setDismissedPackages([]);
    }, []);

    return {
      packageMetadata,
      dismissedPackages,
      setDismissedPackages,
      dismissPackage,
      clearDismissed,
    };
  };
}
