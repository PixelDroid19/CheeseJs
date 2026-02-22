import {
  createPackageSlice,
  type BasePackageError,
  type BasePackageInfo,
  type BasePackagesState,
} from './createPackageStore';

// Type aliases for backwards compatibility
export type PythonPackageError = BasePackageError;
export type PythonPackageInfo = BasePackageInfo;
export type PythonPackagesState = BasePackagesState<PythonPackageInfo>;

// Export the slice creator for use in the unified store
export const createPythonPackagesSlice = createPackageSlice<PythonPackageInfo>();

