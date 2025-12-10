import { useCallback } from 'react';
import { AlertTriangle, RefreshCw, Code, Terminal } from 'lucide-react';

// ============================================================================
// SHARED STYLES
// ============================================================================

const fallbackContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '200px',
    padding: '24px',
    backgroundColor: 'var(--bg-secondary, #1e1e1e)',
    borderRadius: '8px',
    color: 'var(--text-primary, #e0e0e0)',
    textAlign: 'center',
    gap: '16px'
}

const iconContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(239, 68, 68, 0.1)'
}

const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
    color: 'var(--text-primary, #e0e0e0)'
}

const messageStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--text-secondary, #a0a0a0)',
    margin: 0,
    maxWidth: '400px'
}

const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: 'var(--accent-color, #3b82f6)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
}

// ============================================================================
// EDITOR FALLBACK
// ============================================================================

interface EditorFallbackProps {
    onRetry?: () => void
    error?: Error | null
}

export function EditorFallback({ onRetry, error }: EditorFallbackProps) {
    const handleRetry = useCallback(() => {
        if (onRetry) {
            onRetry()
        } else {
            // Force page reload as last resort
            window.location.reload()
        }
    }, [onRetry])

    return (
        <div style={fallbackContainerStyle}>
            <div style={iconContainerStyle}>
                <Code size={32} color="#ef4444" />
            </div>
            <h3 style={titleStyle}>Editor Error</h3>
            <p style={messageStyle}>
                The code editor encountered an unexpected error.
                {error && (
                    <span style={{ display: 'block', marginTop: '8px', opacity: 0.7, fontSize: '12px' }}>
                        {error.message}
                    </span>
                )}
            </p>
            <button
                style={buttonStyle}
                onClick={handleRetry}
                onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-hover, #2563eb)'
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-color, #3b82f6)'
                }}
            >
                <RefreshCw size={16} />
                Reload Editor
            </button>
        </div>
    )
}

// ============================================================================
// RESULT FALLBACK
// ============================================================================

interface ResultFallbackProps {
    onRetry?: () => void
    error?: Error | null
}

export function ResultFallback({ onRetry, error }: ResultFallbackProps) {
    const handleRetry = useCallback(() => {
        if (onRetry) {
            onRetry()
        }
    }, [onRetry])

    return (
        <div style={fallbackContainerStyle}>
            <div style={iconContainerStyle}>
                <Terminal size={32} color="#ef4444" />
            </div>
            <h3 style={titleStyle}>Output Error</h3>
            <p style={messageStyle}>
                The output panel encountered an error while rendering results.
                {error && (
                    <span style={{ display: 'block', marginTop: '8px', opacity: 0.7, fontSize: '12px' }}>
                        {error.message}
                    </span>
                )}
            </p>
            {onRetry && (
                <button
                    style={buttonStyle}
                    onClick={handleRetry}
                    onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent-hover, #2563eb)'
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent-color, #3b82f6)'
                    }}
                >
                    <RefreshCw size={16} />
                    Retry
                </button>
            )}
        </div>
    )
}

// ============================================================================
// GENERIC FALLBACK
// ============================================================================

interface GenericFallbackProps {
    title?: string
    message?: string
    onRetry?: () => void
    error?: Error | null
}

export function GenericFallback({
    title = 'Something went wrong',
    message = 'An unexpected error occurred.',
    onRetry,
    error
}: GenericFallbackProps) {
    const handleRetry = useCallback(() => {
        if (onRetry) {
            onRetry()
        } else {
            window.location.reload()
        }
    }, [onRetry])

    return (
        <div style={fallbackContainerStyle}>
            <div style={iconContainerStyle}>
                <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h3 style={titleStyle}>{title}</h3>
            <p style={messageStyle}>
                {message}
                {error && (
                    <span style={{ display: 'block', marginTop: '8px', opacity: 0.7, fontSize: '12px' }}>
                        {error.message}
                    </span>
                )}
            </p>
            <button
                style={buttonStyle}
                onClick={handleRetry}
                onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-hover, #2563eb)'
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-color, #3b82f6)'
                }}
            >
                <RefreshCw size={16} />
                Retry
            </button>
        </div>
    )
}
