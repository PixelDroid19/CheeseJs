import { useState, useEffect, useCallback } from 'react';

export interface BasePackageMetadata {
  name?: string;
  description?: string;
  version?: string;
  loading?: boolean;
  error?: string;
}

type FetchFn<T extends BasePackageMetadata> = (name: string) => Promise<T>;

/**
 * Creates a hook that fetches and caches metadata for missing packages.
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
          if (cancelled) {
            break;
          }

          setPackageMetadata((prev) => {
            if (prev[pkgName]) {
              return prev;
            }

            fetchInfo(pkgName)
              .then((info) => {
                if (!cancelled) {
                  setPackageMetadata((current) => ({
                    ...current,
                    [pkgName]: info.error
                      ? info
                      : (info as T) || ({ error: 'Failed to fetch info' } as T),
                  }));
                }
              })
              .catch(() => {
                if (!cancelled) {
                  setPackageMetadata((current) => ({
                    ...current,
                    [pkgName]: { error: 'Failed to fetch info' } as T,
                  }));
                }
              });

            return { ...prev, [pkgName]: { loading: true } as T };
          });
        }
      };

      if (detectedMissingPackages.length > 0) {
        void fetchMetadata();
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
