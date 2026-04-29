import { useMemo, useState } from 'react'

/**
 * ActionPlanner — sits below the Goals hex grid and walks the user
 * through building a concrete action plan for one selected goal:
 *
 *   1. Pick a goal
 *   2. Decide if it fits the current budget, and reallocate $/mo from
 *      Discretionary spending, Bare necessities, and Wealth generation
 *   3. Pick the goal "type" (loan paydown, investment target, savings)
 *   4. Pick a target time frame
 *   5. Pick the account this maps to (any asset, liability, or goal)
 *
 * Calculation is a follow-up — for now this just collects inputs.
 */

const GOAL_CAT_EMOJI = {
  money: '💰', career: '🧑‍💻', health: '💪',
  learning: '📚', relationships: '❤️', lifestyle: '🌿',
}
const HORIZON_LABEL = { short: '0–1 yr', mid: '1–3 yrs', long: '3+ yrs' }

const PLAN_TYPES = [
  { id: 'loanPaydown',     label: 'Pay a loan off faster' },
  { id: 'investmentTarget', label: 'Reach an investment target' },
  { id: 'savings',         label: 'Save for a certain amount' },
]

function fmtMoney(n) {
  const x = Number(n) || 0
  return x.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// ── Bucket math (mirrors the Money page's contributions card) ──────────
function computeBuckets(profile) {
  const income          = Number(profile.finances?.monthlyIncome)   || 0
  const bareNecessities = Number(profile.finances?.bareNecessities) || 0
  const wealthGen = (
    (profile.assets || []).reduce((s, a) => s + (Number(a.monthlyPayment) || 0), 0) +
    (profile.liabilities || []).reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0)
  )
  const allocated     = wealthGen + bareNecessities
  const discretionary = Math.max(0, income - allocated)
  return { income, bareNecessities, wealthGen, discretionary }
}

export default function ActionPlanner({ profile }) {
  const goals       = profile.goals       || []
  const assets      = profile.assets      || []
  const liabilities = profile.liabilities || []

  const [goalId, setGoalId] = useState('')

  // Step 2 — affordability + reallocation
  const [affordable, setAffordable]      = useState('') // '' | 'yes' | 'no'
  const [fromDiscretionary, setFromDisc] = useState('')
  const [fromBareNec,       setFromBare] = useState('')
  const [fromWealth,        setFromWealth] = useState('')

  // Step 3+
  const [planType,  setPlanType]  = useState('')
  const [timeValue, setTimeValue] = useState('')
  const [timeUnit,  setTimeUnit]  = useState('years') // 'months' | 'years'
  const [accountKey, setAccountKey] = useState('')    // e.g. 'asset:<id>' | 'liability:<id>' | 'goal:<id>'

  const buckets = useMemo(() => computeBuckets(profile), [profile])

  const reallocTotal = (
    (Number(fromDiscretionary) || 0) +
    (Number(fromBareNec)       || 0) +
    (Number(fromWealth)        || 0)
  )

  // Account options — labelled by classification + name + balance
  const accountOptions = useMemo(() => {
    return [
      ...assets.map((a) => ({
        key: `asset:${a.id}`,
        group: 'Assets',
        label: `🟢 ${a.label}`,
        hint: fmtMoney(a.amount),
      })),
      ...liabilities.map((l) => ({
        key: `liability:${l.id}`,
        group: 'Liabilities',
        label: `🔻 ${l.label}`,
        hint: fmtMoney(l.amount),
      })),
      ...goals.map((g) => ({
        key: `goal:${g.id}`,
        group: 'Goals',
        label: `${GOAL_CAT_EMOJI[g.category] || '🎯'} ${g.title}`,
        hint: HORIZON_LABEL[g.horizon] || '',
      })),
    ]
  }, [assets, liabilities, goals])

  const selectedGoal = goals.find((g) => g.id === goalId) || null

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <section className="card space-y-5">
      <div>
        <h3 className="font-display font-bold text-lg">Build an action plan</h3>
        <p className="text-xs text-ink-500 mt-0.5">
          Pick a goal and shape the budget, time frame, and target account that get you there.
        </p>
      </div>

      {/* Step 1 — pick a goal */}
      <div>
        <label className="label" htmlFor="ap-goal">Which goal would you like an action plan for?</label>
        <select
          id="ap-goal"
          className="input"
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
        >
          <option value="">Select a goal…</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {(GOAL_CAT_EMOJI[g.category] || '🎯')}  {g.title}  ·  {HORIZON_LABEL[g.horizon] || ''}
            </option>
          ))}
        </select>
        {goals.length === 0 && (
          <p className="mt-1 text-xs text-ink-400">Add a goal above to get started.</p>
        )}
      </div>

      {selectedGoal && (
        <>
          {/* Step 2 — affordability + reallocation, all on one row */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="label !mb-3">Budget impact</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <YesNoField
                label="Fits in your current budget?"
                hint="Without changing anything else"
                value={affordable}
                onChange={setAffordable}
              />
              <MoneyField
                label="From discretionary"
                hint={`Available ${fmtMoney(buckets.discretionary)}/mo`}
                value={fromDiscretionary}
                onChange={setFromDisc}
                max={buckets.discretionary}
              />
              <MoneyField
                label="From bare necessities"
                hint={`Currently ${fmtMoney(buckets.bareNecessities)}/mo`}
                value={fromBareNec}
                onChange={setFromBare}
                max={buckets.bareNecessities}
              />
              <MoneyField
                label="From wealth generation"
                hint={`Currently ${fmtMoney(buckets.wealthGen)}/mo`}
                value={fromWealth}
                onChange={setFromWealth}
                max={buckets.wealthGen}
              />
            </div>

            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
              <span className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
                Total reallocated
              </span>
              <span className="font-display text-2xl font-extrabold text-olive-700">
                {fmtMoney(reallocTotal)}<span className="text-sm font-bold text-ink-400">/mo</span>
              </span>
            </div>
          </div>

          {/* Step 3 — what does the goal require? */}
          <div>
            <label className="label" htmlFor="ap-plantype">What does this goal require?</label>
            <select
              id="ap-plantype"
              className="input"
              value={planType}
              onChange={(e) => setPlanType(e.target.value)}
            >
              <option value="">Select an outcome…</option>
              {PLAN_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Step 4 + 5 — time frame + account */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ap-time">Target time frame</label>
              <div className="flex gap-2">
                <input
                  id="ap-time"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  className="input flex-1"
                  placeholder="e.g. 3"
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                />
                <select
                  className="input !w-28"
                  value={timeUnit}
                  onChange={(e) => setTimeUnit(e.target.value)}
                  aria-label="Time unit"
                >
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="ap-account">Apply to which account?</label>
              <select
                id="ap-account"
                className="input"
                value={accountKey}
                onChange={(e) => setAccountKey(e.target.value)}
              >
                <option value="">Select an account…</option>
                {['Assets', 'Liabilities', 'Goals'].map((group) => {
                  const opts = accountOptions.filter((o) => o.group === group)
                  if (opts.length === 0) return null
                  return (
                    <optgroup key={group} label={group}>
                      {opts.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label} {o.hint ? `· ${o.hint}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

// ── Small fields shared inside the planner ────────────────────────────

function YesNoField({ label, hint, value, onChange }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex gap-2">
        {[
          { id: 'yes', label: 'Yes' },
          { id: 'no',  label: 'No'  },
        ].map((opt) => {
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(active ? '' : opt.id)}
              className={`flex-1 chip border ${
                active
                  ? 'bg-olive-50 border-olive-400 text-olive-800'
                  : 'bg-white border-slate-200 text-ink-700 hover:border-olive-300'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
    </div>
  )
}

function MoneyField({ label, hint, value, onChange, max }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max={max ?? undefined}
          step="1"
          className="input pl-8 pr-12"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">/mo</span>
      </div>
      {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
    </div>
  )
}
