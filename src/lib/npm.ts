export interface NpmPackageInfo {
  name: string;
  version: string;
  description?: string;
  main?: string;
  types?: string;
  typings?: string;
  author?: string | { name: string; email?: string; url?: string };
  repository?: { type: string; url: string };
  homepage?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

// Cache for package information
const packageInfoCache = new Map<string, NpmPackageInfo | { error: string }>();

export const getCachedPackageInfo = (name: string) =>
  packageInfoCache.get(name);

export const clearPackageInfoCache = () => packageInfoCache.clear();

// Fetch package info from npm registry
export async function fetchPackageInfo(
  packageName: string
): Promise<NpmPackageInfo | { error: string } | null> {
  if (packageInfoCache.has(packageName)) {
    return packageInfoCache.get(packageName) || null;
  }

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${packageName}/latest`
    );
    if (response.ok) {
      const data = (await response.json()) as NpmPackageInfo;
      packageInfoCache.set(packageName, data);
      return data;
    } else if (response.status === 404) {
      // Package not found
      packageInfoCache.set(packageName, { error: 'Package not found' });
      return { error: 'Package not found' };
    }
  } catch (error) {
    console.error('Failed to fetch package info:', error);
  }
  return null;
}
