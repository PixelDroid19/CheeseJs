/**
 * InputTooltip Component
 * 
 * Floating input field that appears when Python code requests user input.
 * Positioned near the code line that called input().
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface InputRequest {
    id: string
    prompt: string
    line: number
}

interface InputTooltipProps {
    /** Callback to get line position from editor */
    getLineTop?: (line: number) => number | null
}

export function InputTooltip({ getLineTop }: InputTooltipProps) {
    const { t } = useTranslation()
    const [request, setRequest] = useState<InputRequest | null>(null)
    const [value, setValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    // Subscribe to input requests
    useEffect(() => {
        const unsubscribe = window.codeRunner?.onInputRequest((req) => {
            setRequest({
                id: req.id,
                prompt: req.data.prompt || t('input.defaultPrompt', 'Enter value:'),
                line: req.data.line
            })
            setValue('')
        })

        return () => {
            unsubscribe?.()
        }
    }, [t])

    // Focus input when request comes in
    useEffect(() => {
        if (request && inputRef.current) {
            inputRef.current.focus()
        }
    }, [request])

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault()
        if (request) {
            window.codeRunner?.sendInputResponse(request.id, value)
            setRequest(null)
            setValue('')
        }
    }, [request, value])

    const handleCancel = useCallback(() => {
        if (request) {
            window.codeRunner?.sendInputResponse(request.id, '')
            setRequest(null)
            setValue('')
        }
    }, [request])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSubmit()
        } else if (e.key === 'Escape') {
            handleCancel()
        }
    }, [handleSubmit, handleCancel])

    // Calculate position
    const getPosition = () => {
        if (!request || !getLineTop) {
            return { top: 100, left: 50 }
        }

        const lineTop = getLineTop(request.line)
        if (lineTop === null) {
            return { top: 100, left: 50 }
        }

        return {
            top: lineTop + 24, // Below the line
            left: 50 // Left margin
        }
    }

    const position = getPosition()

    return (
        <AnimatePresence>
            {request && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="fixed z-[100] rounded-lg shadow-2xl p-4 bg-card border border-border"
                    style={{
                        top: `${position.top}px`,
                        left: `${position.left}px`,
                        minWidth: '320px',
                        maxWidth: '500px'
                    }}
                >
                    {/* Prompt label */}
                    <div className="mb-3 flex items-center gap-2">
                        <span className="px-2 py-1 rounded text-xs font-mono font-semibold bg-primary text-primary-foreground">
                            input()
                        </span>
                        <span className="text-sm font-medium text-foreground">
                            {request.prompt}
                        </span>
                    </div>

                    {/* Input field */}
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('input.placeholder', 'Ingresa un valor...')}
                            className="flex-1 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-input border border-border text-foreground"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button
                            type="submit"
                            className="px-3 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                            title={t('input.submit', 'Enviar')}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-3 py-2 rounded bg-muted text-muted-foreground hover:opacity-80 transition-opacity"
                            title={t('input.cancel', 'Cancelar')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </form>

                    {/* Hint */}
                    <div className="text-xs mt-2 text-muted-foreground opacity-70">
                        {t('input.hint', 'Enter para enviar, Escape para cancelar')}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default InputTooltip

