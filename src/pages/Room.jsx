import { Link } from 'react-router-dom'
import { usePlanner } from '../context/PlannerContext.jsx'
import { useRoomVisit } from '../hooks/useRoomVisit.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import RoomScene from '../components/room/RoomScene.jsx'
import DecorShop from '../components/room/DecorShop.jsx'
import ReducedMotionToggle from '../components/room/ReducedMotionToggle.jsx'

/**
 * The cozy Play view — primary landing spot for the Play nav tab. The
 * numbers-first hex sandbox (Gameboard, "Net Worth Arena") is still
 * reachable via the Sandbox link, for users who want the advanced
 * what-if tool. See IMMERSIVE_GAMEPLAY.md.
 */
export default function Room() {
  const { profile, tendItem, buyRoomItem, setReducedMotion } = usePlanner()
  useRoomVisit()
  const reduced = useReducedMotion()
  const rootClass = `space-y-6 ${reduced ? 'motion-reduce-scope' : ''}`

  if (!profile) {
    return (
      <div className={rootClass}>
        <Header />
        <div className="card text-center py-12">
          <div className="animate-pulse text-ink-500">Setting up your room…</div>
        </div>
      </div>
    )
  }

  const room = profile.room

  return (
    <div className={rootClass}>
      <Header />

      <div className="flex flex-wrap items-center gap-3">
        <StatChip emoji="✨" value={room?.carePoints ?? 0} label="Care points" />
        <StatChip emoji="🔥" value={`${room?.streak?.current ?? 0}d`} label="Streak" />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-500">Motion</span>
          <ReducedMotionToggle
            value={room?.settings?.reducedMotion}
            onChange={setReducedMotion}
          />
        </div>
      </div>

      <RoomScene room={room} onTend={tendItem} />

      {/* v1 doesn't track real slot coordinates, so bought items just join
          RoomScene's array-order layout (see RoomScene's placement note). */}
      <DecorShop room={room} onBuy={(id, cost) => buyRoomItem(id, cost, null)} />
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">
          🌱 Play
        </h2>
        <p className="text-sm text-ink-500 mt-0.5">
          A cozy space that grows with your real progress.
        </p>
      </div>
      <Link
        to="/gameboard"
        className="chip bg-white shadow-soft text-ink-700 hover:bg-slate-50 shrink-0"
      >
        🧮 Sandbox
      </Link>
    </div>
  )
}

function StatChip({ emoji, value, label }) {
  return (
    <div className="chip bg-white shadow-soft text-ink-700">
      <span aria-hidden>{emoji}</span>
      <span className="font-bold">{value}</span>
      <span className="text-ink-500">{label}</span>
    </div>
  )
}
