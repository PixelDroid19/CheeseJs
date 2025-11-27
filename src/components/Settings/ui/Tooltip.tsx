import { useState, useRef, useId, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { useThemeColors } from '../../../hooks/useThemeColors'

interface TooltipProps {
  content: string
  children: React.ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [position, setPosition] = useState<'left' | 'right' | 'top' | 'bottom'>('left')
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipId = useId()
  const colors = useThemeColors()

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const tooltipWidth = 256
      const tooltipHeight = 100
      const padding = 12

      const spaceLeft = rect.left
      const spaceRight = window.innerWidth - rect.right
      const spaceTop = rect.top

      let newPosition: 'left' | 'right' | 'top' | 'bottom' = 'left'

      if (spaceLeft > tooltipWidth + padding) {
        newPosition = 'left'
      } else if (spaceRight > tooltipWidth + padding) {
        newPosition = 'right'
      } else if (spaceTop > tooltipHeight + padding) {
        newPosition = 'top'
      } else {
        newPosition = 'bottom'
      }

      setPosition(newPosition)

      let top = 0
      let left = 0

      switch (newPosition) {
        case 'left':
          top = rect.top + rect.height / 2
          left = rect.left - padding
          break
        case 'right':
          top = rect.top + rect.height / 2
          left = rect.right + padding
          break
        case 'top':
          top = rect.top - padding
          left = rect.left + rect.width / 2
          break
        case 'bottom':
          top = rect.bottom + padding
          left = rect.left + rect.width / 2
          break
      }

      setCoords({ top, left })
    }
  }

  useEffect(() => {
    if (isVisible) {
      requestAnimationFrame(() => updatePosition())
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
    }
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isVisible])

  return (
    <>
      <div 
        className="relative flex items-center outline-none rounded-full" 
        onMouseEnter={() => { setIsVisible(true); updatePosition(); }}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => { setIsVisible(true); updatePosition(); }}
        onBlur={() => setIsVisible(false)}
        tabIndex={0}
        aria-describedby={isVisible ? tooltipId : undefined}
        ref={triggerRef}
      >
        {children}
      </div>
      {isVisible && createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              id={tooltipId}
              role="tooltip"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{ 
                top: coords.top, 
                left: coords.left,
                position: 'fixed'
              }}
              className={clsx(
                "z-[200] p-3 text-xs rounded-lg shadow-xl w-64 whitespace-normal pointer-events-none border",
                colors.isDark ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-200 text-gray-700",
                position === 'left' ? '-translate-y-1/2 -translate-x-full' : '',
                position === 'right' ? '-translate-y-1/2' : '',
                position === 'top' ? '-translate-x-1/2 -translate-y-full' : '',
                position === 'bottom' ? '-translate-x-1/2' : ''
              )}
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
