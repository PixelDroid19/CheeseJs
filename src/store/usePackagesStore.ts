import {
  createPackageStore,
  type BasePackageError,
  type BasePackageInfo,
  type BasePackagesState,
  MAX_INSTALL_ATTEMPTS,
  selectPendingPackages,
  selectVisibleMissingPackages,
  selectPackageByName,
} from './createPackageStore';

// Re-export constant
export { MAX_INSTALL_ATTEMPTS };

// Type aliases for backwards compatibility
export type PackageError = BasePackageError;
export type PackageInfo = BasePackageInfo;
export type PackagesState = BasePackagesState<PackageInfo>;

// Create the JS packages store using the shared factory
export const usePackagesStore = createPackageStore<PackageInfo>();

// ============================================================================
// SELECTORS (re-exported for backwards compatibility)
// ============================================================================

export {
  selectPendingPackages,
  selectVisibleMissingPackages,
  selectPackageByName,
};
