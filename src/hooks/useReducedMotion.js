import { useEffect, useState } from 'react'
import { usePlanner } from '../context/PlannerContext.jsx'

function systemPrefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/**
 * Resolves room.settings.reducedMotion ('system' | 'on' | 'off') against the
 * OS-level media query. 'system' tracks prefers-reduced-motion live, so
 * toggling it at the OS level while the app is open takes effect
 * immediately; 'on'/'off' override it either way.
 */
export function useReducedMotion() {
  const { profile } = usePlanner()
  const mode = profile?.room?.settings?.reducedMotion || 'system'
  const [systemReduced, setSystemReduced] = useState(systemPrefersReducedMotion)

  useEffect(() => {
    if (!window.matchMedia) return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setSystemReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  if (mode === 'on') return true
  if (mode === 'off') return false
  return systemReduced
}
