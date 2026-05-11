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
  const updateStatus = useRuntimeStatusStore((state) => state.updateStatus);
  const selectedReady = useRuntimeStatusStore((state) =>
    language ? state.isReady(language) : false
  );
  const selectedLoading = useRuntimeStatusStore((state) =>
    language ? state.isLoading(language) : false
  );
  const selectedMessage = useRuntimeStatusStore((state) =>
    language ? state.getLoadingMessage(language) : undefined
  );
  const selectedStatus = useRuntimeStatusStore((state) =>
    language ? state.getStatus(language) : undefined
  );
  const pythonStatus = useRuntimeStatusStore((state) =>
    state.getStatus('python')
  );
  const javascriptStatus = useRuntimeStatusStore((state) =>
    state.getStatus('javascript')
  );
  const typescriptStatus = useRuntimeStatusStore((state) =>
    state.getStatus('typescript')
  );
  const isPythonLoading = useRuntimeStatusStore((state) =>
    state.isLoading('python')
  );

  useEffect(() => {
    const checkPythonReady = async () => {
      try {
        const isReady = await codeRunner?.isReady('python');
        if (isReady) {
          updateStatus('python', {
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
  }, [codeRunner, updateStatus]);

  useEffect(() => {
    const handleStatus = (result: { type: string; data?: unknown }) => {
      if (result.type === 'status') {
        const data = result.data as { message?: string } | undefined;
        const message = data?.message || 'Loading...';

        if (message.toLowerCase().includes('ready')) {
          updateStatus('python', {
            loading: false,
            ready: true,
            message: undefined,
          });
        } else {
          updateStatus('python', {
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
  }, [codeRunner, updateStatus]);

  if (language) {
    return {
      isReady: selectedReady,
      isLoading: selectedLoading,
      message: selectedMessage,
      status: selectedStatus,
    };
  }

  return {
    python: pythonStatus,
    javascript: javascriptStatus,
    typescript: typescriptStatus,
    isAnyLoading: isPythonLoading,
    updateStatus,
  };
}

export default useRuntimeStatus;
