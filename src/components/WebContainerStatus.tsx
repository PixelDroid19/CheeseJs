import { useWebContainerStore } from '../store/useWebContainerStore'
import { AlertCircle, RefreshCw, CheckCircle, XCircle, Download, Loader2 } from 'lucide-react'
import { getDiagnosticSummary } from '../lib/webcontainer/WebContainerDiagnostics'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * WebContainerStatus Component
 * Displays the initialization status of WebContainer and provides retry functionality
 * Shows a non-blocking progress indicator during first-time download
 */
export function WebContainerStatus() {
    const { isLoading, isBootingInBackground, error, diagnosticReport, retryBoot, bootProgress, bootPercentage } = useWebContainerStore()
    const { t } = useTranslation()

    // Show progress indicator during background boot (non-blocking)
    if (isBootingInBackground && isLoading && !error) {
        return (
            <AnimatePresence>
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-4 right-4 max-w-sm bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg z-50"
                >
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            <Download className="w-5 h-5 text-primary animate-bounce" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground mb-1">
                                {t('webcontainer.downloading', 'Setting up runtime environment')}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-2">
                                {bootProgress}
                            </p>
                            
                            {/* Progress bar */}
                            <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                                <motion.div 
                                    className="bg-primary h-1.5 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${bootPercentage}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                            </div>
                            
                            <p className="text-xs text-muted-foreground/70">
                                {t('webcontainer.canUseEditor', 'You can start writing code while this completes')}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        )
    }

    // Don't show anything if loading successfully (after background phase)
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
    const { isLoading, error, webContainer, bootPercentage, isBootingInBackground } = useWebContainerStore()
    const { t } = useTranslation()

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isBootingInBackground ? (
                    <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{t('webcontainer.downloading', 'Downloading')} ({bootPercentage}%)</span>
                    </>
                ) : (
                    <>
                        <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                        <span>{t('webcontainer.initializing', 'Initializing WebContainer...')}</span>
                    </>
                )}
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
