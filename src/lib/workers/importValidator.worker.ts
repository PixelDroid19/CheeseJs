/**
 * Import Validator Web Worker
 *
 * Offloads import validation regex operations to a separate thread
 * to prevent UI blocking on large files.
 */

// Message types for communication with main thread
export interface ValidateImportsMessage {
  type: 'validate';
  code: string;
  installedPackages: string[];
  requestId: number;
}

export interface ValidationResult {
  type: 'result';
  requestId: number;
  missingPackages: string[];
  markers: ImportMarker[];
}

export interface ImportMarker {
  packageName: string;
  packagePath: string;
  startOffset: number;
  endOffset: number;
}

type WorkerMessage = ValidateImportsMessage;

// Import patterns - same as in monacoProviders.ts
const IMPORT_PATTERNS = [
  { regex: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, group: 1 },
  { regex: /import\s+['"]([^'"]+)['"]/g, group: 1 },
  { regex: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, group: 1 },
  { regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, group: 1 }, // dynamic import
];

// Keywords that should be ignored as package names
const IGNORED_PACKAGES = new Set([
  'from',
  'as',
  'in',
  'of',
  'export',
  'import',
  'default',
  'const',
  'var',
  'let',
  'type',
  'interface',
]);

/**
 * Extract base package name from import path
 */
function extractPackageName(packagePath: string): string | null {
  // Skip relative imports
  if (packagePath.startsWith('.') || packagePath.startsWith('/')) {
    return null;
  }

  // Handle scoped packages (@org/package)
  if (packagePath.startsWith('@')) {
    const parts = packagePath.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : packagePath;
  }

  // Regular package - just the first part before any subpath
  return packagePath.split('/')[0];
}

/**
 * Validate imports in the code and find missing packages
 */
function validateImports(
  code: string,
  installedPackages: string[]
): { missingPackages: string[]; markers: ImportMarker[] } {
  const markers: ImportMarker[] = [];
  const missingPackages: string[] = [];
  const installedSet = new Set(installedPackages);

  for (const { regex, group } of IMPORT_PATTERNS) {
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const packagePath = match[group];
      const packageName = extractPackageName(packagePath);

      // Skip invalid or ignored package names
      if (!packageName || IGNORED_PACKAGES.has(packageName)) {
        continue;
      }

      // Check if package is installed
      if (!installedSet.has(packageName)) {
        // Add to missing packages list (deduplicated)
        if (!missingPackages.includes(packageName)) {
          missingPackages.push(packageName);
        }

        // Find the range of the package name in the match
        const fullMatch = match[0];
        const packageIndexInMatch = fullMatch.lastIndexOf(packagePath);

        if (packageIndexInMatch === -1) continue;

        const startOffset = match.index + packageIndexInMatch;
        const endOffset = startOffset + packagePath.length;

        markers.push({
          packageName,
          packagePath,
          startOffset,
          endOffset,
        });
      }
    }
  }

  return { missingPackages, markers };
}

// Web Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'validate') {
    const { code, installedPackages, requestId } = message;

    try {
      const { missingPackages, markers } = validateImports(
        code,
        installedPackages
      );

      const response: ValidationResult = {
        type: 'result',
        requestId,
        missingPackages,
        markers,
      };

      self.postMessage(response);
    } catch (error) {
      console.error('[ImportValidator Worker] Error:', error);

      // Send empty result on error
      const response: ValidationResult = {
        type: 'result',
        requestId,
        missingPackages: [],
        markers: [],
      };

      self.postMessage(response);
    }
  }
};

// Indicate worker is ready
self.postMessage({ type: 'ready' });
