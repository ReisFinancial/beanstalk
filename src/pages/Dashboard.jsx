import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePlanner } from '../context/PlannerContext.jsx'
import Hex from '../components/Hex.jsx'
import AddItemModal from '../components/AddItemModal.jsx'
import WealthMark, { wealthLevel, WEALTH_LEVELS } from '../components/WealthMark.jsx'
import BuyingPowerModal, { buyingPowerTier, BUYING_POWER_TIER_META } from '../components/BuyingPowerModal.jsx'
import TrueNumberCard from '../components/TrueNumberCard.jsx'
import CompareCitiesCard from '../components/CompareCitiesCard.jsx'
import TrueNumberDetail from '../components/TrueNumberDetail.jsx'
import { useTrueNumberV2 } from '../utils/useTrueNumberV2.js'
import { fmtYears } from '../utils/displayMoney.js'
import { PRIORITY_TEMPLATES } from '../data/wizardTemplates.js'
import { ageFromPersonal, MONTH_NAMES } from '../utils/age.js'
import ActionPlanner from '../components/ActionPlanner.jsx'
import { formatLocation } from './Wizard.jsx'


// ----- Future-value helpers --------------------------------------------

// Cheap keyword-based fallback so wizard-seeded or pre-existing hexes
// without an explicit subtype still get a reasonable rate.
function inferSubtype(type, label) {
  const s = (label || '').toLowerCase()
  if (type === 'asset') {
    if (/saving|chequing|checking|\bcash\b/.test(s)) return 'savings'
    if (/pension/.test(s))                            return 'pension'
    if (/retire|rrsp|401/.test(s))                    return 'retirement'
    if (/real estate|property|home equity|house/.test(s)) return 'realEstate'
    if (/crypto|bitcoin|eth|btc/.test(s))            return 'crypto'
    if (/\bcar\b|\bauto\b|vehicle|truck|motorcycle/.test(s)) return 'vehicle'
    if (/stock option|\brsu\b|\beso\b/.test(s))      return 'stockOptions'
    if (/collectible|pokemon|sneaker|\bcard\b|\bart\b|watch|wine|vintage|antique|\bnft\b/.test(s)) return 'collectibles'
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
  // Per-asset override wins — used by stockOptions (and any future
  // "user sets their own ROI" subtype).
  if (type === 'asset' && item?.customRate !== undefined && item.customRate !== null && item.customRate !== '') {
    const r = Number(item.customRate)
    if (Number.isFinite(r)) return r
  }
  const scope = type === 'asset' ? 'asset' : 'liability'
  const key   = item.subtype || inferSubtype(type, item.label)
  // Pension assets fall back to the retirement rate so the user doesn't
  // need to set yet another Money-page field.
  if (type === 'asset' && key === 'pension') {
    return Number(rates?.asset?.retirement) || 0
  }
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
 * - Vehicles depreciate 40% per year and floor at 10% of the original
 *   value — the standard appreciation math doesn't apply.
 */
function futureValue(type, pv, ratePct, years, pmt = 0, subtype = null) {
  const principal = Number(pv) || 0
  const payment   = Number(pmt) || 0
  if (years <= 0) return principal

  // Vehicles depreciate, regardless of any rate that may have been set.
  if (type === 'asset' && subtype === 'vehicle') {
    const depreciated = principal * Math.pow(0.6, years)
    return Math.max(depreciated, principal * 0.1)
  }

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

// Format a goal's target age relative to the user's current age.
// Returns "" when either piece is missing so the caller can render
// nothing rather than a dangling label.

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

// Quick formatter for action-plan timeline tags. Months → "Today" / "X mo" /
// "X yr" / "X yr Y mo" — matches the gameboard's fmtTimeline output.
function fmtActionMonths(months) {
  const m = Number(months) || 0
  if (m <= 0) return 'Today'
  const y = Math.floor(m / 12)
  const r = m % 12
  if (y === 0) return `${r} mo`
  if (r === 0) return `${y} yr`
  return `${y} yr ${r} mo`
}

// Renders the persistent action plan checklist on the dashboard home.
// Steps come from gameboard moves and live in profile.actionPlan so they
// survive navigation. Users can tick items off or dismiss them here, just
// like in the Play page's own list.
function ActionPlanCard({ actionPlan, onToggle, onRemove }) {
  const [showAll, setShowAll] = useState(false)
  const all = actionPlan || []
  const unchecked = all.filter((a) => !a.done)
  const doneCount = all.length - unchecked.length

  if (all.length === 0) {
    return (
      <section className="card">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display text-lg font-bold">Your action plan</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              Strategic moves from the Play page show up here so you can act
              on them in real life.
            </p>
          </div>
          <Link to="/gameboard" className="text-sm font-semibold text-grape-700">
            Open Play →
          </Link>
        </div>
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
          <div className="text-3xl">🎮</div>
          <p className="text-sm text-ink-400 mt-1">
            Run a what-if scenario on the Play page to start building your plan.
          </p>
        </div>
      </section>
    )
  }

  // Default to the next five things to do. Expand to the full list (incl.
  // completed) when the user clicks "Show all".
  const visible = showAll ? all : unchecked.slice(0, 5)
  const hiddenCount = all.length - visible.length

  return (
    <section className="card">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold">Your action plan</h2>
          <p className="text-sm text-ink-500 mt-0.5">
            {doneCount} of {all.length} steps complete.
          </p>
        </div>
        <Link to="/gameboard" className="text-sm font-semibold text-grape-700">
          Open Play →
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-6 text-center">
          <p className="font-display text-base font-extrabold text-brand-700">🎉 All caught up</p>
          <p className="text-sm text-ink-500 mt-1">
            Every active step is checked off. Plan another what-if?
          </p>
        </div>
      ) : (
        <ol className="mt-4 space-y-2">
          {visible.map((step, i) => (
            <ActionPlanStep
              key={step.id}
              step={step}
              index={i + 1}
              onToggle={() => onToggle(step.id)}
              onRemove={() => onRemove(step.id)}
            />
          ))}
        </ol>
      )}

      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-sm font-semibold text-grape-700 hover:text-grape-900"
        >
          Show all {all.length} steps
        </button>
      )}
      {showAll && all.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-3 text-sm font-semibold text-grape-700 hover:text-grape-900"
        >
          Show only upcoming
        </button>
      )}
    </section>
  )
}

function ActionPlanStep({ step, index, onToggle, onRemove }) {
  const tone = step.kind === 'mortgage' || step.kind === 'loan' || step.kind === 'tax'
    ? 'border-amber-200 bg-amber-50/40'
    : step.kind === 'contribution'
    ? 'border-grape-200 bg-grape-50/40'
    : 'border-brand-200 bg-brand-50/40'
  return (
    <li>
      <div className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
        step.done ? 'border-slate-200 bg-slate-50 opacity-70' : tone
      }`}>
        <input
          type="checkbox"
          checked={Boolean(step.done)}
          onChange={onToggle}
          className="mt-1 h-5 w-5 rounded accent-grape-600 shrink-0 cursor-pointer"
          aria-label={`Mark step ${index} done`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none shrink-0" aria-hidden="true">
              {step.emoji}
            </span>
            <p className={`text-sm font-semibold flex-1 leading-snug ${
              step.done ? 'line-through text-ink-400' : ''
            }`}>
              {step.title}
            </p>
            <span className={`chip shrink-0 ${
              step.done ? 'bg-slate-100 text-ink-400' : 'bg-white border border-slate-200 text-ink-500'
            }`}>
              {fmtActionMonths(step.month)}
            </span>
          </div>
          {step.detail && (
            <p className={`text-xs mt-1 ${step.done ? 'text-ink-300' : 'text-ink-500'}`}>
              {step.detail}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 h-7 w-7 grid place-items-center rounded-full text-ink-300
                     hover:text-ink-700 hover:bg-slate-100"
          aria-label="Remove step"
          title="Remove step"
        >
          ✕
        </button>
      </div>
    </li>
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
    updateProfile,
    seedFromFinances,
  } = usePlanner()
  const [params] = useSearchParams()
  // Retired views: 'money' merged into the snapshot; 'goals' removed (ideal-life
  // goals and priorities now come from the wizard). Old links still land somewhere.
  const rawView = params.get('view') || 'home'
  const view = rawView === 'money' ? 'snapshot' : rawView === 'goals' ? 'home' : rawView

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

  // Top priorities come from the wizard's Step 5 templated ranking — falls
  // back to the templates' natural order when the user never reordered.
  const rankedPriorities = (profile.priorityRanking?.length
    ? profile.priorityRanking
    : PRIORITY_TEMPLATES.map((t) => t.id))
    .map((id) => PRIORITY_TEMPLATES.find((t) => t.id === id))
    .filter(Boolean)

  // Same sources as the Snapshot ("Your starting point") so the two views
  // never disagree: hexes for net worth, cashflow inputs for the rates.
  const assetList = profile.assets || []
  const liabilityList = profile.liabilities || []
  const inc = Number(profile.finances.monthlyIncome) || 0
  const exp = Number(profile.finances.bareNecessities) || 0
  const contributions =
    assetList.reduce((s, a) => s + (Number(a.monthlyPayment) || 0), 0) +
    liabilityList.reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0)
  const cash = assetList
    .filter((a) => (a.subtype || inferSubtype('asset', a.label)) === 'savings')
    .reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const inv = assetList
    .filter((a) => ['investments', 'retirement'].includes(a.subtype || inferSubtype('asset', a.label)))
    .reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const debt = liabilityList.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const savingsRate = inc > 0 ? Math.round((contributions / inc) * 100) : null
  const runwayMonths = exp > 0 ? +(cash / exp).toFixed(1) : null
  const netWorth = assetList.reduce((s, a) => s + (Number(a.amount) || 0), 0) - debt

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
  if (rankedPriorities.length >= 1) {
    suggestions.push({ icon: rankedPriorities[0].emoji, title: `Plan one action for "${rankedPriorities[0].title}"`,
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
      updateSection={updateSection}
      updateRate={updateRate}
    />
  }

  if (view === 'number') {
    return <TrueNumberDetail profile={profile} />
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
            <Info
              k="Age"
              v={(() => {
                const a = ageFromPersonal(profile.personal)
                const m = Number(profile.personal.birthMonth)
                const y = Number(profile.personal.birthYear)
                const dob = Number.isFinite(m) && m >= 1 && m <= 12 && Number.isFinite(y) && y > 0
                  ? `${MONTH_NAMES[m - 1]} ${y}`
                  : null
                if (a == null && !dob) return ''
                if (dob && a != null) return `${Math.floor(a)} yrs (${dob})`
                return a != null ? `${Math.floor(a)} yrs` : dob
              })()}
            />
            <Info k="Life stage" v={
              Array.isArray(profile.personal.lifeStage)
                ? (profile.personal.lifeStage.length ? profile.personal.lifeStage.join(', ') : '')
                : profile.personal.lifeStage
            } />
            <Info k="Location" v={formatLocation(profile.personal)} />
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

      <TrueNumberCard profile={profile} />
      <CompareCitiesCard profile={profile} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly income" value={inc > 0 ? fmtMoney(inc) : '—'} hint={inc > 0 ? 'After tax' : 'Add in Snapshot'} />
        <StatCard label="Savings rate"   value={savingsRate === null ? '—' : `${savingsRate}%`} tone={rateTone}
          hint={savingsRate === null ? 'Add income in Snapshot' : 'Monthly contributions ÷ income'} />
        <StatCard label="Runway"         value={runwayMonths === null ? '—' : `${runwayMonths} mo`} tone={runwayTone}
          hint={runwayMonths === null ? 'Add savings + necessities' : 'Savings ÷ bare necessities'} />
        <StatCard label="Net worth"      value={fmtMoney(netWorth)} hint="Everything you own − owe" />
      </div>

      <ActionPlanCard
        actionPlan={profile.actionPlan || []}
        onToggle={(id) => updateProfile((cur) => ({
          actionPlan: (cur.actionPlan || []).map((a) =>
            a.id === id ? { ...a, done: !a.done } : a,
          ),
        }))}
        onRemove={(id) => updateProfile((cur) => ({
          actionPlan: (cur.actionPlan || []).filter((a) => a.id !== id),
        }))}
      />

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display text-lg font-bold">Your top 3 priorities</h2>
          <Link to="/wizard" className="text-sm font-semibold text-grape-700">Re-rank →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rankedPriorities.slice(0, 3).map((t, i) => (
            <div key={t.id} className="card !p-4 flex items-start gap-3">
              <span className="grid place-items-center h-8 w-8 rounded-full text-xs font-bold bg-hero-gradient text-white shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold"><span className="mr-1">{t.emoji}</span>{t.title}</p>
                <p className="text-xs text-ink-500 mt-0.5">{t.detail}</p>
              </div>
            </div>
          ))}
        </div>
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
    snapshot: { h: 'Your starting point', s: 'Where you are today — what your True Number measures against.' },
    goals:    { h: 'Goals',          s: 'What you\'re working toward, hex by hex.' },
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
  const buyingPower      = profile.finances?.buyingPowerAssessment || null
  const [assessingBuyingPower, setAssessingBuyingPower] = useState(false)

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
      assessable: true,
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
                {r.assessable && buyingPower && (() => {
                  const tierMeta = BUYING_POWER_TIER_META[
                    buyingPower.tier || buyingPowerTier(buyingPower.avg)
                  ]
                  return (
                    <span className={`chip shrink-0 ${tierMeta.chip}`}>
                      {tierMeta.chipShort}
                    </span>
                  )
                })()}
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

            {r.assessable && (
              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[11px] text-ink-400">
                  {buyingPower
                    ? `Last check: ${buyingPower.avg.toFixed(1)} / 10 average.`
                    : 'Not sure if this is enough? Run a quick check.'}
                </p>
                <button
                  type="button"
                  onClick={() => setAssessingBuyingPower(true)}
                  className="btn-secondary !py-1.5 !px-3 text-xs border-grape-200 text-grape-700 hover:bg-grape-50"
                >
                  {buyingPower ? 'Re-assess buying power' : 'Assess buying power'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {assessingBuyingPower && (
        <BuyingPowerModal
          initial={buyingPower}
          onClose={() => setAssessingBuyingPower(false)}
          onSave={(assessment) =>
            updateSection('finances', { buyingPowerAssessment: assessment })
          }
        />
      )}
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


// ----- Snapshot (hex grid) ----------------------------------------------

function StepHeading({ n, title, hint }) {
  return (
    <div className="flex items-start gap-3 pt-2">
      <span className="grid place-items-center h-7 w-7 rounded-full bg-hero-gradient text-white text-xs font-bold shrink-0">{n}</span>
      <div>
        <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
        <p className="text-sm text-ink-500">{hint}</p>
      </div>
    </div>
  )
}

// Ties the starting point back to the True Number so every figure entered
// below visibly moves the progress bar and timeline.
function StartingPointProgress({ profile }) {
  const { result: r, money } = useTrueNumberV2(profile)
  const pct = Math.round(r.percentToTarget * 100)
  return (
    <div className="card bg-card-gradient">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-sm">
          <span className="font-display text-xl font-extrabold">{money(r.currentNetWorth)}</span>
          <span className="text-ink-500"> of your {money(r.trueNumber)} True Number</span>
        </p>
        <p className="text-sm font-semibold text-grape-700">
          {pct}% there
          {r.yearsToTarget > 0 && <span className="text-ink-500 font-normal"> · ~{fmtYears(r.yearsToTarget)} to go</span>}
        </p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
        <div className="h-full bg-hero-gradient" style={{ width: `${Math.max(1, pct)}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-ink-500">
        Counts savings, investments, and retirement accounts, minus debts. Your home and car aren't counted — you live in and drive them.
        {r.savings.source === 'contributions' && ` Timeline uses your ${money(r.savings.annualSavings / 12)}/mo of contributions, growing at your investment return.`}
        {r.savings.source === 'income' && ' Timeline assumes you save 20% of your income — add monthly contributions to your hexes to use your real number.'}
        {r.savings.source === 'assumed' && ' Add your income and monthly contributions below to replace the assumed timeline.'}
      </p>
    </div>
  )
}

const SNAPSHOT_FILTERS = [
  { id: 'all',         label: 'All',         tone: 'ink' },
  { id: 'assets',      label: 'Assets',      tone: 'brand' },
  { id: 'liabilities', label: 'Liabilities', tone: 'red' },
]

const GOAL_CAT_EMOJI = {
  // Ideal-life categories set via the wizard
  home: '🏠', lifestyle: '✨', financial: '💫',
  // Action-oriented categories for manually-added goals
  debt: '🔻', investment: '📈', spending: '💸', other: '🎯',
  // Legacy theme categories — kept so older saved goals still render
  money: '💰', career: '🧑‍💻', health: '💪',
  learning: '📚', relationships: '❤️', lifestyle: '🌿',
}
// Merged Snapshot + Money ("Your starting point"). Three steps, top-down:
//   1. Net worth  — asset / liability hexes
//   2. Monthly cashflow — take-home income + where it goes
//   3. Growth & rates (collapsed) — projections, wealth level, return rates
// Goals no longer live here; ideal-life goals come from the wizard.
function SnapshotView({
  profile,
  addingType, setAddingType,
  editing, setEditing,
  addAsset, removeAsset, updateAsset,
  addLiability, removeLiability, updateLiability,
  updateSection, updateRate,
}) {
  const [filter, setFilter] = useState('all')
  const [showGrowth, setShowGrowth] = useState(false)

  // Projection controls
  const [unit, setUnit]       = useState('years') // 'months' | 'years'
  const [periods, setPeriods] = useState(0)
  const years = unit === 'months' ? periods / 12 : periods

  const assets = profile.assets || []
  const liabilities = profile.liabilities || []
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
        a.subtype || inferSubtype('asset', a.label),
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

  // Add: new signature is (type, payload)
  const handleAddSubmit = (type, payload) => {
    if (type === 'asset') addAsset(payload)
    else if (type === 'liability') addLiability(payload)
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
    } else {
      if (oldType === 'asset')     removeAsset(item.id)
      else if (oldType === 'liability') removeLiability(item.id)
      if (newType === 'asset')     addAsset(payload)
      else if (newType === 'liability') addLiability(payload)
    }
    setEditing(null)
  }

  const handleEditDelete = () => {
    if (!editing) return
    const { type, item } = editing
    if (type === 'asset')     removeAsset(item.id)
    else if (type === 'liability') removeLiability(item.id)
    setEditing(null)
  }

  const isEmpty = assets.length + liabilities.length === 0

  return (
    <div className="space-y-6">
      <Header view="snapshot" />

      <StartingPointProgress profile={profile} />

      <StepHeading n={1} title="What you own and owe" hint="Add each account, property, or debt. Your net worth is assets minus liabilities." />

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

      </div>

      {isEmpty && (
        <p className="text-center text-sm text-ink-500">
          Start with your biggest account — a chequing or savings balance is a great first hex.
        </p>
      )}

      <StepHeading n={2} title="Your monthly cashflow" hint="What comes in after tax, and where it goes. This sets how fast you close the gap." />

      <div className="card">
        <label className="label" htmlFor="monthly-income">Monthly take-home income</label>
        <div className="relative max-w-xs">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
          <input
            id="monthly-income"
            type="number"
            inputMode="decimal"
            min="0"
            className="input pl-8 pr-12"
            placeholder="e.g. 6500"
            value={profile.finances?.monthlyIncome ?? ''}
            onChange={(e) => updateSection('finances', { monthlyIncome: e.target.value })}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">/mo</span>
        </div>
        <p className="mt-1 text-[11px] text-ink-400">After tax, all sources combined. You can split it by source in Play.</p>
      </div>

      <ContributionsCard profile={profile} updateSection={updateSection} />

      {/* Step 3 — optional depth, collapsed by default to keep the page calm */}
      <button
        type="button"
        onClick={() => setShowGrowth((v) => !v)}
        className="w-full card !py-3 flex items-center justify-between text-left hover:border-grape-300"
        aria-expanded={showGrowth}
      >
        <span>
          <span className="font-display font-bold">Growth &amp; rates</span>
          <span className="block text-xs text-ink-500">Project your net worth forward and fine-tune return and interest rates. Optional.</span>
        </span>
        <span className="text-ink-400 text-sm">{showGrowth ? 'Hide' : 'Show'}</span>
      </button>

      {showGrowth && (
        <div className="space-y-4">
          {!isEmpty && (
            <div className="grid gap-4 lg:grid-cols-2">
              <ProjectionSlider
                unit={unit} setUnit={setUnit}
                periods={periods} setPeriods={setPeriods}
                projectedNet={netWorth}
                currentAge={ageFromPersonal(profile.personal)}
                pensionAssets={assets.filter(
                  (a) => (a.subtype || inferSubtype('asset', a.label)) === 'pension',
                )}
              />
              <WealthLevelCard netWorth={netWorth} />
            </div>
          )}
          <RatesCard rates={profile.rates} updateRate={updateRate} />
        </div>
      )}

      {addingType && (
        <AddItemModal
          type={addingType}
          mode="add"
          liabilities={liabilities}
          onClose={() => setAddingType(null)}
          onSubmit={handleAddSubmit}
        />
      )}

      {editing && (
        <AddItemModal
          type={editing.type}
          mode="edit"
          initialValue={editing.item}
          liabilities={liabilities}
          onClose={() => setEditing(null)}
          onSubmit={handleEditSubmit}
          onDelete={handleEditDelete}
        />
      )}
    </div>
  )
}

// Slider that drives the future-value projection across every hex.
function ProjectionSlider({
  unit, setUnit, periods, setPeriods,
  projectedNet, currentAge, pensionAssets = [],
}) {
  const max = unit === 'months' ? 60 : 40
  const suffix = unit === 'months' ? 'mo' : (periods === 1 ? 'yr' : 'yrs')
  // Project the user's age at the slider's current position so the user
  // sees themselves on the timeline, not just an abstract horizon.
  const ageNow = Number(currentAge) || null
  const yearsFromNow = unit === 'months' ? periods / 12 : periods
  const projectedAge = ageNow ? Math.floor(ageNow + yearsFromNow) : null
  const ageSuffix = projectedAge != null ? ` (age ${projectedAge})` : ''
  const base = periods === 0 ? 'Today' : `${periods} ${suffix}`
  const label = `${base}${ageSuffix}`

  // Pension annuity income — sums every pension whose retirement age the
  // projection has crossed. Shows as an extra cash inflow line so the
  // user sees the income stream alongside the net-worth number.
  const annuityNow = pensionAssets.reduce((s, p) => {
    const ra = Number(p.retirementAge) || Infinity
    const aa = Number(p.annualAnnuity) || 0
    if (projectedAge != null && projectedAge >= ra) return s + aa
    return s
  }, 0)

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

      {annuityNow > 0 && (
        <div className="mt-2 flex items-baseline justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            Pension annuity income
          </span>
          <span className="font-display text-sm font-extrabold text-brand-700">
            + {fmtMoney(annuityNow)} / yr
          </span>
        </div>
      )}

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

// Olive monoline illustration showing the user's current wealth level.
// Driven by the same projected net worth shown in the slider — so it
// updates live as the user edits hexes or moves the projection horizon.
function WealthLevelCard({ netWorth }) {
  const lvl = wealthLevel(netWorth)
  const meta = WEALTH_LEVELS[lvl]

  return (
    <div className="card flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg">Wealth level</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Where you sit based on projected net worth.
          </p>
        </div>
        <span className="chip border border-olive-200 bg-olive-50 text-olive-700">
          {meta.label}
        </span>
      </div>

      <div className="flex-1 grid place-items-center py-5">
        <WealthMark
          level={lvl}
          className="h-28 w-40 text-olive-600"
        />
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className={`font-display text-3xl font-extrabold ${netWorth < 0 ? 'text-red-600' : 'text-olive-700'}`}>
          {fmtMoney(netWorth)}
        </span>
        <span className="text-xs text-ink-500 text-right">
          {meta.illustration}
          <span className="block text-[11px] text-ink-400">{meta.range}</span>
        </span>
      </div>
    </div>
  )
}

// ----- Goals (hex grid) ------------------------------------------------


