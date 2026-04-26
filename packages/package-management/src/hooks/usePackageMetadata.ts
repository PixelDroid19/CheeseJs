import {
  createPackageMetadataHook,
  type BasePackageMetadata,
} from './createPackageMetadataHook';

const packageInfoCache = new Map<
  string,
  BasePackageMetadata | { error: string }
>();

async function fetchPackageInfo(
  packageName: string
): Promise<BasePackageMetadata | { error: string }> {
  if (packageInfoCache.has(packageName)) {
    return packageInfoCache.get(packageName)!;
  }

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${packageName}/latest`
    );

    if (response.ok) {
      const data = (await response.json()) as BasePackageMetadata;
      packageInfoCache.set(packageName, data);
      return data;
    }

    if (response.status === 404) {
      const result = { error: 'Package not found' };
      packageInfoCache.set(packageName, result);
      return result;
    }
  } catch (error) {
    console.error('Failed to fetch package info:', error);
  }

  return { error: 'Failed to fetch info' };
}

export type PackageMetadata = BasePackageMetadata;

export const getCachedPackageInfo = (name: string) =>
  packageInfoCache.get(name);

export const clearPackageInfoCache = () => packageInfoCache.clear();

/**
 * Fetches and caches npm package metadata.
 */
export const usePackageMetadata = createPackageMetadataHook<PackageMetadata>(
  async (name) => {
    const info = await fetchPackageInfo(name);
    if (!info || info.error) {
      return { error: info?.error || 'Failed to fetch info' };
    }
    return info as PackageMetadata;
  }
);
