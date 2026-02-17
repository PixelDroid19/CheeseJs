import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types for RAG
type RagConfig = {
  retrievalLimit: number;
  retrievalThreshold: number;
  injectionStrategy: 'auto' | 'always-retrieve' | 'always-inject';
  maxContextTokens: number;
};

type RegisteredDocument = {
  id: string;
  title: string;
  type: 'file' | 'url' | 'codebase';
  pathOrUrl: string;
  addedAt: number;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  chunkCount: number;
  error?: string;
  metadata?: Record<string, unknown>;
};

type SubStep = {
  id: string;
  name: string;
  status: 'waiting' | 'loading' | 'done' | 'error';
  progress?: number;
  message?: string;
};

// Default config values
const DEFAULT_CONFIG: RagConfig = {
  retrievalLimit: 5,
  retrievalThreshold: 0.5,
  injectionStrategy: 'auto',
  maxContextTokens: 4000,
};

interface RagState {
  documents: RegisteredDocument[];
  isLoading: boolean;
  error: string | null;
  processingStatus: Record<
    string,
    { status: string; message: string; subSteps?: SubStep[] }
  >;
  activeDocumentIds: string[]; // For filtering search scope (Project Integration)
  pinnedDocIds: string[]; // Documents always included in chat context
  isModalOpen: boolean;

  // Configuration
  config: RagConfig;
  configLoaded: boolean;

  // Actions
  setModalOpen: (open: boolean) => void;
  loadDocuments: () => Promise<void>;
  addFile: (filePath: string) => Promise<void>;
  addUrl: (url: string) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  toggleDocumentSelection: (id: string) => void;
  selectAllDocuments: () => void;
  deselectAllDocuments: () => void;

  // Config Actions
  loadConfig: () => Promise<void>;
  updateConfig: (newConfig: Partial<RagConfig>) => Promise<void>;

  // Pinned Docs Actions
  togglePinnedDoc: (id: string) => void;
  clearPinnedDocs: () => void;
  getPinnedDocsContext: () => Promise<string>;

  // Progress Handler
  handleProgress: (progress: {
    id: string;
    status: string;
    message: string;
    subSteps?: SubStep[];
  }) => void;
}

export const useRagStore = create<RagState>()(
  persist(
    (set, get) => ({
      documents: [],
      isLoading: false,
      error: null,
      processingStatus: {},
      activeDocumentIds: [],
      pinnedDocIds: [],
      isModalOpen: false,
      config: DEFAULT_CONFIG,
      configLoaded: false,

      setModalOpen: (open) => set({ isModalOpen: open }),

      loadDocuments: async () => {
        set({ isLoading: true, error: null });
        try {
          if (!window.rag) throw new Error('RAG system not available');
          const result = await window.rag.getDocuments();
          if (result.success && result.documents) {
            const docs = result.documents;
            set((state) => {
              // If we have no active selection (first run), select all.
              // Otherwise, keep existing selection but filter out removed docs.
              // Also could auto-select new docs? For now, let's just clean up.
              const validIds = new Set(docs.map((d) => d.id));

              let newActiveIds = state.activeDocumentIds.filter((id) =>
                validIds.has(id)
              );

              // If empty selection (and we have docs), select all by default
              if (
                newActiveIds.length === 0 &&
                docs.length > 0 &&
                state.activeDocumentIds.length === 0
              ) {
                newActiveIds = docs.map((d) => d.id);
              }

              return {
                documents: docs,
                activeDocumentIds: newActiveIds,
              };
            });
          } else {
            set({ error: result.error || 'Failed to load documents' });
          }
        } catch (e) {
          set({ error: String(e) });
        } finally {
          set({ isLoading: false });
        }
      },

      addFile: async (filePath) => {
        // Optimistic UI update or wait for progress?
        // Let's rely on progress events.
        try {
          const result = await window.rag.addFile(filePath);
          if (!result.success) throw new Error(result.error);
          get().loadDocuments();
        } catch (e) {
          set({ error: String(e) });
        }
      },

      addUrl: async (url) => {
        try {
          const result = await window.rag.addUrl(url);
          if (!result.success) throw new Error(result.error);
          get().loadDocuments();
        } catch (e) {
          set({ error: String(e) });
        }
      },

      removeDocument: async (id) => {
        try {
          const result = await window.rag.removeDocument(id);
          if (!result.success) throw new Error(result.error);
          set((state) => ({
            documents: state.documents.filter((d) => d.id !== id),
            activeDocumentIds: state.activeDocumentIds.filter(
              (aid) => aid !== id
            ),
          }));
        } catch (e) {
          set({ error: String(e) });
        }
      },

      toggleDocumentSelection: (id) => {
        set((state) => {
          const isActive = state.activeDocumentIds.includes(id);
          return {
            activeDocumentIds: isActive
              ? state.activeDocumentIds.filter((aid) => aid !== id)
              : [...state.activeDocumentIds, id],
          };
        });
      },

      selectAllDocuments: () => {
        set((state) => ({
          activeDocumentIds: state.documents.map((d) => d.id),
        }));
      },

      deselectAllDocuments: () => {
        set({ activeDocumentIds: [] });
      },

      // Config Actions
      loadConfig: async () => {
        try {
          if (!window.rag) return;
          const result = await window.rag.getConfig();
          if (result.success && result.config) {
            set({ config: result.config, configLoaded: true });
          }
        } catch (e) {
          console.error('Failed to load RAG config:', e);
        }
      },

      updateConfig: async (newConfig) => {
        try {
          if (!window.rag) throw new Error('RAG system not available');
          // Optimistic update
          set((state) => ({ config: { ...state.config, ...newConfig } }));

          const result = await window.rag.setConfig(newConfig);
          if (result.success && result.config) {
            set({ config: result.config });
          } else {
            throw new Error(result.error || 'Failed to update config');
          }
        } catch (e) {
          set({ error: String(e) });
          // Reload to get actual config
          get().loadConfig();
        }
      },

      // Pinned Docs Actions
      togglePinnedDoc: (id) => {
        set((state) => {
          const isPinned = state.pinnedDocIds.includes(id);
          return {
            pinnedDocIds: isPinned
              ? state.pinnedDocIds.filter((pid) => pid !== id)
              : [...state.pinnedDocIds, id],
          };
        });
      },

      clearPinnedDocs: () => {
        set({ pinnedDocIds: [] });
      },

      getPinnedDocsContext: async () => {
        const { pinnedDocIds } = get();
        if (pinnedDocIds.length === 0 || !window.rag) return '';

        try {
          // Retrieve all chunks from pinned documents directly by ID,
          // without generating an embedding for an empty query
          const results = await window.rag.getChunksByDocuments(
            pinnedDocIds,
            20 // Reasonable limit for pinned docs context
          );

          if (
            results.success &&
            results.results &&
            results.results.length > 0
          ) {
            let context = '\n\n--- Pinned Documentation ---\n';
            context += results.results
              .map((r, i) => `[Pinned ${i + 1}]:\n${r.content}`)
              .join('\n\n');
            context += '\n--- End Pinned Documentation ---\n\n';
            return context;
          }
        } catch (e) {
          console.warn('Failed to get pinned docs context:', e);
        }
        return '';
      },

      handleProgress: ({ id, status, message, subSteps }) => {
        set((state) => ({
          processingStatus: {
            ...state.processingStatus,
            [id]: { status, message, subSteps },
          },
        }));
        if (status === 'indexed' || status === 'error') {
          get().loadDocuments();
        }
      },
    }),
    {
      name: 'rag-storage',
      partialize: (state) => ({
        activeDocumentIds: state.activeDocumentIds,
        pinnedDocIds: state.pinnedDocIds,
        config: state.config,
      }),
    }
  )
);

// Initialize progress listener lazily to avoid side-effects at import time
let ragProgressInitialized = false;
export function initRagProgressListener(): void {
  if (ragProgressInitialized) return;
  if (typeof window !== 'undefined' && window.rag) {
    window.rag.onProgress((progress) => {
      useRagStore.getState().handleProgress(progress);
    });
    ragProgressInitialized = true;
  }
}
