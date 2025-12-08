/**
 * Runtime Status Hook
 * 
 * Tracks initialization and readiness state of code execution runtimes
 * (JavaScript, Python) for displaying loading indicators in UI.
 */

import { create } from 'zustand'
import { useEffect } from 'react'

type Language = 'javascript' | 'typescript' | 'python'

interface RuntimeStatus {
    language: Language
    ready: boolean
    loading: boolean
    message?: string
    progress?: number
}

interface RuntimeStatusState {
    statuses: Map<Language, RuntimeStatus>

    // Getters
    getStatus: (lang: Language) => RuntimeStatus
    isReady: (lang: Language) => boolean
    isLoading: (lang: Language) => boolean
    getLoadingMessage: (lang: Language) => string | undefined

    // Setters
    updateStatus: (lang: Language, update: Partial<RuntimeStatus>) => void
}

// Default status: not loading, not ready (will check on demand)
const defaultStatus = (lang: Language): RuntimeStatus => ({
    language: lang,
    ready: lang !== 'python', // JS/TS are ready immediately
    loading: false, // Don't show loading by default
    message: undefined
})

export const useRuntimeStatusStore = create<RuntimeStatusState>((set, get) => ({
    statuses: new Map<Language, RuntimeStatus>([
        ['javascript', defaultStatus('javascript')],
        ['typescript', defaultStatus('typescript')],
        ['python', defaultStatus('python')]
    ]),

    getStatus: (lang) => {
        return get().statuses.get(lang) || defaultStatus(lang)
    },

    isReady: (lang) => {
        return get().statuses.get(lang)?.ready ?? false
    },

    isLoading: (lang) => {
        return get().statuses.get(lang)?.loading ?? false
    },

    getLoadingMessage: (lang) => {
        return get().statuses.get(lang)?.message
    },

    updateStatus: (lang, update) => {
        set((state) => {
            const newStatuses = new Map(state.statuses)
            const current = newStatuses.get(lang) || defaultStatus(lang)
            newStatuses.set(lang, { ...current, ...update })
            return { statuses: newStatuses }
        })
    }
}))

/**
 * Hook to subscribe to runtime status updates from main process
 */
export function useRuntimeStatus(language?: Language) {
    const store = useRuntimeStatusStore()

    // Check Python worker readiness on mount
    useEffect(() => {
        const checkPythonReady = async () => {
            try {
                const isReady = await window.codeRunner?.isReady('python')
                if (isReady) {
                    store.updateStatus('python', {
                        loading: false,
                        ready: true,
                        message: undefined
                    })
                }
            } catch {
                // Worker not ready yet, that's fine
            }
        }

        checkPythonReady()
    }, [store])

    useEffect(() => {
        // Subscribe to runtime status events from main process
        const handleStatus = (result: {
            type: string
            data?: unknown
        }) => {
            if (result.type === 'status') {
                const data = result.data as { message?: string } | undefined
                const message = data?.message || 'Loading...'

                // Check if Python is ready
                if (message.toLowerCase().includes('ready')) {
                    store.updateStatus('python', {
                        loading: false,
                        ready: true,
                        message: undefined
                    })
                } else {
                    // Still loading
                    store.updateStatus('python', {
                        loading: true,
                        ready: false,
                        message
                    })
                }
            }
        }

        // Subscribe to code runner results (includes status messages)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unsubscribe = window.codeRunner?.onResult(handleStatus as any)

        return () => {
            unsubscribe?.()
        }
    }, [store])

    if (language) {
        return {
            isReady: store.isReady(language),
            isLoading: store.isLoading(language),
            message: store.getLoadingMessage(language),
            status: store.getStatus(language)
        }
    }

    return {
        python: store.getStatus('python'),
        javascript: store.getStatus('javascript'),
        typescript: store.getStatus('typescript'),
        isAnyLoading: store.isLoading('python'),
        updateStatus: store.updateStatus
    }
}

export default useRuntimeStatus

