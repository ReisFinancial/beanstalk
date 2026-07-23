import { useMemo, useState } from 'react'
import { estimateIdealSpending } from '../utils/idealSpending.js'
import { computeTrueNumber } from '../utils/trueNumber.js'

/**
 * The Dashboard hero card. Reads the user's profile, runs the ideal-life
 * spending estimator + True Number NPV math, and renders the headline
 * number, progress vs current net worth, gap, Nx multiplier, and years
 * to target — plus an expandable "why this number" panel showing the
 * assumptions.
 *
 * A mode toggle at the top switches between two scenarios:
 *   Coast        — user works through their normal working years and
 *                  retires at the pension's age (or the default).
 *   Retire today — user stops working immediately; every year from
 *                  now to age 90 draws from wealth at retirement rates.
 */
export default function TrueNumberCard({ profile }) {
  const [showDetails, setShowDetails] = useState(false)
  const [mode, setMode] = useState('coast') // 'coast' | 'retireToday'

  const spending = useMemo(() => estimateIdealSpending(profile), [profile])
  // Compute both scenarios so the toggle is instant.
  const coastNumber = useMemo(
    () => computeTrueNumber(profile, spending, { mode: 'coast' }),
    [profile, spending],
  )
  const retireTodayNumber = useMemo(
    () => computeTrueNumber(profile, spending, { mode: 'retireToday' }),
    [profile, spending],
  )
  const number = mode === 'retireToday' ? retireTodayNumber : coastNumber

  const pct = Math.round(number.percentToTarget * 100)
  const marketName = spending.assumptions?.market?.name || 'National median'
  const modeCopy = mode === 'retireToday'
    ? `The wealth needed today to stop working now and sustain your ideal life to age ${number.assumptions.lifeExpectancy}.`
    : `The wealth needed today to sustain your ideal life to age ${number.assumptions.lifeExpectancy}.`

  return (
    <section className="card bg-hero-gradient text-white overflow-hidden relative">
      <div className="relative">
        {/* Mode toggle */}
        <div className="mb-4 inline-flex bg-white/15 backdrop-blur rounded-full p-1 text-xs font-semibold border border-white/20">
          {[
            { id: 'coast',        label: `Coast to ${number.assumptions.retirementAge}` },
            { id: 'retireToday',  label: 'Retire today' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`px-3 py-1 rounded-full transition ${
                mode === opt.id
                  ? 'bg-white text-grape-700 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              Your True Number
            </p>
            <p className="mt-1 font-display text-4xl sm:text-5xl font-extrabold leading-none">
              {fmtMoneyLarge(number.trueNumber)}
            </p>
            <p className="mt-2 text-sm opacity-90 max-w-md">
              {modeCopy}
            </p>
          </div>

          {number.multiplier > 0 && (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wider opacity-70">Or think of it as</p>
              <p className="font-display text-2xl font-extrabold leading-none mt-1">
                {number.multiplier}×
              </p>
              <p className="text-[11px] opacity-80 mt-0.5">annual ideal spending</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="opacity-90">
              {fmtMoneyLarge(number.currentNetWorth)} <span className="opacity-70">current</span>
            </span>
            <span className="font-display font-extrabold">{pct}% there</span>
          </div>
          <div className="mt-1.5 h-3 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${Math.max(1, pct)}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2 text-sm opacity-90">
            <span>
              Gap:{' '}
              <span className="font-display font-bold">{fmtMoneyLarge(number.gap)}</span>
            </span>
            <span>
              {number.yearsToTarget == null
                ? 'No clear path at current pace'
                : number.yearsToTarget === 0
                  ? "You're there ✨"
                  : `~${fmtYears(number.yearsToTarget)} to close`}
            </span>
          </div>
        </div>

        {/* Expandable assumptions */}
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="mt-5 text-xs font-semibold underline underline-offset-2 opacity-90 hover:opacity-100"
        >
          {showDetails ? 'Hide the math' : 'Where does this number come from?'}
        </button>

        {showDetails && (
          <div className="mt-3 rounded-2xl bg-white/12 backdrop-blur p-3 text-sm space-y-1 border border-white/15">
            <Row k="Ideal spending"     v={`${fmtMoneyLarge(number.assumptions.annualSpending)} / yr`} />
            <Row k="Priced against"     v={marketName} />
            <Row k="Discount rate"      v={`${(number.assumptions.discountRate * 100).toFixed(1)}% real`} />
            <Row k="Retirement"         v={`Age ${number.assumptions.retirementAge} → ${number.assumptions.lifeExpectancy}`} />
            <Row k="Retirement spending" v={`${fmtMoneyLarge(number.assumptions.retirementSpending)} / yr`} />
            {number.annualGuaranteedIncome > 0 && (
              <Row k="Pension income"    v={`${fmtMoneyLarge(number.annualGuaranteedIncome)} / yr from age ${number.assumptions.retirementAge}`} />
            )}
            <Row k="Retirement Number" v={`${fmtMoneyLarge(number.retirementNumber)} at age ${number.assumptions.retirementAge}`} />
          </div>
        )}

        {/* Gaps — what we had to assume */}
        {spending.gaps?.length > 0 && (
          <div className="mt-3 rounded-2xl bg-white/12 border border-white/15 px-3 py-2 text-xs">
            <p className="font-semibold opacity-90">Estimating with:</p>
            <ul className="mt-1 space-y-0.5 opacity-80">
              {spending.gaps.map((g, i) => (
                <li key={i}>· {g}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="opacity-80">{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  )
}

// ── Formatting helpers — inlined so the component stays portable ────

function fmtMoneyLarge(n) {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  if (abs >= 1_000_000)  return `${sign(v)}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000)      return `${sign(v)}$${Math.round(abs / 1_000)}k`
  return `${sign(v)}$${Math.round(abs).toLocaleString()}`
}
function sign(v) { return v < 0 ? '−' : '' }

function fmtYears(y) {
  const n = Number(y) || 0
  if (n < 1)  return `${Math.round(n * 12)} mo`
  if (n < 10) return `${n.toFixed(1)} yr`
  if (n < 100) return `${Math.round(n)} yr`
  return '99+ yr'
}
