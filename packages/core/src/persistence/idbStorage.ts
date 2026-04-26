import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const loggedFallbacks = new Set<string>();

function warnFallbackOnce(key: string, error: unknown): void {
  if (loggedFallbacks.has(key)) {
    return;
  }

  loggedFallbacks.add(key);
  console.warn(`[idbStorage] Falling back to ${key}`, error);
}

// Custom storage adapter for Zustand persist middleware.
// Prefer IndexedDB for larger persisted payloads, but gracefully fall back to
// localStorage when Electron's backing store is temporarily unavailable.
export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return (await get(name)) || null;
    } catch (error) {
      warnFallbackOnce('localStorage.getItem()', error);
      return getLocalStorage()?.getItem(name) ?? null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await set(name, value);
    } catch (error) {
      warnFallbackOnce('localStorage.setItem()', error);
      getLocalStorage()?.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await del(name);
    } catch (error) {
      warnFallbackOnce('localStorage.removeItem()', error);
      getLocalStorage()?.removeItem(name);
    }
  },
};
