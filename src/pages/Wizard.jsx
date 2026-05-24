import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePlanner } from '../context/PlannerContext.jsx'
import BeanstalkMark from '../components/BeanstalkMark.jsx'

const STEPS = [
  { id: 'welcome',    title: 'Welcome',     emoji: '👋' },
  { id: 'personal',   title: 'About you',   emoji: '🙂' },
  { id: 'goals',      title: 'Your goals',  emoji: '🎯' },
  { id: 'priorities', title: 'Priorities',  emoji: '⚖️' },
  { id: 'finances',   title: 'Money snap',  emoji: '💸' },
  { id: 'review',     title: 'Review',      emoji: '✨' },
]

// Goal categories describe the action the goal represents. Selection
// drives which extra input shows (target $ for "investment", liability
// picker for "debt").
const GOAL_CATEGORIES = [
  { id: 'debt',       label: 'Paying down a debt',           emoji: '🔻' },
  { id: 'investment', label: 'Hitting an investment target', emoji: '📈' },
  { id: 'spending',   label: 'Increase spending allocation', emoji: '💸' },
  { id: 'other',      label: 'Other',                        emoji: '🎯' },
]

const HORIZONS = [
  { id: 'short', label: '0–1 year' },
  { id: 'mid',   label: '1–3 years' },
  { id: 'long',  label: '3+ years' },
]

const SAMPLE_GOALS = [
  { title: 'Build a 6-month emergency fund', category: 'investment', horizon: 'mid',   targetAmount: 15000 },
  { title: 'Pay off credit card debt',       category: 'debt',       horizon: 'short' },
  { title: 'Save for a down payment',        category: 'investment', horizon: 'long',  targetAmount: 50000 },
  { title: 'Eat out twice a week',           category: 'spending',   horizon: 'short' },
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function ProgressBar({ step, total }) {
  const pct = Math.round(((step + 1) / total) * 100)
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-ink-500">
        <span>Step {step + 1} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-hero-gradient transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Choice({ selected, onClick, children, emoji }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-left transition ${
        selected
          ? 'border-grape-500 bg-grape-50 text-grape-800 shadow-soft'
          : 'border-slate-200 bg-white hover:border-grape-300'
      }`}
    >
      {emoji && <span className="text-xl">{emoji}</span>}
      <span className="text-sm font-semibold">{children}</span>
    </button>
  )
}

// ---- Step components ---------------------------------------------------

function StepWelcome({ profile, updateSection }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Nice to meet you 👋</h2>
      <p className="mt-1 text-ink-500 text-sm">
        Beanstalk turns a few quick answers into a dashboard that helps you decide what to do next.
      </p>
      <div className="mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="fullName">What should we call you?</label>
          <input
            id="fullName"
            className="input"
            placeholder="First name or nickname"
            value={profile.personal.fullName}
            onChange={(e) => updateSection('personal', { fullName: e.target.value })}
          />
        </div>
        <div>
          <p className="label">Where do you want to focus first?</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {GOAL_CATEGORIES.map((c) => (
              <Choice
                key={c.id}
                emoji={c.emoji}
                selected={profile.preferences.focusArea === c.id}
                onClick={() => updateSection('preferences', { focusArea: c.id })}
              >
                {c.label}
              </Choice>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Normalize lifeStage to an array — handles legacy string values lingering in
// localStorage from before this field went multi-select.
function asLifeStageArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) return [value]
  return []
}

// Country / region data ----------------------------------------------------

const COUNTRIES = [
  { id: 'CA', label: 'Canada',         regionLabel: 'Province' },
  { id: 'US', label: 'United States',  regionLabel: 'State' },
]

// Build a friendly "Region, Country" string for display, with a graceful
// fallback to any legacy freeform `location` string still on older profiles.
export function formatLocation(personal) {
  if (!personal) return ''
  const country = COUNTRIES.find((c) => c.id === personal.country)?.label
  const parts = []
  if (personal.region) parts.push(personal.region)
  if (country)         parts.push(country)
  if (parts.length)    return parts.join(', ')
  return personal.location || ''
}

const REGIONS_BY_COUNTRY = {
  CA: [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
    'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
    'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec',
    'Saskatchewan', 'Yukon',
  ],
  US: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
    'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
    'West Virginia', 'Wisconsin', 'Wyoming',
  ],
}

function StepPersonal({ profile, updateSection }) {
  const ageRanges = ['Under 25', '25–34', '35–44', '45–54', '55–64', '65+']
  const stages = ['Student', 'Single / independent', 'In a relationship', 'Parent', 'Empty nester', 'Retired']
  const selectedStages = asLifeStageArray(profile.personal.lifeStage)

  const toggleStage = (s) => {
    const next = selectedStages.includes(s)
      ? selectedStages.filter((x) => x !== s)
      : [...selectedStages, s]
    updateSection('personal', { lifeStage: next })
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">A bit about your life</h2>
      <p className="mt-1 text-ink-500 text-sm">This helps us tune the dashboard. Nothing is mandatory.</p>
      <div className="mt-6 space-y-5">
        <div>
          <p className="label">Age range</p>
          <div className="flex flex-wrap gap-2">
            {ageRanges.map((a) => (
              <Choice
                key={a}
                selected={profile.personal.ageRange === a}
                onClick={() => updateSection('personal', { ageRange: a })}
              >
                {a}
              </Choice>
            ))}
          </div>
        </div>
        <div>
          <p className="label">
            Life stage <span className="text-ink-400 font-normal">(select all that apply)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stages.map((s) => (
              <Choice
                key={s}
                selected={selectedStages.includes(s)}
                onClick={() => toggleStage(s)}
              >
                {s}
              </Choice>
            ))}
          </div>
        </div>
        <LocationFields
          country={profile.personal.country}
          region={profile.personal.region}
          onChange={(patch) => updateSection('personal', patch)}
        />
      </div>
    </div>
  )
}

function LocationFields({ country, region, onChange }) {
  const countryMeta = COUNTRIES.find((c) => c.id === country)
  const regionLabel = countryMeta?.regionLabel || 'State / Province'
  const regions = REGIONS_BY_COUNTRY[country] || []

  const handleCountry = (next) => {
    // Reset the region whenever the country changes so we don't
    // leave behind a state from the previous country.
    onChange({ country: next, region: '' })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="label" htmlFor="country">Country (optional)</label>
        <select
          id="country"
          className="input"
          value={country || ''}
          onChange={(e) => handleCountry(e.target.value)}
        >
          <option value="">Select a country…</option>
          {COUNTRIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="region">{regionLabel}</label>
        <select
          id="region"
          className="input disabled:bg-slate-50 disabled:text-ink-300"
          value={region || ''}
          disabled={!country}
          onChange={(e) => onChange({ region: e.target.value })}
        >
          <option value="">
            {country ? `Select a ${regionLabel.toLowerCase()}…` : 'Pick a country first'}
          </option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function StepGoals({ profile, setGoals, setPriorities }) {
  const [draft, setDraft] = useState({
    title: '',
    category: 'other',
    horizon: 'mid',
    targetAmount: '',
    spendingBucket: 'discretionary',
    spendingIncrease: '',
  })

  const addGoal = () => {
    const t = draft.title.trim()
    if (!t) return
    const goal = {
      id: uid(),
      title: t,
      category: draft.category,
      horizon: draft.horizon,
    }
    if (draft.category === 'investment' || draft.category === 'other') {
      const tgt = Number(draft.targetAmount)
      goal.targetAmount = Number.isFinite(tgt) && tgt >= 0 ? tgt : 0
    }
    if (draft.category === 'spending') {
      const inc = Number(draft.spendingIncrease)
      goal.spendingBucket   = draft.spendingBucket
      goal.spendingIncrease = Number.isFinite(inc) && inc >= 0 ? inc : 0
    }
    const next = [...profile.goals, goal]
    setGoals(next)
    setPriorities([...(profile.priorities || []), goal.id])
    setDraft({ ...draft, title: '', targetAmount: '', spendingIncrease: '' })
  }

  const addSample = (s) => {
    const goal = { id: uid(), ...s }
    const next = [...profile.goals, goal]
    setGoals(next)
    setPriorities([...(profile.priorities || []), goal.id])
  }

  const removeGoal = (id) => {
    setGoals(profile.goals.filter((g) => g.id !== id))
    setPriorities((profile.priorities || []).filter((x) => x !== id))
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">What are you working toward?</h2>
      <p className="mt-1 text-ink-500 text-sm">Add 2–6 goals. You can always edit them later.</p>

      <div className="mt-6 card !p-4 space-y-3">
        <input
          className="input"
          placeholder="e.g. Save $10,000 for a down payment"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGoal())}
        />
        <div>
          <label className="label" htmlFor="wizard-goal-cat">Category</label>
          <select
            id="wizard-goal-cat"
            className="input"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          >
            {GOAL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji}  {c.label}
              </option>
            ))}
          </select>
        </div>
        {(draft.category === 'investment' || draft.category === 'other') && (
          <div>
            <label className="label" htmlFor="wizard-goal-target">
              {draft.category === 'investment' ? 'Target amount' : 'Estimated cost'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
              <input
                id="wizard-goal-target"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                className="input pl-8"
                placeholder="e.g. 25000"
                value={draft.targetAmount}
                onChange={(e) => setDraft({ ...draft, targetAmount: e.target.value })}
              />
            </div>
          </div>
        )}
        {draft.category === 'debt' && (
          <p className="text-[11px] text-ink-400">
            You can link this goal to a specific liability after the wizard, from the Goals page.
          </p>
        )}
        {draft.category === 'spending' && (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="wizard-goal-bucket">Which area to increase?</label>
              <select
                id="wizard-goal-bucket"
                className="input"
                value={draft.spendingBucket}
                onChange={(e) => setDraft({ ...draft, spendingBucket: e.target.value })}
              >
                <option value="wealthGen">🌱 Wealth generation</option>
                <option value="bareNec">🧱 Bare necessities</option>
                <option value="discretionary">🎈 Discretionary spending</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="wizard-goal-increase">Increase by</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
                <input
                  id="wizard-goal-increase"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  className="input pl-8 pr-12"
                  placeholder="0"
                  value={draft.spendingIncrease}
                  onChange={(e) => setDraft({ ...draft, spendingIncrease: e.target.value })}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">
                  /mo
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {HORIZONS.map((h) => (
            <Choice
              key={h.id}
              selected={draft.horizon === h.id}
              onClick={() => setDraft({ ...draft, horizon: h.id })}
            >
              {h.label}
            </Choice>
          ))}
        </div>
        <button type="button" onClick={addGoal} className="btn-primary w-full sm:w-auto">
          + Add goal
        </button>
      </div>

      {profile.goals.length === 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-ink-500 mb-2">Or start with one of these:</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_GOALS.map((s) => (
              <button
                key={s.title}
                onClick={() => addSample(s)}
                className="chip bg-white border border-slate-200 hover:border-grape-400 hover:text-grape-700"
              >
                + {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {profile.goals.length > 0 && (
        <ul className="mt-6 space-y-2">
          {profile.goals.map((g) => {
            const cat = GOAL_CATEGORIES.find((c) => c.id === g.category)
            const hz  = HORIZONS.find((h) => h.id === g.horizon)
            return (
              <li key={g.id} className="card !p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{cat?.emoji ?? '🎯'}</span>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{g.title}</p>
                    <p className="text-xs text-ink-500">{cat?.label} · {hz?.label}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeGoal(g.id)}
                  className="text-ink-300 hover:text-red-500 text-sm font-semibold"
                  aria-label={`Remove ${g.title}`}
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function StepPriorities({ profile, setPriorities }) {
  const order = (profile.priorities && profile.priorities.length)
    ? profile.priorities
    : profile.goals.map((g) => g.id)
  const byId = Object.fromEntries(profile.goals.map((g) => [g.id, g]))

  const move = (id, dir) => {
    const idx = order.indexOf(id)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= order.length) return
    const next = order.slice()
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setPriorities(next)
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Rank your goals</h2>
      <p className="mt-1 text-ink-500 text-sm">
        Drag a card up or down with the arrows. The top three become your focus this quarter.
      </p>

      {order.length === 0 ? (
        <div className="mt-6 card text-center text-ink-500">
          Add a few goals in the previous step, then come back to rank them.
        </div>
      ) : (
        <ol className="mt-6 space-y-2">
          {order.map((id, i) => {
            const g = byId[id]
            if (!g) return null
            const cat = GOAL_CATEGORIES.find((c) => c.id === g.category)
            const top = i < 3
            return (
              <li
                key={id}
                className={`card !p-4 flex items-center gap-3 ${top ? 'ring-2 ring-grape-300' : ''}`}
              >
                <span className={`grid place-items-center h-8 w-8 rounded-full text-xs font-bold
                  ${top ? 'bg-hero-gradient text-white' : 'bg-slate-100 text-ink-500'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{g.title}</p>
                  <p className="text-xs text-ink-500">{cat?.emoji} {cat?.label}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-sm font-bold disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => move(id, -1)}
                    aria-label="Move up"
                  >↑</button>
                  <button
                    className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-sm font-bold disabled:opacity-30"
                    disabled={i === order.length - 1}
                    onClick={() => move(id, 1)}
                    aria-label="Move down"
                  >↓</button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function StepFinances({ profile, updateSection }) {
  const f = profile.finances
  const monthly = Number(f.monthlyIncome) - Number(f.monthlyExpenses)
  const hasBoth = f.monthlyIncome && f.monthlyExpenses
  const rate = hasBoth && Number(f.monthlyIncome) > 0
    ? Math.round((monthly / Number(f.monthlyIncome)) * 100)
    : null

  const risks = [
    { id: 'low',    label: 'Conservative', emoji: '🛟' },
    { id: 'medium', label: 'Balanced',     emoji: '⚖️' },
    { id: 'high',   label: 'Ambitious',    emoji: '🚀' },
  ]

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">A quick money snapshot</h2>
      <p className="mt-1 text-ink-500 text-sm">Rough numbers are fine. You can update any time.</p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MoneyField id="inc" label="Monthly income (after tax)" value={f.monthlyIncome}
          onChange={(v) => updateSection('finances', { monthlyIncome: v })} />
        <MoneyField id="exp" label="Monthly expenses" value={f.monthlyExpenses}
          onChange={(v) => updateSection('finances', { monthlyExpenses: v })} />
        <MoneyField id="liq" label="Liquid savings" value={f.liquidAssets}
          onChange={(v) => updateSection('finances', { liquidAssets: v })} />
        <MoneyField id="inv" label="Investments" value={f.investments}
          onChange={(v) => updateSection('finances', { investments: v })} />
        <MoneyField id="re" label="Real estate (equity)" value={f.realEstate}
          onChange={(v) => updateSection('finances', { realEstate: v })} />
        <MoneyField id="debts" label="Total debts (excl. mortgage)" value={f.debts}
          onChange={(v) => updateSection('finances', { debts: v })} />
      </div>

      <div className="mt-5">
        <p className="label">Risk tolerance</p>
        <div className="flex flex-wrap gap-2">
          {risks.map((r) => (
            <Choice
              key={r.id}
              emoji={r.emoji}
              selected={f.riskTolerance === r.id}
              onClick={() => updateSection('finances', { riskTolerance: r.id })}
            >
              {r.label}
            </Choice>
          ))}
        </div>
      </div>

      {rate !== null && (
        <div className="mt-6 card bg-card-gradient">
          <p className="text-sm text-ink-500">Based on what you entered:</p>
          <p className="mt-1 font-display text-2xl font-extrabold">
            {rate >= 0 ? `You save about ${rate}% of your income.` : `You're spending ${Math.abs(rate)}% more than you earn.`}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {rate >= 20 ? 'Great runway for ambitious goals.' :
             rate >= 10 ? 'Solid base — we can stretch it further.' :
             rate >= 0  ? 'Tight. We\'ll look for room to breathe.' :
                          'Priority #1: close the gap before chasing growth.'}
          </p>
        </div>
      )}
    </div>
  )
}

function MoneyField({ id, label, value, onChange }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="input pl-8"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min="0"
        />
      </div>
    </div>
  )
}

function StepReview({ profile }) {
  const topGoals = (profile.priorities || [])
    .slice(0, 3)
    .map((id) => profile.goals.find((g) => g.id === id))
    .filter(Boolean)

  const stages = asLifeStageArray(profile.personal.lifeStage)
  const stageLabel = stages.length ? stages.join(', ') : '—'
  const locLabel = formatLocation(profile.personal)

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">You're set ✨</h2>
      <p className="mt-1 text-ink-500 text-sm">Here's what we'll use to build your dashboard.</p>

      <div className="mt-5 space-y-3">
        <div className="card">
          <h3 className="font-bold">About you</h3>
          <p className="text-sm text-ink-500 mt-1">
            {profile.personal.fullName || 'Anonymous'} · {profile.personal.ageRange || '—'} · {stageLabel}
            {locLabel ? ` · ${locLabel}` : ''}
          </p>
        </div>
        <div className="card">
          <h3 className="font-bold">Top priorities</h3>
          {topGoals.length ? (
            <ol className="mt-2 space-y-1.5 list-decimal list-inside text-sm">
              {topGoals.map((g) => <li key={g.id}>{g.title}</li>)}
            </ol>
          ) : (
            <p className="text-sm text-ink-500 mt-1">No goals added yet.</p>
          )}
        </div>
        <div className="card">
          <h3 className="font-bold">Money snapshot</h3>
          <p className="text-sm text-ink-500 mt-1">
            Income ${profile.finances.monthlyIncome || 0}/mo · Expenses ${profile.finances.monthlyExpenses || 0}/mo · {profile.finances.riskTolerance ? `${profile.finances.riskTolerance} risk` : 'risk not set'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---- Wizard shell ------------------------------------------------------

export default function Wizard() {
  const { user } = useAuth()
  const { profile, updateSection, setGoals, setPriorities, completeWizard, resetProfile } = usePlanner()
  const [step, setStep] = useState(0)
  const navigate = useNavigate()

  const current = STEPS[step]

  const canContinue = useMemo(() => {
    if (!profile) return false
    switch (current.id) {
      case 'welcome':  return profile.personal.fullName.trim().length > 0
      case 'goals':    return profile.goals.length >= 1
      case 'finances': return true
      default:         return true
    }
  }, [current.id, profile])

  if (!profile) return null

  const finish = () => {
    completeWizard()
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="mx-auto max-w-3xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BeanstalkMark className="h-8 w-8 text-olive-600" />
          <span className="font-display text-xl font-extrabold tracking-tight">Beanstalk</span>
        </div>
        <span className="text-xs text-ink-500">Hi, {user?.username} 👋</span>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-24">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="chip bg-grape-50 text-grape-700">
              <span>{current.emoji}</span> {current.title}
            </span>
            <button
              onClick={() => {
                if (confirm('Restart the wizard? Your wizard answers will be cleared.')) {
                  resetProfile()
                  setStep(0)
                }
              }}
              className="text-xs text-ink-300 hover:text-ink-700"
            >
              Restart
            </button>
          </div>

          <ProgressBar step={step} total={STEPS.length} />

          <div className="mt-6">
            {current.id === 'welcome'    && <StepWelcome    profile={profile} updateSection={updateSection} />}
            {current.id === 'personal'   && <StepPersonal   profile={profile} updateSection={updateSection} />}
            {current.id === 'goals'      && <StepGoals      profile={profile} setGoals={setGoals} setPriorities={setPriorities} />}
            {current.id === 'priorities' && <StepPriorities profile={profile} setPriorities={setPriorities} />}
            {current.id === 'finances'   && <StepFinances   profile={profile} updateSection={updateSection} />}
            {current.id === 'review'     && <StepReview     profile={profile} />}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="btn-ghost"
              disabled={step === 0}
            >
              ← Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="btn-primary"
                disabled={!canContinue}
              >
                Continue →
              </button>
            ) : (
              <button onClick={finish} className="btn-primary">
                Go to my dashboard ✨
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
