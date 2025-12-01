/**
 * WebContainer Diagnostics Utility
 * Provides comprehensive health checks and diagnostics for WebContainer initialization
 */

import i18n from '../../i18n'

// Helper function to get translation
const t = (key: string, fallback?: string, options?: Record<string, string>) => {
    return i18n.t(key, { defaultValue: fallback, ...options })
}

export interface DiagnosticResult {
    passed: boolean;
    message: string;
    solution?: string;
    severity: 'error' | 'warning' | 'info';
}

export interface DiagnosticReport {
    overall: boolean;
    checks: {
        crossOriginIsolated: DiagnosticResult;
        headers: DiagnosticResult;
        browserSupport: DiagnosticResult;
        networkConnectivity: DiagnosticResult;
    };
    timestamp: number;
}

/**
 * Check if the environment is cross-origin isolated
 */
function checkCrossOriginIsolation(): DiagnosticResult {
    const isIsolated = window.crossOriginIsolated

    if (!isIsolated) {
        return {
            passed: false,
            severity: 'error',
            message: t('diagnostics.crossOriginIsolated.fail', 'Application is not cross-origin isolated (crossOriginIsolated = false)'),
            solution: t('diagnostics.crossOriginIsolated.failSolution', 'WebContainer requires COOP and COEP headers to be configured correctly.')
        }
    }

    return {
        passed: true,
        severity: 'info',
        message: t('diagnostics.crossOriginIsolated.pass', 'Cross-origin isolation enabled correctly')
    }
}

/**
 * Check browser support for required features
 */
function checkBrowserSupport(): DiagnosticResult {
    const requiredFeatures = {
        SharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        WebAssembly: typeof WebAssembly !== 'undefined',
        Worker: typeof Worker !== 'undefined',
        SharedWorker: typeof SharedWorker !== 'undefined'
    }

    const missingFeatures = Object.entries(requiredFeatures)
        .filter(([, supported]) => !supported)
        .map(([feature]) => feature)

    if (missingFeatures.length > 0) {
        return {
            passed: false,
            severity: 'error',
            message: t('diagnostics.browserSupport.fail', `Unsupported browser features: ${missingFeatures.join(', ')}`, { features: missingFeatures.join(', ') }),
            solution: t('diagnostics.browserSupport.failSolution', 'WebContainer requires a modern browser with SharedArrayBuffer, WebAssembly and Workers support.')
        }
    }

    return {
        passed: true,
        severity: 'info',
        message: t('diagnostics.browserSupport.pass', 'All required browser features are available')
    }
}

/**
 * Check HTTP headers configuration
 */
function checkHeaders(): DiagnosticResult {
    // In a real scenario, we can't directly check response headers from JavaScript
    // But we can infer from crossOriginIsolated status
    if (!window.crossOriginIsolated) {
        return {
            passed: false,
            severity: 'error',
            message: t('diagnostics.headers.fail', 'COOP/COEP headers not configured correctly'),
            solution: t('diagnostics.headers.failSolution', 'Make sure vite.config.ts includes the required headers.')
        }
    }

    return {
        passed: true,
        severity: 'info',
        message: t('diagnostics.headers.pass', 'HTTP headers configured correctly')
    }
}

/**
 * Check network connectivity to WebContainer CDN
 */
async function checkNetworkConnectivity(): Promise<DiagnosticResult> {
    try {
        // Try to fetch a known WebContainer resource
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        await fetch('https://webcontainer.io', {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'no-cors' // We just want to check if we can reach it
        })

        clearTimeout(timeoutId)

        return {
            passed: true,
            severity: 'info',
            message: t('diagnostics.network.pass', 'Network connectivity to WebContainer CDN verified')
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return {
                passed: false,
                severity: 'warning',
                message: t('diagnostics.network.timeout', 'Timeout connecting to WebContainer CDN'),
                solution: t('diagnostics.network.timeoutSolution', 'Check your internet connection.')
            }
        }

        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        return {
            passed: false,
            severity: 'warning',
            message: t('diagnostics.network.fail', `Network connectivity error: ${errorMsg}`, { error: errorMsg }),
            solution: t('diagnostics.network.failSolution', 'Check your internet connection and firewall settings.')
        }
    }
}

/**
 * Run all diagnostic checks
 */
export async function runDiagnostics(): Promise<DiagnosticReport> {
    const checks = {
        crossOriginIsolated: checkCrossOriginIsolation(),
        headers: checkHeaders(),
        browserSupport: checkBrowserSupport(),
        networkConnectivity: await checkNetworkConnectivity()
    }

    const overall = Object.values(checks).every(
        check => check.passed || check.severity === 'warning'
    )

    return {
        overall,
        checks,
        timestamp: Date.now()
    }
}

/**
 * Get a human-readable diagnostic summary
 */
export function getDiagnosticSummary(report: DiagnosticReport): string {
    const title = t('diagnostics.title', 'WebContainer Diagnostics')
    const lines: string[] = [`=== ${title} ===\n`]

    Object.entries(report.checks).forEach(([name, result]) => {
        const icon = result.passed ? '✅' : result.severity === 'warning' ? '⚠️' : '❌'
        lines.push(`${icon} ${name}: ${result.message}`)

        if (result.solution) {
            const solutionLabel = t('diagnostics.solution', 'Solution')
            lines.push(`   ${solutionLabel}: ${result.solution}\n`)
        }
    })

    const overallStatus = report.overall 
        ? t('diagnostics.overallPass', 'READY') + ' ✅'
        : t('diagnostics.overallFail', 'REQUIRES ATTENTION') + ' ❌'
    lines.push(`\n${overallStatus}`)

    return lines.join('\n')
}

/**
 * Check if WebContainer can be initialized based on diagnostics
 */
export async function canInitializeWebContainer(): Promise<{
    canInitialize: boolean;
    report: DiagnosticReport;
}> {
    const report = await runDiagnostics()

    // We can initialize if all critical checks pass
    // Network connectivity warnings are acceptable
    const canInitialize =
        report.checks.crossOriginIsolated.passed &&
        report.checks.headers.passed &&
        report.checks.browserSupport.passed

    return { canInitialize, report }
}
