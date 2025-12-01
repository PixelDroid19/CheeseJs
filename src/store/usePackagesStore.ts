import { create } from 'zustand'

export const MAX_INSTALL_ATTEMPTS = 3

export interface PackageError {
  code: string
  message: string
  timestamp: number
}

export interface PackageInfo {
  name: string
  version?: string
  installing: boolean
  isInstalled: boolean
  error?: string
  installAttempts: number
  lastError?: PackageError
}

interface PackagesState {
  packages: PackageInfo[]
  detectedMissingPackages: string[]
  isInstalling: boolean
  addPackage: (name: string, version?: string) => void
  setDetectedMissingPackages: (packages: string[]) => void
  setPackageInstalling: (name: string, installing: boolean) => void
  setPackageInstalled: (name: string, version?: string) => void
  setPackageError: (name: string, error?: string, errorCode?: string) => void
  removePackage: (name: string) => void
  resetPackageAttempts: (name: string) => void
  canRetryInstall: (name: string) => boolean
  incrementInstallAttempt: (name: string) => number
}

export const usePackagesStore = create<PackagesState>((set, get) => ({
  packages: [],
  detectedMissingPackages: [],
  isInstalling: false,

  setDetectedMissingPackages: (packages: string[]) => {
    set({ detectedMissingPackages: packages })
  },

  addPackage: (name: string, version?: string) => {
    set((state) => {
      // Check if package already exists
      const existing = state.packages.find(pkg => pkg.name === name)
      if (existing) {
        // If it exists but has error and can retry, reset it
        if (existing.error && existing.installAttempts < MAX_INSTALL_ATTEMPTS) {
          return {
            packages: state.packages.map(pkg =>
              pkg.name === name
                ? { ...pkg, error: undefined, installing: false, isInstalled: false }
                : pkg
            )
          }
        }
        return state
      }
      return {
        packages: [...state.packages, { 
          name, 
          version, 
          installing: false, 
          isInstalled: false,
          installAttempts: 0
        }]
      }
    })
  },

  setPackageInstalling: (name: string, installing: boolean) => {
    set((state) => ({
      packages: state.packages.map(pkg =>
        pkg.name === name
          ? { ...pkg, installing, error: undefined }
          : pkg
      ),
      isInstalling: installing
    }))
  },

  setPackageInstalled: (name: string, version?: string) => {
    set((state) => ({
      packages: state.packages.map(pkg =>
        pkg.name === name
          ? { 
              ...pkg, 
              installing: false, 
              isInstalled: true, 
              error: undefined,
              version: version || pkg.version,
              lastError: undefined
            }
          : pkg
      ),
      isInstalling: false
    }))
  },

  setPackageError: (name: string, error?: string, errorCode?: string) => {
    set((state) => ({
      packages: state.packages.map(pkg =>
        pkg.name === name
          ? { 
              ...pkg, 
              error, 
              installing: false, 
              isInstalled: false,
              lastError: error ? {
                code: errorCode || 'INSTALL_ERROR',
                message: error,
                timestamp: Date.now()
              } : undefined
            }
          : pkg
      ),
      isInstalling: false
    }))
  },

  removePackage: (name: string) => {
    set((state) => ({
      packages: state.packages.filter(pkg => pkg.name !== name)
    }))
  },

  resetPackageAttempts: (name: string) => {
    set((state) => ({
      packages: state.packages.map(pkg =>
        pkg.name === name
          ? { ...pkg, installAttempts: 0, error: undefined, lastError: undefined }
          : pkg
      )
    }))
  },

  canRetryInstall: (name: string) => {
    const state = get()
    const pkg = state.packages.find(p => p.name === name)
    if (!pkg) return true
    return pkg.installAttempts < MAX_INSTALL_ATTEMPTS
  },

  incrementInstallAttempt: (name: string) => {
    let attempts = 0
    set((state) => {
      const pkg = state.packages.find(p => p.name === name)
      attempts = (pkg?.installAttempts || 0) + 1
      return {
        packages: state.packages.map(p =>
          p.name === name
            ? { ...p, installAttempts: attempts }
            : p
        )
      }
    })
    return attempts
  }
}))
