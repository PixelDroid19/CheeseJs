import { useState, useEffect } from 'react'
import { fetchPackageInfo } from '../lib/npm'

export interface PackageMetadata {
  name?: string
  description?: string
  version?: string
  loading?: boolean
  error?: string
  // Add other fields as returned by fetchPackageInfo
}

export function usePackageMetadata(detectedMissingPackages: string[]) {
  const [packageMetadata, setPackageMetadata] = useState<Record<string, PackageMetadata>>({})
  const [dismissedPackages, setDismissedPackages] = useState<string[]>([])

  useEffect(() => {
    const fetchMetadata = async () => {
      for (const pkgName of detectedMissingPackages) {
        if (!packageMetadata[pkgName]) {
          // Set a loading state or placeholder first
          setPackageMetadata((prev) => ({ ...prev, [pkgName]: { loading: true } }))

          try {
            const info = await fetchPackageInfo(pkgName)
            setPackageMetadata((prev) => ({
              ...prev,
              [pkgName]: (info as PackageMetadata) || { error: 'Failed to fetch info' },
            }))
          } catch (error) {
             setPackageMetadata((prev) => ({
              ...prev,
              [pkgName]: { error: 'Failed to fetch info' },
            }))
          }
        }
      }
    }

    if (detectedMissingPackages.length > 0) {
      fetchMetadata()
    }
  }, [detectedMissingPackages, packageMetadata])

  return {
    packageMetadata,
    dismissedPackages,
    setDismissedPackages,
  }
}
