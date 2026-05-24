import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlanner } from '../context/PlannerContext.jsx'

/* ----------------------------------------------------------------------
   Net Worth Arena — a sandbox strategy board.

   Every asset, liability, and goal becomes a tile. Drag an asset onto a
   liability or goal: if the asset is worth at least as much as the target
   at the current point on the timeline, the asset "captures" it. The
   asset is then reduced by the captured amount.

   Scrub the timeline forward to let assets appreciate (and liabilities
   accrue interest) until an asset is large enough to take a target.

   This board is a pure what-if sandbox — it never writes back to the
   planner profile. Resetting restores the original positions.
   ---------------------------------------------------------------------- */

const MAX_MONTHS = 360 // 30-year horizon

const ASSET_ICON = {
  savings: '🏦', retirement: '🏖️', investments: '📈',
  realEstate: '🏠', crypto: '🪙',
}
const LIABILITY_ICON = {
  creditCard: '💳', lineOfCredit: '🧾', overdueBills: '⏰',
  carLoan: '🚗', mortgage: '🏚️',
}
const GOAL_ICON = {
  debt: '🔻', investment: '📈', spending: '💸', other: '🎯',
  // legacy theme categories
  money: '💰', career: '🧑‍💻', health: '💪',
  learning: '📚', relationships: '❤️', lifestyle: '🌿',
}

// ── Rate lookup — mirrors the Snapshot's per-hex rate resolution ───────
function inferSubtype(type, label) {
  const s = (label || '').toLowerCase()
  if (type === 'asset') {
    if (/saving|chequing|checking|\bcash\b/.test(s)) return 'savings'
    if (/retire|rrsp|401|pension/.test(s))           return 'retirement'
    if (/real estate|property|home equity|house/.test(s)) return 'realEstate'
    if (/crypto|bitcoin|eth|btc/.test(s))            return 'crypto'
    return 'investments'
  }
  if (/credit card|visa|master|amex/.test(s))        return 'creditCard'
  if (/line of credit|heloc|\bloc\b/.test(s))        return 'lineOfCredit'
  if (/overdue|late/.test(s))                        return 'overdueBills'
  if (/car|auto|vehicle/.test(s))                    return 'carLoan'
  if (/mortgage/.test(s))                            return 'mortgage'
  return 'creditCard'
}
function annualRatePct(type, item, rates) {
  const scope = type === 'asset' ? 'asset' : 'liability'
  const key   = item.subtype || inferSubtype(type, item.label)
  return Number(rates?.[scope]?.[key]) || 0
}

// Compound a value forward `months` months. `pmt` is an end-of-month
// annuity (a contribution for assets, a paydown for liabilities).
function compound(value, annualPct, months, pmt, isLiability) {
  const v = Number(value) || 0
  if (months <= 0) return v
  const r = (Number(annualPct) || 0) / 100 / 12
  const p = Number(pmt) || 0
  const fvPrincipal = v * Math.pow(1 + r, months)
  const fvPmt = r === 0 ? p * months : p * (Math.pow(1 + r, months) - 1) / r
  return isLiability ? Math.max(0, fvPrincipal - fvPmt) : fvPrincipal + fvPmt
}

function fmtMoney(n) {
  return (Number(n) || 0).toLocaleString(undefined, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  })
}

function fmtTimeline(months) {
  if (months <= 0) return 'Today'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m} mo`
  if (m === 0) return `${y} yr`
  return `${y} yr ${m} mo`
}

// A goal's "value" — what an asset must cover to claim it. Investment and
// "other" goals carry a target amount; spending goals are annualized.
function goalValue(g) {
  const t = Number(g.targetAmount)
  if (Number.isFinite(t) && t > 0) return t
  const s = Number(g.spendingIncrease)
  if (Number.isFinite(s) && s > 0) return s * 12
  return 0
}

// Project a tile's worth at a given timeline month.
function assetValueAt(tile, month) {
  return compound(tile.baseValue, tile.rate, month - tile.baseMonth, tile.pmt, false)
}
function targetValueAt(tile, month) {
  if (tile.kind === 'goal') return tile.baseValue // goals don't appreciate
  return compound(tile.baseValue, tile.rate, month - tile.baseMonth, tile.pmt, true)
}

// Build the starting board from the planner profile.
function buildBoard(profile) {
  const rates = profile?.rates
  const assetTiles = (profile?.assets || []).map((a) => ({
    id: `asset:${a.id}`,
    label: a.label || 'Asset',
    icon: ASSET_ICON[a.subtype] || '💰',
    baseValue: Number(a.amount) || 0,
    baseMonth: 0,
    rate: annualRatePct('asset', a, rates),
    pmt: Number(a.monthlyPayment) || 0,
  }))
  const liabilityTiles = (profile?.liabilities || []).map((l) => ({
    id: `liability:${l.id}`,
    kind: 'liability',
    label: l.label || 'Liability',
    icon: LIABILITY_ICON[l.subtype] || '🔻',
    baseValue: Number(l.amount) || 0,
    baseMonth: 0,
    rate: annualRatePct('liability', l, rates),
    pmt: Number(l.monthlyPayment) || 0,
    captured: false,
  }))
  const goalTiles = (profile?.goals || []).map((g) => ({
    id: `goal:${g.id}`,
    kind: 'goal',
    label: g.title || 'Goal',
    icon: GOAL_ICON[g.category] || '🎯',
    baseValue: goalValue(g),
    baseMonth: 0,
    rate: 0,
    pmt: 0,
    captured: false,
  }))
  return { assetTiles, targetTiles: [...liabilityTiles, ...goalTiles] }
}

export default function Gameboard() {
  const { profile } = usePlanner()

  // The planner profile loads from storage in an effect, so it is null on
  // the very first render. Wait for it before snapshotting the board —
  // otherwise GameboardInner's useState would freeze an empty board.
  if (!profile) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="card text-center py-12">
          <div className="animate-pulse text-ink-500">Setting up the board…</div>
        </div>
      </div>
    )
  }
  return <GameboardInner profile={profile} />
}

function GameboardInner({ profile }) {
  const [board, setBoard]           = useState(() => buildBoard(profile))
  const [month, setMonth]           = useState(0)
  const [floorMonth, setFloorMonth] = useState(0) // time only moves forward
  const [draggingId, setDraggingId] = useState(null)
  const [hoverId, setHoverId]       = useState(null)

  const { assetTiles, targetTiles } = board
  const draggingAsset = assetTiles.find((a) => a.id === draggingId) || null

  const remaining   = targetTiles.filter((t) => !t.captured)
  const clearedCount = targetTiles.length - remaining.length
  const won = targetTiles.length > 0 && remaining.length === 0
  const lastCaptureMonth = targetTiles
    .filter((t) => t.captured)
    .reduce((m, t) => Math.max(m, t.capturedMonth || 0), 0)

  // Strongest asset right now — used for idle "how short" hints.
  const strongestAssetVal = assetTiles.length
    ? Math.max(...assetTiles.map((a) => assetValueAt(a, month)))
    : 0
  const anyCapturableNow = remaining.some(
    (t) => targetValueAt(t, month) <= strongestAssetVal,
  )

  // Live net worth at the current timeline position.
  const liveAssets = assetTiles.reduce((s, a) => s + assetValueAt(a, month), 0)
  const liveDebt = targetTiles
    .filter((t) => t.kind === 'liability' && !t.captured)
    .reduce((s, t) => s + targetValueAt(t, month), 0)
  const netWorth = liveAssets - liveDebt

  const canCapture = (target) => {
    if (!draggingAsset || target.captured) return false
    return assetValueAt(draggingAsset, month) >= targetValueAt(target, month)
  }

  // ── Capture: asset takes the target, then shrinks by its value ──────
  const handleCapture = (targetId) => {
    setBoard((prev) => {
      const asset  = prev.assetTiles.find((a) => a.id === draggingId)
      const target = prev.targetTiles.find((t) => t.id === targetId)
      if (!asset || !target || target.captured) return prev
      const aVal = assetValueAt(asset, month)
      const tVal = targetValueAt(target, month)
      if (aVal < tVal) return prev // not enough — reject
      return {
        assetTiles: prev.assetTiles.map((a) =>
          a.id === asset.id
            ? { ...a, baseValue: aVal - tVal, baseMonth: month }
            : a,
        ),
        targetTiles: prev.targetTiles.map((t) =>
          t.id === target.id
            ? {
                ...t,
                captured: true,
                capturedBy: asset.id,
                capturedValue: tVal,
                capturedMonth: month,
              }
            : t,
        ),
      }
    })
    setFloorMonth(month) // committing an action locks the timeline forward
    setDraggingId(null)
    setHoverId(null)
  }

  const handleReset = () => {
    setBoard(buildBoard(profile))
    setMonth(0)
    setFloorMonth(0)
    setDraggingId(null)
    setHoverId(null)
  }

  const jump = (deltaMonths) => {
    setMonth((m) => Math.min(MAX_MONTHS, Math.max(floorMonth, m + deltaMonths)))
  }

  // ── Empty state ─────────────────────────────────────────────────────
  if (assetTiles.length === 0 || targetTiles.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="card text-center py-12">
          <div className="text-5xl">🎲</div>
          <h3 className="mt-3 font-display text-lg font-bold">Your arena is empty</h3>
          <p className="mt-1 text-sm text-ink-500 max-w-md mx-auto">
            The board needs at least one asset and one liability or goal to play.
            Add them on your Snapshot and Goals pages, then come back.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link to="/dashboard?view=snapshot" className="btn-secondary !py-2 !px-4 text-sm">
              Go to Snapshot
            </Link>
            <Link to="/dashboard?view=goals" className="btn-secondary !py-2 !px-4 text-sm">
              Go to Goals
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const pct = targetTiles.length
    ? Math.round((clearedCount / targetTiles.length) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <Header />
        <button onClick={handleReset} className="btn-ghost !py-2 !px-3 text-sm shrink-0">
          ↺ Reset board
        </button>
      </div>

      {/* Victory banner */}
      {won && (
        <div className="card bg-card-gradient border-brand-200 text-center">
          <div className="text-4xl">🏆</div>
          <h3 className="mt-2 font-display text-xl font-extrabold text-brand-700">
            Net worth conquered!
          </h3>
          <p className="mt-1 text-sm text-ink-500">
            Every debt and goal cleared by {fmtTimeline(lastCaptureMonth)}. Net worth now: {fmtMoney(netWorth)}.
          </p>
        </div>
      )}

      {/* Progress + live stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card bg-card-gradient sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-grape-700">
              Targets cleared
            </p>
            <p className="text-sm font-bold">{clearedCount} / {targetTiles.length}</p>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-white/70 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Net worth</p>
          <p className={`mt-1 font-display text-2xl font-extrabold ${
            netWorth >= 0 ? 'text-brand-700' : 'text-red-600'
          }`}>
            {fmtMoney(netWorth)}
          </p>
          <p className="mt-1 text-xs text-ink-500">At {fmtTimeline(month)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Debts left</p>
          <p className="mt-1 font-display text-2xl font-extrabold">
            {remaining.filter((t) => t.kind === 'liability').length}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {remaining.filter((t) => t.kind === 'goal').length} goals left
          </p>
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display font-bold text-lg">Timeline</h3>
          <p className="font-display text-2xl font-extrabold text-grape-700">
            {fmtTimeline(month)}
          </p>
        </div>
        <input
          type="range"
          min={floorMonth}
          max={MAX_MONTHS}
          step="1"
          value={month}
          onChange={(e) => setMonth(Math.max(floorMonth, Number(e.target.value)))}
          className="mt-3 w-full accent-grape-600"
          aria-label="Timeline in months"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-400">
            {floorMonth > 0
              ? `Time only moves forward — committed to ${fmtTimeline(floorMonth)}.`
              : 'Scroll forward to grow your assets.'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => jump(12)} className="chip border border-slate-200 hover:border-grape-400">
              +1 yr
            </button>
            <button onClick={() => jump(60)} className="chip border border-slate-200 hover:border-grape-400">
              +5 yr
            </button>
            <button
              onClick={() => setMonth(MAX_MONTHS)}
              className="chip border border-slate-200 hover:border-grape-400"
            >
              Max
            </button>
          </div>
        </div>
        {!won && !anyCapturableNow && (
          <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            No asset is large enough yet — scroll the timeline forward until one
            appreciates past a target.
          </p>
        )}
      </div>

      {/* Asset tiles — the draggable pieces */}
      <section className="card">
        <h3 className="font-display font-bold text-lg">Your assets</h3>
        <p className="text-xs text-ink-500 mt-0.5">
          Drag an asset onto a debt or goal to capture it. The asset shrinks by what it takes.
        </p>
        <div
          className="mt-4 flex flex-wrap gap-3 rounded-2xl p-3
                     bg-[radial-gradient(circle,_rgba(13,27,42,0.05)_1px,_transparent_1px)]
                     [background-size:16px_16px]"
        >
          {assetTiles.map((tile) => (
            <AssetTile
              key={tile.id}
              tile={tile}
              value={assetValueAt(tile, month)}
              dragging={draggingId === tile.id}
              onDragStart={() => setDraggingId(tile.id)}
              onDragEnd={() => { setDraggingId(null); setHoverId(null) }}
            />
          ))}
        </div>
      </section>

      {/* Target tiles — debts & goals to clear */}
      <section className="card">
        <h3 className="font-display font-bold text-lg">Debts &amp; goals</h3>
        <p className="text-xs text-ink-500 mt-0.5">
          Drop an asset here. Green tiles are within reach; dim tiles need a bigger asset.
        </p>
        <div
          className="mt-4 flex flex-wrap gap-3 rounded-2xl p-3
                     bg-[radial-gradient(circle,_rgba(13,27,42,0.05)_1px,_transparent_1px)]
                     [background-size:16px_16px]"
        >
          {targetTiles.map((tile) => {
            const droppable = canCapture(tile)
            let state = 'idle'
            if (tile.captured) state = 'captured'
            else if (draggingAsset && hoverId === tile.id && droppable) state = 'hover'
            else if (draggingAsset && droppable) state = 'droppable'
            else if (draggingAsset) state = 'blocked'
            return (
              <TargetTile
                key={tile.id}
                tile={tile}
                value={targetValueAt(tile, month)}
                state={state}
                gap={targetValueAt(tile, month) - strongestAssetVal}
                droppable={droppable}
                onDragEnter={() => droppable && setHoverId(tile.id)}
                onDragLeave={() => setHoverId((h) => (h === tile.id ? null : h))}
                onDragOver={(e) => { if (droppable) e.preventDefault() }}
                onDrop={(e) => { e.preventDefault(); handleCapture(tile.id) }}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">
        🎮 Net Worth Arena
      </h2>
      <p className="text-sm text-ink-500 mt-0.5">
        Turn your finances into a board. Capture every debt and goal with your assets.
      </p>
    </div>
  )
}

// ── Asset tile — a draggable piece ────────────────────────────────────
function AssetTile({ tile, value, dragging, onDragStart, onDragEnd }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        // setData is required for the drag to initiate in Firefox.
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', tile.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={`relative w-40 h-40 shrink-0 rounded-2xl border-2 p-3 flex flex-col
                  cursor-grab active:cursor-grabbing select-none transition
                  border-brand-300 bg-gradient-to-br from-brand-50 to-white
                  ${dragging ? 'opacity-40 scale-95' : 'hover:-translate-y-1 hover:shadow-soft'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl leading-none">{tile.icon}</span>
        <span className="chip bg-brand-100 text-brand-700">Asset</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-tight line-clamp-2">{tile.label}</p>
      <div className="mt-auto">
        <p className="font-display text-xl font-extrabold text-brand-700">{fmtMoney(value)}</p>
        <p className="text-[11px] text-ink-400">
          {tile.rate > 0 ? `${tile.rate}% / yr` : 'flat'}
          {tile.pmt > 0 ? ` · +${fmtMoney(tile.pmt)}/mo` : ''}
        </p>
      </div>
      <span className="absolute bottom-2 right-2.5 text-ink-300 text-xs select-none">⠿</span>
    </div>
  )
}

// ── Target tile — a debt or goal to capture ───────────────────────────
function TargetTile({
  tile, value, state, gap, droppable,
  onDragEnter, onDragLeave, onDragOver, onDrop,
}) {
  const isGoal = tile.kind === 'goal'
  const accent = isGoal
    ? { border: 'border-grape-300', bg: 'from-grape-50', text: 'text-grape-700', chip: 'bg-grape-100 text-grape-700' }
    : { border: 'border-red-300',   bg: 'from-red-50',   text: 'text-red-600',   chip: 'bg-red-100 text-red-700' }

  // State-driven styling layered on top of the accent colours.
  let stateClass = `${accent.border} bg-gradient-to-br ${accent.bg} to-white`
  if (state === 'captured') {
    stateClass = 'border-brand-300 bg-brand-50 opacity-90'
  } else if (state === 'hover') {
    stateClass = 'border-brand-500 ring-4 ring-brand-300 scale-105 bg-white'
  } else if (state === 'droppable') {
    stateClass = 'border-brand-400 ring-2 ring-brand-200 bg-white animate-pulse'
  } else if (state === 'blocked') {
    stateClass = `${accent.border} bg-gradient-to-br ${accent.bg} to-white opacity-40`
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative w-40 h-40 shrink-0 rounded-2xl border-2 p-3 flex flex-col
                  select-none transition-all duration-150 [&_*]:pointer-events-none ${stateClass}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl leading-none">{tile.icon}</span>
        <span className={`chip ${state === 'captured' ? 'bg-brand-100 text-brand-700' : accent.chip}`}>
          {isGoal ? 'Goal' : 'Debt'}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-tight line-clamp-2">{tile.label}</p>

      {state === 'captured' ? (
        <div className="mt-auto">
          <p className="font-display text-lg font-extrabold text-brand-700">✓ Cleared</p>
          <p className="text-[11px] text-ink-400">
            {fmtMoney(tile.capturedValue)} · {fmtTimeline(tile.capturedMonth)}
          </p>
        </div>
      ) : (
        <div className="mt-auto">
          <p className={`font-display text-xl font-extrabold ${accent.text}`}>
            {fmtMoney(value)}
          </p>
          <p className="text-[11px] text-ink-400">
            {droppable
              ? 'Drop to capture'
              : gap > 0
                ? `${fmtMoney(gap)} short`
                : 'Ready to claim'}
          </p>
        </div>
      )}

      {state === 'captured' && (
        <span className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="text-4xl opacity-20">✓</span>
        </span>
      )}
    </div>
  )
}
