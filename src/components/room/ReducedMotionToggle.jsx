const OPTIONS = [
  { id: 'system', label: 'Auto' },
  { id: 'on', label: 'Reduced' },
  { id: 'off', label: 'Full' },
]

/**
 * Three-way control for room.settings.reducedMotion. 'Auto' follows the
 * OS-level prefers-reduced-motion setting; 'Reduced'/'Full' override it
 * either way (see hooks/useReducedMotion.js).
 */
export default function ReducedMotionToggle({ value, onChange }) {
  const current = value || 'system'
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={current === opt.id}
          className={`rounded-full px-3 py-1 transition-colors ${
            current === opt.id
              ? 'bg-white text-ink-900 shadow-soft'
              : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
