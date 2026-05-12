import {
  create,
  type StoreApi,
  type UseBoundStore,
  type StateCreator,
} from 'zustand';

export const MAX_INSTALL_ATTEMPTS = 3;

// ============================================================================
// Generic package types
// ============================================================================

export interface BasePackageError {
  code: string;
  message: string;
  timestamp: number;
}

export interface BasePackageInfo {
  name: string;
  version?: string;
  installing: boolean;
  isInstalled: boolean;
  error?: string;
  installAttempts: number;
  lastError?: BasePackageError;
}

/**
 * Shared Zustand slice contract for JavaScript and Python package managers.
 *
 * @template T Package record shape. Feature packages may extend the base
 * package info with manager-specific metadata.
 */
export interface BasePackagesState<
  T extends BasePackageInfo = BasePackageInfo,
> {
  packages: T[];
  detectedMissingPackages: string[];
  isInstalling: boolean;
  addPackage: (name: string, version?: string) => void;
  setDetectedMissingPackages: (packages: string[]) => void;
  setPackageInstalling: (name: string, installing: boolean) => void;
  setPackageInstalled: (name: string, version?: string) => void;
  setPackageError: (name: string, error?: string, errorCode?: string) => void;
  removePackage: (name: string) => void;
  resetPackageAttempts: (name: string) => void;
  canRetryInstall: (name: string) => boolean;
  incrementInstallAttempt: (name: string) => number;
}

/**
 * Create a package-management slice for any package record compatible with
 * {@link BasePackageInfo}.
 */
export const createPackageSlice =
  <T extends BasePackageInfo = BasePackageInfo>(): StateCreator<
    BasePackagesState<T>
  > =>
  (set, get) => ({
    packages: [],
    detectedMissingPackages: [],
    isInstalling: false,

    setDetectedMissingPackages: (packages: string[]) => {
      set({ detectedMissingPackages: packages });
    },

    addPackage: (name: string, version?: string) => {
      set((state) => {
        const existing = state.packages.find((pkg) => pkg.name === name);
        if (existing) {
          if (
            existing.error &&
            existing.installAttempts < MAX_INSTALL_ATTEMPTS
          ) {
            return {
              packages: state.packages.map((pkg) =>
                pkg.name === name
                  ? {
                      ...pkg,
                      error: undefined,
                      installing: false,
                      isInstalled: false,
                    }
                  : pkg
              ),
            };
          }
          return state;
        }
        return {
          packages: [
            ...state.packages,
            {
              name,
              version,
              installing: false,
              isInstalled: false,
              installAttempts: 0,
            } as T,
          ],
        };
      });
    },

    setPackageInstalling: (name: string, installing: boolean) => {
      set((state) => {
        const updatedPackages = state.packages.map((pkg) =>
          pkg.name === name ? { ...pkg, installing, error: undefined } : pkg
        );
        const anyInstalling = updatedPackages.some((pkg) => pkg.installing);
        return {
          packages: updatedPackages,
          isInstalling: anyInstalling,
        };
      });
    },

    setPackageInstalled: (name: string, version?: string) => {
      set((state) => {
        const updatedPackages = state.packages.map((pkg) =>
          pkg.name === name
            ? {
                ...pkg,
                installing: false,
                isInstalled: true,
                error: undefined,
                version: version || pkg.version,
                lastError: undefined,
              }
            : pkg
        );
        const anyInstalling = updatedPackages.some((pkg) => pkg.installing);
        return {
          packages: updatedPackages,
          isInstalling: anyInstalling,
        };
      });
    },

    setPackageError: (name: string, error?: string, errorCode?: string) => {
      set((state) => {
        const updatedPackages = state.packages.map((pkg) =>
          pkg.name === name
            ? {
                ...pkg,
                error,
                installing: false,
                isInstalled: false,
                lastError: error
                  ? {
                      code: errorCode || 'INSTALL_ERROR',
                      message: error,
                      timestamp: Date.now(),
                    }
                  : undefined,
              }
            : pkg
        );
        const anyInstalling = updatedPackages.some((pkg) => pkg.installing);
        return {
          packages: updatedPackages,
          isInstalling: anyInstalling,
        };
      });
    },

    removePackage: (name: string) => {
      set((state) => ({
        packages: state.packages.filter((pkg) => pkg.name !== name),
      }));
    },

    resetPackageAttempts: (name: string) => {
      set((state) => ({
        packages: state.packages.map((pkg) =>
          pkg.name === name
            ? {
                ...pkg,
                installAttempts: 0,
                error: undefined,
                lastError: undefined,
              }
            : pkg
        ),
      }));
    },

    canRetryInstall: (name: string) => {
      const state = get();
      const pkg = state.packages.find((p) => p.name === name);
      if (!pkg) return true;
      return pkg.installAttempts < MAX_INSTALL_ATTEMPTS;
    },

    incrementInstallAttempt: (name: string) => {
      let attempts = 0;
      set((state) => {
        const pkg = state.packages.find((p) => p.name === name);
        attempts = (pkg?.installAttempts || 0) + 1;
        return {
          packages: state.packages.map((p) =>
            p.name === name ? { ...p, installAttempts: attempts } : p
          ),
        };
      });
      return attempts;
    },
  });

/** Persist only package records; transient install state is reconstructed. */
export const partializePackages = <T extends BasePackageInfo>(
  state: BasePackagesState<T>
) => ({
  packages: state.packages,
});

/** Create an isolated package store for tests or non-app package surfaces. */
export function createPackageStore<
  T extends BasePackageInfo = BasePackageInfo,
>(): UseBoundStore<StoreApi<BasePackagesState<T>>> {
  return create<BasePackagesState<T>>(createPackageSlice<T>());
}

export const selectPendingPackages = <T extends BasePackageInfo>(
  state: BasePackagesState<T>
) => state.packages.filter((p) => !p.isInstalled);

export const selectVisibleMissingPackages = <T extends BasePackageInfo>(
  state: BasePackagesState<T>
) =>
  state.detectedMissingPackages.filter((pkgName) => {
    const existingPkg = state.packages.find((p) => p.name === pkgName);
    return !existingPkg?.isInstalled && !existingPkg;
  });

export const selectPackageByName =
  <T extends BasePackageInfo>(name: string) =>
  (state: BasePackagesState<T>) =>
    state.packages.find((p) => p.name === name);
