import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

// Custom storage adapter for Zustand persist middleware
// Maps Zustand synchronous getStorage semantics to idb-keyval async semantics
export const idbStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return (await get(name)) || null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await set(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await del(name);
    },
};
