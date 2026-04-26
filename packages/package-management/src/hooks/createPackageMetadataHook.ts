import { useState, useEffect, useCallback, useRef } from 'react';

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
    const packageMetadataRef = useRef<Record<string, T>>({});

    useEffect(() => {
      packageMetadataRef.current = packageMetadata;
    }, [packageMetadata]);

    useEffect(() => {
      let cancelled = false;

      const packagesToFetch = detectedMissingPackages.filter(
        (pkgName) => !packageMetadataRef.current[pkgName]
      );

      if (packagesToFetch.length === 0) {
        return () => {
          cancelled = true;
        };
      }

      setPackageMetadata((prev) => {
        const next = { ...prev };
        packagesToFetch.forEach((pkgName) => {
          if (!next[pkgName]) {
            next[pkgName] = { loading: true } as T;
          }
        });
        return next;
      });

      packagesToFetch.forEach((pkgName) => {
        void fetchInfo(pkgName)
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
      });

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
