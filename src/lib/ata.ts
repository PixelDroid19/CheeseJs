import { Monaco } from '@monaco-editor/react';
import { usePackagesStore } from '../store/usePackagesStore';

// Cache for fetched types to avoid redundant network requests
const fetchedTypes = new Set<string>();

export function setupTypeAcquisition(monaco: Monaco) {
  // Initial check
  checkAndFetchTypes(monaco);

  // Subscribe to package changes
  return usePackagesStore.subscribe((state, prevState) => {
    // Check if any new package was installed
    const newInstalled = state.packages.filter((p) => p.isInstalled);
    const oldInstalled = prevState.packages.filter((p) => p.isInstalled);

    if (newInstalled.length !== oldInstalled.length) {
      checkAndFetchTypes(monaco);
    }
  });
}

async function checkAndFetchTypes(monaco: Monaco) {
  const packages = usePackagesStore.getState().packages;

  for (const pkg of packages) {
    if (pkg.isInstalled && !fetchedTypes.has(pkg.name)) {
      // Mark as fetching to avoid parallel fetches
      fetchedTypes.add(pkg.name);
      const success = await fetchAndAddTypes(monaco, pkg.name, pkg.version);
      if (!success) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[ATA] Could not find types for ${pkg.name}, adding fallback.`
          );
        }
        addFallbackDeclaration(monaco, pkg.name);
      }
    }
  }
}

async function fetchAndAddTypes(
  monaco: Monaco,
  packageName: string,
  version?: string
): Promise<boolean> {
  try {
    // 1. Get the entry point and type definition URL from esm.sh
    // We use esm.sh because it reliably provides the X-TypeScript-Types header
    const url = `https://esm.sh/${packageName}${version ? `@${version}` : ''}`;

    // We use a HEAD request first to get the headers
    const response = await fetch(url, { method: 'HEAD' });
    const typesUrl = response.headers.get('X-TypeScript-Types');

    if (typesUrl) {
      // 2. Fetch the actual .d.ts content
      const typesResponse = await fetch(typesUrl);
      if (!typesResponse.ok) return false;

      const content = await typesResponse.text();

      // 3. Add to Monaco
      // We map it to file:///node_modules/PACKAGE/index.d.ts
      // This allows standard import resolution to work
      const libPath = `file:///node_modules/${packageName}/index.d.ts`;

      // Add to both JS and TS defaults
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ts = (monaco as any).typescript;
      ts.javascriptDefaults.addExtraLib(content, libPath);
      ts.typescriptDefaults.addExtraLib(content, libPath);

      // 4. Parse and fetch dependencies (basic depth handling)
      const importRegex =
        /(?:import|export)\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const dep = match[1];
        // Skip relative imports and already fetched packages
        if (!dep.startsWith('.') && !fetchedTypes.has(dep)) {
          // We don't await here to avoid blocking, just trigger the fetch
          checkAndFetchTypesForDep(monaco, dep);
        }
      }
      return true;
    } else {
      // Fallback: Try @types/PACKAGE if we haven't already
      if (!packageName.startsWith('@types/')) {
        // Remove from cache so we can try the @types variant
        // But wait, we are in a recursive context.
        // If we return false here, the caller will try fallback.
        // But we want to try @types first.

        // We temporarily remove from fetchedTypes to allow the recursive call to proceed
        // (though we passed packageName, not @types/packageName to fetchedTypes)
        // Actually, checkAndFetchTypes adds 'packageName'.
        // If we call fetchAndAddTypes with '@types/packageName', it's a different name.

        // Let's check if we already tried @types/packageName?
        // No, we just call it.
        const typesPackageName = `@types/${packageName}`;
        if (!fetchedTypes.has(typesPackageName)) {
          fetchedTypes.add(typesPackageName);
          const success = await fetchAndAddTypes(monaco, typesPackageName);
          if (success) {
            // If @types works, we map it effectively.
            // But wait, the user imported 'lodash', not '@types/lodash'.
            // Monaco needs to know that 'lodash' has these types.
            // When we fetch @types/lodash, the content usually declares module "lodash" OR it is an external module.
            // Usually index.d.ts in @types/lodash is for "lodash".
            // We need to make sure the libPath matches "lodash".

            // The recursive call will save it as file:///node_modules/@types/lodash/index.d.ts
            // TypeScript resolution looks in node_modules/@types/lodash/index.d.ts automatically.
            // So it should work!
            return true;
          }
        }
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ATA] Failed to fetch types for ${packageName}:`, error);
    }
  }
  return false;
}

async function checkAndFetchTypesForDep(monaco: Monaco, packageName: string) {
  if (!fetchedTypes.has(packageName)) {
    fetchedTypes.add(packageName);
    await fetchAndAddTypes(monaco, packageName);
  }
}

function addFallbackDeclaration(monaco: Monaco, packageName: string) {
  // Declare the module as any to suppress "Cannot find module" errors
  const content = `declare module "${packageName}" { const value: any; export default value; export = value; }`;
  const libPath = `file:///node_modules/${packageName}/fallback.d.ts`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts = (monaco as any).typescript;
  ts.javascriptDefaults.addExtraLib(content, libPath);
  ts.typescriptDefaults.addExtraLib(content, libPath);
}
