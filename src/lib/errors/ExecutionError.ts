/**
 * Unified Execution Error System
 *
 * Provides consistent error handling across JavaScript and Python execution
 * with categorization, source mapping, and user-friendly messages.
 */

// ============================================================================
// ERROR CATEGORIES
// ============================================================================

export enum ErrorCategory {
  /** Syntax errors during parsing */
  SYNTAX = 'syntax',
  /** Runtime errors during execution */
  RUNTIME = 'runtime',
  /** Timeout errors */
  TIMEOUT = 'timeout',
  /** Memory limit exceeded */
  MEMORY = 'memory',
  /** Execution cancelled by user */
  CANCELLED = 'cancelled',
  /** Module/package not found */
  MODULE_NOT_FOUND = 'module_not_found',
  /** Transpilation errors */
  TRANSPILATION = 'transpilation',
  /** Worker communication errors */
  WORKER = 'worker',
  /** Unknown errors */
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  /** Informational - execution continued */
  INFO = 'info',
  /** Warning - execution continued with issues */
  WARNING = 'warning',
  /** Error - execution stopped */
  ERROR = 'error',
  /** Fatal - worker needs restart */
  FATAL = 'fatal',
}

// ============================================================================
// ERROR INTERFACES
// ============================================================================

export interface SourceLocation {
  /** Line number in original source (1-based) */
  line: number;
  /** Column number in original source (0-based) */
  column?: number;
  /** File name if applicable */
  file?: string;
}

export interface ErrorSuggestion {
  /** Short description of the fix */
  title: string;
  /** Detailed explanation */
  description?: string;
  /** Code snippet to fix the issue */
  code?: string;
  /** Link to documentation */
  docUrl?: string;
}

export interface SerializedExecutionError {
  name: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  language: 'javascript' | 'typescript' | 'python';
  originalMessage: string;
  friendlyMessage: string;
  location?: SourceLocation;
  suggestions: ErrorSuggestion[];
  stack?: string;
  timestamp: number;
}

// ============================================================================
// EXECUTION ERROR CLASS
// ============================================================================

export class ExecutionError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly language: 'javascript' | 'typescript' | 'python';
  public readonly originalMessage: string;
  public readonly friendlyMessage: string;
  public readonly location?: SourceLocation;
  public readonly suggestions: ErrorSuggestion[];
  public readonly timestamp: number;

  constructor(options: {
    name?: string;
    message: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    language?: 'javascript' | 'typescript' | 'python';
    location?: SourceLocation;
    suggestions?: ErrorSuggestion[];
    stack?: string;
  }) {
    const friendlyMessage = ExecutionError.createFriendlyMessage(
      options.message,
      options.category ?? ErrorCategory.UNKNOWN,
      options.language ?? 'javascript'
    );

    super(friendlyMessage);

    this.name = options.name ?? 'ExecutionError';
    this.category = options.category ?? ErrorCategory.UNKNOWN;
    this.severity = options.severity ?? ErrorSeverity.ERROR;
    this.language = options.language ?? 'javascript';
    this.originalMessage = options.message;
    this.friendlyMessage = friendlyMessage;
    this.location = options.location;
    this.suggestions = options.suggestions ?? [];
    this.timestamp = Date.now();

    if (options.stack) {
      this.stack = options.stack;
    }

    // Ensure prototype chain is correct
    Object.setPrototypeOf(this, ExecutionError.prototype);
  }

  /**
   * Create a user-friendly error message
   */
  private static createFriendlyMessage(
    message: string,
    category: ErrorCategory,
    language: string
  ): string {
    switch (category) {
      case ErrorCategory.TIMEOUT:
        return `Execution timed out. Try simplifying your code or breaking it into smaller parts.`;

      case ErrorCategory.MEMORY:
        return `Memory limit exceeded. Your code may be creating too many objects or infinite structures.`;

      case ErrorCategory.CANCELLED:
        return `Execution was cancelled.`;

      case ErrorCategory.MODULE_NOT_FOUND: {
        const moduleMatch = message.match(/['"]([^'"]+)['"]/);
        const moduleName = moduleMatch?.[1] ?? 'unknown';
        const packageManager = language === 'python' ? 'PyPI' : 'npm';
        return `Module "${moduleName}" not found. Install it via Settings → ${packageManager}.`;
      }

      case ErrorCategory.SYNTAX: {
        // Extract line number if present
        const lineMatch = message.match(/line (\d+)/i);
        const lineInfo = lineMatch ? ` on line ${lineMatch[1]}` : '';
        return `Syntax error${lineInfo}: ${ExecutionError.simplifyMessage(message)}`;
      }

      case ErrorCategory.TRANSPILATION:
        return `Transpilation failed: ${ExecutionError.simplifyMessage(message)}`;

      case ErrorCategory.WORKER:
        return `Code runner error. Please restart the application if this persists.`;

      default:
        return ExecutionError.simplifyMessage(message);
    }
  }

  /**
   * Simplify error message by removing stack traces and redundant info
   */
  private static simplifyMessage(message: string): string {
    // Remove Python tracebacks, keep only the last relevant line
    if (message.includes('Traceback')) {
      const lines = message.split('\n');
      const errorLines = lines.filter(
        (line) =>
          !line.trim().startsWith('File ') &&
          !line.trim().startsWith('Traceback') &&
          !line.includes('_pyodide') &&
          !line.includes('pyodide/') &&
          line.trim().length > 0
      );
      const lastError = errorLines.pop();
      return lastError ?? message;
    }

    // Remove Node.js internal stack frames
    if (message.includes('at ')) {
      const lines = message.split('\n');
      return lines[0] ?? message;
    }

    return message;
  }

  /**
   * Get emoji icon for this error
   */
  getIcon(): string {
    switch (this.category) {
      case ErrorCategory.SYNTAX:
        return '📝';
      case ErrorCategory.TIMEOUT:
        return '⏱️';
      case ErrorCategory.MEMORY:
        return '💾';
      case ErrorCategory.CANCELLED:
        return '🛑';
      case ErrorCategory.MODULE_NOT_FOUND:
        return '📦';
      case ErrorCategory.TRANSPILATION:
        return '🔧';
      case ErrorCategory.WORKER:
        return '🔌';
      default:
        return '❌';
    }
  }

  /**
   * Get formatted message with icon
   */
  getFormattedMessage(): string {
    return `${this.getIcon()} ${this.friendlyMessage}`;
  }

  /**
   * Serialize for IPC transfer
   */
  serialize(): SerializedExecutionError {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      language: this.language,
      originalMessage: this.originalMessage,
      friendlyMessage: this.friendlyMessage,
      location: this.location,
      suggestions: this.suggestions,
      stack: this.stack,
      timestamp: this.timestamp,
    };
  }

  /**
   * Create from serialized data
   */
  static deserialize(data: SerializedExecutionError): ExecutionError {
    return new ExecutionError({
      name: data.name,
      message: data.originalMessage,
      category: data.category,
      severity: data.severity,
      language: data.language,
      location: data.location,
      suggestions: data.suggestions,
      stack: data.stack,
    });
  }
}

// ============================================================================
// ERROR FACTORY FUNCTIONS
// ============================================================================

/**
 * Detect error category from error message and name
 */
export function detectErrorCategory(
  errorName: string,
  errorMessage: string,
  _language: 'javascript' | 'typescript' | 'python'
): ErrorCategory {
  const lowerMessage = errorMessage.toLowerCase();
  const lowerName = errorName.toLowerCase();

  // Timeout errors
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerName.includes('timeout')
  ) {
    return ErrorCategory.TIMEOUT;
  }

  // Cancellation errors
  if (
    lowerName === 'cancelerror' ||
    lowerName === 'keyboardinterrupt' ||
    lowerMessage.includes('cancelled') ||
    lowerMessage.includes('canceled') ||
    lowerMessage.includes('keyboardinterrupt')
  ) {
    return ErrorCategory.CANCELLED;
  }

  // Memory errors
  if (
    lowerMessage.includes('memory') ||
    lowerMessage.includes('heap') ||
    lowerName === 'rangeerror' ||
    lowerName === 'memoryerror'
  ) {
    return ErrorCategory.MEMORY;
  }

  // Module not found errors
  if (
    lowerName === 'modulenotfounderror' ||
    lowerMessage.includes('cannot find module') ||
    lowerMessage.includes('no module named') ||
    lowerMessage.includes('module not found')
  ) {
    return ErrorCategory.MODULE_NOT_FOUND;
  }

  // Syntax errors
  if (
    lowerName === 'syntaxerror' ||
    lowerName === 'indentationerror' ||
    lowerMessage.includes('unexpected token') ||
    lowerMessage.includes('unexpected identifier')
  ) {
    return ErrorCategory.SYNTAX;
  }

  // Transpilation errors
  if (
    lowerMessage.includes('transpilation') ||
    lowerMessage.includes('transform') ||
    lowerMessage.includes('babel') ||
    lowerMessage.includes('typescript')
  ) {
    return ErrorCategory.TRANSPILATION;
  }

  // Worker errors
  if (
    lowerMessage.includes('worker') ||
    lowerMessage.includes('not initialized') ||
    lowerMessage.includes('not available')
  ) {
    return ErrorCategory.WORKER;
  }

  // Runtime errors (default for most errors)
  return ErrorCategory.RUNTIME;
}

/**
 * Parse line number from error message or stack
 */
export function parseErrorLocation(
  errorMessage: string,
  stack?: string
): SourceLocation | undefined {
  // Try to extract from message
  const lineMatch =
    errorMessage.match(/line (\d+)/i) ?? errorMessage.match(/:(\d+):/);
  if (lineMatch) {
    const columnMatch = errorMessage.match(/:(\d+):(\d+)/);
    return {
      line: parseInt(lineMatch[1], 10),
      column: columnMatch ? parseInt(columnMatch[2], 10) : undefined,
    };
  }

  // Try to extract from stack trace
  if (stack) {
    // JavaScript stack: at functionName (file:line:column)
    const jsMatch = stack.match(/usercode\.js:(\d+):(\d+)/);
    if (jsMatch) {
      return {
        line: parseInt(jsMatch[1], 10),
        column: parseInt(jsMatch[2], 10),
        file: 'usercode.js',
      };
    }

    // Python stack: File "...", line X
    const pyMatch = stack.match(/line (\d+)/i);
    if (pyMatch) {
      return {
        line: parseInt(pyMatch[1], 10),
      };
    }
  }

  return undefined;
}

/**
 * Generate suggestions based on error type
 */
export function generateSuggestions(
  category: ErrorCategory,
  errorMessage: string,
  language: 'javascript' | 'typescript' | 'python'
): ErrorSuggestion[] {
  const suggestions: ErrorSuggestion[] = [];

  switch (category) {
    case ErrorCategory.MODULE_NOT_FOUND: {
      const moduleMatch = errorMessage.match(/['"]([^'"]+)['"]/);
      if (moduleMatch) {
        const moduleName = moduleMatch[1];
        suggestions.push({
          title: `Install ${moduleName}`,
          description:
            language === 'python'
              ? `Open Settings → PyPI and search for "${moduleName}"`
              : `Open Settings → npm and search for "${moduleName}"`,
        });
      }
      break;
    }

    case ErrorCategory.SYNTAX:
      suggestions.push({
        title: 'Check syntax',
        description:
          'Look for missing brackets, parentheses, quotes, or incorrect indentation.',
      });
      if (language === 'python') {
        suggestions.push({
          title: 'Check indentation',
          description: 'Python uses indentation to define code blocks.',
        });
      }
      break;

    case ErrorCategory.TIMEOUT:
      suggestions.push({
        title: 'Check for infinite loops',
        description: 'Make sure your loops have proper exit conditions.',
      });
      suggestions.push({
        title: 'Reduce computation',
        description: 'Try processing smaller datasets or fewer iterations.',
      });
      break;

    case ErrorCategory.MEMORY:
      suggestions.push({
        title: 'Check for memory leaks',
        description:
          'Avoid creating large arrays, objects, or recursive structures without limits.',
      });
      break;

    default:
      break;
  }

  return suggestions;
}

/**
 * Create ExecutionError from a raw error object
 */
export function createExecutionError(
  error: unknown,
  language: 'javascript' | 'typescript' | 'python' = 'javascript'
): ExecutionError {
  // Handle ExecutionError instances
  if (error instanceof ExecutionError) {
    return error;
  }

  // Handle Error instances
  if (error instanceof Error) {
    const category = detectErrorCategory(error.name, error.message, language);
    const location = parseErrorLocation(error.message, error.stack);
    const suggestions = generateSuggestions(category, error.message, language);

    return new ExecutionError({
      name: error.name,
      message: error.message,
      category,
      language,
      location,
      suggestions,
      stack: error.stack,
    });
  }

  // Handle serialized error objects
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    const name = String(errObj.name ?? 'Error');
    const message = String(errObj.message ?? String(error));
    const stack = typeof errObj.stack === 'string' ? errObj.stack : undefined;

    const category = detectErrorCategory(name, message, language);
    const location = parseErrorLocation(message, stack);
    const suggestions = generateSuggestions(category, message, language);

    return new ExecutionError({
      name,
      message,
      category,
      language,
      location,
      suggestions,
      stack,
    });
  }

  // Handle string errors
  if (typeof error === 'string') {
    const category = detectErrorCategory('Error', error, language);
    const location = parseErrorLocation(error);
    const suggestions = generateSuggestions(category, error, language);

    return new ExecutionError({
      message: error,
      category,
      language,
      location,
      suggestions,
    });
  }

  // Unknown error type
  return new ExecutionError({
    message: 'An unknown error occurred',
    category: ErrorCategory.UNKNOWN,
    language,
  });
}

/**
 * Check if an error should be displayed to the user
 * (filters out cancellation and internal errors)
 */
export function shouldDisplayError(error: ExecutionError): boolean {
  // Don't display cancellation errors
  if (error.category === ErrorCategory.CANCELLED) {
    return false;
  }

  // Always display syntax errors (they are user errors)
  if (error.category === ErrorCategory.SYNTAX) {
    return true;
  }

  // Don't display internal Pyodide errors
  if (
    error.originalMessage.includes('_pyodide') ||
    error.originalMessage.includes('pyodide/webloop')
  ) {
    return false;
  }

  return true;
}
