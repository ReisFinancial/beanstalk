import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePlanner } from '../context/PlannerContext.jsx'
import Hex from '../components/Hex.jsx'
import AddItemModal from '../components/AddItemModal.jsx'

// ----- Future-value helpers --------------------------------------------

// Cheap keyword-based fallback so wizard-seeded or pre-existing hexes
// without an explicit subtype still get a reasonable rate.
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

/**
 * Future value of a hex after `years` years.
 *
 * - PV compounds at the annual rate (`ratePct`, e.g. 6 for 6%).
 * - `pmt` is a monthly contribution (asset) or monthly paydown (liability)
 *   treated as an end-of-month annuity. The annual rate is split into a
 *   monthly rate (r/12) to match the payment cadence.
 * - For liabilities, payments subtract from the balance and we floor at $0
 *   so the hex doesn't go negative once the loan is paid off.
 */
function futureValue(type, pv, ratePct, years, pmt = 0) {
  const principal = Number(pv) || 0
  const payment   = Number(pmt) || 0
  if (years <= 0) return principal

  const rAnnual  = (Number(ratePct) || 0) / 100
  const rMonthly = rAnnual / 12
  const n        = years * 12

  const fvPrincipal = principal * Math.pow(1 + rMonthly, n)
  const fvPayments = rMonthly === 0
    ? payment * n
    : payment * (Math.pow(1 + rMonthly, n) - 1) / rMonthly

  if (type === 'liability') {
    return Math.max(0, fvPrincipal - fvPayments)
  }
  return fvPrincipal + fvPayments
}

const CATEGORIES = {
  money:         { label: 'Money',         emoji: '💰', color: 'from-grape-400/20 to-grape-200/20' },
  career:        { label: 'Career',        emoji: '🧑‍💻', color: 'from-brand-400/20 to-brand-200/20' },
  health:        { label: 'Health',        emoji: '💪', color: 'from-peach-400/20 to-peach-500/10' },
  learning:      { label: 'Learning',      emoji: '📚', color: 'from-sky-300/20 to-sky-200/20' },
  relationships: { label: 'Relationships', emoji: '❤️', color: 'from-rose-300/20 to-rose-200/20' },
  lifestyle:     { label: 'Lifestyle',     emoji: '🌿', color: 'from-emerald-300/20 to-emerald-200/20' },
}

const HORIZONS = {
  short: '0–1 yr',
  mid:   '1–3 yrs',
  long:  '3+ yrs',
}

function fmtMoney(n) {
  const x = Number(n) || 0
  return x.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function StatCard({ label, value, tone = 'default', hint }) {
  const toneClass = {
    default: 'bg-white',
    good:    'bg-brand-50 border-brand-100',
    warn:    'bg-amber-50 border-amber-100',
    bad:     'bg-red-50 border-red-100',
  }[tone]
  return (
    <div className={`card ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

function GoalCard({ goal, rank }) {
  const c = CATEGORIES[goal.category] || CATEGORIES.lifestyle
  return (
    <div className={`card bg-gradient-to-br ${c.color} relative overflow-hidden`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{c.emoji}</span>
          <span className="chip bg-white text-ink-700">{c.label}</span>
        </div>
        {rank && (
          <span className="chip bg-hero-gradient text-white">#{rank}</span>
        )}
      </div>
      <h3 className="mt-3 font-display text-lg font-bold leading-snug">{goal.title}</h3>
      <p className="mt-1 text-xs text-ink-500">Horizon · {HORIZONS[goal.horizon] || '—'}</p>
    </div>
  )
}

function NextStep({ icon, title, children }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="shrink-0 grid place-items-center h-9 w-9 rounded-full bg-grape-50 text-grape-700 text-lg">
        {icon}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-ink-500">{children}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const {
    profile,
    addAsset, removeAsset, updateAsset,
    addLiability, removeLiability, updateLiability,
    addGoal, removeGoal, updateGoal,
    updateRate,
    updateSection,
    seedFromFinances,
  } = usePlanner()
  const [params] = useSearchParams()
  const rawView = params.get('view') || 'home'
  // back-compat: old /dashboard?view=goals links land on the new snapshot tab
  const view = rawView === 'goals' ? 'snapshot' : rawView

  // Modal state for adding items on the snapshot view
  const [addingType, setAddingType] = useState(null) // 'asset' | 'liability' | 'goal' | null
  // Modal state for editing an existing hex — { type, item } | null
  const [editing, setEditing] = useState(null)

  // Seed assets/liabilities from wizard finances the first time we
  // visit the snapshot view, so it isn't empty.
  useEffect(() => {
    if (view === 'snapshot' && profile && !profile.snapshotSeeded) {
      seedFromFinances()
    }
  }, [view, profile, seedFromFinances])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  if (!profile) return null

  const topGoals = (profile.priorities || [])
    .map((id) => profile.goals.find((g) => g.id === id))
    .filter(Boolean)

  const inc = Number(profile.finances.monthlyIncome) || 0
  const exp = Number(profile.finances.monthlyExpenses) || 0
  const cash = Number(profile.finances.liquidAssets) || 0
  const inv = Number(profile.finances.investments) || 0
  const realEstate = Number(profile.finances.realEstate) || 0
  const debt = Number(profile.finances.debts) || 0
  const monthly = inc - exp
  const savingsRate = inc > 0 ? Math.round((monthly / inc) * 100) : null
  const runwayMonths = exp > 0 ? +(cash / exp).toFixed(1) : null
  const netWorth = cash + inv + realEstate - debt

  const rateTone = savingsRate === null ? 'default'
    : savingsRate >= 15 ? 'good'
    : savingsRate >= 0 ? 'warn'
    : 'bad'
  const runwayTone = runwayMonths === null ? 'default'
    : runwayMonths >= 6 ? 'good'
    : runwayMonths >= 3 ? 'warn'
    : 'bad'

  // Next-step suggestions based on answers
  const suggestions = []
  if (runwayMonths !== null && runwayMonths < 3) {
    suggestions.push({ icon: '🛟', title: 'Build a starter emergency fund',
      text: 'Aim for one month of expenses in a high-yield savings account.' })
  }
  if (savingsRate !== null && savingsRate < 10 && inc > 0) {
    suggestions.push({ icon: '🔍', title: 'Find 5% of slack in your budget',
      text: 'Review subscriptions and top two categories to carve out room.' })
  }
  if (debt > 0 && inc > 0 && debt / Math.max(inc, 1) > 3) {
    suggestions.push({ icon: '🧯', title: 'Pay down high-interest debt',
      text: 'Prioritize any balance above ~7% APR before investing more.' })
  }
  if (topGoals.length >= 1) {
    suggestions.push({ icon: '🎯', title: `Plan one action for "${topGoals[0].title}"`,
      text: 'Pick a single, concrete next step you can do this week.' })
  }
  if (profile.finances.riskTolerance === 'high' && inv === 0) {
    suggestions.push({ icon: '🚀', title: 'Open an investment account',
      text: 'You marked yourself as ambitious — let compounding do its thing.' })
  }
  if (suggestions.length === 0) {
    suggestions.push({ icon: '✨', title: 'Nice work — pick your weekly focus',
      text: 'Choose one top-3 goal and set a 20-minute action for this week.' })
  }

  // ----- View switches -------------------------------------------------

  if (view === 'snapshot') {
    return <SnapshotView
      profile={profile}
      addingType={addingType}
      setAddingType={setAddingType}
      editing={editing}
      setEditing={setEditing}
      addAsset={addAsset}
      removeAsset={removeAsset}
      updateAsset={updateAsset}
      addLiability={addLiability}
      removeLiability={removeLiability}
      updateLiability={updateLiability}
      addGoal={addGoal}
      removeGoal={removeGoal}
      updateGoal={updateGoal}
    />
  }

  if (view === 'money') {
    return (
      <div className="space-y-6">
        <Header view="money" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Monthly income"   value={fmtMoney(inc)} />
          <StatCard label="Monthly expenses" value={fmtMoney(exp)} />
          <StatCard label="Savings rate"
            value={savingsRate === null ? '—' : `${savingsRate}%`}
            hint={savingsRate === null ? 'Add income & expenses' : savingsRate >= 20 ? 'Excellent' : savingsRate >= 10 ? 'Solid' : 'Room to grow'}
            tone={rateTone} />
          <StatCard label="Runway"
            value={runwayMonths === null ? '—' : `${runwayMonths} mo`}
            hint={runwayMonths === null ? 'Add savings & expenses' : runwayMonths >= 6 ? 'Well covered' : runwayMonths >= 3 ? 'Getting there' : 'Build the cushion'}
            tone={runwayTone} />
        </div>
        <ContributionsCard profile={profile} updateSection={updateSection} />

        <RatesCard rates={profile.rates} updateRate={updateRate} />

        <div className="card">
          <h3 className="font-display font-bold">Risk tolerance</h3>
          <p className="text-sm text-ink-500 mt-1 capitalize">
            {profile.finances.riskTolerance
              ? `${profile.finances.riskTolerance} — we'll tilt suggestions accordingly.`
              : 'Not set yet. Update it in your profile.'}
          </p>
        </div>
      </div>
    )
  }

  if (view === 'profile') {
    return (
      <div className="space-y-6">
        <Header view="profile" />
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-hero-gradient shadow-glow grid place-items-center text-white font-bold text-xl">
              {(user?.username || '?').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-display text-xl font-extrabold">{profile.personal.fullName || user?.username}</p>
              <p className="text-sm text-ink-500">@{user?.username} · {user?.email}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 text-sm">
            <Info k="Age range" v={profile.personal.ageRange} />
            <Info k="Life stage" v={profile.personal.lifeStage} />
            <Info k="Location" v={profile.personal.location} />
            <Info k="Focus area" v={CATEGORIES[profile.preferences.focusArea]?.label} />
          </dl>
        </div>
        <Link to="/wizard" className="btn-secondary w-full sm:w-auto">Update answers in the wizard</Link>
      </div>
    )
  }

  // Default home
  return (
    <div className="space-y-6">
      <Header view="home" greeting={greeting} name={profile.personal.fullName || user?.username} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Top goals"      value={topGoals.length} hint="From your wizard" />
        <StatCard label="Savings rate"   value={savingsRate === null ? '—' : `${savingsRate}%`} tone={rateTone} />
        <StatCard label="Runway"         value={runwayMonths === null ? '—' : `${runwayMonths} mo`} tone={runwayTone} />
        <StatCard label="Net position"   value={fmtMoney(netWorth)} />
      </div>

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display text-lg font-bold">Your top 3 focus</h2>
          <Link to="/dashboard?view=goals" className="text-sm font-semibold text-grape-700">See all →</Link>
        </div>
        {topGoals.length === 0 ? <EmptyGoals /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topGoals.slice(0, 3).map((g, i) => <GoalCard key={g.id} goal={g} rank={i + 1} />)}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-bold">Suggested next steps</h2>
        <p className="text-sm text-ink-500 mt-0.5">Tuned to what you shared in the wizard.</p>
        <div className="mt-5 space-y-4">
          {suggestions.slice(0, 4).map((s, i) => (
            <NextStep key={i} icon={s.icon} title={s.title}>{s.text}</NextStep>
          ))}
        </div>
      </section>
    </div>
  )
}

function Header({ view, greeting, name }) {
  const titles = {
    home:     { h: greeting ? `${greeting}, ${name || 'friend'}` : 'Dashboard', s: "Here's the shape of your plan today." },
    snapshot: { h: 'Snapshot',       s: 'Your assets, liabilities, and goals — one hex at a time.' },
    money:    { h: 'Your money',     s: 'A live view of the numbers you shared.' },
    profile:  { h: 'Your profile',   s: 'The context we use to personalize things.' },
  }
  const t = titles[view] || titles.home
  return (
    <div>
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">{t.h}</h1>
      <p className="mt-1 text-ink-500">{t.s}</p>
    </div>
  )
}

function Info({ k, v }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{k}</p>
      <p className="mt-0.5 font-semibold">{v || '—'}</p>
    </div>
  )
}

// ----- Monthly contributions (Money view) --------------------------------

function ContributionsCard({ profile, updateSection }) {
  const income           = Number(profile.finances?.monthlyIncome)    || 0
  const bareNecessities  = Number(profile.finances?.bareNecessities)  || 0

  // Wealth generation = every hex's monthly contribution / payment
  const wealthGen = (
    (profile.assets || []).reduce((s, a) => s + (Number(a.monthlyPayment) || 0), 0) +
    (profile.liabilities || []).reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0)
  )

  const allocated = wealthGen + bareNecessities
  const discretionary = Math.max(0, income - allocated)
  const overSpent = income > 0 && allocated > income
  const shortfall = overSpent ? allocated - income : 0

  // Share of income (falls back to allocated total when income is missing)
  const denom = income > 0 ? income : Math.max(allocated, 1)
  const pct = (v) => Math.round((v / denom) * 100)

  const rows = [
    {
      key: 'wealth',
      label: 'Wealth Generation',
      amount: wealthGen,
      pct: pct(wealthGen),
      hint: 'Sum of every hex\'s monthly contribution or payment on the Snapshot.',
      bar: 'bg-brand-500',
      dot: 'bg-brand-500',
    },
    {
      key: 'necessities',
      label: 'Bare Necessities',
      amount: bareNecessities,
      pct: pct(bareNecessities),
      hint: 'Fixed expenditures — rent, utilities, insurance, groceries.',
      bar: 'bg-amber-500',
      dot: 'bg-amber-500',
      editable: true,
    },
    {
      key: 'discretionary',
      label: 'Discretionary Spending',
      amount: discretionary,
      pct: pct(discretionary),
      hint: overSpent
        ? `Over-allocated by ${fmtMoney(shortfall)} — trim somewhere or increase income.`
        : 'What\'s left over after the above — eating out, hobbies, travel.',
      bar: 'bg-grape-500',
      dot: 'bg-grape-500',
      warn: overSpent,
    },
  ]

  return (
    <div className="card">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-display font-bold text-lg">Monthly contributions</h3>
        <p className="text-xs text-ink-500">
          Income {fmtMoney(income)} · Allocated {fmtMoney(allocated)}
        </p>
      </div>

      {/* Stacked bar */}
      <div className="mt-4 h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
        <div className="bg-brand-500"  style={{ width: `${Math.min(100, pct(wealthGen))}%` }} />
        <div className="bg-amber-500"  style={{ width: `${Math.min(100, pct(bareNecessities))}%` }} />
        <div className="bg-grape-500"  style={{ width: `${Math.min(100, pct(discretionary))}%` }} />
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.key} className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${r.dot}`} />
                <p className="font-semibold truncate">{r.label}</p>
              </div>
              <div className="text-right">
                <p className={`font-display font-extrabold ${r.warn ? 'text-red-600' : ''}`}>
                  {fmtMoney(r.amount)}
                </p>
                <p className="text-[11px] text-ink-500">{r.pct}% of income</p>
              </div>
            </div>

            <p className={`mt-1 text-xs ${r.warn ? 'text-red-600' : 'text-ink-500'}`}>
              {r.hint}
            </p>

            {r.editable && (
              <div className="relative mt-3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  className="input pl-8 pr-12 bg-white"
                  placeholder="0"
                  value={profile.finances?.bareNecessities ?? ''}
                  onChange={(e) => updateSection('finances', { bareNecessities: e.target.value })}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">
                  /mo
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ----- Rates (Money view) ------------------------------------------------

const ASSET_RATE_FIELDS = [
  { key: 'savings',     label: 'Savings',                    hint: 'High-yield / chequing APY' },
  { key: 'retirement',  label: 'Retirement investments',     hint: 'RRSP, 401(k), pension' },
  { key: 'investments', label: 'Investments',                hint: 'Brokerage, TFSA, taxable' },
  { key: 'realEstate',  label: 'Capital gains on real estate', hint: 'Annual appreciation %' },
  { key: 'crypto',      label: 'Gains on crypto',            hint: 'Expected annual return' },
]

const LIABILITY_RATE_FIELDS = [
  { key: 'creditCard',   label: 'Credit cards',    hint: 'APR on balances carried' },
  { key: 'lineOfCredit', label: 'Line of credit',  hint: 'HELOC / unsecured LOC rate' },
  { key: 'overdueBills', label: 'Overdue bills',   hint: 'Late-fee interest rate' },
  { key: 'carLoan',      label: 'Car loans',       hint: 'Auto financing APR' },
  { key: 'mortgage',     label: 'Mortgage',        hint: 'Current mortgage rate' },
]

function RateField({ label, hint, value, onChange, accent }) {
  return (
    <div>
      <label className="label flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {hint && <span className="text-[11px] font-normal text-ink-400">{hint}</span>}
      </label>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className={`input pr-10 ${accent || ''}`}
          placeholder="0.0"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 font-semibold">%</span>
      </div>
    </div>
  )
}

function RatesCard({ rates, updateRate }) {
  const assetRates     = rates?.asset     || {}
  const liabilityRates = rates?.liability || {}

  return (
    <div className="card">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-display font-bold text-lg">Growth & interest rates</h3>
        <p className="text-xs text-ink-500">
          Applied per type. We'll use these to project future values on your Snapshot.
        </p>
      </div>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        {/* Assets column */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            <h4 className="font-display font-bold text-brand-700 uppercase text-xs tracking-wider">
              Assets · ROI
            </h4>
          </div>
          <div className="space-y-4">
            {ASSET_RATE_FIELDS.map((f) => (
              <RateField
                key={f.key}
                label={f.label}
                hint={f.hint}
                value={assetRates[f.key]}
                onChange={(v) => updateRate('asset', f.key, v)}
                accent="focus:ring-brand-400"
              />
            ))}
          </div>
        </div>

        {/* Liabilities column */}
        <div className="md:border-l md:border-slate-100 md:pl-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <h4 className="font-display font-bold text-red-700 uppercase text-xs tracking-wider">
              Liabilities · Interest
            </h4>
          </div>
          <div className="space-y-4">
            {LIABILITY_RATE_FIELDS.map((f) => (
              <RateField
                key={f.key}
                label={f.label}
                hint={f.hint}
                value={liabilityRates[f.key]}
                onChange={(v) => updateRate('liability', f.key, v)}
                accent="focus:ring-red-400"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyGoals() {
  return (
    <div className="card text-center">
      <p className="text-ink-500">No goals yet.</p>
      <Link to="/wizard" className="btn-primary mt-3 inline-flex">Add some in the wizard</Link>
    </div>
  )
}

// ----- Snapshot (hex grid) ----------------------------------------------

const SNAPSHOT_FILTERS = [
  { id: 'all',         label: 'All',         tone: 'ink' },
  { id: 'assets',      label: 'Assets',      tone: 'brand' },
  { id: 'liabilities', label: 'Liabilities', tone: 'red' },
  { id: 'goals',       label: 'Goals',       tone: 'slate' },
]

const GOAL_CAT_EMOJI = {
  money: '💰', career: '🧑‍💻', health: '💪',
  learning: '📚', relationships: '❤️', lifestyle: '🌿',
}
const HORIZON_LABEL = { short: '0–1 yr', mid: '1–3 yrs', long: '3+ yrs' }

function SnapshotView({
  profile,
  addingType, setAddingType,
  editing, setEditing,
  addAsset, removeAsset, updateAsset,
  addLiability, removeLiability, updateLiability,
  addGoal, removeGoal, updateGoal,
}) {
  const [filter, setFilter] = useState('all')

  // Projection controls
  const [unit, setUnit]       = useState('years') // 'months' | 'years'
  const [periods, setPeriods] = useState(0)
  const years = unit === 'months' ? periods / 12 : periods

  const assets = profile.assets || []
  const liabilities = profile.liabilities || []
  const goals = profile.goals || []
  const rates = profile.rates

  // Projected values per hex — recompute only when inputs change
  const projectedAssets = useMemo(() =>
    assets.map((a) => ({
      ...a,
      projected: futureValue(
        'asset',
        a.amount,
        annualRatePct('asset', a, rates),
        years,
        a.monthlyPayment,
      ),
    })),
    [assets, rates, years],
  )
  const projectedLiabilities = useMemo(() =>
    liabilities.map((l) => ({
      ...l,
      projected: futureValue(
        'liability',
        l.amount,
        annualRatePct('liability', l, rates),
        years,
        l.monthlyPayment,
      ),
    })),
    [liabilities, rates, years],
  )

  // KPI totals use the projected values so they also slide with the bar
  const totalAssets      = projectedAssets.reduce((s, a) => s + a.projected, 0)
  const totalLiabilities = projectedLiabilities.reduce((s, l) => s + l.projected, 0)
  const netWorth = totalAssets - totalLiabilities

  const showAssets      = filter === 'all' || filter === 'assets'
  const showLiabilities = filter === 'all' || filter === 'liabilities'
  const showGoals       = filter === 'all' || filter === 'goals'

  // Add: new signature is (type, payload)
  const handleAddSubmit = (type, payload) => {
    if (type === 'asset') addAsset(payload)
    else if (type === 'liability') addLiability(payload)
    else if (type === 'goal') addGoal(payload)
    setAddingType(null)
  }

  // Edit: update in place when classification is unchanged, otherwise
  // remove from the old bucket and add to the new one.
  const handleEditSubmit = (newType, payload) => {
    if (!editing) return
    const { type: oldType, item } = editing
    if (newType === oldType) {
      if (newType === 'asset')     updateAsset(item.id, payload)
      else if (newType === 'liability') updateLiability(item.id, payload)
      else if (newType === 'goal') updateGoal(item.id, payload)
    } else {
      if (oldType === 'asset')     removeAsset(item.id)
      else if (oldType === 'liability') removeLiability(item.id)
      else if (oldType === 'goal') removeGoal(item.id)
      if (newType === 'asset')     addAsset(payload)
      else if (newType === 'liability') addLiability(payload)
      else if (newType === 'goal') addGoal(payload)
    }
    setEditing(null)
  }

  const handleEditDelete = () => {
    if (!editing) return
    const { type, item } = editing
    if (type === 'asset')     removeAsset(item.id)
    else if (type === 'liability') removeLiability(item.id)
    else if (type === 'goal') removeGoal(item.id)
    setEditing(null)
  }

  const isEmpty = assets.length + liabilities.length + goals.length === 0

  return (
    <div className="space-y-6">
      <Header view="snapshot" />

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card bg-gradient-to-br from-brand-50 to-white border-brand-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Assets</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{fmtMoney(totalAssets)}</p>
          <p className="mt-1 text-xs text-ink-500">{assets.length} item{assets.length === 1 ? '' : 's'}</p>
        </div>
        <div className="card bg-gradient-to-br from-red-50 to-white border-red-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Liabilities</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{fmtMoney(totalLiabilities)}</p>
          <p className="mt-1 text-xs text-ink-500">{liabilities.length} item{liabilities.length === 1 ? '' : 's'}</p>
        </div>
        <div className="card bg-card-gradient">
          <p className="text-xs font-semibold uppercase tracking-wide text-grape-700">Net worth</p>
          <p className={`mt-1 font-display text-2xl font-extrabold ${netWorth < 0 ? 'text-red-600' : ''}`}>
            {fmtMoney(netWorth)}
          </p>
          <p className="mt-1 text-xs text-ink-500">Assets − liabilities</p>
        </div>
      </div>

      {/* Filter + add buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter snapshot">
          {SNAPSHOT_FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`chip border ${
                filter === f.id
                  ? 'bg-grape-50 border-grape-400 text-grape-800'
                  : 'bg-white border-slate-200 text-ink-500 hover:border-grape-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAddingType('asset')}
            className="btn-secondary !py-2 !px-4 text-sm border-brand-200 text-brand-700 hover:bg-brand-50"
          >+ Asset</button>
          <button
            onClick={() => setAddingType('liability')}
            className="btn-secondary !py-2 !px-4 text-sm border-red-200 text-red-700 hover:bg-red-50"
          >+ Liability</button>
          <button
            onClick={() => setAddingType('goal')}
            className="btn-secondary !py-2 !px-4 text-sm"
          >+ Goal</button>
        </div>
      </div>

      {/* Hex grid — tightly packed honeycomb (see .honeycomb in index.css) */}
      <div className="honeycomb">
        {showAssets && projectedAssets.map((a) => (
          <Hex
            key={a.id}
            tone="asset"
            as="button"
            icon="🟢"
            title={a.label}
            subtitle={fmtMoney(a.projected)}
            onClick={() => setEditing({ type: 'asset', item: a })}
            onRemove={() => removeAsset(a.id)}
          />
        ))}

        {showLiabilities && projectedLiabilities.map((l) => (
          <Hex
            key={l.id}
            tone="liability"
            as="button"
            icon="🔻"
            title={l.label}
            subtitle={fmtMoney(l.projected)}
            onClick={() => setEditing({ type: 'liability', item: l })}
            onRemove={() => removeLiability(l.id)}
          />
        ))}

        {showGoals && goals.map((g) => (
          <Hex
            key={g.id}
            tone="goal"
            as="button"
            icon={GOAL_CAT_EMOJI[g.category] || '🎯'}
            title={g.title}
            subtitle={HORIZON_LABEL[g.horizon] || ''}
            onClick={() => setEditing({ type: 'goal', item: g })}
            onRemove={() => removeGoal(g.id)}
          />
        ))}
      </div>

      {isEmpty && (
        <p className="text-center text-sm text-ink-500">
          Start by adding a hex for an asset you own, a debt you owe, or a goal you're chasing.
        </p>
      )}

      {/* Projection slider — drives FV math for every hex above */}
      {!isEmpty && (
        <ProjectionSlider
          unit={unit} setUnit={setUnit}
          periods={periods} setPeriods={setPeriods}
          projectedNet={netWorth}
        />
      )}

      {addingType && (
        <AddItemModal
          type={addingType}
          mode="add"
          onClose={() => setAddingType(null)}
          onSubmit={handleAddSubmit}
        />
      )}

      {editing && (
        <AddItemModal
          type={editing.type}
          mode="edit"
          initialValue={editing.item}
          onClose={() => setEditing(null)}
          onSubmit={handleEditSubmit}
          onDelete={handleEditDelete}
        />
      )}
    </div>
  )
}

// Slider that drives the future-value projection across every hex.
function ProjectionSlider({ unit, setUnit, periods, setPeriods, projectedNet }) {
  const max = unit === 'months' ? 60 : 40
  const suffix = unit === 'months' ? 'mo' : (periods === 1 ? 'yr' : 'yrs')
  const label = periods === 0 ? 'Today' : `${periods} ${suffix}`

  const switchUnit = (next) => {
    if (next === unit) return
    // Keep the slider visually close to where it was when toggling unit.
    if (next === 'years' && unit === 'months') {
      setPeriods(Math.round(periods / 12))
    } else if (next === 'months' && unit === 'years') {
      setPeriods(Math.min(60, periods * 12))
    }
    setUnit(next)
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg">Project into the future</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Each hex compounds at its type's rate from the Money page.
          </p>
        </div>
        <div className="inline-flex bg-slate-100 rounded-full p-1 text-sm font-semibold">
          {['months', 'years'].map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => switchUnit(u)}
              className={`px-3 py-1 rounded-full transition ${
                unit === u
                  ? 'bg-white text-ink-900 shadow-soft'
                  : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {u[0].toUpperCase() + u.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <span className="font-display text-3xl font-extrabold text-grape-700">{label}</span>
        <span className="text-xs text-ink-500 text-right">
          Projected net worth
          <span className={`ml-2 font-display font-bold ${projectedNet < 0 ? 'text-red-600' : 'text-ink-900'}`}>
            {fmtMoney(projectedNet)}
          </span>
        </span>
      </div>

      <input
        type="range"
        min="0"
        max={max}
        step="1"
        value={periods}
        onChange={(e) => setPeriods(Number(e.target.value))}
        className="w-full mt-3 accent-grape-600"
        aria-label={`Projection horizon in ${unit}`}
      />
      <div className="flex justify-between text-[11px] text-ink-400 mt-1">
        <span>Today</span>
        <span>{max} {unit === 'months' ? 'mo' : 'yrs'}</span>
      </div>
    </div>
  )
}
