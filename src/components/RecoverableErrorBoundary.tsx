import { Component, ErrorInfo, ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ErrorBoundaryConfig {
  maxRetries: number;
  baseRetryDelay: number; // ms
  shouldRecover: boolean;
  logErrors: boolean;
}

interface RecoverableErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  config?: Partial<ErrorBoundaryConfig>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface RecoverableErrorBoundaryState {
  hasError: boolean;
  retryCount: number;
  lastError: Error | null;
}

// ============================================================================
// RECOVERABLE ERROR BOUNDARY
// ============================================================================

export class RecoverableErrorBoundary extends Component<
  RecoverableErrorBoundaryProps,
  RecoverableErrorBoundaryState
> {
  private config: ErrorBoundaryConfig;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: RecoverableErrorBoundaryProps) {
    super(props);

    this.config = {
      maxRetries: props.config?.maxRetries ?? 3,
      baseRetryDelay: props.config?.baseRetryDelay ?? 1000,
      shouldRecover: props.config?.shouldRecover ?? true,
      logErrors: props.config?.logErrors ?? true,
    };

    this.state = {
      hasError: false,
      retryCount: 0,
      lastError: null,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<RecoverableErrorBoundaryState> {
    return { hasError: true, lastError: error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const componentName = this.props.componentName ?? 'Unknown';

    // Log error if configured
    if (this.config.logErrors) {
      console.error(`[ErrorBoundary:${componentName}] Error caught:`, error);
      console.error(
        `[ErrorBoundary:${componentName}] Component stack:`,
        errorInfo.componentStack
      );
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Attempt auto-recovery if configured
    if (
      this.config.shouldRecover &&
      this.state.retryCount < this.config.maxRetries
    ) {
      this.scheduleRecovery();
    }
  }

  private scheduleRecovery(): void {
    // Clear any existing retry timeout
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    // Calculate delay with exponential backoff
    const delay =
      this.config.baseRetryDelay * Math.pow(2, this.state.retryCount);

    this.retryTimeout = setTimeout(() => {
      this.setState((prevState) => ({
        hasError: false,
        retryCount: prevState.retryCount + 1,
      }));
    }, delay);
  }

  componentWillUnmount(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  /**
   * Force a recovery attempt
   */
  forceRecovery = (): void => {
    this.setState({
      hasError: false,
      retryCount: 0,
      lastError: null,
    });
  };

  /**
   * Reset error state completely
   */
  reset = (): void => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.setState({
      hasError: false,
      retryCount: 0,
      lastError: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default RecoverableErrorBoundary;
