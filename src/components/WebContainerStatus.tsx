import { useWebContainerStore } from '../store/useWebContainerStore'
import { AlertCircle, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { getDiagnosticSummary } from '../lib/webcontainer/WebContainerDiagnostics'
import { useTranslation } from 'react-i18next'

/**
 * WebContainerStatus Component
 * Displays the initialization status of WebContainer and provides retry functionality
 */
export function WebContainerStatus() {
    const { isLoading, error, diagnosticReport, retryBoot } = useWebContainerStore()
    const { t } = useTranslation()

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
            <div className="fixed bottom-4 right-4 max-w-md bg-destructive/90 backdrop-blur-sm border border-destructive rounded-lg p-4 shadow-lg z-50 text-destructive-foreground">
                <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-destructive-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-destructive-foreground mb-1">
                            {t('webcontainer.initError', 'Error initializing WebContainer')}
                        </h3>
                        <p className="text-xs text-destructive-foreground/90 mb-3">
                            {error.message}
                        </p>

                        {diagnosticReport && (
                            <details className="mb-3">
                                <summary className="text-xs text-destructive-foreground/80 cursor-pointer hover:text-destructive-foreground mb-2">
                                    {t('webcontainer.viewDiagnostics', 'View detailed diagnostics')}
                                </summary>
                                <pre className="text-xs text-destructive-foreground bg-black/20 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                    {getDiagnosticSummary(diagnosticReport)}
                                </pre>
                            </details>
                        )}

                        <button
                            onClick={() => retryBoot()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-background/20 hover:bg-background/30 text-destructive-foreground text-xs rounded transition-colors"
                        >
                            <RefreshCw className="w-3 h-3" />
                            {t('webcontainer.retry', 'Retry')}
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
    const { t } = useTranslation()

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                <span>{t('webcontainer.initializing', 'Initializing WebContainer...')}</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span>{t('webcontainer.notAvailable', 'WebContainer not available')}</span>
            </div>
        )
    }

    if (webContainer) {
        return (
            <div className="flex items-center gap-2 text-xs text-success">
                <CheckCircle className="w-3 h-3" />
                <span>{t('webcontainer.ready', 'WebContainer ready')}</span>
            </div>
        )
    }

    return null
}
