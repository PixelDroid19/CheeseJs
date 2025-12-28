// Centralized logging system
// Main logger (uses LogLevel as the canonical type)
export {
  logger,
  createLogger,
  Logger,
  NamespacedLogger,
  type LogLevel,
  type LogEntry,
  type LoggerConfig,
} from './logger';

// Package-specific logger (rename LogLevel to avoid conflict)
export {
  packageLogger,
  logInstallStart,
  logInstallSuccess,
  logInstallFailure,
  logAutoRunPending,
  logAutoRunStart,
  logAutoRunComplete,
  logAutoRunSkipped,
  logAutoRunFailed,
  type LogLevel as PackageLogLevel,
  type InstallationStatus,
  type AutoRunStatus,
  type InstallationLogEntry,
  type AutoRunLogEntry,
  type PackageLoggerConfig,
} from './packageLogger';
