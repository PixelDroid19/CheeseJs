import type { Monaco } from '@monaco-editor/react';

/** Package record consumed by the type acquisition service. */
export interface TypeAcquisitionPackageInfo {
  name: string;
  version?: string;
  isInstalled: boolean;
}

/** Minimal store contract required for automatic type acquisition. */
export interface TypeAcquisitionStore<
  TPackage extends TypeAcquisitionPackageInfo = TypeAcquisitionPackageInfo,
> {
  getState(): { packages: TPackage[] };
  subscribe(
    listener: (
      state: { packages: TPackage[] },
      prevState: { packages: TPackage[] }
    ) => void
  ): () => void;
}

interface MonacoTypeAcquisitionDefaults {
  javascriptDefaults: {
    addExtraLib: (content: string, filePath?: string) => void;
  };
  typescriptDefaults: {
    addExtraLib: (content: string, filePath?: string) => void;
  };
}

const fetchedTypes = new Set<string>();

const NODE_BUILTIN_MODULES = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'stream/promises',
  'string_decoder',
  'sys',
  'timers',
  'timers/promises',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

function isNodeBuiltin(packageName: string): boolean {
  const normalizedName = packageName.startsWith('node:')
    ? packageName.slice(5)
    : packageName;

  return NODE_BUILTIN_MODULES.has(normalizedName);
}

/**
 * Wires automatic type acquisition to a package store so Monaco receives
 * type definitions for newly installed packages.
 */
export function setupTypeAcquisition<
  TPackage extends TypeAcquisitionPackageInfo = TypeAcquisitionPackageInfo,
>(monaco: Monaco, packageStore: TypeAcquisitionStore<TPackage>) {
  checkAndFetchTypes(monaco, packageStore);

  return packageStore.subscribe((state, prevState) => {
    const newInstalled = state.packages.filter((pkg) => pkg.isInstalled);
    const oldInstalled = prevState.packages.filter((pkg) => pkg.isInstalled);

    if (newInstalled.length !== oldInstalled.length) {
      checkAndFetchTypes(monaco, packageStore);
    }
  });
}

async function checkAndFetchTypes<TPackage extends TypeAcquisitionPackageInfo>(
  monaco: Monaco,
  packageStore: TypeAcquisitionStore<TPackage>
) {
  const packages = packageStore.getState().packages;

  for (const pkg of packages) {
    if (pkg.isInstalled && !fetchedTypes.has(pkg.name)) {
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
  if (isNodeBuiltin(packageName)) {
    addNodeBuiltinDeclaration(monaco, packageName);
    return true;
  }

  try {
    const url = `https://esm.sh/${packageName}${version ? `@${version}` : ''}`;
    const response = await fetch(url, { method: 'HEAD' });
    const typesUrl = response.headers.get('X-TypeScript-Types');

    if (typesUrl) {
      const typesResponse = await fetch(typesUrl);
      if (!typesResponse.ok) return false;

      const content = await typesResponse.text();
      const libPath = `file:///node_modules/${packageName}/index.d.ts`;

      const ts = (
        monaco as unknown as { typescript: MonacoTypeAcquisitionDefaults }
      ).typescript;
      ts.javascriptDefaults.addExtraLib(content, libPath);
      ts.typescriptDefaults.addExtraLib(content, libPath);

      const importRegex =
        /(?:import|export)\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const dep = match[1];
        if (!dep.startsWith('.') && !fetchedTypes.has(dep)) {
          checkAndFetchTypesForDep(monaco, dep);
        }
      }
      return true;
    }

    if (!packageName.startsWith('@types/')) {
      const typesPackageName = `@types/${packageName}`;
      if (!fetchedTypes.has(typesPackageName)) {
        fetchedTypes.add(typesPackageName);
        const success = await fetchAndAddTypes(monaco, typesPackageName);
        if (success) {
          return true;
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
  if (isNodeBuiltin(packageName)) {
    if (!fetchedTypes.has(packageName)) {
      fetchedTypes.add(packageName);
      addNodeBuiltinDeclaration(monaco, packageName);
    }
    return;
  }

  if (!fetchedTypes.has(packageName)) {
    fetchedTypes.add(packageName);
    await fetchAndAddTypes(monaco, packageName);
  }
}

function addFallbackDeclaration(monaco: Monaco, packageName: string) {
  const content = `declare module "${packageName}" { const value: any; export default value; export = value; }`;
  const libPath = `file:///node_modules/${packageName}/fallback.d.ts`;
  const ts = (
    monaco as unknown as { typescript: MonacoTypeAcquisitionDefaults }
  ).typescript;
  ts.javascriptDefaults.addExtraLib(content, libPath);
  ts.typescriptDefaults.addExtraLib(content, libPath);
}

function addNodeBuiltinDeclaration(monaco: Monaco, packageName: string) {
  const normalizedName = packageName.startsWith('node:')
    ? packageName.slice(5)
    : packageName;

  const content = `
declare module "${normalizedName}" {
  const value: any;
  export default value;
  export = value;
}
declare module "node:${normalizedName}" {
  const value: any;
  export default value;
  export = value;
}
`;

  const libPath = `file:///node_modules/@types/node/${normalizedName}.d.ts`;
  const ts = (
    monaco as unknown as { typescript: MonacoTypeAcquisitionDefaults }
  ).typescript;
  ts.javascriptDefaults.addExtraLib(content, libPath);
  ts.typescriptDefaults.addExtraLib(content, libPath);
}
