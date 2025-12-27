/**
 * Language Executor Registry
 * 
 * Centralized system for managing language-specific executors with:
 * - Independent configuration per language (worker, transpiler, timeout)
 * - Worker lifecycle management
 * - Execution routing based on language
 * - Parallel execution support via worker pools
 */

import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { EventEmitter } from 'node:events'

// ============================================================================
// TYPES
// ============================================================================

export type SupportedLanguage = 'javascript' | 'typescript' | 'python'

export interface ExecutorConfig {
  /** Worker script path (relative to dist-electron) */
  workerScript: string
  /** Transpiler worker script path (optional, for JS/TS) */
  transpilerWorkerScript?: string
  /** Default execution timeout in ms */
  defaultTimeout: number
  /** Maximum concurrent executions */
  maxConcurrent: number
  /** Worker initialization data */
  workerData?: Record<string, unknown>
  /** Debug function name injected into code */
  debugFunctionName: string
  /** Whether to use worker pool for parallel execution */
  useWorkerPool: boolean
}

export interface TransformOptions {
  showTopLevelResults?: boolean
  loopProtection?: boolean
  magicComments?: boolean
  showUndefined?: boolean
  targetVersion?: 'ES2022' | 'ES2024' | 'ESNext'
  experimentalDecorators?: boolean
  jsx?: boolean
  debugFunctionName?: string
}

export interface ExecutionRequest {
  id: string
  code: string
  language: SupportedLanguage
  options: {
    timeout?: number
    showUndefined?: boolean
    showTopLevelResults?: boolean
    loopProtection?: boolean
    magicComments?: boolean
  }
}

export interface ExecutionResult {
  type: 'result' | 'console' | 'debug' | 'error' | 'complete' | 'ready'
  id: string
  data?: unknown
  line?: number
  jsType?: string
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir'
}

interface PendingExecution {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  language: SupportedLanguage
  startTime: number
}

interface WorkerState {
  worker: Worker
  ready: boolean
  busy: boolean
  currentExecutionId: string | null
}

interface TranspilerState {
  worker: Worker
  ready: boolean
  pendingTranspilations: Map<string, {
    resolve: (code: string) => void
    reject: (error: Error) => void
  }>
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_CONFIGS: Record<SupportedLanguage, ExecutorConfig> = {
  javascript: {
    workerScript: 'codeExecutor.js',
    transpilerWorkerScript: 'swcTranspilerWorker.js',
    defaultTimeout: 30000,
    maxConcurrent: 4,
    debugFunctionName: '__jsDebug',
    useWorkerPool: true
  },
  typescript: {
    workerScript: 'codeExecutor.js',
    transpilerWorkerScript: 'swcTranspilerWorker.js',
    defaultTimeout: 30000,
    maxConcurrent: 4,
    debugFunctionName: '__jsDebug',
    useWorkerPool: true
  },
  python: {
    workerScript: 'pythonExecutor.js',
    defaultTimeout: 60000,
    maxConcurrent: 1, // Python/Pyodide is single-threaded
    debugFunctionName: '__pyDebug',
    useWorkerPool: false
  }
}

// ============================================================================
// EXECUTOR REGISTRY
// ============================================================================

export class ExecutorRegistry extends EventEmitter {
  private configs: Map<SupportedLanguage, ExecutorConfig> = new Map()
  private workers: Map<SupportedLanguage, WorkerState> = new Map()
  private transpilers: Map<SupportedLanguage, TranspilerState> = new Map()
  private pendingExecutions: Map<string, PendingExecution> = new Map()
  private basePath: string
  private nodeModulesPath: string | undefined

  constructor(basePath: string, nodeModulesPath?: string) {
    super()
    this.basePath = basePath
    this.nodeModulesPath = nodeModulesPath

    // Initialize with default configs
    for (const [lang, config] of Object.entries(DEFAULT_CONFIGS)) {
      this.configs.set(lang as SupportedLanguage, { ...config })
    }
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Update configuration for a specific language
   */
  setConfig(language: SupportedLanguage, config: Partial<ExecutorConfig>): void {
    const existing = this.configs.get(language)
    if (existing) {
      this.configs.set(language, { ...existing, ...config })
    }
  }

  /**
   * Get configuration for a specific language
   */
  getConfig(language: SupportedLanguage): ExecutorConfig | undefined {
    return this.configs.get(language)
  }

  // ============================================================================
  // WORKER MANAGEMENT
  // ============================================================================

  /**
   * Initialize executor worker for a language
   */
  async initializeExecutor(language: SupportedLanguage): Promise<void> {
    const config = this.configs.get(language)
    if (!config) {
      throw new Error(`No configuration found for language: ${language}`)
    }

    // Check if already initialized
    const existing = this.workers.get(language)
    if (existing?.ready) {
      return
    }

    const workerPath = path.join(this.basePath, config.workerScript)
    
    return new Promise((resolve, reject) => {
      const workerData = {
        ...config.workerData,
        nodeModulesPath: this.nodeModulesPath,
        language,
        debugFunctionName: config.debugFunctionName
      }

      const worker = new Worker(workerPath, { workerData })
      
      const state: WorkerState = {
        worker,
        ready: false,
        busy: false,
        currentExecutionId: null
      }

      this.workers.set(language, state)

      const initTimeout = setTimeout(() => {
        reject(new Error(`Worker initialization timeout for ${language}`))
      }, 30000)

      worker.on('message', (message: ExecutionResult) => {
        if (message.type === 'ready') {
          clearTimeout(initTimeout)
          state.ready = true
          console.log(`[ExecutorRegistry] ${language} executor ready`)
          resolve()
          return
        }

        // Emit message for renderer forwarding
        this.emit('execution-result', message)

        // Handle completion
        if (message.type === 'complete' || message.type === 'error') {
          state.busy = false
          state.currentExecutionId = null

          const pending = this.pendingExecutions.get(message.id)
          if (pending) {
            if (message.type === 'error') {
              const errorData = message.data as { message?: string } | undefined
              pending.reject(new Error(errorData?.message || 'Execution error'))
            } else {
              pending.resolve(message.data)
            }
            this.pendingExecutions.delete(message.id)
          }
        }
      })

      worker.on('error', (error) => {
        console.error(`[ExecutorRegistry] ${language} worker error:`, error)
        state.ready = false
        clearTimeout(initTimeout)
        reject(error)
      })

      worker.on('exit', (code) => {
        console.log(`[ExecutorRegistry] ${language} worker exited with code ${code}`)
        state.ready = false
        this.workers.delete(language)

        // Reject pending executions
        for (const [id, pending] of this.pendingExecutions) {
          if (pending.language === language) {
            pending.reject(new Error(`Worker exited unexpectedly`))
            this.pendingExecutions.delete(id)
          }
        }

        // Auto-restart on crash
        if (code !== 0) {
          setTimeout(() => this.initializeExecutor(language), 1000)
        }
      })
    })
  }

  /**
   * Initialize transpiler worker for JS/TS
   */
  async initializeTranspiler(language: 'javascript' | 'typescript'): Promise<void> {
    const config = this.configs.get(language)
    if (!config?.transpilerWorkerScript) {
      return // No transpiler configured
    }

    // Check if already initialized
    const existing = this.transpilers.get(language)
    if (existing?.ready) {
      return
    }

    const workerPath = path.join(this.basePath, config.transpilerWorkerScript)

    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath)

      const state: TranspilerState = {
        worker,
        ready: false,
        pendingTranspilations: new Map()
      }

      this.transpilers.set(language, state)

      const initTimeout = setTimeout(() => {
        reject(new Error(`Transpiler initialization timeout for ${language}`))
      }, 30000)

      worker.on('message', (message: { type: string; id?: string; code?: string; error?: string }) => {
        if (message.type === 'ready') {
          clearTimeout(initTimeout)
          state.ready = true
          console.log(`[ExecutorRegistry] ${language} transpiler ready`)
          resolve()
          return
        }

        if (message.type === 'result' && message.id) {
          const pending = state.pendingTranspilations.get(message.id)
          if (pending) {
            pending.resolve(message.code || '')
            state.pendingTranspilations.delete(message.id)
          }
        }

        if (message.type === 'error' && message.id) {
          const pending = state.pendingTranspilations.get(message.id)
          if (pending) {
            pending.reject(new Error(message.error || 'Transpilation error'))
            state.pendingTranspilations.delete(message.id)
          }
        }
      })

      worker.on('error', (error) => {
        console.error(`[ExecutorRegistry] ${language} transpiler error:`, error)
        state.ready = false
        clearTimeout(initTimeout)
        reject(error)
      })

      worker.on('exit', (code) => {
        console.log(`[ExecutorRegistry] ${language} transpiler exited with code ${code}`)
        state.ready = false
        this.transpilers.delete(language)

        // Reject pending transpilations
        for (const [, pending] of state.pendingTranspilations) {
          pending.reject(new Error('Transpiler exited unexpectedly'))
        }

        // Auto-restart on crash
        if (code !== 0) {
          setTimeout(() => this.initializeTranspiler(language), 1000)
        }
      })
    })
  }

  // ============================================================================
  // TRANSPILATION
  // ============================================================================

  /**
   * Transpile code using the dedicated transpiler worker
   */
  async transpile(
    code: string,
    language: 'javascript' | 'typescript',
    options: TransformOptions
  ): Promise<string> {
    const transpiler = this.transpilers.get(language)
    if (!transpiler?.ready) {
      await this.initializeTranspiler(language)
    }

    const state = this.transpilers.get(language)
    if (!state?.ready) {
      throw new Error(`Transpiler not available for ${language}`)
    }

    const config = this.configs.get(language)
    const id = `transpile-${Date.now()}-${Math.random().toString(36).slice(2)}`

    return new Promise((resolve, reject) => {
      state.pendingTranspilations.set(id, { resolve, reject })

      state.worker.postMessage({
        type: 'transpile',
        id,
        code,
        options: {
          ...options,
          debugFunctionName: config?.debugFunctionName || 'debug'
        }
      })

      // Transpilation timeout
      setTimeout(() => {
        if (state.pendingTranspilations.has(id)) {
          state.pendingTranspilations.delete(id)
          reject(new Error('Transpilation timeout'))
        }
      }, 30000)
    })
  }

  // ============================================================================
  // EXECUTION
  // ============================================================================

  /**
   * Execute code in the appropriate worker
   */
  async execute(request: ExecutionRequest): Promise<unknown> {
    const { id, code, language, options } = request
    const config = this.configs.get(language)

    if (!config) {
      throw new Error(`Unsupported language: ${language}`)
    }

    // Ensure executor is initialized
    const workerState = this.workers.get(language)
    if (!workerState?.ready) {
      await this.initializeExecutor(language)
    }

    const state = this.workers.get(language)
    if (!state?.ready) {
      throw new Error(`Executor not available for ${language}`)
    }

    // For JS/TS, transpile first using dedicated worker
    let transformedCode = code
    if (language === 'javascript' || language === 'typescript') {
      try {
        transformedCode = await this.transpile(code, language, {
          showTopLevelResults: options.showTopLevelResults ?? true,
          loopProtection: options.loopProtection ?? true,
          magicComments: options.magicComments ?? false,
          showUndefined: options.showUndefined ?? false,
          debugFunctionName: config.debugFunctionName
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Transpilation error: ${message}`)
      }
    }

    // Execute in worker
    return new Promise((resolve, reject) => {
      this.pendingExecutions.set(id, {
        resolve,
        reject,
        language,
        startTime: Date.now()
      })

      state.busy = true
      state.currentExecutionId = id

      state.worker.postMessage({
        type: 'execute',
        id,
        code: transformedCode,
        language,
        options: {
          timeout: options.timeout ?? config.defaultTimeout,
          showUndefined: options.showUndefined ?? false
        }
      })

      // Safety timeout
      const timeout = (options.timeout ?? config.defaultTimeout) + 5000
      setTimeout(() => {
        if (this.pendingExecutions.has(id)) {
          this.pendingExecutions.delete(id)
          state.busy = false
          state.currentExecutionId = null
          reject(new Error(`Execution timeout after ${timeout}ms`))
        }
      }, timeout)
    })
  }

  /**
   * Cancel a pending execution
   */
  cancelExecution(id: string): void {
    for (const [_language, state] of this.workers) {
      if (state.currentExecutionId === id) {
        state.worker.postMessage({ type: 'cancel', id })
        break
      }
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Initialize all executors and transpilers
   */
  async initializeAll(): Promise<void> {
    const initPromises: Promise<void>[] = []

    for (const language of this.configs.keys()) {
      initPromises.push(this.initializeExecutor(language))
      
      if (language === 'javascript' || language === 'typescript') {
        initPromises.push(this.initializeTranspiler(language))
      }
    }

    await Promise.all(initPromises)
    console.log('[ExecutorRegistry] All executors initialized')
  }

  /**
   * Shutdown all workers
   */
  async shutdown(): Promise<void> {
    const terminatePromises: Promise<void>[] = []

    for (const [language, state] of this.workers) {
      terminatePromises.push(
        state.worker.terminate().then(() => {
          console.log(`[ExecutorRegistry] ${language} executor terminated`)
        })
      )
    }

    for (const [language, state] of this.transpilers) {
      terminatePromises.push(
        state.worker.terminate().then(() => {
          console.log(`[ExecutorRegistry] ${language} transpiler terminated`)
        })
      )
    }

    await Promise.all(terminatePromises)
    this.workers.clear()
    this.transpilers.clear()
    this.pendingExecutions.clear()
  }

  /**
   * Get registry status
   */
  getStatus(): Record<SupportedLanguage, { executor: boolean; transpiler: boolean }> {
    const status: Record<string, { executor: boolean; transpiler: boolean }> = {}

    for (const language of this.configs.keys()) {
      status[language] = {
        executor: this.workers.get(language)?.ready ?? false,
        transpiler: this.transpilers.get(language as 'javascript' | 'typescript')?.ready ?? false
      }
    }

    return status as Record<SupportedLanguage, { executor: boolean; transpiler: boolean }>
  }
}

// Export singleton factory
let registryInstance: ExecutorRegistry | null = null

export function getExecutorRegistry(basePath?: string, nodeModulesPath?: string): ExecutorRegistry {
  if (!registryInstance && basePath) {
    registryInstance = new ExecutorRegistry(basePath, nodeModulesPath)
  }
  if (!registryInstance) {
    throw new Error('ExecutorRegistry not initialized')
  }
  return registryInstance
}

export function resetExecutorRegistry(): void {
  if (registryInstance) {
    registryInstance.shutdown()
    registryInstance = null
  }
}
