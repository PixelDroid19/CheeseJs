import { create } from 'zustand'

interface PackageInfo {
  name: string
  version?: string
  installing: boolean
  isInstalled: boolean
  error?: string
}

interface PackagesState {
  packages: PackageInfo[]
  detectedMissingPackages: string[]
  isInstalling: boolean
  addPackage: (name: string, version?: string) => void
  setDetectedMissingPackages: (packages: string[]) => void
  setPackageInstalling: (name: string, installing: boolean) => void
  setPackageInstalled: (name: string) => void
  setPackageError: (name: string, error?: string) => void
  removePackage: (name: string) => void
}

export const usePackagesStore = create<PackagesState>((set) => ({
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
        // If it exists but has error, reset it to retry
        if (existing.error) {
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
        packages: [...state.packages, { name, version, installing: false, isInstalled: false }]
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

  setPackageInstalled: (name: string) => {
    set((state) => ({
      packages: state.packages.map(pkg =>
        pkg.name === name
          ? { ...pkg, installing: false, isInstalled: true, error: undefined }
          : pkg
      ),
      isInstalling: false
    }))
  },

  setPackageError: (name: string, error?: string) => {
    set((state) => ({
      packages: state.packages.map(pkg =>
        pkg.name === name
          ? { ...pkg, error, installing: false, isInstalled: false }
          : pkg
      ),
      isInstalling: false
    }))
  },

  removePackage: (name: string) => {
    set((state) => ({
      packages: state.packages.filter(pkg => pkg.name !== name)
    }))
  }
}))
