import { useMemo, useState } from 'react'
import { MARKETS } from '../data/realEstateMarkets.js'
import { estimateIdealSpending, estimateForMarket } from '../utils/idealSpending.js'
import { computeTrueNumber } from '../utils/trueNumber.js'

/**
 * Compare Cities — for the same ideal-life inputs, re-price housing
 * against every market in the dataset and show the resulting True
 * Number sorted by the biggest gap reduction.
 *
 * Self-contained: computes the current True Number itself so it can
 * live wherever it's dropped without a parent hoist.
 *
 * Framed as pure information ("here's what your ideal costs elsewhere"),
 * not a nudge to move.
 */
export default function CompareCitiesCard({ profile }) {
  const [showAll, setShowAll] = useState(false)
  const [country, setCountry] = useState('all')

  // Baseline: user's own market (whatever their home goal resolves to).
  const currentSpending = useMemo(() => estimateIdealSpending(profile), [profile])
  const currentNumber   = useMemo(
    () => computeTrueNumber(profile, currentSpending),
    [profile, currentSpending],
  )
  const currentMarketId = currentSpending.assumptions?.market?.id

  const alternatives = useMemo(() => {
    if (!currentNumber || !(currentNumber.trueNumber > 0)) return []
    const rows = MARKETS
      // Skip markets missing price data — nothing to compare against.
      .filter((m) => m.medianPriceUsd && m.medianPriceUsd > 0)
      // Skip whatever the user is already priced against.
      .filter((m) => m.id !== currentMarketId)
      .map((m) => {
        const spending = estimateForMarket(profile, m.id)
        const number   = computeTrueNumber(profile, spending)
        const delta    = currentNumber.trueNumber - number.trueNumber
        const pctReduction = delta / currentNumber.trueNumber
        return { market: m, trueNumber: number.trueNumber, delta, pctReduction }
      })
    // Sort: biggest reduction first.
    rows.sort((a, b) => b.pctReduction - a.pctReduction)
    return rows
  }, [profile, currentNumber, currentMarketId])

  const filtered = useMemo(() => {
    if (country === 'all') return alternatives
    return alternatives.filter((r) => r.market.country === country)
  }, [alternatives, country])

  if (alternatives.length === 0) return null

  const visible = showAll ? filtered : filtered.slice(0, 3)
  const cheaperCount = filtered.filter((r) => r.pctReduction > 0).length

  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-lg">Where else could you build this life?</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Same ideal, different address. {cheaperCount} of {filtered.length} markets lower your True Number.
          </p>
        </div>

        {/* Country filter */}
        <div className="inline-flex bg-slate-100 rounded-full p-1 text-xs font-semibold shrink-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'US',  label: 'US' },
            { id: 'CA',  label: 'Canada' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setCountry(c.id); setShowAll(false) }}
              className={`px-3 py-1 rounded-full transition ${
                country === c.id
                  ? 'bg-white text-ink-900 shadow-soft'
                  : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center">
          <p className="text-sm text-ink-400">No matching markets — try a different filter.</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-2">
          {visible.map((row, i) => (
            <CityRow key={row.market.id} row={row} rank={i + 1} showAll={showAll} />
          ))}
        </ol>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        {filtered.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-sm font-semibold text-grape-700 hover:text-grape-900"
          >
            {showAll ? 'Show only top 3' : `Show all ${filtered.length} markets`}
          </button>
        )}
        <p className="text-[11px] text-ink-400 ml-auto">
          Housing priced with market medians · lifestyle scales by density tier
        </p>
      </div>
    </section>
  )
}

function CityRow({ row, rank, showAll }) {
  const { market, trueNumber, delta, pctReduction } = row
  const cheaper = pctReduction > 0
  const pctLabel = `${cheaper ? '−' : '+'}${Math.abs(Math.round(pctReduction * 100))}%`

  return (
    <li>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 hover:border-grape-300 transition">
        <span className={`grid place-items-center h-8 w-8 rounded-full font-display text-sm font-extrabold shrink-0 ${
          rank <= 3
            ? 'bg-hero-gradient text-white'
            : 'bg-slate-100 text-ink-500'
        }`}>
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{market.name}</p>
          <p className="text-[11px] text-ink-500">
            {market.densityTier} · {market.country} · {(market.population / 1_000_000).toFixed(1)}M people
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display font-extrabold">{fmtMoneyLarge(trueNumber)}</p>
          <p className={`text-[11px] font-semibold ${
            cheaper ? 'text-brand-700' : 'text-red-600'
          }`}>
            {pctLabel} · {cheaper ? '−' : '+'}{fmtMoneyLarge(Math.abs(delta))}
          </p>
        </div>
      </div>
    </li>
  )
}

// ── Formatting helpers — inlined for portability ──────────────────

function fmtMoneyLarge(n) {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000)     return `$${Math.round(abs / 1_000)}k`
  return `$${Math.round(abs).toLocaleString()}`
}
