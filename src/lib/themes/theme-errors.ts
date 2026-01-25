/**
 * Theme Errors
 *
 * Custom error types for the theme system.
 * Provides detailed error information for debugging and user feedback.
 */

// ============================================================================
// BASE THEME ERROR
// ============================================================================

/**
 * Base class for all theme-related errors
 */
export class ThemeError extends Error {
  public readonly code: string;
  public readonly themeId?: string;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: number;

  constructor(
    message: string,
    code: string,
    themeId?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ThemeError';
    this.code = code;
    this.themeId = themeId;
    this.details = details;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ThemeError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      themeId: this.themeId,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// ============================================================================
// SPECIFIC ERROR TYPES
// ============================================================================

/**
 * Error thrown when a theme fails to load
 */
export class ThemeLoadError extends ThemeError {
  public readonly path?: string;
  public readonly retryCount: number;
  public readonly originalError?: Error;

  constructor(
    themeId: string,
    message: string,
    options: {
      path?: string;
      retryCount?: number;
      originalError?: Error;
      details?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Failed to load theme '${themeId}': ${message}`,
      'THEME_LOAD_ERROR',
      themeId,
      options.details
    );
    this.name = 'ThemeLoadError';
    this.path = options.path;
    this.retryCount = options.retryCount ?? 0;
    this.originalError = options.originalError;
  }
}

/**
 * Error thrown when theme validation fails
 */
export class ThemeValidationError extends ThemeError {
  public readonly validationErrors: Array<{ path: string; message: string }>;

  constructor(
    themeId: string,
    validationErrors: Array<{ path: string; message: string }>,
    details?: Record<string, unknown>
  ) {
    const errorSummary = validationErrors
      .slice(0, 3)
      .map((e) => e.message)
      .join('; ');
    const more =
      validationErrors.length > 3
        ? ` (+${validationErrors.length - 3} more)`
        : '';

    super(
      `Theme '${themeId}' validation failed: ${errorSummary}${more}`,
      'THEME_VALIDATION_ERROR',
      themeId,
      details
    );
    this.name = 'ThemeValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Error thrown when a theme is not found
 */
export class ThemeNotFoundError extends ThemeError {
  public readonly availableThemes: string[];

  constructor(
    themeId: string,
    availableThemes: string[] = [],
    details?: Record<string, unknown>
  ) {
    super(`Theme '${themeId}' not found`, 'THEME_NOT_FOUND', themeId, details);
    this.name = 'ThemeNotFoundError';
    this.availableThemes = availableThemes;
  }

  getSuggestion(): string | null {
    if (this.availableThemes.length === 0) return null;

    // Simple similarity check
    const themeIdLower = this.themeId?.toLowerCase() ?? '';
    const similar = this.availableThemes.find(
      (t) =>
        t.toLowerCase().includes(themeIdLower) ||
        themeIdLower.includes(t.toLowerCase())
    );

    return similar ? `Did you mean '${similar}'?` : null;
  }
}

/**
 * Error thrown when theme application fails
 */
export class ThemeApplicationError extends ThemeError {
  public readonly phase: 'monaco' | 'css' | 'callback';
  public readonly originalError?: Error;

  constructor(
    themeId: string,
    phase: 'monaco' | 'css' | 'callback',
    message: string,
    originalError?: Error,
    details?: Record<string, unknown>
  ) {
    super(
      `Failed to apply theme '${themeId}' during ${phase} phase: ${message}`,
      'THEME_APPLICATION_ERROR',
      themeId,
      details
    );
    this.name = 'ThemeApplicationError';
    this.phase = phase;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when theme inheritance fails
 */
export class ThemeInheritanceError extends ThemeError {
  public readonly parentThemeId: string;
  public readonly inheritanceChain: string[];

  constructor(
    themeId: string,
    parentThemeId: string,
    message: string,
    inheritanceChain: string[] = [],
    details?: Record<string, unknown>
  ) {
    super(
      `Theme inheritance error for '${themeId}': ${message}`,
      'THEME_INHERITANCE_ERROR',
      themeId,
      details
    );
    this.name = 'ThemeInheritanceError';
    this.parentThemeId = parentThemeId;
    this.inheritanceChain = inheritanceChain;
  }

  hasCircularReference(): boolean {
    return this.message.includes('circular');
  }
}

/**
 * Error thrown when Monaco Editor is not available
 */
export class MonacoNotAvailableError extends ThemeError {
  constructor(
    operation: string,
    themeId?: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Monaco Editor not available for operation: ${operation}`,
      'MONACO_NOT_AVAILABLE',
      themeId,
      details
    );
    this.name = 'MonacoNotAvailableError';
  }
}

/**
 * Error thrown when CSS variable application fails
 */
export class CSSVariableError extends ThemeError {
  public readonly variableName: string;
  public readonly variableValue?: string;

  constructor(
    themeId: string,
    variableName: string,
    message: string,
    variableValue?: string,
    details?: Record<string, unknown>
  ) {
    super(
      `CSS variable error for '${variableName}': ${message}`,
      'CSS_VARIABLE_ERROR',
      themeId,
      details
    );
    this.name = 'CSSVariableError';
    this.variableName = variableName;
    this.variableValue = variableValue;
  }
}

/**
 * Error thrown during theme format conversion
 */
export class ThemeConversionError extends ThemeError {
  public readonly sourceFormat: string;
  public readonly targetFormat: string;

  constructor(
    themeId: string,
    sourceFormat: string,
    targetFormat: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Failed to convert theme '${themeId}' from ${sourceFormat} to ${targetFormat}: ${message}`,
      'THEME_CONVERSION_ERROR',
      themeId,
      details
    );
    this.name = 'ThemeConversionError';
    this.sourceFormat = sourceFormat;
    this.targetFormat = targetFormat;
  }
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Check if an error is a theme-related error
 */
export function isThemeError(error: unknown): error is ThemeError {
  return error instanceof ThemeError;
}

/**
 * Create a user-friendly error message
 */
export function getThemeErrorMessage(error: unknown): string {
  if (isThemeError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return `Theme error: ${error.message}`;
  }

  return 'An unknown theme error occurred';
}

/**
 * Get the error code for an error
 */
export function getThemeErrorCode(error: unknown): string {
  if (isThemeError(error)) {
    return error.code;
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Wrap an error in a ThemeError if it isn't already
 */
export function wrapAsThemeError(
  error: unknown,
  themeId?: string,
  operation?: string
): ThemeError {
  if (isThemeError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  return new ThemeError(
    operation ? `${operation}: ${message}` : message,
    'WRAPPED_ERROR',
    themeId,
    {
      originalError: error instanceof Error ? error.name : typeof error,
      operation,
    }
  );
}
