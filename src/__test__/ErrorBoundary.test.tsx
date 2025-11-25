import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../components/ErrorBoundary'

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render error UI when error occurs', () => {
    const ThrowError = () => {
      throw new Error('Test error')
    }

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Reload Application')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('should use custom fallback when provided', () => {
    const ThrowError = () => {
      throw new Error('Custom error')
    }

    const customFallback = (error: Error) => <div>Custom Error: {error.message}</div>

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom Error: Custom error')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })
})
