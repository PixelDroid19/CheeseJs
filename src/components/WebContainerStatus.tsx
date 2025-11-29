import { useWebContainerStore } from '../store/useWebContainerStore'
import { AlertCircle, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { getDiagnosticSummary } from '../lib/webcontainer/WebContainerDiagnostics'

/**
 * WebContainerStatus Component
 * Displays the initialization status of WebContainer and provides retry functionality
 */
export function WebContainerStatus() {
    const { isLoading, error, diagnosticReport, retryBoot } = useWebContainerStore()

    // Don't show anything if loading successfully
    if (isLoading && !error) {
        return null
    }

    // Don't show anything if everything is working
    if (!isLoading && !error) {
        return null
    }

    // Show error state
    if (error) {
        return (
            <div className="fixed bottom-4 right-4 max-w-md bg-red-900/90 backdrop-blur-sm border border-red-700 rounded-lg p-4 shadow-lg z-50">
                <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-red-100 mb-1">
                            Error al inicializar WebContainer
                        </h3>
                        <p className="text-xs text-red-200 mb-3">
                            {error.message}
                        </p>

                        {diagnosticReport && (
                            <details className="mb-3">
                                <summary className="text-xs text-red-300 cursor-pointer hover:text-red-200 mb-2">
                                    Ver diagnósticos detallados
                                </summary>
                                <pre className="text-xs text-red-200 bg-red-950/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                    {getDiagnosticSummary(diagnosticReport)}
                                </pre>
                            </details>
                        )}

                        <button
                            onClick={() => retryBoot()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition-colors"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Reintentar
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return null
}

/**
 * Inline WebContainer Status Indicator
 * Can be used in the UI to show current status
 */
export function WebContainerStatusIndicator() {
    const { isLoading, error, webContainer } = useWebContainerStore()

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span>Inicializando WebContainer...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                <span>WebContainer no disponible</span>
            </div>
        )
    }

    if (webContainer) {
        return (
            <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle className="w-3 h-3" />
                <span>WebContainer listo</span>
            </div>
        )
    }

    return null
}
