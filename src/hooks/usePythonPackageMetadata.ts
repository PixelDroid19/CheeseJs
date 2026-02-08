import {
  createPackageMetadataHook,
  type BasePackageMetadata,
} from './createPackageMetadataHook';

// Extended metadata type for PyPI packages
export interface PyPIPackageMetadata extends BasePackageMetadata {
  author?: string;
  homepage?: string;
}

interface PyPIApiResponse {
  info: {
    name: string;
    version: string;
    summary: string;
    author: string;
    home_page: string;
  };
}

/**
 * Fetch package info from PyPI
 */
async function fetchPyPIPackageInfo(
  packageName: string
): Promise<PyPIPackageMetadata> {
  try {
    const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);

    if (!response.ok) {
      if (response.status === 404) {
        return { error: 'Package not found on PyPI' };
      }
      return { error: `Failed to fetch: ${response.status}` };
    }

    const data: PyPIApiResponse = await response.json();

    return {
      name: data.info.name,
      description: data.info.summary,
      version: data.info.version,
      author: data.info.author,
      homepage: data.info.home_page,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to fetch info',
    };
  }
}

/**
 * Hook to fetch and cache Python package metadata from PyPI.
 */
export const usePythonPackageMetadata =
  createPackageMetadataHook<PyPIPackageMetadata>(fetchPyPIPackageInfo);
