import {
  createPackageSlice,
  partializePackages,
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

// Export the slice creator for use in the unified store
export const createPackagesSlice = createPackageSlice<PackageInfo>();
export { partializePackages };

// ============================================================================
// SELECTORS (re-exported for backwards compatibility)
// ============================================================================

export {
  selectPendingPackages,
  selectVisibleMissingPackages,
  selectPackageByName,
};
