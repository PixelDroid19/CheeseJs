/**
 * Package Installation Logger
 * 
 * Provides structured logging for package installation and auto-execution events.
 * Logs are stored in memory and can be exported for debugging purposes.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type InstallationStatus = 'started' | 'success' | 'failed' | 'retrying'

export type AutoRunStatus = 'pending' | 'started' | 'completed' | 'skipped' | 'failed'

export interface InstallationLogEntry {
  id: string
  timestamp: number
  packageName: string
  status: InstallationStatus
  duration?: number
  attempt?: number
  maxAttempts?: number
  error?: string
  version?: string
}

export interface AutoRunLogEntry {
  id: string
  timestamp: number
  status: AutoRunStatus
  triggeredBy: 'package-install' | 'manual' | 'initial'
  packages?: string[]
  duration?: number
  error?: string
}

export interface PackageLoggerConfig {
  maxEntries: number
  enabled: boolean
  consoleOutput: boolean
  minLevel: LogLevel
}

const DEFAULT_CONFIG: PackageLoggerConfig = {
  maxEntries: 100,
  enabled: true,
  consoleOutput: process.env.NODE_ENV === 'development',
  minLevel: 'info'
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

class PackageLogger {
  private installationLogs: InstallationLogEntry[] = []
  private autoRunLogs: AutoRunLogEntry[] = []
  private config: PackageLoggerConfig = DEFAULT_CONFIG
  private listeners: Set<() => void> = new Set()

  configure(config: Partial<PackageLoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): PackageLoggerConfig {
    return { ...this.config }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel]
  }

  private trimLogs(): void {
    if (this.installationLogs.length > this.config.maxEntries) {
      this.installationLogs = this.installationLogs.slice(-this.config.maxEntries)
    }
    if (this.autoRunLogs.length > this.config.maxEntries) {
      this.autoRunLogs = this.autoRunLogs.slice(-this.config.maxEntries)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener())
  }

  private consoleLog(level: LogLevel, message: string, data?: object): void {
    if (!this.config.consoleOutput) return

    const prefix = '📦 [PackageLogger]'
    const timestamp = new Date().toISOString()
    const formattedMessage = `${prefix} [${timestamp}] ${message}`

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, data || '')
        break
      case 'info':
        console.info(formattedMessage, data || '')
        break
      case 'warn':
        console.warn(formattedMessage, data || '')
        break
      case 'error':
        console.error(formattedMessage, data || '')
        break
    }
  }

  // Installation logging methods
  logInstallStart(packageName: string, attempt: number = 1, maxAttempts: number = 3): string {
    if (!this.shouldLog('info')) return ''

    const entry: InstallationLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      packageName,
      status: 'started',
      attempt,
      maxAttempts
    }

    this.installationLogs.push(entry)
    this.trimLogs()
    this.notifyListeners()

    this.consoleLog('info', `Installing package: ${packageName} (attempt ${attempt}/${maxAttempts})`)

    return entry.id
  }

  logInstallSuccess(packageName: string, version?: string, startTime?: number): void {
    if (!this.shouldLog('info')) return

    const duration = startTime ? Date.now() - startTime : undefined

    const entry: InstallationLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      packageName,
      status: 'success',
      duration,
      version
    }

    this.installationLogs.push(entry)
    this.trimLogs()
    this.notifyListeners()

    this.consoleLog('info', `Package installed successfully: ${packageName}${version ? `@${version}` : ''}`, 
      duration ? { duration: `${duration}ms` } : undefined)
  }

  logInstallFailure(packageName: string, error: string, attempt?: number, willRetry?: boolean): void {
    const level = willRetry ? 'warn' : 'error'
    if (!this.shouldLog(level)) return

    const entry: InstallationLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      packageName,
      status: willRetry ? 'retrying' : 'failed',
      error,
      attempt
    }

    this.installationLogs.push(entry)
    this.trimLogs()
    this.notifyListeners()

    const message = willRetry 
      ? `Package installation failed, will retry: ${packageName}`
      : `Package installation failed: ${packageName}`
    
    this.consoleLog(level, message, { error, attempt })
  }

  // Auto-run logging methods
  logAutoRunPending(packages: string[]): string {
    if (!this.shouldLog('info')) return ''

    const entry: AutoRunLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      status: 'pending',
      triggeredBy: 'package-install',
      packages
    }

    this.autoRunLogs.push(entry)
    this.trimLogs()
    this.notifyListeners()

    this.consoleLog('info', `Auto-run pending after package installation`, { packages })

    return entry.id
  }

  logAutoRunStart(triggeredBy: AutoRunLogEntry['triggeredBy'] = 'package-install'): string {
    if (!this.shouldLog('info')) return ''

    const entry: AutoRunLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      status: 'started',
      triggeredBy
    }

    this.autoRunLogs.push(entry)
    this.trimLogs()
    this.notifyListeners()

    this.consoleLog('info', `Auto-run started (triggered by: ${triggeredBy})`)

    return entry.id
  }

  logAutoRunComplete(startTime?: number): void {
    if (!this.shouldLog('info')) return

    const duration = startTime ? Date.now() - startTime : undefined

    const entry: AutoRunLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      status: 'completed',
      triggeredBy: 'package-install',
      duration
    }

    this.autoRunLogs.push(entry)
    this.trimLogs()
    this.notifyListeners()

    this.consoleLog('info', `Auto-run completed`, duration ? { duration: `${duration}ms` } : undefined)
  }

  logAutoRunSkipped(reason: string): void {
    if (!this.shouldLog('info')) return

    const entry: AutoRunLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      status: 'skipped',
      triggeredBy: 'package-install',
      error: reason
    }

    this.autoRunLogs.push(entry)
    this.trimLogs()
    this.notifyListeners()

    this.consoleLog('info', `Auto-run skipped: ${reason}`)
  }

  logAutoRunFailed(error: string): void {
    if (!this.shouldLog('error')) return

    const entry: AutoRunLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      status: 'failed',
      triggeredBy: 'package-install',
      error
    }

    this.autoRunLogs.push(entry)
    this.trimLogs()
    this.notifyListeners()

    this.consoleLog('error', `Auto-run failed`, { error })
  }

  // Query methods
  getInstallationLogs(filter?: { packageName?: string; status?: InstallationStatus }): InstallationLogEntry[] {
    let logs = [...this.installationLogs]
    
    if (filter?.packageName) {
      logs = logs.filter(log => log.packageName === filter.packageName)
    }
    if (filter?.status) {
      logs = logs.filter(log => log.status === filter.status)
    }
    
    return logs
  }

  getAutoRunLogs(filter?: { status?: AutoRunStatus }): AutoRunLogEntry[] {
    let logs = [...this.autoRunLogs]
    
    if (filter?.status) {
      logs = logs.filter(log => log.status === filter.status)
    }
    
    return logs
  }

  getRecentLogs(count: number = 10): { installation: InstallationLogEntry[]; autoRun: AutoRunLogEntry[] } {
    return {
      installation: this.installationLogs.slice(-count),
      autoRun: this.autoRunLogs.slice(-count)
    }
  }

  // Subscription for reactive updates
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Clear logs
  clearLogs(): void {
    this.installationLogs = []
    this.autoRunLogs = []
    this.notifyListeners()
    this.consoleLog('debug', 'Logs cleared')
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify({
      config: this.config,
      installationLogs: this.installationLogs,
      autoRunLogs: this.autoRunLogs,
      exportedAt: new Date().toISOString()
    }, null, 2)
  }
}

// Singleton instance
export const packageLogger = new PackageLogger()

// Convenience functions
export const logInstallStart = packageLogger.logInstallStart.bind(packageLogger)
export const logInstallSuccess = packageLogger.logInstallSuccess.bind(packageLogger)
export const logInstallFailure = packageLogger.logInstallFailure.bind(packageLogger)
export const logAutoRunPending = packageLogger.logAutoRunPending.bind(packageLogger)
export const logAutoRunStart = packageLogger.logAutoRunStart.bind(packageLogger)
export const logAutoRunComplete = packageLogger.logAutoRunComplete.bind(packageLogger)
export const logAutoRunSkipped = packageLogger.logAutoRunSkipped.bind(packageLogger)
export const logAutoRunFailed = packageLogger.logAutoRunFailed.bind(packageLogger)
