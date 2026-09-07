import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePlanner } from '../context/PlannerContext.jsx'
import BeanstalkMark from '../components/BeanstalkMark.jsx'
import { ageFromPersonal, MONTH_NAMES } from '../utils/age.js'

const STEPS = [
  { id: 'welcome',    title: 'Welcome',     emoji: '👋' },
  { id: 'personal',   title: 'About you',   emoji: '🙂' },
  { id: 'lifestyle',  title: 'Lifestyle',   emoji: '✨' },
  { id: 'financial',  title: 'Financial',   emoji: '💫' },
  { id: 'priorities', title: 'Priorities',  emoji: '⚖️' },
  { id: 'review',     title: 'Review',      emoji: '🎉' },
]

// Ideal-life goal categories drive the wizard's qualitative capture.
// Each category exposes a different set of sub-fields — we'll turn those
// signals into monetary targets later using 50/30/20 assumptions.
const GOAL_CATEGORIES = [
  { id: 'home',      label: 'Purchase a home',   emoji: '🏠' },
  { id: 'lifestyle', label: 'Lifestyle goals',   emoji: '✨' },
  { id: 'financial', label: 'Financial status',  emoji: '💫' },
]

const SOCIAL_LEVELS = [
  { id: 'quiet',    label: 'Quiet — a few close friends' },
  { id: 'balanced', label: 'Balanced — mix of quiet + social' },
  { id: 'high',     label: 'High — social calendar, frequent hosting' },
]
const SECURITY_LEVELS = [
  { id: 'basic',       label: 'Basic — bills covered, some savings' },
  { id: 'comfortable', label: 'Comfortable — no worries, room to enjoy' },
  { id: 'abundant',    label: 'Abundant — generous, generational reach' },
]
const RETIREMENT_LIFESTYLES = [
  { id: 'modest',   label: 'Modest — simpler than today' },
  { id: 'same',     label: 'Same as today' },
  { id: 'upgraded', label: 'Upgraded — travel, hobbies, more' },
]
const INVESTMENT_APPROACHES = [
  { id: 'conservative', label: 'Conservative' },
  { id: 'balanced',     label: 'Balanced' },
  { id: 'ambitious',    label: 'Ambitious' },
]

// Five templated priorities the user ranks on Step 5. Stored on
// profile.priorityRanking as an ordered array of ids. Exported so the
// review + downstream views (Dashboard) can render the same labels.
// Five templated hobby categories the user ranks on Step 3. Stored on
// the lifestyle goal as `hobbyRanking` — an ordered array of ids. Later
// the model can weight cost by position (top-ranked category scales up).
export const HOBBY_TEMPLATES = [
  { id: 'active',  emoji: '🏞️', title: 'Active',  detail: 'Sports, outdoors, and nature.' },
  { id: 'social',  emoji: '🍸', title: 'Social',  detail: 'Nights out with friends.' },
  { id: 'luxury',  emoji: '🛍️', title: 'Luxury',  detail: 'Retail and collectibles.' },
  { id: 'digital', emoji: '🎮', title: 'Digital', detail: 'Games and screens.' },
  { id: 'culture', emoji: '🎭', title: 'Culture', detail: 'Theatre and the arts.' },
]

export const PRIORITY_TEMPLATES = [
  { id: 'security',   emoji: '🛡️', title: 'Freedom from a paycheck',          detail: 'Own my time. Answer to no one.' },
  { id: 'loved_ones', emoji: '❤️',  title: 'Fully present for the ones I love', detail: 'No screens. No pings. Just me.' },
  { id: 'lifestyle',  emoji: '✨',  title: 'A life without price tags',         detail: 'Say yes without doing the math.' },
  { id: 'wealth',     emoji: '📈',  title: 'Wealth that outlasts me',           detail: 'Compound now. Coast later. Leave a legacy.' },
  { id: 'home',       emoji: '🏡',  title: 'A home worth never leaving',        detail: 'Everything I love, under one roof.' },
]

// Yes/No/Maybe → wealth track. Used by the welcome step and downstream
// features that tailor guidance to what the user's actually pursuing.
const CONTENTMENT_TO_TRACK = {
  yes:   'preservation',
  no:    'accumulation',
  maybe: 'prioritization',
}

// Housing situation — second True Number anchor. Contentment sets the
// discretionary (30%) side; this sets how the home shows up in the model:
//   need_home     → full purchase price + ongoing carrying cost
//   upgrade       → upgrade delta (new price − current home value) + carry
//   own_ideal     → ongoing carrying cost only, no capital ask
//   prefer_rent   → no capital ask, no carry; substitute annual rent line
const HOUSING_OPTIONS = [
  { id: 'need_home',   emoji: '🏡', label: "Don't own yet",         caption: "I'll be buying my ideal home." },
  { id: 'upgrade',     emoji: '🏗️', label: 'Own — want to upgrade', caption: 'I want to trade up to a better home.' },
  { id: 'own_ideal',   emoji: '🏠', label: 'Already ideal',         caption: 'My home is already the one I want.' },
  { id: 'prefer_rent', emoji: '🔑', label: "Don't own, prefer to rent", caption: 'Renting is the plan long-term.' },
]

// Purchase-path situations need a neighbourhood follow-up so the model
// can look up the right dwelling dataset once we have one. Owners with
// their ideal home already or lifelong renters skip this question.
const HOUSING_SITUATIONS_NEEDING_NEIGHBOURHOOD = new Set(['need_home', 'upgrade'])

const NEIGHBOURHOOD_OPTIONS = [
  { id: 'urban',    emoji: '🏙️', label: 'Urban',   caption: 'Downtown, close to the core.' },
  { id: 'suburbs',  emoji: '🏘️', label: 'Suburbs', caption: 'Walking distance to everything.' },
  { id: 'rural',    emoji: '🌾', label: 'Rural',   caption: 'You need a car to go everywhere.' },
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
  const contentment = profile.personal.contentment || ''

  const chooseContentment = (id) => {
    updateSection('personal', {
      contentment: id,
      wealthTrack: CONTENTMENT_TO_TRACK[id] || '',
    })
  }

  const options = [
    { id: 'yes',   emoji: '😊', label: 'Yes',   caption: 'The life I have feels right.' },
    { id: 'no',    emoji: '🚀', label: 'No',    caption: 'I want more than what I have today.' },
    { id: 'maybe', emoji: '🤔', label: 'Maybe', caption: 'Parts of it — the rest could stretch.' },
  ]

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Let's design your ideal life 👋</h2>
      <p className="mt-1 text-ink-500 text-sm">
        No wrong answers. We'll turn what you want into the number you need to hit — starting with two quick questions.
      </p>
      <div className="mt-6 space-y-6">
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
          <p className="label">Are you content with the lifestyle you have today?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {options.map((o) => {
              const selected = contentment === o.id
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => chooseContentment(o.id)}
                  className={`text-left rounded-2xl border-2 p-3 transition ${
                    selected
                      ? 'border-grape-400 bg-grape-50'
                      : 'border-slate-200 bg-white hover:border-grape-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{o.emoji}</span>
                    <span className="font-display font-bold">{o.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-500 leading-snug">{o.caption}</p>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-ink-400">
            Behind the scenes, this sets your track: preservation, accumulation, or prioritization.
          </p>
        </div>
        <div>
          <p className="label">And your housing situation?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {HOUSING_OPTIONS.map((o) => {
              const selected = profile.personal.housingSituation === o.id
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => {
                    // If the new situation doesn't need a neighbourhood, clear
                    // any stale value from a previous selection.
                    const patch = { housingSituation: o.id }
                    if (!HOUSING_SITUATIONS_NEEDING_NEIGHBOURHOOD.has(o.id)) {
                      patch.neighbourhoodType = ''
                    }
                    updateSection('personal', patch)
                  }}
                  className={`text-left rounded-2xl border-2 p-3 transition ${
                    selected
                      ? 'border-grape-400 bg-grape-50'
                      : 'border-slate-200 bg-white hover:border-grape-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{o.emoji}</span>
                    <span className="font-display font-bold">{o.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-500 leading-snug">{o.caption}</p>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-ink-400">
            Sets whether your True Number needs a full home purchase, an upgrade delta, ongoing carrying cost, or a rent line.
          </p>

          {HOUSING_SITUATIONS_NEEDING_NEIGHBOURHOOD.has(profile.personal.housingSituation) && (
            <div className="mt-4 rounded-2xl border border-grape-100 bg-grape-50/40 p-3">
              <p className="label">Type of neighbourhood</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {NEIGHBOURHOOD_OPTIONS.map((o) => {
                  const selected = profile.personal.neighbourhoodType === o.id
                  return (
                    <button
                      type="button"
                      key={o.id}
                      onClick={() => updateSection('personal', { neighbourhoodType: o.id })}
                      className={`text-left rounded-2xl border-2 p-3 transition ${
                        selected
                          ? 'border-grape-400 bg-white'
                          : 'border-slate-200 bg-white hover:border-grape-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{o.emoji}</span>
                        <span className="font-display font-bold">{o.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-500 leading-snug">{o.caption}</p>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-[11px] text-ink-400">
                Feeds the dwelling-cost dataset once it's live — until then it's stored on your profile for the model to read.
              </p>
            </div>
          )}
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
          <label className="label">Birth date</label>
          <div className="flex gap-2 max-w-md">
            <select
              aria-label="Birth month"
              className="input flex-1"
              value={profile.personal.birthMonth ?? ''}
              onChange={(e) =>
                updateSection('personal', { birthMonth: e.target.value })
              }
            >
              <option value="">Month</option>
              {[
                'January','February','March','April','May','June',
                'July','August','September','October','November','December',
              ].map((m, i) => (
                <option key={m} value={String(i + 1)}>{m}</option>
              ))}
            </select>
            <input
              aria-label="Birth year"
              type="number"
              inputMode="numeric"
              min="1900"
              max={new Date().getFullYear()}
              step="1"
              className="input w-32"
              placeholder="Year"
              value={profile.personal.birthYear ?? ''}
              onChange={(e) =>
                updateSection('personal', { birthYear: e.target.value })
              }
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-400">
            Month + year so age-anchored forecasts (milestones, pension
            kick-in) shift on the right month — not just the right year.
          </p>
        </div>
        <div>
          <p className="label">
            Life stage today <span className="text-ink-400 font-normal">(select all that apply)</span>
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

        {/* Future life stage — do you want a different life stage in ~5 years */}
        <div>
          <p className="label">Do you see your life entering a new stage within the next 5 to 10 years?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                updateSection('personal', { wantsLifeStageChange: false, futureLifeStage: [] })
              }
              className={`flex-1 rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition ${
                !profile.personal.wantsLifeStageChange
                  ? 'border-grape-400 bg-grape-50 text-grape-800'
                  : 'border-slate-200 bg-white text-ink-700 hover:border-grape-300'
              }`}
            >
              No — same as today
            </button>
            <button
              type="button"
              onClick={() => updateSection('personal', { wantsLifeStageChange: true })}
              className={`flex-1 rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition ${
                profile.personal.wantsLifeStageChange
                  ? 'border-grape-400 bg-grape-50 text-grape-800'
                  : 'border-slate-200 bg-white text-ink-700 hover:border-grape-300'
              }`}
            >
              Yes — pick where I want to be
            </button>
          </div>

          {profile.personal.wantsLifeStageChange && (
            <div className="mt-3">
              <p className="text-xs text-ink-500 mb-2">
                What life stage would you like to be in?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stages.map((s) => {
                  const future = asLifeStageArray(profile.personal.futureLifeStage)
                  const selected = future.includes(s)
                  return (
                    <Choice
                      key={s}
                      selected={selected}
                      onClick={() => {
                        const next = selected
                          ? future.filter((x) => x !== s)
                          : [...future, s]
                        updateSection('personal', { futureLifeStage: next })
                      }}
                    >
                      {s}
                    </Choice>
                  )
                })}
              </div>
            </div>
          )}
        </div>
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

// One goal per category. Lifestyle + Financial each capture a single
// record that the True Number model reads via firstGoalByCategory.
// Defaulting the title from the current field values keeps the Priorities
// + Review steps readable without asking the user to name anything.
function defaultTitleFor(category, g) {
  if (category === 'lifestyle') {
    if (g?.vacationsPerYear) return `${g.vacationsPerYear} vacations / yr lifestyle`
    return 'Live my ideal lifestyle'
  }
  if (category === 'financial') {
    if (g?.financialSecurity) {
      const label = SECURITY_LEVELS.find((s) => s.id === g.financialSecurity)?.label
      return label ? label.split(' — ')[0] + ' financial security' : 'Reach my financial ideal'
    }
    return 'Reach my financial ideal'
  }
  return 'New goal'
}

// Binds a single goal per category to profile.goals. Creates the goal on
// the first change; patches it in place afterward. Also keeps the goal's
// id at the tail of profile.priorities so Priorities step picks it up.
function useSingleGoal(profile, setGoals, setPriorities, category) {
  const goals = profile.goals || []
  const existing = goals.find((g) => g.category === category) || null

  const patchGoal = (patch) => {
    if (existing) {
      const merged = { ...existing, ...patch }
      merged.title = defaultTitleFor(category, merged)
      setGoals(goals.map((g) => (g.id === existing.id ? merged : g)))
    } else {
      const id = uid()
      const merged = { id, category, ...patch }
      merged.title = defaultTitleFor(category, merged)
      setGoals([...goals, merged])
      setPriorities([...(profile.priorities || []), id])
    }
  }

  return [existing, patchGoal]
}

// Reorderable list of hobby templates. Reconciles stored order with the
// current template set on each render so a template added/removed later
// slots in without breaking a partially-saved ranking.
function HobbyRanker({ ranking, onChange }) {
  const templateIds = HOBBY_TEMPLATES.map((t) => t.id)
  const stored = ranking || []
  const order = [
    ...stored.filter((id) => templateIds.includes(id)),
    ...templateIds.filter((id) => !stored.includes(id)),
  ]
  const move = (id, dir) => {
    const idx = order.indexOf(id)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= order.length) return
    const next = order.slice()
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }
  return (
    <ol className="space-y-2">
      {order.map((id, i) => {
        const t = HOBBY_TEMPLATES.find((x) => x.id === id)
        if (!t) return null
        return (
          <li key={id} className="card !p-3 flex items-center gap-3">
            <span className="grid place-items-center h-8 w-8 rounded-full text-xs font-bold bg-hero-gradient text-white">
              {i + 1}
            </span>
            <span className="text-2xl">{t.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{t.title}</p>
              <p className="text-xs text-ink-500 truncate">{t.detail}</p>
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
  )
}

function StepLifestyle({ profile, setGoals, setPriorities }) {
  const [goal, patchGoal] = useSingleGoal(profile, setGoals, setPriorities, 'lifestyle')

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Your lifestyle ✨</h2>
      <p className="mt-1 text-ink-500 text-sm">
        These signals shape your 30% (wants) bucket — vacations, social spend, hobbies.
        Skip anything that doesn't apply.
      </p>

      <div className="mt-6 card !p-4 space-y-4">
        <div>
          <label className="label" htmlFor="ls-vacations">Vacations per year</label>
          <input
            id="ls-vacations"
            type="number"
            inputMode="numeric"
            min="0"
            max="52"
            step="1"
            className="input max-w-[180px]"
            placeholder="e.g. 3"
            value={goal?.vacationsPerYear ?? ''}
            onChange={(e) => {
              const v = e.target.value
              if (v === '') { patchGoal({ vacationsPerYear: null }); return }
              const n = Number(v)
              patchGoal({ vacationsPerYear: Number.isFinite(n) && n >= 0 ? n : null })
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="ls-social">Social intensity</label>
          <select
            id="ls-social"
            className="input"
            value={goal?.socialIntensity || ''}
            onChange={(e) => patchGoal({ socialIntensity: e.target.value || null })}
          >
            <option value="">Select…</option>
            {SOCIAL_LEVELS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="label">Hobbies you'd prioritize</p>
          <p className="text-xs text-ink-500 mb-2">
            Move the categories so what you'd spend most time on sits at the top.
          </p>
          <HobbyRanker
            ranking={goal?.hobbyRanking}
            onChange={(next) => patchGoal({ hobbyRanking: next })}
          />
        </div>
      </div>
    </div>
  )
}

function StepFinancial({ profile, setGoals, setPriorities }) {
  const [goal, patchGoal] = useSingleGoal(profile, setGoals, setPriorities, 'financial')

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Your financial status 💫</h2>
      <p className="mt-1 text-ink-500 text-sm">
        Sets the discount rate for your True Number and how much your retirement-phase
        spending shifts from today's lifestyle.
      </p>

      <div className="mt-6 card !p-4 space-y-4">
        <div>
          <label className="label" htmlFor="fs-security">Financial security you want</label>
          <select
            id="fs-security"
            className="input"
            value={goal?.financialSecurity || ''}
            onChange={(e) => patchGoal({ financialSecurity: e.target.value || null })}
          >
            <option value="">Select…</option>
            {SECURITY_LEVELS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fs-retirement">Post-employment lifestyle</label>
          <select
            id="fs-retirement"
            className="input"
            value={goal?.retirementLifestyle || ''}
            onChange={(e) => patchGoal({ retirementLifestyle: e.target.value || null })}
          >
            <option value="">Select…</option>
            {RETIREMENT_LIFESTYLES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fs-approach">Investment approach</label>
          <select
            id="fs-approach"
            className="input"
            value={goal?.investmentApproach || ''}
            onChange={(e) => patchGoal({ investmentApproach: e.target.value || null })}
          >
            <option value="">Select…</option>
            {INVESTMENT_APPROACHES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function StepPriorities({ profile, setPriorityRanking }) {
  // Start from the user's stored order, then append any templates missing
  // from a partial order (added since they last touched this step) so the
  // list is always exactly the current template set.
  const stored = profile.priorityRanking || []
  const templateIds = PRIORITY_TEMPLATES.map((t) => t.id)
  const order = [
    ...stored.filter((id) => templateIds.includes(id)),
    ...templateIds.filter((id) => !stored.includes(id)),
  ]

  const move = (id, dir) => {
    const idx = order.indexOf(id)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= order.length) return
    const next = order.slice()
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setPriorityRanking(next)
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Rank what matters ⚖️</h2>
      <p className="mt-1 text-ink-500 text-sm">
        Move the cards so the ones that matter most sit at the top. The top three become your focus this quarter.
      </p>

      <ol className="mt-6 space-y-2">
        {order.map((id, i) => {
          const t = PRIORITY_TEMPLATES.find((x) => x.id === id)
          if (!t) return null
          const top = i < 3
          return (
            <li
              key={id}
              className={`card !p-4 flex items-center gap-3 ${top ? 'ring-2 ring-grape-300' : ''}`}
            >
              <span className="grid place-items-center h-8 w-8 rounded-full text-xs font-bold bg-hero-gradient text-white">
                {i + 1}
              </span>
              <span className="text-2xl">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{t.title}</p>
                <p className="text-xs text-ink-500 truncate">{t.detail}</p>
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
    </div>
  )
}

function StepReview({ profile }) {
  // Top 3 priorities come from the templated ranking captured on Step 5.
  // Fall back to the templates' natural order if the user never touched it.
  const priorityOrder = (profile.priorityRanking && profile.priorityRanking.length)
    ? profile.priorityRanking
    : PRIORITY_TEMPLATES.map((t) => t.id)
  const topPriorities = priorityOrder
    .slice(0, 3)
    .map((id) => PRIORITY_TEMPLATES.find((t) => t.id === id))
    .filter(Boolean)

  const stages = asLifeStageArray(profile.personal.lifeStage)
  const stageLabel = stages.length ? stages.join(', ') : '—'
  const futureStages = asLifeStageArray(profile.personal.futureLifeStage)
  const locLabel = formatLocation(profile.personal)
  const trackLabel = ({
    preservation:   'Wealth preservation',
    accumulation:   'Wealth accumulation',
    prioritization: 'Wealth prioritization',
  })[profile.personal.wealthTrack] || 'Not set'

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">You're set ✨</h2>
      <p className="mt-1 text-ink-500 text-sm">Here's what we'll use to build your dashboard.</p>

      <div className="mt-5 space-y-3">
        <div className="card">
          <h3 className="font-bold">About you</h3>
          <p className="text-sm text-ink-500 mt-1">
            {profile.personal.fullName || 'Anonymous'} · {(() => {
              const a = ageFromPersonal(profile.personal)
              return a != null ? `${Math.floor(a)} yrs` : '—'
            })()} · {stageLabel}
            {locLabel ? ` · ${locLabel}` : ''}
          </p>
          {profile.personal.wantsLifeStageChange && futureStages.length > 0 && (
            <p className="text-xs text-ink-500 mt-1">
              In 5–10 years: {futureStages.join(', ')}
            </p>
          )}
        </div>
        <div className="card bg-card-gradient border-grape-200">
          <h3 className="font-bold">Your track</h3>
          <p className="text-sm text-ink-500 mt-1">
            {trackLabel}
            {profile.personal.contentment && ` · you said "${profile.personal.contentment}" to lifestyle contentment.`}
          </p>
        </div>
        <div className="card">
          <h3 className="font-bold">Top priorities</h3>
          <ol className="mt-2 space-y-1.5 list-decimal list-inside text-sm">
            {topPriorities.map((t) => (
              <li key={t.id}>
                <span className="mr-1">{t.emoji}</span>{t.title}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

// ---- Wizard shell ------------------------------------------------------

export default function Wizard() {
  const { user } = useAuth()
  const { profile, updateSection, setGoals, setPriorities, setPriorityRanking, completeWizard, resetProfile } = usePlanner()
  const [step, setStep] = useState(0)
  const navigate = useNavigate()

  const current = STEPS[step]

  const canContinue = useMemo(() => {
    if (!profile) return false
    switch (current.id) {
      case 'welcome': {
        const needsNeighbourhood = HOUSING_SITUATIONS_NEEDING_NEIGHBOURHOOD
          .has(profile.personal.housingSituation)
        return profile.personal.fullName.trim().length > 0
          && !!profile.personal.contentment
          && !!profile.personal.housingSituation
          && (!needsNeighbourhood || !!profile.personal.neighbourhoodType)
      }
      case 'review':
        return true // review is optional per the pivot
      default:
        return true
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
            {current.id === 'lifestyle'  && <StepLifestyle  profile={profile} setGoals={setGoals} setPriorities={setPriorities} />}
            {current.id === 'financial'  && <StepFinancial  profile={profile} setGoals={setGoals} setPriorities={setPriorities} />}
            {current.id === 'priorities' && <StepPriorities profile={profile} setPriorityRanking={setPriorityRanking} />}
            {current.id === 'review'     && <StepReview     profile={profile} />}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="btn-ghost"
              disabled={step === 0}
            >
              ← Back
            </button>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {/* On the priorities step, offer a quick "skip review" shortcut
                  since the review is optional in the new flow. */}
              {current.id === 'priorities' && (
                <button onClick={finish} className="btn-ghost text-sm">
                  Skip review →
                </button>
              )}
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
    </div>
  )
}
