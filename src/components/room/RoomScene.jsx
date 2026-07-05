import RoomItem from './RoomItem.jsx'
import { SEASONS } from '../../data/roomCatalog.js'

// Background tint per season — a light wash, not a full illustration yet.
// Storm/winter stay muted rather than dark, in keeping with "gentle, never
// alarming" neglect/weather framing.
const SEASON_BG = {
  spring: 'from-brand-50 to-white',
  summer: 'from-amber-50 to-white',
  autumn: 'from-peach-400/10 to-white',
  winter: 'from-slate-100 to-white',
  storm: 'from-slate-200 to-white',
}

/**
 * The room itself: a grid of currently-placed items over a season-tinted
 * background. Unplaced/owned-but-stored items live in the shop, not here
 * (see DecorShop). v1 lays items out in array order rather than tracking
 * real slot coordinates — `item.slotId` is reserved for a future layout
 * step, not read yet.
 */
export default function RoomScene({ room, onTend }) {
  const placed = (room?.items || []).filter((it) => it.placed)
  const season = SEASONS[room?.season?.current] || SEASONS.spring
  const bg = SEASON_BG[room?.season?.current] || SEASON_BG.spring

  return (
    <div className={`rounded-3xl border border-slate-100 bg-gradient-to-b ${bg} p-6 sm:p-8`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink-900">Your room</h2>
        <span className="chip bg-white/80 text-ink-700 shadow-soft" title={season.hint}>
          {season.emoji} {season.label}
        </span>
      </div>

      {placed.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-500">
          Nothing placed yet — check the shop for things you've already unlocked.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {placed.map((item) => (
            <RoomItem key={item.id} item={item} onTend={onTend} />
          ))}
        </div>
      )}
    </div>
  )
}
