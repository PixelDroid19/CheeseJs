/**
 * WebContainer Diagnostics Utility
 * Provides comprehensive health checks and diagnostics for WebContainer initialization
 */

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
            message: 'La aplicación no está aislada de origen cruzado (crossOriginIsolated = false)',
            solution:
                'WebContainer requiere que los headers COOP y COEP estén configurados correctamente. ' +
                'Verifica que el servidor esté enviando:\n' +
                '- Cross-Origin-Embedder-Policy: require-corp\n' +
                '- Cross-Origin-Opener-Policy: same-origin'
        }
    }

    return {
        passed: true,
        severity: 'info',
        message: 'Aislamiento de origen cruzado habilitado correctamente'
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
            message: `Características del navegador no soportadas: ${missingFeatures.join(', ')}`,
            solution:
                'WebContainer requiere un navegador moderno con soporte para SharedArrayBuffer, ' +
                'WebAssembly y Workers. Actualiza tu navegador o usa Chrome/Edge/Firefox recientes.'
        }
    }

    return {
        passed: true,
        severity: 'info',
        message: 'Todas las características del navegador requeridas están disponibles'
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
            message: 'Headers COOP/COEP no configurados correctamente',
            solution:
                'Asegúrate de que vite.config.ts incluya:\n' +
                'server.headers["Cross-Origin-Embedder-Policy"] = "require-corp"\n' +
                'server.headers["Cross-Origin-Opener-Policy"] = "same-origin"'
        }
    }

    return {
        passed: true,
        severity: 'info',
        message: 'Headers HTTP configurados correctamente'
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
            message: 'Conectividad de red a WebContainer CDN verificada'
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return {
                passed: false,
                severity: 'warning',
                message: 'Timeout al conectar con WebContainer CDN',
                solution:
                    'Verifica tu conexión a internet. WebContainer requiere acceso a sus servidores ' +
                    'para cargar recursos necesarios. Si estás detrás de un firewall o proxy, ' +
                    'asegúrate de que los dominios *.webcontainer.io estén permitidos.'
            }
        }

        return {
            passed: false,
            severity: 'warning',
            message: `Error de conectividad de red: ${error instanceof Error ? error.message : 'Unknown error'}`,
            solution:
                'Verifica tu conexión a internet y que no haya bloqueos de firewall ' +
                'para los dominios de WebContainer (*.webcontainer.io, *.stackblitz.com)'
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
    const lines: string[] = ['=== Diagnóstico de WebContainer ===\n']

    Object.entries(report.checks).forEach(([name, result]) => {
        const icon = result.passed ? '✅' : result.severity === 'warning' ? '⚠️' : '❌'
        lines.push(`${icon} ${name}: ${result.message}`)

        if (result.solution) {
            lines.push(`   Solución: ${result.solution}\n`)
        }
    })

    lines.push(`\nEstado general: ${report.overall ? 'APTO ✅' : 'REQUIERE ATENCIÓN ❌'}`)

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
