/**
 * Sandbox require policy for JS/TS execution worker.
 *
 * The goal is to block only high-risk Node.js built-ins while preserving
 * broad compatibility with user-installed npm packages.
 */

// High-risk Node.js built-ins that can break sandbox guarantees.
// Kept intentionally small to reduce compatibility impact.
export const BLOCKED_NODE_MODULES = new Set([
  'child_process',
  'cluster',
  'inspector',
  'module',
  'process',
  'vm',
  'worker_threads',
]);

export function normalizeModuleSpecifier(moduleName: string): string {
  const withoutNodePrefix = moduleName.startsWith('node:')
    ? moduleName.slice(5)
    : moduleName;

  // Example: fs/promises -> fs
  return withoutNodePrefix.split('/')[0];
}

export function isBlockedSandboxModule(moduleName: string): boolean {
  return BLOCKED_NODE_MODULES.has(normalizeModuleSpecifier(moduleName));
}
