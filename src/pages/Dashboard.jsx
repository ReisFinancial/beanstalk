import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePlanner } from '../context/PlannerContext.jsx'
import Hex from '../components/Hex.jsx'
import AddItemModal from '../components/AddItemModal.jsx'

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Liquid savings" value={fmtMoney(cash)} />
          <StatCard label="Investments"    value={fmtMoney(inv)} />
          <StatCard label="Real estate"    value={fmtMoney(realEstate)} />
          <StatCard label="Debts"          value={fmtMoney(debt)}
            tone={debt > 0 ? 'warn' : 'default'} />
          <StatCard label="Net position"   value={fmtMoney(netWorth)} hint="Assets minus debts" />
        </div>
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

  const assets = profile.assets || []
  const liabilities = profile.liabilities || []
  const goals = profile.goals || []

  const totalAssets = assets.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + (Number(l.amount) || 0), 0)
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
        {showAssets && assets.map((a) => (
          <Hex
            key={a.id}
            tone="asset"
            as="button"
            icon="🟢"
            title={a.label}
            subtitle={fmtMoney(a.amount)}
            onClick={() => setEditing({ type: 'asset', item: a })}
            onRemove={() => removeAsset(a.id)}
          />
        ))}

        {showLiabilities && liabilities.map((l) => (
          <Hex
            key={l.id}
            tone="liability"
            as="button"
            icon="🔻"
            title={l.label}
            subtitle={fmtMoney(l.amount)}
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
