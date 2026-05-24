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
  debt: '🔻', investment: '📈', spending: '💸', other: '🎯',
  // Legacy theme categories — kept so older saved goals still render
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

// Currency formatter that keeps cents — useful for required PMT figures
// where a $0 vs $0.43/mo difference matters to the user.
function fmtMoneyCents(n) {
  const x = Number(n) || 0
  return x.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

// Standard PMT formula:  PMT = P · r · (1+r)^n / ((1+r)^n − 1)
//   P = principal, r = monthly rate, n = number of monthly payments.
// When r = 0, we degrade to straight-line P/n.
function pmtToPayoff(principal, annualRatePct, numPayments) {
  const P = Number(principal) || 0
  const N = Number(numPayments) || 0
  if (P <= 0 || N <= 0) return 0
  const r = (Number(annualRatePct) || 0) / 100 / 12
  if (r === 0) return P / N
  const growth = Math.pow(1 + r, N)
  return (P * r * growth) / (growth - 1)
}

// Future value of an investment with end-of-month contributions:
//   FV = PV · (1+r)^n  +  PMT · ((1+r)^n − 1) / r
// PV is the asset's current balance (face value), PMT is the monthly
// contribution (existing payment + reallocated extra), r is the monthly
// rate, n is the number of monthly periods. r = 0 collapses to the
// straight-line PV + PMT·n.
function fvWithContributions(presentValue, annualRatePct, numPayments, pmt) {
  const PV  = Number(presentValue) || 0
  const N   = Number(numPayments)  || 0
  const PMT = Number(pmt)          || 0
  const r   = (Number(annualRatePct) || 0) / 100 / 12
  if (N <= 0) return PV
  if (r === 0) return PV + PMT * N
  const growth = Math.pow(1 + r, N)
  return PV * growth + PMT * ((growth - 1) / r)
}

// Solve for the monthly contribution needed to grow PV → target FV:
//   PMT = (FV − PV · (1+r)^n) · r / ((1+r)^n − 1)
// When r = 0, the rate-free version is straight-line: (FV − PV) / n.
// Result is floored at 0 — if PV alone already reaches FV, no PMT needed.
function pmtForTarget(presentValue, targetValue, annualRatePct, numPayments) {
  const PV = Number(presentValue) || 0
  const FV = Number(targetValue)  || 0
  const N  = Number(numPayments)  || 0
  if (N <= 0) return 0
  const r = (Number(annualRatePct) || 0) / 100 / 12
  if (r === 0) return Math.max(0, (FV - PV) / N)
  const growth = Math.pow(1 + r, N)
  return Math.max(0, (FV - PV * growth) * r / (growth - 1))
}

// Liquid assets — what counts toward the savings face value.
const LIQUID_ASSET_SUBTYPES = new Set(['savings', 'investments', 'crypto'])

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
  const [targetAmount, setTargetAmount] = useState('') // savings-plan target $

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

  // Resolve the selected account back to its underlying record so we
  // can pull amount, subtype, and existing monthly payment.
  const selectedAccount = useMemo(() => {
    if (!accountKey) return null
    const [scope, id] = accountKey.split(':')
    if (scope === 'asset')     return { scope, item: assets.find((a) => a.id === id)      || null }
    if (scope === 'liability') return { scope, item: liabilities.find((l) => l.id === id) || null }
    if (scope === 'goal')      return { scope, item: goals.find((g) => g.id === id)       || null }
    return null
  }, [accountKey, assets, liabilities, goals])

  // Convert the user's time-frame entry into a number of monthly payments.
  const numPayments = (() => {
    const n = Number(timeValue) || 0
    return timeUnit === 'years' ? n * 12 : n
  })()

  // Liquid-asset context for the savings + investment-target plans.
  // The "face value" is the sum of every asset whose subtype counts as
  // liquid (savings, investments, crypto). The growth rate is the
  // share-weighted average of each liquid asset's typical return rate.
  // Existing PMT is the sum of monthly contributions already going into
  // those accounts.
  const liquidContext = useMemo(() => {
    const liquid = assets.filter((a) => LIQUID_ASSET_SUBTYPES.has(a.subtype || 'savings'))
    let totalAmount = 0
    let weightedRate = 0
    let existingPmt = 0
    liquid.forEach((a) => {
      const amt  = Number(a.amount) || 0
      const rate = Number(profile.rates?.asset?.[a.subtype || 'savings']) || 0
      totalAmount  += amt
      weightedRate += amt * rate
      existingPmt  += Number(a.monthlyPayment) || 0
    })
    const blendedRate = totalAmount > 0 ? weightedRate / totalAmount : 0
    return {
      accounts: liquid,
      presentVal: totalAmount,
      blendedRate,
      existingPmt,
    }
  }, [assets, profile.rates])

  // Investment-target PMT calculation — same shape as savings, gated
  // on the investmentTarget plan. Uses the combined liquid asset pool
  // as PV and the share-weighted blended rate, and solves for the
  // required monthly contribution to hit the target.
  const investmentTarget = useMemo(() => {
    if (planType !== 'investmentTarget') return null
    const target = Number(targetAmount) || 0
    if (target <= 0) return null
    if (numPayments <= 0) return null

    const { presentVal, blendedRate, existingPmt, accounts } = liquidContext
    const required  = pmtForTarget(presentVal, target, blendedRate, numPayments)
    const combined  = existingPmt + reallocTotal
    const shortfall = required - combined
    const projected = fvWithContributions(presentVal, blendedRate, numPayments, combined)

    return {
      target,
      presentVal,
      blendedRate,
      existingPmt,
      combined,
      required,
      shortfall,
      projected,
      onTrack: combined >= required,
      accounts,
    }
  }, [planType, targetAmount, numPayments, liquidContext, reallocTotal])

  // Savings-target PMT calculation — kicks in when the user picked the
  // savings plan AND entered a target amount. Uses the combined liquid
  // assets as PV and the share-weighted blended growth rate.
  const savingsTarget = useMemo(() => {
    if (planType !== 'savings') return null
    const target = Number(targetAmount) || 0
    if (target <= 0) return null
    if (numPayments <= 0) return null

    const { presentVal, blendedRate, existingPmt, accounts } = liquidContext
    const required  = pmtForTarget(presentVal, target, blendedRate, numPayments)
    const combined  = existingPmt + reallocTotal
    const shortfall = required - combined
    const projected = fvWithContributions(presentVal, blendedRate, numPayments, combined)

    return {
      target,
      presentVal,
      blendedRate,
      existingPmt,
      combined,
      required,
      shortfall,
      projected,
      onTrack: combined >= required,
      accounts,
    }
  }, [planType, targetAmount, numPayments, liquidContext, reallocTotal])

  // Loan-paydown PMT calculation — only kicks in when the user has
  // picked the loan-paydown plan AND chosen a liability account.
  const loanPaydown = useMemo(() => {
    if (planType !== 'loanPaydown') return null
    if (!selectedAccount || selectedAccount.scope !== 'liability') return null
    const item = selectedAccount.item
    if (!item) return null
    if (numPayments <= 0) return null

    const subtype = item.subtype || 'creditCard'
    const annualRate = Number(profile.rates?.liability?.[subtype]) || 0
    const principal  = Number(item.amount) || 0
    const required   = pmtToPayoff(principal, annualRate, numPayments)
    const existing   = Number(item.monthlyPayment) || 0
    const combined   = existing + reallocTotal
    const shortfall  = required - combined

    return {
      item,
      subtype,
      annualRate,
      principal,
      required,
      existing,
      combined,
      shortfall,
      onTrack: combined >= required && required > 0,
    }
  }, [planType, selectedAccount, numPayments, profile.rates, reallocTotal])

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
          {/* Step 2 — affordability check, then conditional reallocation */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
            <p className="label !mb-0">Budget impact</p>

            {/* Row 1 — affordability question on its own */}
            <YesNoField
              label="Can you afford this goal with your discretionary budget?"
              hint={`Discretionary budget available: ${fmtMoney(buckets.discretionary)}/mo`}
              value={affordable}
              onChange={setAffordable}
            />

            {/* Row 2 — reallocation, only if the user can't afford it outright */}
            {affordable === 'no' && (
              <div className="border-t border-slate-200 pt-4">
                <p className="label">
                  Which areas of your monthly finances would you like to reallocate to achieve this goal?
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
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
            )}
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

            {(planType === 'savings' || planType === 'investmentTarget') ? (
              <div>
                <label className="label" htmlFor="ap-target">Target amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
                  <input
                    id="ap-target"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    className="input pl-8"
                    placeholder="e.g. 25000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                  />
                </div>
                <p className="mt-1 text-[11px] text-ink-400">
                  Combined liquid assets: {fmtMoney(liquidContext.presentVal)} · blended rate{' '}
                  {(liquidContext.blendedRate || 0).toFixed(2)}%
                </p>
              </div>
            ) : (
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
            )}
          </div>

          {/* Loan-paydown projection — required PMT to clear the loan in time */}
          {planType === 'loanPaydown' && (
            <LoanPaydownResult
              loanPaydown={loanPaydown}
              selectedAccount={selectedAccount}
              numPayments={numPayments}
              timeValue={timeValue}
              timeUnit={timeUnit}
            />
          )}

          {/* Investment-target projection — required PMT to grow combined liquid assets to target */}
          {planType === 'investmentTarget' && (
            <InvestmentTargetResult
              investmentTarget={investmentTarget}
              targetAmount={targetAmount}
              numPayments={numPayments}
              timeValue={timeValue}
              timeUnit={timeUnit}
            />
          )}

          {/* Savings projection — required PMT to grow combined liquid assets to target */}
          {planType === 'savings' && (
            <SavingsTargetResult
              savingsTarget={savingsTarget}
              targetAmount={targetAmount}
              numPayments={numPayments}
              timeValue={timeValue}
              timeUnit={timeUnit}
            />
          )}
        </>
      )}
    </section>
  )
}

// ── Loan-paydown result card ──────────────────────────────────────────
function LoanPaydownResult({ loanPaydown, selectedAccount, numPayments, timeValue, timeUnit }) {
  // Guard: the user picked "Pay a loan off faster" but hasn't completed
  // the inputs yet. Show a soft hint instead of a blank panel.
  if (!loanPaydown) {
    let msg = 'Pick a target time frame and a liability account to see the required monthly payment.'
    if (selectedAccount && selectedAccount.scope !== 'liability') {
      msg = 'Loan paydown needs a liability — pick one from the Liabilities group above.'
    } else if (numPayments <= 0 && Number(timeValue) > 0) {
      msg = 'Time frame must be at least one month.'
    } else if (selectedAccount?.scope === 'liability' && Number(selectedAccount.item?.amount) <= 0) {
      msg = 'This loan has a zero balance — there\'s nothing left to pay off.'
    }
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-ink-500">
        {msg}
      </div>
    )
  }

  const { item, subtype, annualRate, principal, required, existing, combined, shortfall, onTrack } = loanPaydown
  const timeLabel = timeUnit === 'years'
    ? `${timeValue} ${Number(timeValue) === 1 ? 'year' : 'years'} (${numPayments} payments)`
    : `${numPayments} ${numPayments === 1 ? 'month' : 'months'}`

  return (
    <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-olive-700 font-semibold">
            Required monthly payment
          </p>
          <p className="font-display text-3xl font-extrabold text-olive-700">
            {fmtMoneyCents(required)}<span className="text-sm font-bold text-ink-400">/mo</span>
          </p>
        </div>
        <span className={`chip border ${
          onTrack
            ? 'bg-brand-50 border-brand-300 text-brand-700'
            : 'bg-amber-50 border-amber-300 text-amber-700'
        }`}>
          {onTrack ? 'On track' : `Short ${fmtMoneyCents(Math.max(0, shortfall))}/mo`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <ResultRow k="Loan" v={`🔻 ${item.label}`} />
        <ResultRow k="Balance" v={fmtMoney(principal)} />
        <ResultRow k="Interest rate" v={`${(Number(annualRate) || 0).toFixed(2)}% APR`} hint={`Pulled from Money → ${subtype}`} />
        <ResultRow k="Time frame" v={timeLabel} />
        <ResultRow k="Current payment" v={`${fmtMoney(existing)}/mo`} />
        <ResultRow k="Reallocated extra" v={`${fmtMoney(loanPaydown.combined - loanPaydown.existing)}/mo`} />
      </div>

      <p className="mt-4 text-xs text-ink-500">
        {onTrack
          ? <>Your existing {fmtMoney(existing)}/mo plus the {fmtMoney(combined - existing)}/mo you reallocated covers the {fmtMoneyCents(required)}/mo needed to clear this loan in {timeLabel}.</>
          : <>You'd need {fmtMoneyCents(shortfall)}/mo more to hit this in {timeLabel}. Either reallocate further, raise the time frame, or increase the loan's monthly payment on the Snapshot.</>
        }
      </p>
    </div>
  )
}

// ── Investment-target result card ─────────────────────────────────────
function InvestmentTargetResult({ investmentTarget, targetAmount, numPayments, timeValue, timeUnit }) {
  if (!investmentTarget) {
    let msg = 'Enter a target amount and a time frame to see the required monthly contribution.'
    if (numPayments <= 0 && Number(timeValue) > 0) {
      msg = 'Time frame must be at least one month.'
    } else if (Number(targetAmount) <= 0) {
      msg = 'Enter the dollar amount you want to reach.'
    }
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-ink-500">
        {msg}
      </div>
    )
  }

  const {
    target, presentVal, blendedRate, existingPmt, combined,
    required, shortfall, projected, onTrack, accounts,
  } = investmentTarget
  const reallocExtra = combined - existingPmt
  const timeLabel = timeUnit === 'years'
    ? `${timeValue} ${Number(timeValue) === 1 ? 'year' : 'years'} (${numPayments} payments)`
    : `${numPayments} ${numPayments === 1 ? 'month' : 'months'}`

  return (
    <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-olive-700 font-semibold">
            Required monthly contribution
          </p>
          <p className="font-display text-3xl font-extrabold text-olive-700">
            {fmtMoneyCents(required)}<span className="text-sm font-bold text-ink-400">/mo</span>
          </p>
        </div>
        <span className={`chip border ${
          onTrack
            ? 'bg-brand-50 border-brand-300 text-brand-700'
            : 'bg-amber-50 border-amber-300 text-amber-700'
        }`}>
          {onTrack ? 'On track' : `Short ${fmtMoneyCents(Math.max(0, shortfall))}/mo`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <ResultRow k="Target amount" v={fmtMoney(target)} />
        <ResultRow
          k="Combined liquid assets"
          v={fmtMoney(presentVal)}
          hint={accounts.length > 0
            ? `${accounts.length} account${accounts.length === 1 ? '' : 's'} (savings + investments + crypto)`
            : 'No liquid assets yet — add some on the Snapshot.'}
        />
        <ResultRow
          k="Blended growth rate"
          v={`${(Number(blendedRate) || 0).toFixed(2)}% / yr`}
          hint="Share-weighted across your liquid assets"
        />
        <ResultRow k="Time frame" v={timeLabel} />
        <ResultRow k="Current contributions" v={`${fmtMoney(existingPmt)}/mo`} />
        <ResultRow k="Reallocated extra" v={`${fmtMoney(reallocExtra)}/mo`} />
      </div>

      <p className="mt-4 text-xs text-ink-500">
        {onTrack
          ? <>Your existing {fmtMoney(existingPmt)}/mo plus the {fmtMoney(reallocExtra)}/mo you reallocated grows {fmtMoney(presentVal)} into roughly {fmtMoney(projected)} in {timeLabel} — past your {fmtMoney(target)} target.</>
          : <>To hit {fmtMoney(target)} in {timeLabel} you'd need {fmtMoneyCents(required)}/mo. You're {fmtMoneyCents(shortfall)}/mo short — reallocate further, raise the time frame, or lower the target.</>
        }
      </p>
    </div>
  )
}

// ── Savings-target result card ────────────────────────────────────────
function SavingsTargetResult({ savingsTarget, targetAmount, numPayments, timeValue, timeUnit }) {
  if (!savingsTarget) {
    let msg = 'Enter a target amount and a time frame to see the required monthly contribution.'
    if (numPayments <= 0 && Number(timeValue) > 0) {
      msg = 'Time frame must be at least one month.'
    } else if (Number(targetAmount) <= 0) {
      msg = 'Enter the dollar amount you want to reach.'
    }
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-ink-500">
        {msg}
      </div>
    )
  }

  const {
    target, presentVal, blendedRate, existingPmt, combined,
    required, shortfall, projected, onTrack, accounts,
  } = savingsTarget
  const reallocExtra = combined - existingPmt
  const timeLabel = timeUnit === 'years'
    ? `${timeValue} ${Number(timeValue) === 1 ? 'year' : 'years'} (${numPayments} payments)`
    : `${numPayments} ${numPayments === 1 ? 'month' : 'months'}`

  return (
    <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-olive-700 font-semibold">
            Required monthly contribution
          </p>
          <p className="font-display text-3xl font-extrabold text-olive-700">
            {fmtMoneyCents(required)}<span className="text-sm font-bold text-ink-400">/mo</span>
          </p>
        </div>
        <span className={`chip border ${
          onTrack
            ? 'bg-brand-50 border-brand-300 text-brand-700'
            : 'bg-amber-50 border-amber-300 text-amber-700'
        }`}>
          {onTrack ? 'On track' : `Short ${fmtMoneyCents(Math.max(0, shortfall))}/mo`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <ResultRow k="Target amount" v={fmtMoney(target)} />
        <ResultRow
          k="Combined liquid assets"
          v={fmtMoney(presentVal)}
          hint={accounts.length > 0
            ? `${accounts.length} account${accounts.length === 1 ? '' : 's'} (savings + investments + crypto)`
            : 'No liquid assets yet — add some on the Snapshot.'}
        />
        <ResultRow
          k="Blended growth rate"
          v={`${(Number(blendedRate) || 0).toFixed(2)}% / yr`}
          hint="Share-weighted across your liquid assets"
        />
        <ResultRow k="Time frame" v={timeLabel} />
        <ResultRow k="Current contributions" v={`${fmtMoney(existingPmt)}/mo`} />
        <ResultRow k="Reallocated extra" v={`${fmtMoney(reallocExtra)}/mo`} />
      </div>

      <p className="mt-4 text-xs text-ink-500">
        {onTrack
          ? <>Your existing {fmtMoney(existingPmt)}/mo plus the {fmtMoney(reallocExtra)}/mo you reallocated grows {fmtMoney(presentVal)} into roughly {fmtMoney(projected)} in {timeLabel} — past your {fmtMoney(target)} target.</>
          : <>To hit {fmtMoney(target)} in {timeLabel} you'd need {fmtMoneyCents(required)}/mo. You're {fmtMoneyCents(shortfall)}/mo short — reallocate further, raise the time frame, or lower the target.</>
        }
      </p>
    </div>
  )
}

function ResultRow({ k, v, hint }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 border border-slate-100">
      <p className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">{k}</p>
      <p className="font-semibold mt-0.5">{v}</p>
      {hint && <p className="text-[11px] text-ink-400 mt-0.5">{hint}</p>}
    </div>
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
