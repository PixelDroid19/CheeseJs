/**
 * Executor Registry
 * 
 * Centralized registry for language executors.
 * Provides a scalable architecture for adding new language support
 * without modifying existing code.
 */

import type {
  SupportedLanguage,
  LanguageTransformer,
  LanguageExecutor,
  TransformOptions,
  ExecutionRequest,
} from './types.js'

// ============================================================================
// EXECUTOR REGISTRY
// ============================================================================

/**
 * Registry for language transformers and executors
 */
class ExecutorRegistry {
  private static instance: ExecutorRegistry | null = null
  
  private transformers: Map<SupportedLanguage, LanguageTransformer> = new Map()
  private executors: Map<SupportedLanguage, LanguageExecutor> = new Map()
  private initializationPromises: Map<SupportedLanguage, Promise<void>> = new Map()
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  static getInstance(): ExecutorRegistry {
    if (!ExecutorRegistry.instance) {
      ExecutorRegistry.instance = new ExecutorRegistry()
    }
    return ExecutorRegistry.instance
  }
  
  // ==========================================================================
  // TRANSFORMER REGISTRATION
  // ==========================================================================
  
  /**
   * Register a language transformer
   */
  registerTransformer(transformer: LanguageTransformer): void {
    this.transformers.set(transformer.language, transformer)
    console.log(`[Registry] Registered transformer for ${transformer.language}`)
  }
  
  /**
   * Get transformer for a language
   */
  getTransformer(language: SupportedLanguage): LanguageTransformer | undefined {
    return this.transformers.get(language)
  }
  
  /**
   * Check if transformer exists for language
   */
  hasTransformer(language: SupportedLanguage): boolean {
    return this.transformers.has(language)
  }
  
  // ==========================================================================
  // EXECUTOR REGISTRATION
  // ==========================================================================
  
  /**
   * Register a language executor
   */
  registerExecutor(executor: LanguageExecutor): void {
    for (const language of executor.languages) {
      this.executors.set(language, executor)
      console.log(`[Registry] Registered executor for ${language}`)
    }
  }
  
  /**
   * Get executor for a language
   */
  getExecutor(language: SupportedLanguage): LanguageExecutor | undefined {
    return this.executors.get(language)
  }
  
  /**
   * Check if executor exists for language
   */
  hasExecutor(language: SupportedLanguage): boolean {
    return this.executors.has(language)
  }
  
  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  
  /**
   * Initialize executor for a specific language
   */
  async initializeExecutor(language: SupportedLanguage): Promise<void> {
    const executor = this.executors.get(language)
    if (!executor) {
      throw new Error(`No executor registered for language: ${language}`)
    }
    
    // Return existing promise if already initializing
    const existing = this.initializationPromises.get(language)
    if (existing) {
      return existing
    }
    
    // Skip if already ready
    if (executor.isReady()) {
      return Promise.resolve()
    }
    
    // Start initialization
    const promise = executor.initialize()
    this.initializationPromises.set(language, promise)
    
    try {
      await promise
    } finally {
      this.initializationPromises.delete(language)
    }
  }
  
  /**
   * Initialize all registered executors
   */
  async initializeAll(): Promise<void> {
    const uniqueExecutors = new Set(this.executors.values())
    await Promise.all(
      Array.from(uniqueExecutors).map(executor => 
        executor.isReady() ? Promise.resolve() : executor.initialize()
      )
    )
  }
  
  // ==========================================================================
  // EXECUTION
  // ==========================================================================
  
  /**
   * Transform code for a specific language
   */
  transform(language: SupportedLanguage, code: string, options: TransformOptions): string {
    const transformer = this.transformers.get(language)
    if (!transformer) {
      throw new Error(`No transformer registered for language: ${language}`)
    }
    return transformer.transform(code, options)
  }
  
  /**
   * Execute code with full pipeline
   */
  async execute(request: ExecutionRequest): Promise<unknown> {
    const { language, code, transformOptions, executeOptions } = request
    
    // Ensure executor is initialized
    await this.initializeExecutor(language)
    
    const executor = this.executors.get(language)
    if (!executor) {
      throw new Error(`No executor registered for language: ${language}`)
    }
    
    // Transform code if transformer exists
    let transformedCode = code
    const transformer = this.transformers.get(language)
    if (transformer) {
      transformedCode = transformer.transform(code, transformOptions)
    }
    
    // Execute
    return executor.execute(transformedCode, executeOptions)
  }
  
  /**
   * Cancel execution
   */
  cancel(language: SupportedLanguage, executionId: string): void {
    const executor = this.executors.get(language)
    if (executor) {
      executor.cancel(executionId)
    }
  }
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Dispose all executors
   */
  disposeAll(): void {
    const uniqueExecutors = new Set(this.executors.values())
    for (const executor of uniqueExecutors) {
      try {
        executor.dispose()
      } catch (error) {
        console.error('[Registry] Error disposing executor:', error)
      }
    }
    this.executors.clear()
    this.transformers.clear()
    this.initializationPromises.clear()
  }
  
  /**
   * Get registered languages
   */
  getRegisteredLanguages(): SupportedLanguage[] {
    return Array.from(new Set([
      ...this.transformers.keys(),
      ...this.executors.keys()
    ]))
  }
  
  /**
   * Check if a language is fully supported (has both transformer and executor)
   */
  isLanguageSupported(language: SupportedLanguage): boolean {
    return this.hasTransformer(language) && this.hasExecutor(language)
  }
}

// Export singleton accessor
export function getExecutorRegistry(): ExecutorRegistry {
  return ExecutorRegistry.getInstance()
}

export { ExecutorRegistry }
