import {
  createPackageStore,
  type BasePackageError,
  type BasePackageInfo,
  type BasePackagesState,
} from './createPackageStore';

// Type aliases for backwards compatibility
export type PythonPackageError = BasePackageError;
export type PythonPackageInfo = BasePackageInfo;
export type PythonPackagesState = BasePackagesState<PythonPackageInfo>;

// Create the Python packages store using the shared factory
export const usePythonPackagesStore = createPackageStore<PythonPackageInfo>();
