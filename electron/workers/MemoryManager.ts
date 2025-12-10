/**
 * Memory Manager - Adaptive Memory Management for Python Worker
 * 
 * Features:
 * - Strategy pattern for different cleanup approaches
 * - Adaptive thresholds based on runtime conditions
 * - Metrics and monitoring
 * - Force cleanup capabilities
 */

import { parentPort } from 'worker_threads'

// ============================================================================
// TYPES
// ============================================================================

export interface MemoryStats {
    heapUsed: number
    heapTotal: number
    executionsSinceCleanup: number
    lastCleanupTime: number
    pyObjectCount: number
}

export interface MemoryThresholds {
    softLimit: number    // Light cleanup when exceeded
    hardLimit: number    // Full cleanup when exceeded
    criticalLimit: number // Force restart when exceeded
}

export interface MemoryManagerConfig {
    thresholds: MemoryThresholds
    gcInterval: number           // Force GC every N executions
    cleanupInterval: number      // Full cleanup every N executions
    checkAfterExecution: boolean // Check memory after each execution
}

export type CleanupLevel = 'none' | 'light' | 'full' | 'critical'

// ============================================================================
// MEMORY MANAGER
// ============================================================================

export class MemoryManager {
    private config: MemoryManagerConfig
    private stats: MemoryStats
    private executionCounter = 0
    private onCriticalCallback: (() => Promise<void>) | null = null

    constructor(config?: Partial<MemoryManagerConfig>) {
        this.config = {
            thresholds: config?.thresholds ?? {
                softLimit: 256 * 1024 * 1024,    // 256MB - light cleanup
                hardLimit: 512 * 1024 * 1024,    // 512MB - full cleanup
                criticalLimit: 768 * 1024 * 1024  // 768MB - force restart
            },
            gcInterval: config?.gcInterval ?? 5,
            cleanupInterval: config?.cleanupInterval ?? 10,
            checkAfterExecution: config?.checkAfterExecution ?? true
        }

        this.stats = {
            heapUsed: 0,
            heapTotal: 0,
            executionsSinceCleanup: 0,
            lastCleanupTime: Date.now(),
            pyObjectCount: 0
        }
    }

    /**
     * Update memory stats from process
     */
    updateStats(): void {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const mem = process.memoryUsage()
            this.stats.heapUsed = mem.heapUsed
            this.stats.heapTotal = mem.heapTotal
        }
    }

    /**
     * Set Python object count (called from Python code)
     */
    setPyObjectCount(count: number): void {
        this.stats.pyObjectCount = count
    }

    /**
     * Determine what level of cleanup is needed
     */
    getRequiredCleanupLevel(): CleanupLevel {
        this.updateStats()

        const { heapUsed } = this.stats
        const { thresholds } = this.config

        if (heapUsed > thresholds.criticalLimit) {
            return 'critical'
        }

        if (heapUsed > thresholds.hardLimit) {
            return 'full'
        }

        if (heapUsed > thresholds.softLimit) {
            return 'light'
        }

        // Check interval-based cleanup
        if (this.executionCounter > 0) {
            if (this.executionCounter % this.config.cleanupInterval === 0) {
                return 'full'
            }
            if (this.executionCounter % this.config.gcInterval === 0) {
                return 'light'
            }
        }

        return 'none'
    }

    /**
     * Called after each execution to check memory
     */
    async afterExecution(): Promise<CleanupLevel> {
        this.executionCounter++
        this.stats.executionsSinceCleanup++

        if (!this.config.checkAfterExecution) {
            return 'none'
        }

        const level = this.getRequiredCleanupLevel()

        // Log warning for high memory usage
        if (level !== 'none') {
            this.logMemoryWarning(level)
        }

        return level
    }

    /**
     * Mark cleanup as completed
     */
    markCleanupComplete(): void {
        this.stats.executionsSinceCleanup = 0
        this.stats.lastCleanupTime = Date.now()
        this.updateStats()
    }

    /**
     * Log memory warning to parent process
     */
    private logMemoryWarning(level: CleanupLevel): void {
        const memoryMB = Math.round(this.stats.heapUsed / 1024 / 1024)

        console.log(`[MemoryManager] ${level.toUpperCase()} cleanup triggered - ${memoryMB}MB used`)

        if (parentPort) {
            parentPort.postMessage({
                type: 'status',
                id: 'memory-warning',
                data: {
                    message: `Memory ${level}: ${memoryMB}MB`,
                    level,
                    stats: this.getStats()
                }
            })
        }
    }

    /**
     * Set callback for critical memory situations
     */
    onCritical(callback: () => Promise<void>): void {
        this.onCriticalCallback = callback
    }

    /**
     * Handle critical memory situation
     */
    async handleCritical(): Promise<void> {
        console.error('[MemoryManager] CRITICAL memory threshold exceeded!')

        if (this.onCriticalCallback) {
            await this.onCriticalCallback()
        }
    }

    /**
     * Get current memory stats
     */
    getStats(): MemoryStats {
        this.updateStats()
        return { ...this.stats }
    }

    /**
     * Get configuration
     */
    getConfig(): MemoryManagerConfig {
        return { ...this.config }
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<MemoryManagerConfig>): void {
        this.config = { ...this.config, ...config }
        if (config.thresholds) {
            this.config.thresholds = { ...this.config.thresholds, ...config.thresholds }
        }
    }

    /**
     * Get execution counter
     */
    getExecutionCount(): number {
        return this.executionCounter
    }

    /**
     * Reset counter
     */
    resetCounter(): void {
        this.executionCounter = 0
        this.stats.executionsSinceCleanup = 0
    }

    /**
     * Format stats for logging
     */
    formatStats(): string {
        const stats = this.getStats()
        return [
            `Heap: ${Math.round(stats.heapUsed / 1024 / 1024)}MB / ${Math.round(stats.heapTotal / 1024 / 1024)}MB`,
            `Executions since cleanup: ${stats.executionsSinceCleanup}`,
            `Python objects: ${stats.pyObjectCount}`,
            `Last cleanup: ${new Date(stats.lastCleanupTime).toISOString()}`
        ].join(' | ')
    }
}

// ============================================================================
// PYTHON CLEANUP CODE GENERATORS
// ============================================================================

/**
 * Generate Python code for light cleanup (GC only)
 */
export function generateLightCleanupCode(): string {
    return `
import gc
gc.collect()
gc.collect()  # Run twice for circular references
`
}

/**
 * Generate Python code for full namespace cleanup
 */
export function generateFullCleanupCode(): string {
    return `
import sys
import gc

# Names to preserve (system and our custom functions)
_preserve = {
    'sys', 'gc', 'builtins', 'ast', 'asyncio', 'traceback', 'io',
    '_debug_outputs', 'debug', '_get_debug_outputs',
    '_async_input', '_js_request_input', '_original_input',
    '_transform_for_async_input', '_AsyncTransformer', '_AwaitTransformer',
    '_CallGraphBuilder', '_compute_async_functions', '_SYNC_DECORATORS',
    '_code_to_transform', 'micropip', 'StringIO'
}

# Get all current global names
_all_names = list(globals().keys())

# Delete user-defined variables
for _name in _all_names:
    if (_name not in _preserve and 
        not _name.startswith('_') and 
        _name not in sys.builtin_module_names):
        try:
            del globals()[_name]
        except:
            pass

# Clear any remaining references
del _all_names
try:
    del _name
except:
    pass

# Force garbage collection
gc.collect()
gc.collect()
`
}

/**
 * Generate Python code to get object count
 */
export function generateObjectCountCode(): string {
    return `
import gc
len(gc.get_objects())
`
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let memoryManagerInstance: MemoryManager | null = null

export function getMemoryManager(config?: Partial<MemoryManagerConfig>): MemoryManager {
    if (!memoryManagerInstance) {
        memoryManagerInstance = new MemoryManager(config)
    }
    return memoryManagerInstance
}

export function resetMemoryManager(): void {
    memoryManagerInstance = null
}
