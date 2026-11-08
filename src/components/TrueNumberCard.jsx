import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FINANCIAL_SECURITY_TIERS } from '../experimental/schema-v2/data.js'
import { fmtYears } from '../utils/displayMoney.js'
import { useTrueNumberV2 } from '../utils/useTrueNumberV2.js'

/**
 * The Dashboard hero card — True Number v2.
 *
 * Maps the wizard profile into v2 inputs (wizardToV2Input), runs
 * computeTrueNumberV2, and renders the headline, progress vs today's liquid
 * net worth, gap, years to target, and a "where does this number come
 * from?" breakdown. Lists every answer the adapter had to assume so the
 * user can go fix it. Displays in the user's own currency (the model runs
 * in USD).
 */

const HOUSING_LABEL = {
  need_home:   'Buying your ideal home',
  upgrade:     'Upgrading your home',
  own_ideal:   'Already in your ideal home',
  prefer_rent: 'Renting',
}
const DENSITY_LABEL = { urban: 'Urban', suburbs: 'Suburbs', rural: 'Rural' }

const DEFAULT_LABEL = {
  idealCity:          'Ideal city — using a national average',
  housingSituation:   'Housing situation — assumed buying a home',
  neighbourhoodType:  'Neighbourhood — assumed suburbs',
  currentHomeValue:   'Current home value — not entered, so the full price is counted',
  socialIntensity:    'Social intensity — assumed balanced',
  hobbyRanking:       'Hobbies — using the default order (active, social, luxury)',
  financialSecurity:  'Financial security — assumed comfortable',
  investmentApproach: 'Investment approach — assumed balanced',
  birthDate:          'Age — assumed 35',
}

export default function TrueNumberCard({ profile }) {
  const [showDetails, setShowDetails] = useState(false)

  const { input, defaultsUsed, displayCurrency, result, money, place: cityName } = useTrueNumberV2(profile)

  const r = result
  const { necessities, shelter, discretion } = r.components
  const pct = Math.round(r.percentToTarget * 100)
  const securityTier = FINANCIAL_SECURITY_TIERS.find((t) => t.multiple === r.components.securityMultiplier)
  const isOwner = shelter.mode !== 'prefer_rent'

  return (
    <section className="card bg-hero-gradient text-white overflow-hidden relative">
      <div className="relative">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80 flex items-center gap-2">
              Your True Number
              {r.isEstimated && (
                <span className="rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] normal-case tracking-normal">
                  Estimated
                </span>
              )}
            </p>
            <p className="mt-1 font-display text-4xl sm:text-5xl font-extrabold leading-none">
              {money(r.trueNumber)}
            </p>
            <p className="mt-2 text-sm opacity-90 max-w-md">
              The wealth you'd need today to fund your ideal life in {cityName} to
              age {r.assumptions.lifeExpectancy} — without working another day.
            </p>
          </div>

          {r.multiplier > 0 && (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wider opacity-70">Or think of it as</p>
              <p className="font-display text-2xl font-extrabold leading-none mt-1">{r.multiplier}×</p>
              <p className="text-[11px] opacity-80 mt-0.5">a year of your ideal life</p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="opacity-90">
              {money(r.currentNetWorth)} <span className="opacity-70">today</span>
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
            <span>Gap: <span className="font-display font-bold">{money(r.gap)}</span></span>
            <span>
              {r.yearsToTarget == null
                ? 'No clear path at current pace'
                : r.yearsToTarget === 0
                  ? "You're there ✨"
                  : `~${fmtYears(r.yearsToTarget)} to close`}
            </span>
          </div>
          {r.savings.source === 'assumed' && r.yearsToTarget > 0 && (
            <p className="mt-1 text-[11px] opacity-75">
              Timeline assumes you save 20% of an income that fits this life. Add your real income in Snapshot to sharpen it.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs font-semibold underline underline-offset-2 opacity-90 hover:opacity-100"
          >
            {showDetails ? 'Hide the math' : 'Where does this number come from?'}
          </button>
          {(r.currentNetWorth === 0 || r.savings.incomeAssumed) && (
            <Link
              to="/dashboard?view=snapshot"
              className="text-xs font-semibold rounded-full bg-white text-grape-700 hover:bg-white/90 px-3 py-1"
            >
              Add your starting point →
            </Link>
          )}
          <Link
            to="/dashboard?view=number"
            className="text-xs font-semibold rounded-full bg-white/20 hover:bg-white/30 border border-white/30 px-3 py-1"
          >
            Read more →
          </Link>
        </div>

        {showDetails && (
          <div className="mt-3 rounded-2xl bg-white/12 backdrop-blur p-3 text-sm border border-white/15 space-y-3">
            <div className="space-y-1">
              <Row k="Ideal city" v={`${cityName} · ${DENSITY_LABEL[densityKey(input.densityTierId)] || 'Suburbs'}`} />
              <Row k="Housing" v={HOUSING_LABEL[shelter.mode]} />
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Each year</p>
              <Row k="Living costs" v={money(necessities.annual)} hint="Food, transport, utilities" />
              {isOwner ? (
                <>
                  {shelter.envelopeAnnual > 0 && (
                    <Row k="Home payment" v={money(shelter.envelopeAnnual)} hint="Mortgage now, renovations once it's paid off" />
                  )}
                  <Row k="Property tax + upkeep" v={money(shelter.carryAnnual)} />
                </>
              ) : (
                <Row k="Rent" v={money(shelter.envelopeAnnual)} />
              )}
              <Row
                k="Lifestyle"
                v={money(discretion.annual)}
                hint={lifestyleHint(discretion)}
              />
              <Row
                k={`× ${securityTier?.financialTier ?? 'security'} security`}
                v={`${r.components.securityMultiplier}×`}
                hint="Headroom for the security level you chose"
              />
              <Row k="Your ideal year" v={money(r.annualSpending)} strong />
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Over your lifetime</p>
              <Row
                k={`${r.assumptions.yearsProjected} years of that`}
                v={money(r.spendingPV)}
                hint={`Today's value at a ${(r.assumptions.discountRate * 100).toFixed(0)}% real return (${r.assumptions.investmentApproach})`}
              />
              {shelter.lumpSum > 0 && (
                <Row k="Down payment" v={money(shelter.lumpSum)} hint="Paid up front, on top" />
              )}
              <Row k="True Number" v={money(r.trueNumber)} strong />
            </div>

            <p className="text-[11px] opacity-70">
              Figures in {displayCurrency}. Costs are directional estimates for planning, not quotes.
            </p>
          </div>
        )}

        {defaultsUsed.length > 0 && (
          <div className="mt-3 rounded-2xl bg-white/12 border border-white/15 px-3 py-2 text-xs">
            <p className="font-semibold opacity-90">We assumed:</p>
            <ul className="mt-1 space-y-0.5 opacity-80">
              {defaultsUsed.map((d) => <li key={d}>· {DEFAULT_LABEL[d] || d}</li>)}
            </ul>
            <Link to="/dashboard?view=number" className="mt-1.5 inline-block font-semibold underline underline-offset-2">
              Review your answers
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

function densityKey(id) {
  return { 1: 'urban', 2: 'suburbs', 3: 'rural' }[id]
}

function lifestyleHint(discretion) {
  const cats = [...new Set(discretion.breakdown.map((b) => b.category))]
  if (!cats.length) return 'No lifestyle categories selected'
  const est = new Set(discretion.estimatedCategories)
  const list = cats.map((c) => (est.has(c) ? `${c}*` : c)).join(', ')
  return `${list} · ${discretion.tier} intensity${est.size ? ' · *estimated' : ''}`
}

function Row({ k, v, hint, strong }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'pt-1 border-t border-white/15' : ''}`}>
      <span className="min-w-0">
        <span className={strong ? 'font-semibold' : 'opacity-80'}>{k}</span>
        {hint && <span className="block text-[11px] opacity-60 leading-snug">{hint}</span>}
      </span>
      <span className={`text-right shrink-0 ${strong ? 'font-display font-extrabold' : 'font-semibold'}`}>{v}</span>
    </div>
  )
}
