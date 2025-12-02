import { create } from 'zustand'
import { WebContainer } from '@webcontainer/api'
import { runDiagnostics, getDiagnosticSummary, type DiagnosticReport } from '../lib/webcontainer/WebContainerDiagnostics'

interface WebContainerState {
  webContainer: WebContainer | null;
  isLoading: boolean;
  isBootingInBackground: boolean; // New: indicates background boot
  error: Error | null;
  diagnosticReport: DiagnosticReport | null;
  retryCount: number;
  bootProgress: string;
  bootPercentage: number; // New: estimated progress percentage
  bootWebContainer: () => Promise<void>;
  retryBoot: () => Promise<void>;
}

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 2000 // 2 seconds
const BOOT_TIMEOUT = 180000 // 180 seconds - WebContainer can take a while on first boot

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
  isBootingInBackground: true, // Start as background boot
  error: null,
  diagnosticReport: null,
  retryCount: 0,
  bootProgress: 'Initializing...',
  bootPercentage: 0,

  bootWebContainer: async () => {
    const currentRetry = get().retryCount

    try {
      set({ isLoading: true, isBootingInBackground: true, error: null, bootProgress: 'Running diagnostics...', bootPercentage: 5 })

      // Run diagnostics first
      const diagnostics = await runDiagnostics()
      set({ diagnosticReport: diagnostics, bootPercentage: 10 })

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

      set({ bootProgress: 'Downloading WebContainer runtime...', bootPercentage: 15 })

      // Simulate progress during boot (since WebContainer doesn't provide progress events)
      const progressInterval = setInterval(() => {
        const currentPercentage = get().bootPercentage
        if (currentPercentage < 85) {
          // Slow down progress as it gets higher (asymptotic approach)
          const increment = Math.max(1, Math.floor((90 - currentPercentage) / 10))
          set({ bootPercentage: Math.min(85, currentPercentage + increment) })
        }
      }, 2000)

      // WebContainer.boot() with credentialless COEP
      // Use longer timeout - first boot downloads significant resources
      const bootPromise = WebContainer.boot({
        coep: 'credentialless'
      })
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`WebContainer boot timed out after ${BOOT_TIMEOUT / 1000} seconds. Please check your internet connection and try again.`)), BOOT_TIMEOUT)
      )

      const instance = await Promise.race([bootPromise, timeoutPromise])
      
      clearInterval(progressInterval)
      set({ bootProgress: 'Setting up sandbox environment...', bootPercentage: 90 })

      // Initialize package.json
      await instance.fs.writeFile(
        'package.json',
        JSON.stringify({
          name: 'jsrunner-sandbox',
          type: 'module'
        }, null, 2)
      )

      set({ bootPercentage: 100 })

      // Success - reset retry count
      set({
        webContainer: instance,
        isLoading: false,
        isBootingInBackground: false,
        error: null,
        retryCount: 0,
        bootProgress: 'Ready'
      })

    } catch (err) {
      const error = err as Error
      console.error('WebContainer boot failed:', error)

      // Check if we should retry
      if (currentRetry < MAX_RETRIES) {
        const delay = getRetryDelay(currentRetry)

        set({ 
          retryCount: currentRetry + 1,
          bootProgress: `Retrying in ${delay / 1000}s... (attempt ${currentRetry + 2}/${MAX_RETRIES + 1})`,
          bootPercentage: 0
        })

        // Wait and retry
        await sleep(delay)
        return get().bootWebContainer()
      }

      // Max retries exceeded
      set({
        error,
        isLoading: false,
        isBootingInBackground: false,
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
      isLoading: true,
      isBootingInBackground: true,
      bootProgress: 'Retrying...',
      bootPercentage: 0
    })
    return get().bootWebContainer()
  }
}))
