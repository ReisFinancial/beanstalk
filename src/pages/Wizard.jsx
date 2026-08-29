import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePlanner } from '../context/PlannerContext.jsx'
import BeanstalkMark from '../components/BeanstalkMark.jsx'
import { ageFromPersonal, MONTH_NAMES } from '../utils/age.js'

const STEPS = [
  { id: 'welcome',    title: 'Welcome',     emoji: '👋' },
  { id: 'personal',   title: 'About you',   emoji: '🙂' },
  { id: 'goals',      title: 'Your ideal',  emoji: '🎯' },
  { id: 'priorities', title: 'Priorities',  emoji: '⚖️' },
  { id: 'review',     title: 'Review',      emoji: '✨' },
]

// Ideal-life goal categories drive the wizard's qualitative capture.
// Each category exposes a different set of sub-fields — we'll turn those
// signals into monetary targets later using 50/30/20 assumptions.
const GOAL_CATEGORIES = [
  { id: 'home',      label: 'Purchase a home',   emoji: '🏠' },
  { id: 'lifestyle', label: 'Lifestyle goals',   emoji: '✨' },
  { id: 'financial', label: 'Financial status',  emoji: '💫' },
]

const HOME_TYPES = ['Bungalow', 'Townhouse', 'Condo', 'Detached', 'Apartment', 'Other']
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

        {/* Future life stage — do you want a different life stage in ~5 years */}
        <div>
          <p className="label">Do you want a different life stage in 5 years?</p>
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

function StepGoals({ profile, setGoals, setPriorities }) {
  // Draft holds every qualitative field for every category — only the
  // ones matching the selected category are read on submit.
  const emptyDraft = {
    category: 'home',
    // home
    homeType:      '',
    homeLocation:  '',
    homeBeds:      '',
    homeBaths:     '',
    // lifestyle
    vacationsPerYear:  '',
    socialIntensity:   '',
    hobbies:           '',
    // financial
    financialSecurity:     '',
    retirementLifestyle:   '',
    investmentApproach:    '',
    // shared
    targetAge:     '',
  }
  const [draft, setDraft] = useState(emptyDraft)

  const setField = (patch) => setDraft((d) => ({ ...d, ...patch }))

  // Default title per category so users don't have to name every goal.
  const defaultTitle = (d) => {
    if (d.category === 'home') {
      const t = d.homeType ? `${d.homeType.toLowerCase()} ` : ''
      const loc = d.homeLocation ? ` in ${d.homeLocation}` : ''
      return `Own a ${t}home${loc}`.replace(/  +/g, ' ').trim() || 'Purchase a home'
    }
    if (d.category === 'lifestyle') {
      if (d.vacationsPerYear) return `${d.vacationsPerYear} vacations / yr lifestyle`
      return 'Live my ideal lifestyle'
    }
    if (d.category === 'financial') {
      if (d.financialSecurity) {
        const label = SECURITY_LEVELS.find((s) => s.id === d.financialSecurity)?.label
        return label ? label.split(' — ')[0] + ' financial security' : 'Reach my financial ideal'
      }
      return 'Reach my financial ideal'
    }
    return 'New goal'
  }

  const addGoal = () => {
    const goal = { id: uid(), category: draft.category, title: defaultTitle(draft) }
    const age = Number(draft.targetAge)
    if (Number.isFinite(age) && age > 0) goal.targetAge = Math.round(age)

    if (draft.category === 'home') {
      goal.homeType     = draft.homeType || null
      goal.homeLocation = draft.homeLocation.trim() || null
      const beds  = Number(draft.homeBeds)
      const baths = Number(draft.homeBaths)
      goal.homeBeds  = Number.isFinite(beds)  && beds  >= 0 ? beds  : null
      goal.homeBaths = Number.isFinite(baths) && baths >= 0 ? baths : null
    } else if (draft.category === 'lifestyle') {
      const vpy = Number(draft.vacationsPerYear)
      goal.vacationsPerYear = Number.isFinite(vpy) && vpy >= 0 ? vpy : null
      goal.socialIntensity  = draft.socialIntensity || null
      goal.hobbies          = draft.hobbies.trim() || null
    } else if (draft.category === 'financial') {
      goal.financialSecurity   = draft.financialSecurity   || null
      goal.retirementLifestyle = draft.retirementLifestyle || null
      goal.investmentApproach  = draft.investmentApproach  || null
    }

    const next = [...profile.goals, goal]
    setGoals(next)
    setPriorities([...(profile.priorities || []), goal.id])
    setDraft({ ...emptyDraft, category: draft.category })
  }

  const removeGoal = (id) => {
    setGoals(profile.goals.filter((g) => g.id !== id))
    setPriorities((profile.priorities || []).filter((x) => x !== id))
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Paint your ideal life 🎯</h2>
      <p className="mt-1 text-ink-500 text-sm">
        Don't worry about the numbers — we'll calculate what things cost from your answers. Add
        as many ideals as you'd like across the three categories.
      </p>

      <div className="mt-6 card !p-4 space-y-4">
        <div>
          <label className="label" htmlFor="wizard-goal-cat">Category</label>
          <select
            id="wizard-goal-cat"
            className="input"
            value={draft.category}
            onChange={(e) => setDraft({ ...emptyDraft, category: e.target.value })}
          >
            {GOAL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji}  {c.label}</option>
            ))}
          </select>
        </div>

        {/* Home purchase fields */}
        {draft.category === 'home' && (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="home-type">Home type</label>
              <select
                id="home-type"
                className="input"
                value={draft.homeType}
                onChange={(e) => setField({ homeType: e.target.value })}
              >
                <option value="">Select…</option>
                {HOME_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="home-loc">Location</label>
              <input
                id="home-loc"
                className="input"
                placeholder="e.g. Toronto suburbs, Austin, coastal BC"
                value={draft.homeLocation}
                onChange={(e) => setField({ homeLocation: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="home-beds">Bedrooms</label>
                <input
                  id="home-beds"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  className="input"
                  placeholder="3"
                  value={draft.homeBeds}
                  onChange={(e) => setField({ homeBeds: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="home-baths">Bathrooms</label>
                <input
                  id="home-baths"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="0.5"
                  className="input"
                  placeholder="2"
                  value={draft.homeBaths}
                  onChange={(e) => setField({ homeBaths: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Lifestyle fields */}
        {draft.category === 'lifestyle' && (
          <div className="space-y-3">
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
                value={draft.vacationsPerYear}
                onChange={(e) => setField({ vacationsPerYear: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="ls-social">Social intensity</label>
              <select
                id="ls-social"
                className="input"
                value={draft.socialIntensity}
                onChange={(e) => setField({ socialIntensity: e.target.value })}
              >
                <option value="">Select…</option>
                {SOCIAL_LEVELS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ls-hobbies">Hobbies</label>
              <input
                id="ls-hobbies"
                className="input"
                placeholder="e.g. skiing, live music, cooking classes"
                value={draft.hobbies}
                onChange={(e) => setField({ hobbies: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Financial status fields */}
        {draft.category === 'financial' && (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="fs-security">Financial security you want</label>
              <select
                id="fs-security"
                className="input"
                value={draft.financialSecurity}
                onChange={(e) => setField({ financialSecurity: e.target.value })}
              >
                <option value="">Select…</option>
                {SECURITY_LEVELS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fs-retirement">Retirement lifestyle</label>
              <select
                id="fs-retirement"
                className="input"
                value={draft.retirementLifestyle}
                onChange={(e) => setField({ retirementLifestyle: e.target.value })}
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
                value={draft.investmentApproach}
                onChange={(e) => setField({ investmentApproach: e.target.value })}
              >
                <option value="">Select…</option>
                {INVESTMENT_APPROACHES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="goal-target-age">
            Target age <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <div className="relative max-w-[200px]">
            <input
              id="goal-target-age"
              type="number"
              inputMode="numeric"
              min="0"
              max="120"
              step="1"
              className="input pr-14"
              placeholder="e.g. 50"
              value={draft.targetAge}
              onChange={(e) => setField({ targetAge: e.target.value })}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">yrs</span>
          </div>
        </div>

        <button type="button" onClick={addGoal} className="btn-primary w-full sm:w-auto">
          + Add to my ideals
        </button>
      </div>

      {profile.goals.length > 0 && (
        <ul className="mt-6 space-y-2">
          {profile.goals.map((g) => {
            const cat = GOAL_CATEGORIES.find((c) => c.id === g.category)
            const age = g.targetAge
            return (
              <li key={g.id} className="card !p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{cat?.emoji ?? '🎯'}</span>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{g.title}</p>
                    <p className="text-xs text-ink-500">
                      {cat?.label || 'Goal'}{age ? ` · By age ${age}` : ''}
                    </p>
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

function StepReview({ profile }) {
  const topGoals = (profile.priorities || [])
    .slice(0, 3)
    .map((id) => profile.goals.find((g) => g.id === id))
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
              In 5 years: {futureStages.join(', ')}
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
          {topGoals.length ? (
            <ol className="mt-2 space-y-1.5 list-decimal list-inside text-sm">
              {topGoals.map((g) => <li key={g.id}>{g.title}</li>)}
            </ol>
          ) : (
            <p className="text-sm text-ink-500 mt-1">No ideals added yet.</p>
          )}
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
      case 'welcome': {
        const needsNeighbourhood = HOUSING_SITUATIONS_NEEDING_NEIGHBOURHOOD
          .has(profile.personal.housingSituation)
        return profile.personal.fullName.trim().length > 0
          && !!profile.personal.contentment
          && !!profile.personal.housingSituation
          && (!needsNeighbourhood || !!profile.personal.neighbourhoodType)
      }
      case 'goals':
        return profile.goals.length >= 1
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
            {current.id === 'goals'      && <StepGoals      profile={profile} setGoals={setGoals} setPriorities={setPriorities} />}
            {current.id === 'priorities' && <StepPriorities profile={profile} setPriorities={setPriorities} />}
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
