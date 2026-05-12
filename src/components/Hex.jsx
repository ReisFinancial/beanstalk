/**
 * A pointy-top hexagon with a bold charcoal border.
 *
 * Structure (3 absolutely-positioned layers inside a hex-aspect container):
 *   1. Charcoal backdrop  — full size, clip-path'd into a hex
 *   2. Colored body        — inset 3px so the charcoal shows as a border
 *   3. Remove button       — positioned inside the hex shape (touch-friendly)
 */
const TONES = {
  asset: {
    bg: 'bg-gradient-to-br from-brand-400 to-brand-600',
    tag: 'Asset',
    text: 'text-white',
  },
  liability: {
    bg: 'bg-gradient-to-br from-red-400 to-red-600',
    tag: 'Liability',
    text: 'text-white',
  },
  goal: {
    bg: 'bg-gradient-to-br from-slate-400 to-slate-600',
    tag: 'Goal',
    text: 'text-white',
  },
}

export default function Hex({
  tone = 'asset',
  title,
  subtitle,
  tag,
  icon,
  onClick,
  onRemove,
  as: As = 'div',
  animDelay,
}) {
  const t = TONES[tone] || TONES.asset
  const isButton = As === 'button'

  return (
    <div
      className="relative aspect-[1/1.155] group hex-entrance"
      style={animDelay != null ? { animationDelay: animDelay } : undefined}
    >
      {/* Charcoal border layer — full size */}
      <div className="absolute inset-0 hex-clip bg-slate-900" aria-hidden />

      {/* Colored body — inset so the charcoal shows as a border */}
      <As
        onClick={onClick}
        type={isButton ? 'button' : undefined}
        className={`
          absolute inset-[3px] hex-clip ${t.bg} ${t.text}
          flex flex-col items-center justify-center px-3 text-center
          transition-transform duration-150
          ${onClick ? 'hover:scale-[1.02] cursor-pointer' : ''}
          focus:outline-none focus:scale-[1.02]
        `}
      >
        {icon && <span className="text-2xl leading-none mb-1" aria-hidden>{icon}</span>}
        {(t.tag || tag) && (
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5">
            {tag || t.tag}
          </span>
        )}
        {title && (
          <span className="font-display text-[13px] sm:text-sm font-bold leading-tight line-clamp-2 max-w-[85%]">
            {title}
          </span>
        )}
        {subtitle && (
          <span className="text-[11px] font-semibold opacity-90 mt-0.5 line-clamp-1 max-w-[85%]">
            {subtitle}
          </span>
        )}
      </As>

      {/* Remove button — placed inside the hex's flat middle band so it sits
          on the colored body, not in the transparent corner that overlaps
          with a neighboring hex in the tight honeycomb. */}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute z-10 h-6 w-6 rounded-full bg-white text-slate-900
                     text-xs font-bold shadow-soft border border-slate-300
                     hover:bg-slate-50 focus:bg-slate-50 transition-colors"
          style={{ top: '28%', right: '12%' }}
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </div>
  )
}
