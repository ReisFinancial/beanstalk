import { catalogEntry } from '../../data/roomCatalog.js'

const KIND_LABEL = { plant: 'Plant', decor: 'Decor', pet: 'Pet', food: 'Treat' }

/**
 * Spend care points to place something you've already unlocked. Items land
 * here (unplaced) the moment they're unlocked — see PlannerContext's
 * unlockRoomItem — and move into RoomScene once bought. v1 doesn't track
 * real slot coordinates, so `onBuy` places items without a specific spot
 * (see RoomScene's array-order layout note).
 */
export default function DecorShop({ room, onBuy }) {
  const carePoints = room?.carePoints ?? 0
  const inventory = (room?.items || []).filter((it) => !it.placed)

  if (inventory.length === 0) {
    return (
      <div className="card text-sm text-ink-500">
        Nothing waiting in the shop right now — keep an eye out after your next milestone.
      </div>
    )
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-bold text-ink-900">Shop</h3>
        <span className="chip bg-brand-50 text-brand-700">✨ {carePoints} care points</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {inventory.map((item) => {
          const entry = catalogEntry(item.kind, item.speciesId)
          const price = entry?.price || 0
          const affordable = carePoints >= price

          return (
            <div
              key={item.id}
              className="flex flex-col items-center gap-1.5 rounded-3xl border border-slate-100
                bg-white p-4 text-center shadow-soft"
            >
              <span className="text-3xl leading-none" aria-hidden>{entry?.emoji || '❔'}</span>
              <span className="font-display text-xs font-bold leading-tight text-ink-900">
                {entry?.label || item.kind}
              </span>
              <span className="chip bg-slate-100 text-ink-500">
                {KIND_LABEL[item.kind] || item.kind}
              </span>
              <button
                type="button"
                onClick={() => onBuy(item.id, price)}
                disabled={!affordable}
                className={`mt-1 rounded-full px-3 py-1 text-[11px] font-bold shadow-soft transition-colors ${
                  affordable
                    ? 'bg-brand-500 text-white hover:bg-brand-600'
                    : 'bg-slate-100 text-ink-300 cursor-not-allowed'
                }`}
              >
                {price > 0 ? `Place — ${price}✨` : 'Place — free'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
