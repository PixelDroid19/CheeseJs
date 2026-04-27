import { useEffect } from 'react';
import { create } from 'zustand';
import type { CodeRunner } from '@cheesejs/core';
import type { Language } from '@cheesejs/core/contracts/workerTypes';

interface RuntimeStatus {
  language: Language;
  ready: boolean;
  loading: boolean;
  message?: string;
  progress?: number;
}

interface RuntimeStatusState {
  statuses: Map<Language, RuntimeStatus>;
  getStatus: (lang: Language) => RuntimeStatus;
  isReady: (lang: Language) => boolean;
  isLoading: (lang: Language) => boolean;
  getLoadingMessage: (lang: Language) => string | undefined;
  updateStatus: (lang: Language, update: Partial<RuntimeStatus>) => void;
}

const defaultStatus = (lang: Language): RuntimeStatus => ({
  language: lang,
  ready: lang !== 'python',
  loading: false,
  message: undefined,
});

export const useRuntimeStatusStore = create<RuntimeStatusState>((set, get) => ({
  statuses: new Map<Language, RuntimeStatus>([
    ['javascript', defaultStatus('javascript')],
    ['typescript', defaultStatus('typescript')],
    ['python', defaultStatus('python')],
    ['c', defaultStatus('c')],
    ['cpp', defaultStatus('cpp')],
  ]),

  getStatus: (lang) => get().statuses.get(lang) || defaultStatus(lang),
  isReady: (lang) => get().statuses.get(lang)?.ready ?? false,
  isLoading: (lang) => get().statuses.get(lang)?.loading ?? false,
  getLoadingMessage: (lang) => get().statuses.get(lang)?.message,
  updateStatus: (lang, update) => {
    set((state) => {
      const newStatuses = new Map(state.statuses);
      const current = newStatuses.get(lang) || defaultStatus(lang);
      newStatuses.set(lang, { ...current, ...update });
      return { statuses: newStatuses };
    });
  },
}));

export function useRuntimeStatus(
  language?: Language,
  codeRunner?: Pick<CodeRunner, 'isReady' | 'onResult'>
) {
  const store = useRuntimeStatusStore();

  useEffect(() => {
    const checkPythonReady = async () => {
      try {
        const isReady = await codeRunner?.isReady('python');
        if (isReady) {
          store.updateStatus('python', {
            loading: false,
            ready: true,
            message: undefined,
          });
        }
      } catch {
        // Worker not ready yet.
      }
    };

    void checkPythonReady();
  }, [codeRunner, store]);

  useEffect(() => {
    const handleStatus = (result: { type: string; data?: unknown }) => {
      if (result.type === 'status') {
        const data = result.data as { message?: string } | undefined;
        const message = data?.message || 'Loading...';

        if (message.toLowerCase().includes('ready')) {
          store.updateStatus('python', {
            loading: false,
            ready: true,
            message: undefined,
          });
        } else {
          store.updateStatus('python', {
            loading: true,
            ready: false,
            message,
          });
        }
      }
    };

    const unsubscribe = codeRunner?.onResult(
      handleStatus as Parameters<CodeRunner['onResult']>[0]
    );

    return () => {
      unsubscribe?.();
    };
  }, [codeRunner, store]);

  if (language) {
    return {
      isReady: store.isReady(language),
      isLoading: store.isLoading(language),
      message: store.getLoadingMessage(language),
      status: store.getStatus(language),
    };
  }

  return {
    python: store.getStatus('python'),
    javascript: store.getStatus('javascript'),
    typescript: store.getStatus('typescript'),
    isAnyLoading: store.isLoading('python'),
    updateStatus: store.updateStatus,
  };
}

export default useRuntimeStatus;
