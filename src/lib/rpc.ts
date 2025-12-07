/**
 * RPC Communication System for CheeseJS
 * Inspired by Hyper terminal's IPC architecture
 * 
 * Provides a clean abstraction over Electron IPC for:
 * - Code execution
 * - Language detection
 * - Package management
 * - Worker status updates
 */

type Language = 'javascript' | 'typescript' | 'python'

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface ExecutionRequest {
  id: string
  code: string
  language: Language
  options: ExecutionOptions
}

export interface ExecutionOptions {
  timeout?: number
  showUndefined?: boolean
  showTopLevelResults?: boolean
  loopProtection?: boolean
  magicComments?: boolean
}

export interface ExecutionResult {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete' | 'status'
  id: string
  data?: unknown
  line?: number
  jsType?: string
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir'
}

export interface WorkerStatus {
  language: Language
  ready: boolean
  loading: boolean
  message?: string
}

// ============================================================================
// RPC CLASS
// ============================================================================

type ResultCallback = (result: ExecutionResult) => void
type StatusCallback = (status: WorkerStatus) => void

class RPC {
  private resultCallbacks = new Set<ResultCallback>()
  private statusCallbacks = new Set<StatusCallback>()
  private pendingExecutions = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private executionCounter = 0
  private workerStatus: Map<Language, WorkerStatus> = new Map()
  private currentExecutionId: string | null = null  // For rate limiting

  constructor() {
    this.initializeStatus()
  }

  private initializeStatus() {
    // Initialize worker status for all supported languages
    const languages: Language[] = ['javascript', 'typescript', 'python']
    languages.forEach(lang => {
      this.workerStatus.set(lang, {
        language: lang,
        ready: false,
        loading: false
      })
    })
  }

  /**
   * Generate a unique execution ID
   */
  generateId(): string {
    return `exec-${Date.now()}-${++this.executionCounter}`
  }

  /**
 * Execute code in the appropriate worker
 * Includes rate limiting - cancels previous pending execution
 */
  async execute(code: string, language: Language, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    if (!window.codeRunner) {
      throw new Error('Code runner not available. Ensure you are running in Electron.')
    }

    const id = this.generateId()

    // Cancel any previous pending execution (rate limiting)
    if (this.currentExecutionId) {
      this.cancel(this.currentExecutionId)
    }
    this.currentExecutionId = id

    // Update status to loading
    this.updateStatus(language, { loading: true, message: 'Executing...' })

    try {
      const response = await window.codeRunner.execute(id, code, {
        ...options,
        language
      })

      // Only process if this is still the current execution
      if (this.currentExecutionId === id) {
        this.updateStatus(language, { loading: false, ready: true })
        this.currentExecutionId = null
      }

      if (!response.success) {
        throw new Error(response.error ?? 'Execution failed')
      }

      return {
        type: 'complete',
        id,
        data: response.data
      }
    } catch (error) {
      if (this.currentExecutionId === id) {
        this.updateStatus(language, { loading: false })
        this.currentExecutionId = null
      }
      throw error
    }
  }

  /**
   * Cancel a running execution
   */
  cancel(id: string): void {
    window.codeRunner?.cancel(id)
    this.pendingExecutions.delete(id)
  }

  /**
   * Subscribe to execution results
   */
  onResult(callback: ResultCallback): () => void {
    this.resultCallbacks.add(callback)

    // Also subscribe to the underlying codeRunner
    const unsubscribe = window.codeRunner?.onResult((result: ExecutionResult) => {
      // Process status messages
      if (result.type === 'status' as ExecutionResult['type']) {
        const statusData = result.data as { message?: string }
        // Infer language from message or default to current
        this.notifyStatusCallbacks({
          language: 'python', // Status usually comes from Python during load
          ready: false,
          loading: true,
          message: statusData?.message
        })
      }

      callback(result)
    })

    return () => {
      this.resultCallbacks.delete(callback)
      unsubscribe?.()
    }
  }

  /**
   * Subscribe to worker status updates
   */
  onStatus(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback)
    return () => {
      this.statusCallbacks.delete(callback)
    }
  }

  /**
   * Get current status for a language
   */
  getStatus(language: Language): WorkerStatus | undefined {
    return this.workerStatus.get(language)
  }

  /**
   * Check if a language is ready to execute
   */
  isReady(language: Language): boolean {
    return this.workerStatus.get(language)?.ready ?? false
  }

  private updateStatus(language: Language, update: Partial<WorkerStatus>) {
    const current = this.workerStatus.get(language) || {
      language,
      ready: false,
      loading: false
    }

    const newStatus = { ...current, ...update }
    this.workerStatus.set(language, newStatus)
    this.notifyStatusCallbacks(newStatus)
  }

  private notifyStatusCallbacks(status: WorkerStatus) {
    this.statusCallbacks.forEach(cb => cb(status))
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.resultCallbacks.clear()
    this.statusCallbacks.clear()
    this.pendingExecutions.clear()
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let rpcInstance: RPC | null = null

export function getRPC(): RPC {
  if (!rpcInstance) {
    rpcInstance = new RPC()
  }
  return rpcInstance
}

export function destroyRPC(): void {
  if (rpcInstance) {
    rpcInstance.destroy()
    rpcInstance = null
  }
}

export default RPC
