/**
 * Worker Pool Manager
 * 
 * Provides a scalable pool of worker threads for code execution with:
 * - Dynamic scaling based on workload (1-4 workers)
 * - Queue-based job management with priorities
 * - Health monitoring and automatic worker recovery
 * - Load balancing across available workers
 */

import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { EventEmitter } from 'node:events'

// ============================================================================
// TYPES
// ============================================================================

export type WorkerType = 'javascript' | 'python'

export interface WorkerPoolConfig {
  /** Minimum number of workers to maintain */
  minWorkers: number
  /** Maximum number of workers to scale to */
  maxWorkers: number
  /** Time in ms before scaling down idle workers */
  idleTimeoutMs: number
  /** Time in ms to wait for worker to become ready */
  initTimeoutMs: number
  /** Time in ms between health checks */
  healthCheckIntervalMs: number
  /** Max consecutive failures before worker is replaced */
  maxConsecutiveFailures: number
}

export interface ExecutionJob {
  id: string
  code: string
  options: Record<string, unknown>
  priority: JobPriority
  timestamp: number
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

export enum JobPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
}

export interface WorkerInfo {
  id: string
  worker: Worker
  type: WorkerType
  ready: boolean
  busy: boolean
  currentJobId: string | null
  consecutiveFailures: number
  executionCount: number
  lastActivityTime: number
  createdAt: number
}

export interface PoolStats {
  totalWorkers: number
  readyWorkers: number
  busyWorkers: number
  queueLength: number
  totalExecutions: number
  averageExecutionTime: number
}

export interface WorkerMessage {
  type: string
  id?: string
  data?: unknown
  [key: string]: unknown
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: WorkerPoolConfig = {
  minWorkers: 1,
  maxWorkers: 4,
  idleTimeoutMs: 60000, // 1 minute
  initTimeoutMs: 30000, // 30 seconds
  healthCheckIntervalMs: 30000, // 30 seconds
  maxConsecutiveFailures: 3,
}

// ============================================================================
// WORKER POOL CLASS
// ============================================================================

export class WorkerPool extends EventEmitter {
  private config: WorkerPoolConfig
  private workerType: WorkerType
  private workerScript: string
  private workerData: Record<string, unknown>
  
  private workers: Map<string, WorkerInfo> = new Map()
  private jobQueue: ExecutionJob[] = []
  private activeJobs: Map<string, { workerId: string; startTime: number }> = new Map()
  
  private workerIdCounter = 0
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private scaleDownTimeout: ReturnType<typeof setTimeout> | null = null
  
  private totalExecutions = 0
  private totalExecutionTime = 0
  private isShuttingDown = false

  constructor(
    workerType: WorkerType,
    workerScript: string,
    workerData: Record<string, unknown> = {},
    config: Partial<WorkerPoolConfig> = {}
  ) {
    super()
    this.workerType = workerType
    this.workerScript = workerScript
    this.workerData = workerData
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the pool with minimum workers
   */
  async initialize(): Promise<void> {
    console.log(`[WorkerPool:${this.workerType}] Initializing with ${this.config.minWorkers} workers`)
    
    const initPromises: Promise<void>[] = []
    for (let i = 0; i < this.config.minWorkers; i++) {
      initPromises.push(this.createWorker())
    }
    
    await Promise.all(initPromises)
    
    // Start health check interval
    this.startHealthChecks()
    
    console.log(`[WorkerPool:${this.workerType}] Initialized successfully`)
  }

  /**
   * Create a new worker and add it to the pool
   */
  private async createWorker(): Promise<void> {
    const workerId = `${this.workerType}-worker-${++this.workerIdCounter}`
    
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerScript, {
        workerData: this.workerData
      })

      const workerInfo: WorkerInfo = {
        id: workerId,
        worker,
        type: this.workerType,
        ready: false,
        busy: false,
        currentJobId: null,
        consecutiveFailures: 0,
        executionCount: 0,
        lastActivityTime: Date.now(),
        createdAt: Date.now(),
      }

      this.workers.set(workerId, workerInfo)

      // Set up initialization timeout
      const initTimeout = setTimeout(() => {
        if (!workerInfo.ready) {
          console.error(`[WorkerPool:${this.workerType}] Worker ${workerId} init timeout`)
          this.removeWorker(workerId)
          reject(new Error(`Worker initialization timeout`))
        }
      }, this.config.initTimeoutMs)

      // Handle worker messages
      worker.on('message', (message: WorkerMessage) => {
        this.handleWorkerMessage(workerId, message)
        
        if (message.type === 'ready') {
          workerInfo.ready = true
          clearTimeout(initTimeout)
          resolve()
        }
      })

      worker.on('error', (error) => {
        console.error(`[WorkerPool:${this.workerType}] Worker ${workerId} error:`, error)
        workerInfo.consecutiveFailures++
        this.emit('workerError', { workerId, error })
        
        // Handle job failure if worker was busy
        if (workerInfo.currentJobId) {
          this.handleJobFailure(workerInfo.currentJobId, error)
        }
        
        // Replace worker if too many failures
        if (workerInfo.consecutiveFailures >= this.config.maxConsecutiveFailures) {
          this.replaceWorker(workerId)
        }
      })

      worker.on('exit', (code) => {
        console.log(`[WorkerPool:${this.workerType}] Worker ${workerId} exited with code ${code}`)
        
        // Handle job failure if worker was busy
        if (workerInfo.currentJobId) {
          this.handleJobFailure(workerInfo.currentJobId, new Error(`Worker exited with code ${code}`))
        }
        
        this.workers.delete(workerId)
        
        // Replace if not shutting down and below minimum
        if (!this.isShuttingDown && this.workers.size < this.config.minWorkers) {
          this.createWorker().catch(err => {
            console.error(`[WorkerPool:${this.workerType}] Failed to replace worker:`, err)
          })
        }
      })
    })
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerId: string, message: WorkerMessage): void {
    const workerInfo = this.workers.get(workerId)
    if (!workerInfo) return

    workerInfo.lastActivityTime = Date.now()

    // Forward message to listeners
    this.emit('message', { workerId, message })

    // Handle job completion
    if (message.type === 'complete' || message.type === 'error') {
      const jobId = message.id as string
      const activeJob = this.activeJobs.get(jobId)
      
      if (activeJob && activeJob.workerId === workerId) {
        const executionTime = Date.now() - activeJob.startTime
        this.totalExecutionTime += executionTime
        this.totalExecutions++
        
        workerInfo.busy = false
        workerInfo.currentJobId = null
        workerInfo.executionCount++
        workerInfo.consecutiveFailures = 0 // Reset on success
        
        this.activeJobs.delete(jobId)
        
        // Process next job in queue
        this.processQueue()
        
        // Check if we can scale down
        this.scheduleScaleDown()
      }
    }
  }

  /**
   * Handle job failure
   */
  private handleJobFailure(jobId: string, error: Error): void {
    const activeJob = this.activeJobs.get(jobId)
    if (!activeJob) return

    // Find the original job to reject
    // Note: In this implementation, jobs are not stored after being dispatched
    // The reject callback would need to be stored separately
    this.activeJobs.delete(jobId)
    
    this.emit('jobError', { jobId, error })
  }

  // ============================================================================
  // JOB EXECUTION
  // ============================================================================

  /**
   * Execute code on an available worker
   */
  async execute(
    id: string,
    code: string,
    options: Record<string, unknown> = {},
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<unknown> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down')
    }

    return new Promise((resolve, reject) => {
      const job: ExecutionJob = {
        id,
        code,
        options,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
      }

      // Add to queue with priority ordering
      this.insertJobByPriority(job)
      
      // Try to process immediately
      this.processQueue()
      
      // Scale up if needed
      this.checkScaleUp()
    })
  }

  /**
   * Insert job into queue maintaining priority order
   */
  private insertJobByPriority(job: ExecutionJob): void {
    // Find insertion point (higher priority first, then by timestamp)
    let insertIndex = this.jobQueue.length
    
    for (let i = 0; i < this.jobQueue.length; i++) {
      if (job.priority > this.jobQueue[i].priority ||
          (job.priority === this.jobQueue[i].priority && job.timestamp < this.jobQueue[i].timestamp)) {
        insertIndex = i
        break
      }
    }
    
    this.jobQueue.splice(insertIndex, 0, job)
  }

  /**
   * Process jobs in the queue
   */
  private processQueue(): void {
    while (this.jobQueue.length > 0) {
      const availableWorker = this.getAvailableWorker()
      if (!availableWorker) break

      const job = this.jobQueue.shift()!
      this.dispatchJob(availableWorker, job)
    }
  }

  /**
   * Get an available worker
   */
  private getAvailableWorker(): WorkerInfo | null {
    for (const workerInfo of this.workers.values()) {
      if (workerInfo.ready && !workerInfo.busy) {
        return workerInfo
      }
    }
    return null
  }

  /**
   * Dispatch a job to a worker
   */
  private dispatchJob(workerInfo: WorkerInfo, job: ExecutionJob): void {
    workerInfo.busy = true
    workerInfo.currentJobId = job.id
    workerInfo.lastActivityTime = Date.now()

    this.activeJobs.set(job.id, {
      workerId: workerInfo.id,
      startTime: Date.now(),
    })

    // Store resolve/reject for later
    const jobCallbacks = { resolve: job.resolve, reject: job.reject }
    
    // Set up one-time listener for this job's completion
    const messageHandler = (data: { workerId: string; message: WorkerMessage }) => {
      if (data.message.id !== job.id) return
      
      if (data.message.type === 'complete') {
        jobCallbacks.resolve(data.message.data)
        this.off('message', messageHandler)
      } else if (data.message.type === 'error') {
        jobCallbacks.reject(new Error((data.message.data as { message: string })?.message ?? 'Execution error'))
        this.off('message', messageHandler)
      }
    }
    
    this.on('message', messageHandler)

    // Send job to worker
    workerInfo.worker.postMessage({
      type: 'execute',
      id: job.id,
      code: job.code,
      options: job.options,
    })
  }

  /**
   * Cancel a running or queued job
   */
  cancel(jobId: string): void {
    // Check if job is in queue
    const queueIndex = this.jobQueue.findIndex(j => j.id === jobId)
    if (queueIndex !== -1) {
      const job = this.jobQueue.splice(queueIndex, 1)[0]
      job.reject(new Error('Job cancelled'))
      return
    }

    // Check if job is active
    const activeJob = this.activeJobs.get(jobId)
    if (activeJob) {
      const workerInfo = this.workers.get(activeJob.workerId)
      if (workerInfo) {
        workerInfo.worker.postMessage({ type: 'cancel', id: jobId })
      }
    }
  }

  // ============================================================================
  // SCALING
  // ============================================================================

  /**
   * Check if we need to scale up
   */
  private checkScaleUp(): void {
    const busyWorkers = Array.from(this.workers.values()).filter(w => w.busy).length
    const totalWorkers = this.workers.size
    
    // Scale up if all workers are busy and we have queued jobs
    if (busyWorkers === totalWorkers && 
        this.jobQueue.length > 0 && 
        totalWorkers < this.config.maxWorkers) {
      console.log(`[WorkerPool:${this.workerType}] Scaling up: ${totalWorkers} -> ${totalWorkers + 1}`)
      this.createWorker().then(() => {
        this.processQueue()
      }).catch(err => {
        console.error(`[WorkerPool:${this.workerType}] Failed to scale up:`, err)
      })
    }
  }

  /**
   * Schedule scale down check
   */
  private scheduleScaleDown(): void {
    if (this.scaleDownTimeout) {
      clearTimeout(this.scaleDownTimeout)
    }
    
    this.scaleDownTimeout = setTimeout(() => {
      this.checkScaleDown()
    }, this.config.idleTimeoutMs)
  }

  /**
   * Check if we can scale down
   */
  private checkScaleDown(): void {
    const idleWorkers = Array.from(this.workers.values())
      .filter(w => w.ready && !w.busy)
      .sort((a, b) => a.executionCount - b.executionCount) // Remove least used first
    
    const totalWorkers = this.workers.size
    
    // Scale down if we have more than minimum and idle workers
    while (idleWorkers.length > 0 && totalWorkers > this.config.minWorkers) {
      const workerToRemove = idleWorkers.shift()!
      const timeSinceActivity = Date.now() - workerToRemove.lastActivityTime
      
      if (timeSinceActivity > this.config.idleTimeoutMs) {
        console.log(`[WorkerPool:${this.workerType}] Scaling down: removing idle worker ${workerToRemove.id}`)
        this.removeWorker(workerToRemove.id)
      }
    }
  }

  // ============================================================================
  // HEALTH MONITORING
  // ============================================================================

  /**
   * Start health check interval
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck()
    }, this.config.healthCheckIntervalMs)
  }

  /**
   * Perform health check on all workers
   */
  private performHealthCheck(): void {
    const now = Date.now()
    
    for (const workerInfo of this.workers.values()) {
      // Check for stuck workers (busy for too long without activity)
      if (workerInfo.busy) {
        const timeSinceActivity = now - workerInfo.lastActivityTime
        const stuckThreshold = 60000 // 1 minute
        
        if (timeSinceActivity > stuckThreshold) {
          console.warn(`[WorkerPool:${this.workerType}] Worker ${workerInfo.id} appears stuck, replacing`)
          this.replaceWorker(workerInfo.id)
        }
      }
      
      // Check for workers with too many failures
      if (workerInfo.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        console.warn(`[WorkerPool:${this.workerType}] Worker ${workerInfo.id} has too many failures, replacing`)
        this.replaceWorker(workerInfo.id)
      }
    }
    
    // Ensure minimum workers
    if (this.workers.size < this.config.minWorkers) {
      const toCreate = this.config.minWorkers - this.workers.size
      for (let i = 0; i < toCreate; i++) {
        this.createWorker().catch(err => {
          console.error(`[WorkerPool:${this.workerType}] Failed to create worker during health check:`, err)
        })
      }
    }
  }

  /**
   * Replace a problematic worker
   */
  private async replaceWorker(workerId: string): Promise<void> {
    this.removeWorker(workerId)
    await this.createWorker()
  }

  /**
   * Remove a worker from the pool
   */
  private removeWorker(workerId: string): void {
    const workerInfo = this.workers.get(workerId)
    if (!workerInfo) return

    // Handle any active job
    if (workerInfo.currentJobId) {
      this.handleJobFailure(workerInfo.currentJobId, new Error('Worker removed'))
    }

    try {
      workerInfo.worker.terminate()
    } catch (e) {
      console.error(`[WorkerPool:${this.workerType}] Error terminating worker:`, e)
    }

    this.workers.delete(workerId)
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const workers = Array.from(this.workers.values())
    const readyWorkers = workers.filter(w => w.ready).length
    const busyWorkers = workers.filter(w => w.busy).length

    return {
      totalWorkers: workers.length,
      readyWorkers,
      busyWorkers,
      queueLength: this.jobQueue.length,
      totalExecutions: this.totalExecutions,
      averageExecutionTime: this.totalExecutions > 0 
        ? Math.round(this.totalExecutionTime / this.totalExecutions) 
        : 0,
    }
  }

  /**
   * Check if any worker is ready
   */
  isReady(): boolean {
    return Array.from(this.workers.values()).some(w => w.ready)
  }

  /**
   * Wait for at least one worker to be ready
   */
  async waitForReady(timeoutMs: number = 10000): Promise<boolean> {
    if (this.isReady()) return true

    return new Promise((resolve) => {
      const startTime = Date.now()
      
      const checkReady = setInterval(() => {
        if (this.isReady()) {
          clearInterval(checkReady)
          resolve(true)
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkReady)
          resolve(false)
        }
      }, 100)
    })
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    console.log(`[WorkerPool:${this.workerType}] Shutting down`)
    this.isShuttingDown = true

    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    // Clear scale down timeout
    if (this.scaleDownTimeout) {
      clearTimeout(this.scaleDownTimeout)
      this.scaleDownTimeout = null
    }

    // Reject all queued jobs
    for (const job of this.jobQueue) {
      job.reject(new Error('Pool shutting down'))
    }
    this.jobQueue = []

    // Terminate all workers
    const terminatePromises = Array.from(this.workers.values()).map(workerInfo => {
      return workerInfo.worker.terminate()
    })

    await Promise.all(terminatePromises)
    this.workers.clear()
    this.activeJobs.clear()

    console.log(`[WorkerPool:${this.workerType}] Shutdown complete`)
  }

  /**
   * Send message to a specific worker or all workers
   */
  broadcast(message: WorkerMessage, workerId?: string): void {
    if (workerId) {
      const workerInfo = this.workers.get(workerId)
      if (workerInfo) {
        workerInfo.worker.postMessage(message)
      }
    } else {
      for (const workerInfo of this.workers.values()) {
        workerInfo.worker.postMessage(message)
      }
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a worker pool for JavaScript/TypeScript execution
 */
export function createJSWorkerPool(
  nodeModulesPath: string | undefined,
  config?: Partial<WorkerPoolConfig>
): WorkerPool {
  const workerScript = path.join(__dirname, 'codeExecutor.js')
  return new WorkerPool('javascript', workerScript, { nodeModulesPath }, config)
}

/**
 * Create a worker pool for Python execution
 * Note: Python pool typically uses min=1, max=1 due to Pyodide memory constraints
 */
export function createPythonWorkerPool(
  config?: Partial<WorkerPoolConfig>
): WorkerPool {
  const workerScript = path.join(__dirname, 'pythonExecutor.js')
  const pythonConfig: Partial<WorkerPoolConfig> = {
    minWorkers: 1,
    maxWorkers: 1, // Pyodide is memory-heavy, keep to single instance
    ...config,
  }
  return new WorkerPool('python', workerScript, {}, pythonConfig)
}

