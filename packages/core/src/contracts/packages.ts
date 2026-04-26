/** Result of an npm package installation or removal. */
export interface PackageInstallResult {
  success: boolean;
  packageName: string;
  version?: string;
  error?: string;
}

export interface InstalledPackage {
  name: string;
  version: string;
  path: string;
}

/** Renderer API for managing npm packages inside CheeseJS's sandbox workspace. */
export interface PackageManager {
  install: (packageName: string) => Promise<PackageInstallResult>;
  uninstall: (packageName: string) => Promise<PackageInstallResult>;
  list: () => Promise<{
    success: boolean;
    packages: InstalledPackage[];
    error?: string;
  }>;
  getNodeModulesPath: () => Promise<string>;
}

export interface PythonPackageInstallResult {
  success: boolean;
  packageName: string;
  version?: string;
  error?: string;
}

export interface PythonMemoryStats {
  heapUsed: number;
  heapTotal: number;
  executionsSinceCleanup: number;
  lastCleanupTime: number;
  pyObjects: number;
  executionCount: number;
}

/** Renderer API for managing the Pyodide runtime and Python packages. */
export interface PythonPackageManager {
  install: (packageName: string) => Promise<PythonPackageInstallResult>;
  listInstalled: () => Promise<{
    success: boolean;
    packages: string[];
    error?: string;
  }>;
  resetRuntime: () => Promise<{ success: boolean; error?: string }>;
  getMemoryStats: () => Promise<{
    success: boolean;
    stats?: PythonMemoryStats;
    error?: string;
  }>;
  cleanupNamespace: () => Promise<{ success: boolean; error?: string }>;
}
