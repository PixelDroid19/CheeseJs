import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Snippet {
  id: string;
  name: string;
  code: string;
}

interface SnippetsState {
  snippets: Snippet[];
  addSnippet: (snippet: Omit<Snippet, 'id'>) => void;
  removeSnippet: (id: string) => void;
  updateSnippet: (id: string, updates: Partial<Omit<Snippet, 'id'>>) => void;
}

export const useSnippetsStore = create<SnippetsState>()(
  persist(
    (set) => ({
      snippets: [],
      addSnippet: (snippet) =>
        set((state) => ({
          snippets: [
            ...state.snippets,
            { ...snippet, id: crypto.randomUUID() }
          ]
        })),
      removeSnippet: (id) =>
        set((state) => ({
          snippets: state.snippets.filter((s) => s.id !== id)
        })),
      updateSnippet: (id, updates) =>
        set((state) => ({
          snippets: state.snippets.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          )
        }))
    }),
    {
      name: 'snippets-storage'
    }
  )
)
