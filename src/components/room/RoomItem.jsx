import { decayCareLevel, careState } from '../../utils/room.js'
import { catalogEntry } from '../../data/roomCatalog.js'

// Only plants and pets need tending — decor is static furniture and food is
// a one-off cosmetic flourish, neither decays.
const TENDABLE_KINDS = new Set(['plant', 'pet'])

// Deliberately muted rather than alarming for `wilted` — neglect here means
// "hasn't been visited in a while," not a warning about money, so it
// shouldn't borrow the red "bad" tone used elsewhere for financial alerts.
const CARE_STYLES = {
  thriving: { ring: 'ring-brand-200', chip: 'bg-brand-50 text-brand-700', badge: '💧 Thriving' },
  okay:     { ring: 'ring-amber-200', chip: 'bg-amber-50 text-amber-700', badge: '🌤️ Could use water' },
  wilted:   { ring: 'ring-slate-300', chip: 'bg-slate-100 text-ink-500',  badge: '🥀 Needs a little care' },
}

/**
 * A single plant/decor/pet/food tile. Care level is derived from
 * `item.lastTendedAt` at render time (see utils/room.js) rather than read
 * from stored state, so it always reflects "right now."
 */
export default function RoomItem({ item, onTend }) {
  const entry = catalogEntry(item.kind, item.speciesId)
  const label = entry?.label || item.kind
  const emoji = entry?.emoji || '❔'
  const tendable = TENDABLE_KINDS.has(item.kind)
  const state = tendable ? careState(decayCareLevel(item)) : null
  const style = state ? CARE_STYLES[state] : null

  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-3xl border border-slate-100 bg-white
        p-4 text-center shadow-soft ring-2 ${style ? style.ring : 'ring-transparent'}`}
    >
      <span
        className={`text-3xl leading-none ${state === 'wilted' ? 'opacity-60 grayscale' : ''}`}
        aria-hidden
      >
        {emoji}
      </span>
      <span className="font-display text-xs font-bold leading-tight text-ink-900">{label}</span>

      {style && (
        <span className={`chip ${style.chip}`}>{style.badge}</span>
      )}

      {tendable && state !== 'thriving' && onTend && (
        <button
          type="button"
          onClick={() => onTend(item.id)}
          className="mt-1 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold text-white
            shadow-soft transition-colors hover:bg-brand-600"
        >
          {item.kind === 'pet' ? 'Feed' : 'Water'}
        </button>
      )}
    </div>
  )
}
