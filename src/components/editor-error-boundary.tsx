import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class EditorErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError (error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch (error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Editor:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  public render () {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-950 p-4 text-zinc-400">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-6 w-6" />
            <h2 className="text-lg font-semibold">Editor crashed</h2>
          </div>
          <p className="max-w-md text-center text-sm">
            Something went wrong with the code editor. This might be due to a complex operation or an internal error.
          </p>
          {this.state.error && (
            <pre className="max-w-md overflow-auto rounded bg-zinc-900 p-2 text-xs text-red-300">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
