import { useState, useEffect, useCallback } from 'react'

export interface PyPIPackageMetadata {
    name?: string
    description?: string
    version?: string
    loading?: boolean
    error?: string
    author?: string
    homepage?: string
}

interface PyPIApiResponse {
    info: {
        name: string
        version: string
        summary: string
        author: string
        home_page: string
    }
}

/**
 * Fetch package info from PyPI
 */
async function fetchPyPIPackageInfo(packageName: string): Promise<PyPIPackageMetadata> {
    try {
        const response = await fetch(`https://pypi.org/pypi/${packageName}/json`)

        if (!response.ok) {
            if (response.status === 404) {
                return { error: 'Package not found on PyPI' }
            }
            return { error: `Failed to fetch: ${response.status}` }
        }

        const data: PyPIApiResponse = await response.json()

        return {
            name: data.info.name,
            description: data.info.summary,
            version: data.info.version,
            author: data.info.author,
            homepage: data.info.home_page
        }
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to fetch info' }
    }
}

/**
 * Hook to fetch and cache Python package metadata from PyPI
 */
export function usePythonPackageMetadata(detectedMissingPackages: string[]) {
    const [packageMetadata, setPackageMetadata] = useState<Record<string, PyPIPackageMetadata>>({})
    const [dismissedPackages, setDismissedPackages] = useState<string[]>([])

    // Fetch metadata for new packages
    useEffect(() => {
        const fetchMetadata = async () => {
            for (const pkgName of detectedMissingPackages) {
                // Skip if already fetched or currently loading
                if (packageMetadata[pkgName] && !packageMetadata[pkgName].loading) {
                    continue
                }

                // Skip if already dismissed
                if (dismissedPackages.includes(pkgName)) {
                    continue
                }

                // Set loading state
                setPackageMetadata((prev) => ({
                    ...prev,
                    [pkgName]: { loading: true }
                }))

                // Fetch from PyPI
                const info = await fetchPyPIPackageInfo(pkgName)

                setPackageMetadata((prev) => ({
                    ...prev,
                    [pkgName]: info
                }))
            }
        }

        if (detectedMissingPackages.length > 0) {
            fetchMetadata()
        }
    }, [detectedMissingPackages, dismissedPackages])

    // Memoized dismiss handler
    const dismissPackage = useCallback((pkgName: string) => {
        setDismissedPackages(prev => [...prev, pkgName])
    }, [])

    // Clear dismissed when package list changes significantly
    const clearDismissed = useCallback(() => {
        setDismissedPackages([])
    }, [])

    return {
        packageMetadata,
        dismissedPackages,
        setDismissedPackages,
        dismissPackage,
        clearDismissed
    }
}
