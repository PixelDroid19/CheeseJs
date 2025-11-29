import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runDiagnostics, getDiagnosticSummary, canInitializeWebContainer } from '../lib/webcontainer/WebContainerDiagnostics'

// Mock window.crossOriginIsolated
const mockCrossOriginIsolated = (value: boolean) => {
    Object.defineProperty(window, 'crossOriginIsolated', {
        writable: true,
        configurable: true,
        value
    })
}

// Mock fetch
global.fetch = vi.fn()

describe('WebContainerDiagnostics', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('runDiagnostics', () => {
        it('should pass all checks when environment is properly configured', async () => {
            mockCrossOriginIsolated(true)

                // Mock successful network check
                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
                    ok: true
                })

            const report = await runDiagnostics()

            expect(report.overall).toBe(true)
            expect(report.checks.crossOriginIsolated.passed).toBe(true)
            expect(report.checks.headers.passed).toBe(true)
            expect(report.checks.browserSupport.passed).toBe(true)
        })

        it('should fail when crossOriginIsolated is false', async () => {
            mockCrossOriginIsolated(false)

            const report = await runDiagnostics()

            expect(report.checks.crossOriginIsolated.passed).toBe(false)
            expect(report.checks.crossOriginIsolated.severity).toBe('error')
            expect(report.checks.crossOriginIsolated.solution).toBeDefined()
        })

        it('should handle network connectivity issues gracefully', async () => {
            mockCrossOriginIsolated(true)

                // Mock network failure
                ; (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

            const report = await runDiagnostics()

            expect(report.checks.networkConnectivity.passed).toBe(false)
            expect(report.checks.networkConnectivity.severity).toBe('warning')
        })

        it('should handle network timeout', async () => {
            mockCrossOriginIsolated(true)

            // Mock timeout
            const abortError = new Error('Aborted')
            abortError.name = 'AbortError'
                ; (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError)

            const report = await runDiagnostics()

            expect(report.checks.networkConnectivity.passed).toBe(false)
            expect(report.checks.networkConnectivity.message).toContain('Timeout')
        })
    })

    describe('getDiagnosticSummary', () => {
        it('should generate a readable summary', async () => {
            mockCrossOriginIsolated(true)
                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

            const report = await runDiagnostics()
            const summary = getDiagnosticSummary(report)

            expect(summary).toContain('Diagnóstico de WebContainer')
            expect(summary).toContain('✅')
            expect(summary).toContain('APTO')
        })

        it('should include solutions for failed checks', async () => {
            mockCrossOriginIsolated(false)

            const report = await runDiagnostics()
            const summary = getDiagnosticSummary(report)

            expect(summary).toContain('Solución:')
            expect(summary).toContain('REQUIERE ATENCIÓN')
        })
    })

    describe('canInitializeWebContainer', () => {
        it('should return true when all critical checks pass', async () => {
            mockCrossOriginIsolated(true)
                ; (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

            const result = await canInitializeWebContainer()

            expect(result.canInitialize).toBe(true)
        })

        it('should return false when critical checks fail', async () => {
            mockCrossOriginIsolated(false)

            const result = await canInitializeWebContainer()

            expect(result.canInitialize).toBe(false)
        })

        it('should allow initialization despite network warnings', async () => {
            mockCrossOriginIsolated(true)
                ; (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

            const result = await canInitializeWebContainer()

            // Network connectivity is a warning, not a blocker
            expect(result.canInitialize).toBe(true)
        })
    })
})
