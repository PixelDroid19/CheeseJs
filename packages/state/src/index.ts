/**
 * Shared application state primitives and slices.
 *
 * This package intentionally sits outside `@cheesejs/core`: state is a feature
 * layer that depends on the core contracts, while the core stays focused on
 * stable extension, host, event, and runtime boundaries.
 */
export * from './state/createPackageStore';
export * from './state/createNestedSlice';
export * from './state/createScopedStoreHook';
export * from './state/useHistoryStore';
export * from './state/usePackagesStore';
export * from './state/usePythonPackagesStore';
export * from './state/useSettingsStore';
export * from './state/useSnippetsStore';
