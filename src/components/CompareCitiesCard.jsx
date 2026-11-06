import { useMemo, useState } from 'react'
import { wizardToV2Input } from '../experimental/schema-v2/wizardToV2Input.js'
import { compareAllCities } from '../experimental/schema-v2/compareCities.js'
import { moneyFormatter } from '../utils/displayMoney.js'

/**
 * Compare Cities — same ideal life (housing situation, neighbourhood,
 * lifestyle, security, investment approach), priced in every listed metro
 * with True Number v2. Sorted by biggest reduction vs the user's ideal city.
 *
 * Framed as information ("here's what your ideal costs elsewhere"), not a
 * nudge to move.
 */
export default function CompareCitiesCard({ profile }) {
  const [showAll, setShowAll] = useState(false)
  const [country, setCountry] = useState('all')

  const { baseline, rows, displayCurrency } = useMemo(() => {
    const { input, displayCurrency } = wizardToV2Input(profile)
    return { ...compareAllCities(input), displayCurrency }
  }, [profile])

  const filtered = useMemo(
    () => (country === 'all' ? rows : rows.filter((r) => r.city.country === country)),
    [rows, country],
  )

  if (!(baseline.trueNumber > 0) || rows.length === 0) return null

  const money = moneyFormatter(displayCurrency)
  const visible = showAll ? filtered : filtered.slice(0, 3)
  const cheaperCount = filtered.filter((r) => r.pctReduction > 0).length
  const baseName = baseline.isNationalAverage
    ? `the ${baseline.assumptions.city.country === 'CA' ? 'Canadian' : 'US'} average`
    : baseline.assumptions.city.name.split('-')[0]

  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-lg">Where else could you build this life?</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Same ideal, different address. {cheaperCount} of {filtered.length} cities cost less than {baseName}.
          </p>
        </div>

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
                country === c.id ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center">
          <p className="text-sm text-ink-400">No matching cities — try a different filter.</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-2">
          {visible.map((row, i) => (
            <CityRow key={row.city.id} row={row} rank={i + 1} money={money} />
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
            {showAll ? 'Show only top 3' : `Show all ${filtered.length} cities`}
          </button>
        )}
        <p className="text-[11px] text-ink-400 ml-auto">
          Directional estimates · figures in {displayCurrency}
        </p>
      </div>
    </section>
  )
}

function CityRow({ row, rank, money }) {
  const { city, trueNumber, delta, pctReduction } = row
  const cheaper = pctReduction > 0
  const pctLabel = `${cheaper ? '−' : '+'}${Math.abs(Math.round(pctReduction * 100))}%`

  return (
    <li>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 hover:border-grape-300 transition">
        <span className={`grid place-items-center h-8 w-8 rounded-full font-display text-sm font-extrabold shrink-0 ${
          rank <= 3 ? 'bg-hero-gradient text-white' : 'bg-slate-100 text-ink-500'
        }`}>
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{city.name.split('-')[0]}, {city.state}</p>
          <p className="text-[11px] text-ink-500">
            {city.country} · {(city.population / 1_000_000).toFixed(1)}M people
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display font-extrabold">{money(trueNumber)}</p>
          <p className={`text-[11px] font-semibold ${cheaper ? 'text-brand-700' : 'text-red-600'}`}>
            {pctLabel} · {cheaper ? '−' : '+'}{money(Math.abs(delta))}
          </p>
        </div>
      </div>
    </li>
  )
}
