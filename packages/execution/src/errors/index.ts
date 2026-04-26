/**
 * Error handling module exports
 */

export {
  ExecutionError,
  ErrorCategory,
  ErrorSeverity,
  createExecutionError,
  detectErrorCategory,
  parseErrorLocation,
  generateSuggestions,
  shouldDisplayError,
  type SourceLocation,
  type ErrorSuggestion,
  type SerializedExecutionError,
} from './ExecutionError';
