import { useState, useEffect, useRef, useCallback } from 'react'

export function useAutoFade(trigger: unknown, delay: number = 2000) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHoveringRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    const hasContent = trigger
      ? (Array.isArray(trigger) ? trigger.length > 0 : true)
      : false

    if (hasContent) {
      const rafId = requestAnimationFrame(() => setVisible(true))
      clearTimer()
      if (!isHoveringRef.current) {
        timerRef.current = setTimeout(() => setVisible(false), delay)
      }
      return () => {
        cancelAnimationFrame(rafId)
        clearTimer()
      }
    } else {
      const rafId = requestAnimationFrame(() => setVisible(false))
      return () => {
        cancelAnimationFrame(rafId)
        clearTimer()
      }
    }
  }, [trigger, delay, clearTimer])

  const onMouseEnter = useCallback(() => {
    isHoveringRef.current = true
    clearTimer()
    setVisible(true)
  }, [clearTimer])

  const onMouseLeave = useCallback(() => {
    isHoveringRef.current = false
    setVisible(false)
  }, [])

  return { visible, onMouseEnter, onMouseLeave }
}
