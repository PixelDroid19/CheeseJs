import { Component, ErrorInfo, ReactNode } from 'react'
import i18n from '../i18n'

interface Props {
  children: ReactNode
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

// Helper to get translations in class component
const t = (key: string, fallback: string) => i18n.t(key, { defaultValue: fallback })

class ErrorBoundary extends Component<Props, State> {
  constructor (props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError (_error: Error): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch (error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  render () {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error && this.state.errorInfo) {
        return this.props.fallback(this.state.error, this.state.errorInfo)
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-background">
          <div className="max-w-2xl w-full bg-card rounded-lg shadow-lg p-6 border border-destructive/50">
            <div className="flex items-center gap-3 mb-4">
              <svg
                className="w-8 h-8 text-destructive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="text-2xl font-bold text-destructive">
                {t('errors.title', 'Something went wrong')}
              </h2>
            </div>

            <div className="mb-4">
              <p className="text-foreground mb-2">
                {t('errors.description', 'An unexpected error occurred in the application. Please try reloading.')}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-md transition-colors"
              >
                {t('errors.reload', 'Reload Application')}
              </button>
            </div>

            {this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
                  {t('errors.details', 'Error Details')}
                </summary>
                <div className="mt-2 p-4 bg-muted rounded border border-border overflow-auto">
                  <p className="text-sm font-mono text-destructive mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
