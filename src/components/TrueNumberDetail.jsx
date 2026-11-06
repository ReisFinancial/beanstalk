import { Link } from 'react-router-dom'
import { LIFESTYLE_TYPES, FINANCIAL_SECURITY_TIERS, CAD_TO_USD } from '../experimental/schema-v2/data.js'
import { fmtYears } from '../utils/displayMoney.js'
import { useTrueNumberV2 } from '../utils/useTrueNumberV2.js'

/**
 * "Read more" page for the True Number (Dashboard ?view=number).
 *
 * Tells the number as a short story, top to bottom:
 *   1. One-sentence summary
 *   2. What one ideal year costs — security headroom shown in dollars
 *   3. Why the number is so big (in plain words)
 *   4. What you told us vs. what we assumed — each with its own edit link
 *   5. What would move this number (placeholder until the lever engine)
 *   6. How confident we are
 */

const HOUSING_LABEL = {
  need_home:   'Buying your ideal home',
  upgrade:     'Upgrading your home',
  own_ideal:   'Already in your ideal home',
  prefer_rent: 'Renting',
}
const DENSITY_LABEL = { 1: 'Urban', 2: 'Suburbs', 3: 'Rural' }
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export default function TrueNumberDetail({ profile }) {
  const { input, defaultsUsed, displayCurrency, result: r, money, place } = useTrueNumberV2(profile)
  const { necessities, shelter, discretion, securityMultiplier, preTierAnnual } = r.components
  const assumed = new Set(defaultsUsed)
  const isOwner = shelter.mode !== 'prefer_rent'
  const securityTier = FINANCIAL_SECURITY_TIERS.find((t) => t.multiple === securityMultiplier)?.financialTier

  // ── 1. Story ──────────────────────────────────────────────────────
  const where = r.isNationalAverage
    ? `in ${place}`
    : shelter.mode === 'prefer_rent'
      ? `renting in ${place}`
      : `in the ${place} ${DENSITY_LABEL[input.densityTierId].toLowerCase()}`

  // ── 2. Ideal-year segments ────────────────────────────────────────
  const headroom = Math.max(0, r.annualSpending - preTierAnnual)
  const segments = [
    { key: 'living',    label: 'Living costs',      hint: 'Food, transport, utilities', value: necessities.annual, color: 'bg-brand-500' },
    { key: 'housing',   label: isOwner ? 'Housing' : 'Rent',
      hint: isOwner ? 'Home payment, property tax, upkeep' : 'Market rent for your ideal home',
      value: shelter.totalAnnual, color: 'bg-grape-500' },
    { key: 'lifestyle', label: 'Lifestyle',         hint: `${discretion.tier} intensity`, value: discretion.annual, color: 'bg-peach-500' },
    { key: 'headroom',  label: 'Security headroom', hint: `Extra room for "${securityTier}" security (${securityMultiplier}×)`, value: headroom, color: 'bg-grape-200' },
  ].filter((s) => s.value > 0)
  const total = segments.reduce((s, x) => s + x.value, 0) || 1

  // ── 3. Why so big ─────────────────────────────────────────────────
  const years = r.assumptions.yearsProjected
  const ratePct = Math.round(r.assumptions.discountRate * 100)
  const withoutGrowth = r.annualSpending * years

  // ── 4. Inputs ─────────────────────────────────────────────────────
  const categories = input.lifestyleTypeIds
    .map((id) => LIFESTYLE_TYPES.find((t) => t.id === id)?.category)
    .filter(Boolean)
    .map(cap)
    .join(', ')
  const hasAssets = (profile.assets || []).length > 0 || (profile.liabilities || []).length > 0

  const inputs = [
    { key: 'idealCity', label: 'Where you want to live', step: 'personal',
      value: r.isNationalAverage ? `${cap(place)} (national average)` : place },
    { key: 'housingSituation', label: 'Housing', step: 'welcome', value: HOUSING_LABEL[shelter.mode] },
    (shelter.mode === 'need_home' || shelter.mode === 'upgrade') &&
      { key: 'neighbourhoodType', label: 'Neighbourhood', step: 'welcome', value: DENSITY_LABEL[input.densityTierId] },
    shelter.mode === 'upgrade' &&
      { key: 'currentHomeValue', label: 'Current home value', step: 'welcome',
        value: input.currentHomeValue > 0 ? money(input.currentHomeValue) : 'Not entered' },
    { key: 'birthDate', label: 'Age', step: 'personal', value: `${input.currentAge}` },
    { key: 'socialIntensity', label: 'Lifestyle intensity', step: 'lifestyle', value: cap(input.lifestyleTier) },
    { key: 'hobbyRanking', label: 'Lifestyle categories counted', step: 'lifestyle', value: categories || 'None' },
    { key: 'financialSecurity', label: 'Financial security', step: 'financial', value: cap(input.financialTier) },
    { key: 'investmentApproach', label: 'Investment approach', step: 'financial',
      value: `${cap(input.investmentApproach)} (${ratePct}% real return)` },
    { key: 'netWorth', label: 'Starting net worth', to: '/dashboard?view=snapshot',
      value: money(r.currentNetWorth), status: hasAssets ? 'told' : 'missing' },
    { key: 'income', label: 'Income', to: '/gameboard',
      value: r.savings.incomeAssumed ? 'Not added' : `${money(r.savings.effectiveIncome)} / yr`,
      status: r.savings.incomeAssumed ? 'missing' : 'told' },
  ].filter(Boolean)

  // ── 6. Confidence ─────────────────────────────────────────────────
  const notes = []
  if (r.isNationalAverage) {
    notes.push(`${cap(place)} is priced at an average of our 40 listed metros, which leans toward big cities — a smaller town would likely cost less.`)
  }
  if (discretion.estimatedCategories.length) {
    const cats = discretion.estimatedCategories.map(cap).join(', ')
    notes.push(r.isNationalAverage
      ? `Lifestyle (${cats}) uses country-wide averages.`
      : `Lifestyle (${cats}) uses country-wide averages, not ${place}-specific prices.`)
  }
  notes.push('Food and transport use national averages — they don\'t vary by city yet.')
  notes.push('Home prices and rents are planning estimates from early 2026, not quotes.')
  if (displayCurrency === 'CAD') notes.push(`Figures shown in CAD, converted at 1 CAD = ${CAD_TO_USD} USD.`)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard" className="text-sm font-semibold text-grape-700">← Back to dashboard</Link>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500 flex items-center gap-2">
          Your True Number
          {r.isEstimated && (
            <span className="rounded-full bg-peach-400/20 text-peach-600 px-2 py-0.5 text-[10px] normal-case tracking-normal">Estimated</span>
          )}
        </p>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl font-extrabold">{money(r.trueNumber)}</h1>
      </div>

      {/* 1. Story */}
      <section className="card">
        <p className="text-lg leading-relaxed">
          Living your ideal life {where} costs about <strong>{money(r.annualSpending)} a year</strong>.
          Funding that for {years} years is worth <strong>{money(r.spendingPV)} today</strong>
          {shelter.lumpSum > 0 ? <>, plus a <strong>{money(shelter.lumpSum)} down payment</strong></> : null}.
        </p>
        <p className="mt-2 text-sm text-ink-500">
          You have {money(r.currentNetWorth)} toward it today —{' '}
          {r.yearsToTarget === 0
            ? "you're already there."
            : r.yearsToTarget == null
              ? 'add your income in Play to see a timeline.'
              : `about ${fmtYears(r.yearsToTarget)} to close the gap at your current pace.`}
        </p>
      </section>

      {/* 2. One ideal year */}
      <section className="card">
        <h2 className="font-display text-lg font-bold">What one ideal year costs</h2>
        <div className="mt-4 flex h-5 w-full overflow-hidden rounded-full" role="img"
             aria-label={segments.map((s) => `${s.label} ${money(s.value)}`).join(', ')}>
          {segments.map((s) => (
            <div key={s.key} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} />
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {segments.map((s) => (
            <li key={s.key} className="flex items-start justify-between gap-3 text-sm">
              <span className="flex items-start gap-2 min-w-0">
                <span className={`mt-1 h-3 w-3 rounded-sm shrink-0 ${s.color}`} />
                <span>
                  <span className="font-semibold">{s.label}</span>
                  <span className="block text-xs text-ink-500">{s.hint}</span>
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="font-semibold">{money(s.value)}</span>
                <span className="block text-xs text-ink-500">{Math.round((s.value / total) * 100)}%</span>
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-slate-100 pt-2 text-sm font-semibold">
            <span>Your ideal year</span><span>{money(r.annualSpending)}</span>
          </li>
        </ul>
        {headroom > 0 && (
          <p className="mt-3 text-xs text-ink-500">
            Security headroom is the cushion for the level of security you chose. Choosing a different level changes it more than anything else here.
          </p>
        )}
      </section>

      {/* 3. Why so big */}
      <section className="card">
        <h2 className="font-display text-lg font-bold">Why is the number so big?</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed">
          <p>
            <strong>It covers every year of your life, not just one.</strong> It adds up {years} years of your ideal life
            (to age {r.assumptions.lifeExpectancy}) and puts them in today's dollars.
          </p>
          <p>
            <strong>Your money does part of the work.</strong> If your savings earned nothing, you'd need
            {' '}{money(withoutGrowth)}. Because a {input.investmentApproach} portfolio earns about {ratePct}% a year after
            inflation, you need {money(r.spendingPV)} instead — about {r.multiplier} years of spending, not {years}.
          </p>
        </div>
      </section>

      {/* 4. Told vs assumed */}
      <section className="card">
        <h2 className="font-display text-lg font-bold">What you told us — and what we assumed</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {inputs.map((row) => {
            const status = row.status || (assumed.has(row.key) ? 'assumed' : 'told')
            return (
              <li key={row.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-ink-500">{row.label}</span>
                  <span className="block font-semibold truncate">{row.value}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <StatusChip status={status} />
                  <Link to={row.to || `/wizard?step=${row.step}`} className="text-xs font-semibold text-grape-700">
                    {status === 'missing' ? 'Add' : 'Edit'}
                  </Link>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 5. Levers — placeholder until the lever engine */}
      <section className="card border-dashed">
        <h2 className="font-display text-lg font-bold">What would move your number</h2>
        <p className="mt-2 text-sm text-ink-500">
          Soon you'll see the three changes that would lower your number most — like a different neighbourhood or a
          calmer lifestyle — and what each one is worth. For now, try changes in Play.
        </p>
        <Link to="/gameboard" className="mt-3 inline-block btn-secondary">Open Play →</Link>
      </section>

      {/* 6. Confidence */}
      <section className="card">
        <h2 className="font-display text-lg font-bold">How confident is this number?</h2>
        <p className="mt-1 text-sm text-ink-500">It's a planning estimate — close enough to steer by, not a quote.</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {notes.map((n, i) => <li key={i} className="flex gap-2"><span className="text-ink-300">·</span><span>{n}</span></li>)}
        </ul>
      </section>
    </div>
  )
}

function StatusChip({ status }) {
  const styles = {
    told:    'bg-brand-50 text-brand-700',
    assumed: 'bg-peach-400/20 text-peach-600',
    missing: 'bg-slate-100 text-ink-500',
  }
  const label = { told: 'You told us', assumed: 'We assumed', missing: 'Not added yet' }
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status]}`}>{label[status]}</span>
}
