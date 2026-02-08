import { fetchPackageInfo } from '../lib/npm';
import {
  createPackageMetadataHook,
  type BasePackageMetadata,
} from './createPackageMetadataHook';

// Backwards-compatible type alias
export type PackageMetadata = BasePackageMetadata;

/**
 * Hook to fetch and cache npm package metadata.
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
