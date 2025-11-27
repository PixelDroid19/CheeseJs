import { useCallback, useEffect, useRef } from 'react'

export function useDebouncedFunction<
  T extends (...args: Parameters<T>) => ReturnType<T>,
>(callback: T, delay: number): T {
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }

      timeoutIdRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )

  const cancel = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])

  return debouncedCallback as T
}
