// Cache for package information
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const packageInfoCache = new Map<string, any>();

export const getCachedPackageInfo = (name: string) =>
  packageInfoCache.get(name);

export const clearPackageInfoCache = () => packageInfoCache.clear();

// Fetch package info from npm registry
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchPackageInfo(packageName: string): Promise<any> {
  if (packageInfoCache.has(packageName)) {
    return packageInfoCache.get(packageName);
  }

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${packageName}/latest`
    );
    if (response.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await response.json();
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
