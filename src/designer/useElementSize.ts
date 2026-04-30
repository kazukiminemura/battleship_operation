import { useCallback, useRef, useState } from 'react'

export function useElementSize<T extends HTMLElement>(initialSize: { width: number; height: number }) {
  const cleanupRef = useRef<(() => void) | null>(null)
  const [size, setSize] = useState(initialSize)

  const ref = useCallback((el: T | null) => {
    cleanupRef.current?.()
    cleanupRef.current = null
    if (!el) return

    const updateSize = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    window.addEventListener('resize', updateSize)
    cleanupRef.current = () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  return [ref, size] as const
}
