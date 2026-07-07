import { useEffect, useRef, useState } from 'react'

// Goal categories now describe what kind of action the goal entails.
// The selection drives which extra inputs show below it (target $ or
// the liability the goal pays down).
const GOAL_CATEGORIES = [
  { id: 'debt',       label: 'Paying down a debt',         emoji: '🔻' },
  { id: 'investment', label: 'Hitting an investment target', emoji: '📈' },
  { id: 'spending',   label: 'Increase spending allocation',   emoji: '💸' },
  { id: 'other',      label: 'Other',                       emoji: '🎯' },
]
const CLASSIFICATIONS = [
  { id: 'asset',     label: 'Asset',     emoji: '🟢' },
  { id: 'liability', label: 'Liability', emoji: '🔻' },
  { id: 'goal',      label: 'Goal',      emoji: '🎯' },
]

// Subtypes line up with the rate fields on the Money page so each hex
// can look up its own ROI / interest rate.
const ASSET_SUBTYPES = [
  { id: 'savings',      label: 'Savings' },
  { id: 'retirement',   label: 'Retirement' },
  { id: 'investments',  label: 'Investments' },
  { id: 'realEstate',   label: 'Real estate' },
  { id: 'crypto',       label: 'Crypto' },
  { id: 'vehicle',      label: 'Vehicle / car' },
  { id: 'stockOptions', label: 'Stock options' },
  { id: 'pension',      label: 'Company pension' },
  { id: 'collectibles', label: 'Collectibles' },
]
const LIABILITY_SUBTYPES = [
  { id: 'creditCard',   label: 'Credit card' },
  { id: 'lineOfCredit', label: 'Line of credit' },
  { id: 'overdueBills', label: 'Overdue bills' },
  { id: 'carLoan',      label: 'Car loan' },
  { id: 'mortgage',     label: 'Mortgage' },
]
const DEFAULT_SUBTYPE = { asset: 'savings', liability: 'creditCard' }

const META = {
  asset: {
    addH: 'Add an asset',    editH: 'Edit asset',
    addS: 'Something you own that has value.',
    editS: 'Rename it, adjust the amount, or reclassify.',
    addCTA: 'Add asset',     editCTA: 'Save changes',
  },
  liability: {
    addH: 'Add a liability', editH: 'Edit liability',
    addS: 'A debt or ongoing obligation.',
    editS: 'Rename it, adjust the amount, or reclassify.',
    addCTA: 'Add liability', editCTA: 'Save changes',
  },
  goal: {
    addH: 'Add a goal',      editH: 'Edit goal',
    addS: 'What are you working toward?',
    editS: 'Rename it, tweak the timeline, or reclassify.',
    addCTA: 'Add goal',      editCTA: 'Save changes',
  },
}

/**
 * AddItemModal — create or edit an asset / liability / goal.
 *
 * Props:
 *   type          : initial classification ('asset' | 'liability' | 'goal')
 *   mode          : 'add' (default) | 'edit'
 *   initialValue  : existing item for edit mode — { label|title, amount?, category?, targetAge?, targetAmount?, liabilityId? }
 *   liabilities   : full list of liabilities (used by the goal "debt" picker)
 *   onClose       : () => void
 *   onSubmit      : (type, payload) => void — callback receives the (possibly reclassified) type
 *   onDelete      : optional () => void — shown only in edit mode
 */
export default function AddItemModal({
  type: initialType,
  mode = 'add',
  initialValue,
  liabilities = [],
  onClose,
  onSubmit,
  onDelete,
}) {
  const firstInput = useRef(null)
  const [type, setType] = useState(initialType)

  // Shared across all classifications
  const [label, setLabel] = useState(
    initialValue ? (initialValue.label ?? initialValue.title ?? '') : '',
  )
  const [amount, setAmount] = useState(
    initialValue?.amount !== undefined && initialValue.amount !== null
      ? String(initialValue.amount)
      : '',
  )
  const [monthlyPayment, setMonthlyPayment] = useState(
    initialValue?.monthlyPayment !== undefined && initialValue.monthlyPayment !== null
      ? String(initialValue.monthlyPayment)
      : '',
  )
  // Stock options carry their own projected ROI instead of using the type
  // rate from the Money page.
  const [customRate, setCustomRate] = useState(
    initialValue?.customRate !== undefined && initialValue.customRate !== null
      ? String(initialValue.customRate)
      : '',
  )
  // Pension-only — age the annuity begins + forecasted annual annuity.
  const [retirementAge, setRetirementAge] = useState(
    initialValue?.retirementAge !== undefined && initialValue.retirementAge !== null
      ? String(initialValue.retirementAge)
      : '',
  )
  const [annualAnnuity, setAnnualAnnuity] = useState(
    initialValue?.annualAnnuity !== undefined && initialValue.annualAnnuity !== null
      ? String(initialValue.annualAnnuity)
      : '',
  )
  // Asset/liability-only — picks which rate category applies
  const [subtype, setSubtype] = useState(
    initialValue?.subtype
      || DEFAULT_SUBTYPE[initialType]
      || 'savings',
  )
  // Goal-only. `category` now drives extra fields:
  //   investment → ask for a target $ amount
  //   debt       → ask which liability this goal pays down
  const LEGACY_CATEGORY_MAP = {
    money: 'investment', career: 'other', health: 'other',
    learning: 'other',   relationships: 'other', lifestyle: 'other',
  }
  const initialCategory = (() => {
    const c = initialValue?.category
    if (!c) return 'other'
    if (GOAL_CATEGORIES.some((x) => x.id === c)) return c
    return LEGACY_CATEGORY_MAP[c] || 'other'
  })()
  const [category, setCategory]           = useState(initialCategory)
  const [targetAge, setTargetAge]         = useState(
    initialValue?.targetAge !== undefined && initialValue.targetAge !== null
      ? String(initialValue.targetAge)
      : '',
  )
  const [targetAmount, setTargetAmount]   = useState(
    initialValue?.targetAmount !== undefined && initialValue.targetAmount !== null
      ? String(initialValue.targetAmount)
      : '',
  )
  const [liabilityId, setLiabilityId]     = useState(initialValue?.liabilityId || '')
  const [spendingBucket, setSpendingBucket] = useState(initialValue?.spendingBucket || 'discretionary')
  const [spendingIncrease, setSpendingIncrease] = useState(
    initialValue?.spendingIncrease !== undefined && initialValue.spendingIncrease !== null
      ? String(initialValue.spendingIncrease)
      : '',
  )

  // When the user reclassifies in edit mode, make sure the subtype stays
  // valid for the new classification.
  const handleClassChange = (newType) => {
    setType(newType)
    if (newType === 'asset' && !ASSET_SUBTYPES.some((s) => s.id === subtype)) {
      setSubtype(DEFAULT_SUBTYPE.asset)
    } else if (newType === 'liability' && !LIABILITY_SUBTYPES.some((s) => s.id === subtype)) {
      setSubtype(DEFAULT_SUBTYPE.liability)
    }
  }

  // Close on escape + focus first input
  useEffect(() => {
    firstInput.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) return
    if (type === 'goal') {
      const payload = { title: trimmed, category }
      const age = Number(targetAge)
      payload.targetAge = Number.isFinite(age) && age > 0 ? Math.round(age) : null
      if (category === 'investment' || category === 'other') {
        const tgt = Number(targetAmount)
        payload.targetAmount = Number.isFinite(tgt) && tgt >= 0 ? tgt : 0
      }
      if (category === 'debt') {
        payload.liabilityId = liabilityId || null
      }
      if (category === 'spending') {
        const inc = Number(spendingIncrease)
        payload.spendingBucket   = spendingBucket
        payload.spendingIncrease = Number.isFinite(inc) && inc >= 0 ? inc : 0
      }
      onSubmit(type, payload)
    } else {
      const amt = Number(amount)
      if (!Number.isFinite(amt) || amt < 0) return
      const pmt = monthlyPayment === '' ? 0 : Number(monthlyPayment)
      if (!Number.isFinite(pmt) || pmt < 0) return
      const payload = { label: trimmed, amount: amt, subtype, monthlyPayment: pmt }
      // Stock options + collectibles: per-asset ROI overrides the
      // Money-page type rate — each collection appreciates uniquely.
      if (type === 'asset' && (subtype === 'stockOptions' || subtype === 'collectibles')) {
        const r = Number(customRate)
        payload.customRate = Number.isFinite(r) && r >= 0 ? r : null
      }
      // Pension: retirement age + forecasted annual annuity feed projection logic.
      if (type === 'asset' && subtype === 'pension') {
        const ra = Number(retirementAge)
        const aa = Number(annualAnnuity)
        payload.retirementAge = Number.isFinite(ra) && ra > 0 ? Math.round(ra) : null
        payload.annualAnnuity = Number.isFinite(aa) && aa >= 0 ? aa : 0
      }
      onSubmit(type, payload)
    }
  }

  const meta = META[type]
  const heading  = mode === 'edit' ? meta.editH  : meta.addH
  const subhead  = mode === 'edit' ? meta.editS  : meta.addS
  const cta      = mode === 'edit' ? meta.editCTA : meta.addCTA

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-ink-900/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-soft
                      p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold">{heading}</h2>
            <p className="text-sm text-ink-500 mt-0.5">{subhead}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full bg-slate-100 hover:bg-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === 'edit' && (
            <div>
              <p className="label">Classification</p>
              <div className="flex flex-wrap gap-2">
                {CLASSIFICATIONS.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleClassChange(c.id)}
                    className={`chip border ${
                      type === c.id
                        ? 'bg-grape-50 border-grape-400 text-grape-800'
                        : 'bg-white border-slate-200 text-ink-700'
                    }`}
                  >
                    <span>{c.emoji}</span> {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label" htmlFor="item-label">
              {type === 'goal' ? 'Goal' : 'Name'}
            </label>
            <input
              id="item-label"
              ref={firstInput}
              className="input"
              placeholder={
                type === 'asset'     ? 'e.g. Chequing account, Home equity'
                : type === 'liability' ? 'e.g. Student loan, Credit card'
                : 'e.g. Buy a house, Run a 10k'
              }
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>

          {type !== 'goal' && (
            <>
              <div>
                <label className="label" htmlFor="item-amount">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
                  <input
                    id="item-amount"
                    type="number"
                    inputMode="decimal"
                    className="input pl-8"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label flex items-baseline justify-between gap-2" htmlFor="item-pmt">
                  <span>
                    {type === 'asset' ? 'Monthly contribution' : 'Monthly payment'}
                    <span className="text-ink-400 font-normal ml-1">(optional)</span>
                  </span>
                  <span className="text-[11px] font-normal text-ink-400">
                    {type === 'asset' ? 'Added each month' : 'Paid down each month'}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
                  <input
                    id="item-pmt"
                    type="number"
                    inputMode="decimal"
                    className="input pl-8 pr-16"
                    placeholder="0"
                    value={monthlyPayment}
                    onChange={(e) => setMonthlyPayment(e.target.value)}
                    min="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">
                    /mo
                  </span>
                </div>
              </div>

              <div>
                <p className="label">
                  Type <span className="text-ink-400 font-normal">(rate comes from Money page)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {(type === 'asset' ? ASSET_SUBTYPES : LIABILITY_SUBTYPES).map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setSubtype(s.id)}
                      className={`chip border ${
                        subtype === s.id
                          ? 'bg-grape-50 border-grape-400 text-grape-800'
                          : 'bg-white border-slate-200 text-ink-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stock options + collectibles — per-asset ROI override */}
              {type === 'asset' && (subtype === 'stockOptions' || subtype === 'collectibles') && (
                <div>
                  <label className="label" htmlFor="item-roi">
                    {subtype === 'collectibles' ? 'Projected appreciation' : 'Projected ROI'}
                    <span className="text-ink-400 font-normal ml-1">(per year)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="item-roi"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      className="input pr-10"
                      placeholder={subtype === 'collectibles' ? 'e.g. 6' : 'e.g. 12'}
                      value={customRate}
                      onChange={(e) => setCustomRate(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 font-semibold">%</span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-400">
                    {subtype === 'collectibles'
                      ? 'How much you expect this collection to appreciate each year. Used for projections only.'
                      : 'Annual return you expect on these options. Used for projections only.'}
                  </p>
                </div>
              )}

              {/* Pension — retirement age + forecasted annual annuity */}
              {type === 'asset' && subtype === 'pension' && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    Pension details
                  </p>
                  <div>
                    <label className="label" htmlFor="pension-retire">Retirement age</label>
                    <div className="relative max-w-[180px]">
                      <input
                        id="pension-retire"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="120"
                        step="1"
                        className="input pr-14 bg-white"
                        placeholder="e.g. 65"
                        value={retirementAge}
                        onChange={(e) => setRetirementAge(e.target.value)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">yrs</span>
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="pension-annuity">
                      Forecasted annual annuity at retirement
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
                      <input
                        id="pension-annuity"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="1"
                        className="input pl-8 pr-12 bg-white"
                        placeholder="e.g. 36000"
                        value={annualAnnuity}
                        onChange={(e) => setAnnualAnnuity(e.target.value)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">/yr</span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-400">
                      Income stream that begins once you reach the retirement age above.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {type === 'goal' && (
            <>
              <div>
                <label className="label" htmlFor="goal-category">Category</label>
                <select
                  id="goal-category"
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {GOAL_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji}  {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {(category === 'investment' || category === 'other') && (
                <div>
                  <label className="label" htmlFor="goal-target">
                    {category === 'investment' ? 'Target amount' : 'Estimated cost'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
                    <input
                      id="goal-target"
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
                    {category === 'investment'
                      ? "The dollar amount you're aiming to reach."
                      : "The dollar amount this goal is expected to cost."}
                  </p>
                </div>
              )}

              {category === 'debt' && (
                <div>
                  <label className="label" htmlFor="goal-liability">Liability to pay down</label>
                  <select
                    id="goal-liability"
                    className="input"
                    value={liabilityId}
                    onChange={(e) => setLiabilityId(e.target.value)}
                  >
                    <option value="">Select a liability…</option>
                    {liabilities.map((l) => (
                      <option key={l.id} value={l.id}>
                        🔻 {l.label} {l.amount ? `· $${Number(l.amount).toLocaleString()}` : ''}
                      </option>
                    ))}
                  </select>
                  {liabilities.length === 0 && (
                    <p className="mt-1 text-[11px] text-ink-400">
                      No liabilities yet — add one on the Snapshot first.
                    </p>
                  )}
                </div>
              )}

              {category === 'spending' && (
                <div className="space-y-3">
                  <div>
                    <label className="label" htmlFor="goal-bucket">Which area to increase?</label>
                    <select
                      id="goal-bucket"
                      className="input"
                      value={spendingBucket}
                      onChange={(e) => setSpendingBucket(e.target.value)}
                    >
                      <option value="wealthGen">🌱 Wealth generation</option>
                      <option value="bareNec">🧱 Bare necessities</option>
                      <option value="discretionary">🎈 Discretionary spending</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="goal-increase">Increase by</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
                      <input
                        id="goal-increase"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="1"
                        className="input pl-8 pr-12"
                        placeholder="0"
                        value={spendingIncrease}
                        onChange={(e) => setSpendingIncrease(e.target.value)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">
                        /mo
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-400">
                      How much extra you want to add to this bucket each month.
                    </p>
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
                    value={targetAge}
                    onChange={(e) => setTargetAge(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">yrs</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-400">
                  The age you'd like to reach this milestone by.
                </p>
              </div>
            </>
          )}

          <div className="flex items-center gap-3 pt-2">
            {mode === 'edit' && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="btn-ghost !text-red-600 hover:!bg-red-50"
              >
                Delete
              </button>
            ) : (
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                Cancel
              </button>
            )}
            <button type="submit" className="btn-primary flex-1">{cta}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
