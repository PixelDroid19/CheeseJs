/**
 * Language Executor Registry
 * 
 * Centralized registry for language executors in CheeseJS.
 * Allows registering executors per language with independent configuration.
 * 
 * Features:
 * - Language-specific worker management
 * - Independent transpiler configuration
 * - Custom timeout settings per language
 * - Worker pool support for parallel execution
 */

import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { EventEmitter } from 'node:events'

// ============================================================================
// TYPES
// ============================================================================

export type SupportedLanguage = 'javascript' | 'typescript' | 'python'

export interface TranspilerConfig {
  /** Worker script path for transpilation (null = no transpilation) */
  workerScript: string | null
  /** Enable loop protection */
  loopProtection: boolean
  /** Enable magic comments */
  magicComments: boolean
  /** Show top-level results */
  showTopLevelResults: boolean
  /** Target ECMAScript version */
  targetVersion: 'ES2022' | 'ES2024' | 'ESNext'
  /** Enable experimental decorators */
  experimentalDecorators: boolean
  /** Enable JSX parsing */
  jsx: boolean
  /** Custom debug function name */
  debugFunctionName: string
}

export interface ExecutorConfig {
  /** Worker script path for execution */
  workerScript: string
  /** Default execution timeout (ms) */
  timeout: number
  /** Enable worker pool for parallel execution */
  usePool: boolean
  /** Min workers in pool (if usePool=true) */
  poolMinWorkers: number
  /** Max workers in pool (if usePool=true) */
  poolMaxWorkers: number
  /** Extra data to pass to worker */
  workerData?: Record<string, unknown>
}

export interface LanguageConfig {
  language: SupportedLanguage
  transpiler: TranspilerConfig
  executor: ExecutorConfig
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

export interface WorkerMessage {
  type: string
  id?: string
  data?: unknown
  line?: number
  jsType?: string
  consoleType?: string
  [key: string]: unknown
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const DEFAULT_JS_CONFIG: LanguageConfig = {
  language: 'javascript',
  transpiler: {
    workerScript: 'swcWorker.js',
    loopProtection: true,
    magicComments: false,
    showTopLevelResults: true,
    targetVersion: 'ES2024',
    experimentalDecorators: true,
    jsx: true,
    debugFunctionName: '__jsDebug'
  },
  executor: {
    workerScript: 'codeExecutor.js',
    timeout: 30000,
    usePool: true,
    poolMinWorkers: 1,
    poolMaxWorkers: 4
  }
}

export const DEFAULT_TS_CONFIG: LanguageConfig = {
  language: 'typescript',
  transpiler: {
    workerScript: 'swcWorker.js',
    loopProtection: true,
    magicComments: false,
    showTopLevelResults: true,
    targetVersion: 'ES2024',
    experimentalDecorators: true,
    jsx: true,
    debugFunctionName: '__jsDebug'
  },
  executor: {
    workerScript: 'codeExecutor.js',
    timeout: 30000,
    usePool: true,
    poolMinWorkers: 1,
    poolMaxWorkers: 4
  }
}

export const DEFAULT_PYTHON_CONFIG: LanguageConfig = {
  language: 'python',
  transpiler: {
    workerScript: null, // Python doesn't need transpilation
    loopProtection: false,
    magicComments: false,
    showTopLevelResults: true,
    targetVersion: 'ES2024',
    experimentalDecorators: false,
    jsx: false,
    debugFunctionName: '__pyDebug'
  },
  executor: {
    workerScript: 'pythonExecutor.js',
    timeout: 60000, // Python needs longer timeout for Pyodide init
    usePool: false, // Pyodide doesn't support multiple instances well
    poolMinWorkers: 1,
    poolMaxWorkers: 1
  }
}

// ============================================================================
// EXECUTOR INSTANCE
// ============================================================================

interface ExecutorInstance {
  config: LanguageConfig
  executorWorker: Worker | null
  transpilerWorker: Worker | null
  ready: boolean
  initializing: boolean
  initPromise: Promise<void> | null
  pendingExecutions: Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }>
  pendingTranspilations: Map<string, {
    resolve: (code: string) => void
    reject: (error: Error) => void
  }>
}

// ============================================================================
// LANGUAGE EXECUTOR REGISTRY
// ============================================================================

export class LanguageExecutorRegistry extends EventEmitter {
  private executors = new Map<SupportedLanguage, ExecutorInstance>()
  private distPath: string
  private getNodeModulesPath: () => string | undefined

  constructor(distPath: string, getNodeModulesPath: () => string | undefined) {
    super()
    this.distPath = distPath
    this.getNodeModulesPath = getNodeModulesPath
  }

  /**
   * Register a language executor with configuration
   */
  register(config: LanguageConfig): void {
    if (this.executors.has(config.language)) {
      console.warn(`[Registry] Executor for ${config.language} already registered, updating config`)
      const existing = this.executors.get(config.language)!
      existing.config = config
      return
    }

    this.executors.set(config.language, {
      config,
      executorWorker: null,
      transpilerWorker: null,
      ready: false,
      initializing: false,
      initPromise: null,
      pendingExecutions: new Map(),
      pendingTranspilations: new Map()
    })

    console.log(`[Registry] Registered executor for ${config.language}`)
  }

  /**
   * Register all default executors
   */
  registerDefaults(): void {
    this.register(DEFAULT_JS_CONFIG)
    this.register(DEFAULT_TS_CONFIG)
    this.register(DEFAULT_PYTHON_CONFIG)
  }

  /**
   * Initialize executor for a specific language
   */
  async initialize(language: SupportedLanguage): Promise<void> {
    const instance = this.executors.get(language)
    if (!instance) {
      throw new Error(`No executor registered for language: ${language}`)
    }

    if (instance.ready) return
    if (instance.initPromise) return instance.initPromise

    instance.initializing = true
    instance.initPromise = this.doInitialize(language, instance)

    try {
      await instance.initPromise
    } finally {
      instance.initializing = false
      instance.initPromise = null
    }
  }

  private async doInitialize(language: SupportedLanguage, instance: ExecutorInstance): Promise<void> {
    const { config } = instance

    // Initialize transpiler worker if needed
    if (config.transpiler.workerScript) {
      await this.initTranspilerWorker(instance)
    }

    // Initialize executor worker
    await this.initExecutorWorker(language, instance)

    instance.ready = true
    console.log(`[Registry] ${language} executor initialized`)
  }

  private initTranspilerWorker(instance: ExecutorInstance): Promise<void> {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(this.distPath, instance.config.transpiler.workerScript!)

      try {
        instance.transpilerWorker = new Worker(workerPath)

        instance.transpilerWorker.on('message', (message: WorkerMessage) => {
          if (message.type === 'ready') {
            console.log(`[Registry] Transpiler worker ready for ${instance.config.language}`)
            resolve()
            return
          }

          if (message.type === 'transform-result' && message.id) {
            const pending = instance.pendingTranspilations.get(message.id)
            if (pending) {
              instance.pendingTranspilations.delete(message.id)
              if (message.error) {
                pending.reject(new Error(message.error as string))
              } else {
                pending.resolve(message.code as string)
              }
            }
          }
        })

        instance.transpilerWorker.on('error', (error) => {
          console.error(`[Registry] Transpiler worker error:`, error)
          reject(error)
        })

        instance.transpilerWorker.on('exit', (code) => {
          if (code !== 0) {
            console.warn(`[Registry] Transpiler worker exited with code ${code}`)
          }
          instance.transpilerWorker = null
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  private initExecutorWorker(language: SupportedLanguage, instance: ExecutorInstance): Promise<void> {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(this.distPath, instance.config.executor.workerScript)

      try {
        const workerData: Record<string, unknown> = {
          ...instance.config.executor.workerData,
          debugFunctionName: instance.config.transpiler.debugFunctionName
        }

        // Add node_modules path for JS/TS executor
        if (language === 'javascript' || language === 'typescript') {
          workerData.nodeModulesPath = this.getNodeModulesPath()
        }

        instance.executorWorker = new Worker(workerPath, { workerData })

        instance.executorWorker.on('message', (message: WorkerMessage) => {
          if (message.type === 'ready') {
            console.log(`[Registry] Executor worker ready for ${language}`)
            resolve()
            return
          }

          // Emit all messages for external handling
          this.emit('worker-message', { language, message })

          // Handle execution completion
          if ((message.type === 'complete' || message.type === 'error') && message.id) {
            const pending = instance.pendingExecutions.get(message.id)
            if (pending) {
              clearTimeout(pending.timeout)
              instance.pendingExecutions.delete(message.id)

              if (message.type === 'error') {
                pending.reject(new Error((message.data as { message: string })?.message || 'Execution error'))
              } else {
                pending.resolve(message.data)
              }
            }
          }
        })

        instance.executorWorker.on('error', (error) => {
          console.error(`[Registry] Executor worker error for ${language}:`, error)
          instance.ready = false
          reject(error)

          // Reject all pending executions
          for (const [id, pending] of instance.pendingExecutions) {
            clearTimeout(pending.timeout)
            pending.reject(error)
            instance.pendingExecutions.delete(id)
          }
        })

        instance.executorWorker.on('exit', (code) => {
          console.log(`[Registry] Executor worker for ${language} exited with code ${code}`)
          instance.executorWorker = null
          instance.ready = false

          // Auto-reinitialize on crash (except during shutdown)
          if (code !== 0) {
            setTimeout(() => {
              console.log(`[Registry] Reinitializing ${language} executor after crash`)
              this.initialize(language).catch(console.error)
            }, 1000)
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Transpile code using the language's transpiler worker
   */
  async transpile(language: SupportedLanguage, code: string, options: ExecutionRequest['options'] = {}): Promise<string> {
    const instance = this.executors.get(language)
    if (!instance) {
      throw new Error(`No executor registered for language: ${language}`)
    }

    // Python doesn't need transpilation
    if (!instance.config.transpiler.workerScript) {
      return code
    }

    if (!instance.transpilerWorker) {
      await this.initialize(language)
    }

    const id = `transpile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return new Promise((resolve, reject) => {
      instance.pendingTranspilations.set(id, { resolve, reject })

      instance.transpilerWorker!.postMessage({
        type: 'transform',
        id,
        code,
        options: {
          showTopLevelResults: options.showTopLevelResults ?? instance.config.transpiler.showTopLevelResults,
          loopProtection: options.loopProtection ?? instance.config.transpiler.loopProtection,
          magicComments: options.magicComments ?? instance.config.transpiler.magicComments,
          showUndefined: options.showUndefined ?? false,
          targetVersion: instance.config.transpiler.targetVersion,
          experimentalDecorators: instance.config.transpiler.experimentalDecorators,
          jsx: instance.config.transpiler.jsx,
          debugFunctionName: instance.config.transpiler.debugFunctionName
        }
      })

      // Transpilation timeout (5s should be plenty)
      setTimeout(() => {
        if (instance.pendingTranspilations.has(id)) {
          instance.pendingTranspilations.delete(id)
          reject(new Error('Transpilation timeout'))
        }
      }, 5000)
    })
  }

  /**
   * Execute code in the language's executor worker
   */
  async execute(request: ExecutionRequest): Promise<unknown> {
    const { id, code, language, options } = request

    const instance = this.executors.get(language)
    if (!instance) {
      throw new Error(`No executor registered for language: ${language}`)
    }

    if (!instance.ready) {
      await this.initialize(language)
    }

    // Transpile code first (for JS/TS)
    let transformedCode = code
    if (instance.config.transpiler.workerScript) {
      try {
        transformedCode = await this.transpile(language, code, options)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Transpilation error: ${message}`)
      }
    }

    const timeout = options.timeout ?? instance.config.executor.timeout

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        if (instance.pendingExecutions.has(id)) {
          instance.pendingExecutions.delete(id)
          this.emit('execution-timeout', { id, language })
          reject(new Error('Execution timeout'))
        }
      }, timeout + 5000)

      instance.pendingExecutions.set(id, { resolve, reject, timeout: timeoutHandle })

      instance.executorWorker!.postMessage({
        type: 'execute',
        id,
        code: transformedCode,
        options: {
          timeout,
          showUndefined: options.showUndefined ?? false
        }
      })
    })
  }

  /**
   * Cancel a running execution
   */
  cancel(id: string, language?: SupportedLanguage): void {
    const languages = language ? [language] : Array.from(this.executors.keys())

    for (const lang of languages) {
      const instance = this.executors.get(lang)
      if (instance?.executorWorker) {
        instance.executorWorker.postMessage({ type: 'cancel', id })

        const pending = instance.pendingExecutions.get(id)
        if (pending) {
          clearTimeout(pending.timeout)
          pending.reject(new Error('Execution cancelled'))
          instance.pendingExecutions.delete(id)
        }
      }
    }
  }

  /**
   * Terminate executor for a language
   */
  async terminate(language: SupportedLanguage): Promise<void> {
    const instance = this.executors.get(language)
    if (!instance) return

    if (instance.transpilerWorker) {
      await instance.transpilerWorker.terminate()
      instance.transpilerWorker = null
    }

    if (instance.executorWorker) {
      await instance.executorWorker.terminate()
      instance.executorWorker = null
    }

    instance.ready = false

    // Reject all pending executions
    for (const [id, pending] of instance.pendingExecutions) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Executor terminated'))
      instance.pendingExecutions.delete(id)
    }

    console.log(`[Registry] Terminated executor for ${language}`)
  }

  /**
   * Terminate all executors
   */
  async terminateAll(): Promise<void> {
    const promises = Array.from(this.executors.keys()).map(lang => this.terminate(lang))
    await Promise.all(promises)
  }

  /**
   * Get configuration for a language
   */
  getConfig(language: SupportedLanguage): LanguageConfig | undefined {
    return this.executors.get(language)?.config
  }

  /**
   * Check if a language executor is ready
   */
  isReady(language: SupportedLanguage): boolean {
    return this.executors.get(language)?.ready ?? false
  }

  /**
   * Get executor worker for a language (for direct messaging)
   */
  getExecutorWorker(language: SupportedLanguage): Worker | null {
    return this.executors.get(language)?.executorWorker ?? null
  }

  /**
   * Post message to executor worker
   */
  postToExecutor(language: SupportedLanguage, message: unknown): void {
    const worker = this.getExecutorWorker(language)
    if (worker) {
      worker.postMessage(message)
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE FACTORY
// ============================================================================

let registryInstance: LanguageExecutorRegistry | null = null

export function getExecutorRegistry(
  distPath?: string,
  getNodeModulesPath?: () => string | undefined
): LanguageExecutorRegistry {
  if (!registryInstance) {
    if (!distPath || !getNodeModulesPath) {
      throw new Error('Registry not initialized. Provide distPath and getNodeModulesPath on first call.')
    }
    registryInstance = new LanguageExecutorRegistry(distPath, getNodeModulesPath)
    registryInstance.registerDefaults()
  }
  return registryInstance
}

export function clearExecutorRegistry(): void {
  if (registryInstance) {
    registryInstance.terminateAll().catch(console.error)
    registryInstance = null
  }
}
