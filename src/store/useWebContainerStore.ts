import { create } from 'zustand'
import { WebContainer } from '@webcontainer/api'
import { runDiagnostics, getDiagnosticSummary, type DiagnosticReport } from '../lib/webcontainer/WebContainerDiagnostics'

interface WebContainerState {
  webContainer: WebContainer | null;
  isLoading: boolean;
  error: Error | null;
  diagnosticReport: DiagnosticReport | null;
  retryCount: number;
  bootWebContainer: () => Promise<void>;
  retryBoot: () => Promise<void>;
}

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(retryCount: number): number {
  return INITIAL_RETRY_DELAY * Math.pow(2, retryCount)
}

export const useWebContainerStore = create<WebContainerState>((set, get) => ({
  webContainer: null,
  isLoading: true,
  error: null,
  diagnosticReport: null,
  retryCount: 0,

  bootWebContainer: async () => {
    const currentRetry = get().retryCount

    try {
      set({ isLoading: true, error: null })

      // Run diagnostics first
      const diagnostics = await runDiagnostics()
      set({ diagnosticReport: diagnostics })

      // Check for critical issues
      if (!diagnostics.checks.crossOriginIsolated.passed) {
        const summary = getDiagnosticSummary(diagnostics)
        console.error('WebContainer diagnostics failed:\n', summary)
        throw new Error(
          'Application is not cross-origin isolated. WebContainers require COOP/COEP headers to work. ' +
          'Check console for detailed diagnostics.'
        )
      }

      if (!diagnostics.checks.browserSupport.passed) {
        const summary = getDiagnosticSummary(diagnostics)
        console.error('Browser support check failed:\n', summary)
        throw new Error(
          'Your browser does not support required features for WebContainer. ' +
          'Please use a modern browser (Chrome, Edge, or Firefox).'
        )
      }

      // Log diagnostics summary
      if (process.env.NODE_ENV === 'development') {
        console.log(getDiagnosticSummary(diagnostics))
      }

      // Add a timeout race to prevent infinite loading
      const bootPromise = WebContainer.boot()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('WebContainer boot timed out after 15 seconds')), 15000)
      )

      const instance = await Promise.race([bootPromise, timeoutPromise])

      // Initialize package.json
      await instance.fs.writeFile(
        'package.json',
        JSON.stringify({
          name: 'jsrunner-sandbox',
          type: 'module'
        }, null, 2)
      )

      // Success - reset retry count
      set({
        webContainer: instance,
        isLoading: false,
        error: null,
        retryCount: 0
      })

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ WebContainer initialized successfully')
      }
    } catch (err) {
      const error = err as Error
      console.error('WebContainer boot failed:', error)

      // Check if we should retry
      if (currentRetry < MAX_RETRIES) {
        const delay = getRetryDelay(currentRetry)
        console.log(`Retrying WebContainer boot in ${delay}ms (attempt ${currentRetry + 1}/${MAX_RETRIES})...`)

        set({ retryCount: currentRetry + 1 })

        // Wait and retry
        await sleep(delay)
        return get().bootWebContainer()
      }

      // Max retries exceeded
      set({
        error,
        isLoading: false,
        retryCount: currentRetry
      })

      // Run diagnostics again to provide helpful error info
      const diagnostics = await runDiagnostics()
      set({ diagnosticReport: diagnostics })
      console.error('WebContainer diagnostics after failure:\n', getDiagnosticSummary(diagnostics))
    }
  },

  retryBoot: async () => {
    // Reset state and retry
    set({
      retryCount: 0,
      error: null,
      isLoading: true
    })
    return get().bootWebContainer()
  }
}))
