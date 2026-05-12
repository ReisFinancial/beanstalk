import { useEffect, useRef, useState } from 'react'

/**
 * Animates from 0 → target over `duration` ms using an ease-out cubic curve.
 * Returns the current animated value as a number.
 * Pass null/undefined to skip animation and return 0.
 */
export function useCountUp(target, duration = 750) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) {
      setValue(0)
      return
    }
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setValue(Math.round(target * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}
