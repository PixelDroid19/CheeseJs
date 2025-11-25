import { create } from 'zustand'

interface PackageInfo {
  name: string
  version?: string
  installing: boolean
  error?: string
}

interface PackagesState {
  packages: PackageInfo[]
  isInstalling: boolean
  addPackage: (name: string, version?: string) => void
  setPackageInstalling: (name: string, installing: boolean) => void
  setPackageError: (name: string, error?: string) => void
  removePackage: (name: string) => void
}

export const usePackagesStore = create<PackagesState>((set) => ({
  packages: [],
  isInstalling: false,

  addPackage: (name: string, version?: string) => {
    set((state) => {
      // Check if package already exists
      if (state.packages.some(pkg => pkg.name === name)) {
        return state
      }
      return {
        packages: [...state.packages, { name, version, installing: false }]
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

  setPackageError: (name: string, error?: string) => {
    set((state) => ({
      packages: state.packages.map(pkg =>
        pkg.name === name
          ? { ...pkg, error, installing: false }
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
