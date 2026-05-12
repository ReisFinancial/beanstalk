import { useEffect, useRef, useState } from 'react'

function fmtMoney(n) {
  const x = Number(n) || 0
  return x.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Goal categories now describe what kind of action the goal entails.
// The selection drives which extra inputs show below it (target $ or
// the liability the goal pays down).
const GOAL_CATEGORIES = [
  { id: 'debt',       label: 'Paying down a debt',         emoji: '🔻' },
  { id: 'investment', label: 'Hitting an investment target', emoji: '📈' },
  { id: 'spending',   label: 'Increase spending allocation',   emoji: '💸' },
  { id: 'other',      label: 'Other',                       emoji: '🎯' },
]
const HORIZONS = [
  { id: 'short', label: '0–1 yr' },
  { id: 'mid',   label: '1–3 yrs' },
  { id: 'long',  label: '3+ yrs' },
]

const CLASSIFICATIONS = [
  { id: 'asset',     label: 'Asset',     emoji: '🟢' },
  { id: 'liability', label: 'Liability', emoji: '🔻' },
  { id: 'goal',      label: 'Goal',      emoji: '🎯' },
]

// Subtypes line up with the rate fields on the Money page so each hex
// can look up its own ROI / interest rate.
const ASSET_SUBTYPES = [
  { id: 'savings',     label: 'Savings' },
  { id: 'retirement',  label: 'Retirement' },
  { id: 'investments', label: 'Investments' },
  { id: 'realEstate',  label: 'Real estate' },
  { id: 'crypto',      label: 'Crypto' },
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
 *   initialValue  : existing item for edit mode — { label|title, amount?, category?, horizon?, targetAmount?, liabilityId? }
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
  logContribution,
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
  const [horizon, setHorizon]             = useState(initialValue?.horizon || 'mid')
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

  // Contribution log state (edit mode, asset/liability only)
  const [contribAmount, setContribAmount] = useState('')
  const [contribNote,   setContribNote]   = useState('')
  const [contribLogged, setContribLogged] = useState(false)

  const handleLogContrib = () => {
    const n = Number(contribAmount)
    if (!n || n <= 0 || !logContribution || !initialValue?.id) return
    logContribution(initialValue.type ?? type, initialValue.id, { amount: n, note: contribNote.trim() })
    setContribAmount('')
    setContribNote('')
    setContribLogged(true)
    setTimeout(() => setContribLogged(false), 2500)
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
      const payload = { title: trimmed, category, horizon }
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
      onSubmit(type, { label: trimmed, amount: amt, subtype, monthlyPayment: pmt })
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
                      p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-6 flip-enter">
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
                <p className="label">Time horizon</p>
                <div className="flex flex-wrap gap-2">
                  {HORIZONS.map((h) => (
                    <button
                      type="button"
                      key={h.id}
                      onClick={() => setHorizon(h.id)}
                      className={`chip border ${
                        horizon === h.id
                          ? 'bg-grape-50 border-grape-400 text-grape-800'
                          : 'bg-white border-slate-200 text-ink-700'
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Contribution log — edit mode, asset or liability only */}
          {mode === 'edit' && type !== 'goal' && logContribution && initialValue?.id && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div>
                <p className="font-display font-semibold text-sm">
                  {type === 'asset' ? 'Log a contribution' : 'Log a payment'}
                </p>
                <p className="text-xs text-ink-400 mt-0.5">
                  {type === 'asset'
                    ? 'Record money you added — updates your balance right away.'
                    : 'Record what you paid down — reduces your balance right away.'}
                </p>
              </div>

              {monthlyPayment && Number(monthlyPayment) > 0 && (
                <p className="text-xs text-ink-500">
                  Your plan: <span className="font-semibold">{fmtMoney(Number(monthlyPayment))}/mo</span>
                </p>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 text-sm">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    className="input pl-7 pr-3 py-2.5 text-sm"
                    placeholder="Amount"
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLogContrib}
                  disabled={!contribAmount || Number(contribAmount) <= 0}
                  className={`btn shrink-0 text-sm px-4 py-2.5 transition-all ${
                    contribLogged
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 text-ink-700 hover:bg-slate-200 disabled:opacity-40'
                  }`}
                >
                  {contribLogged ? '✓ Logged' : 'Log it'}
                </button>
              </div>

              <input
                type="text"
                className="input py-2.5 text-sm"
                placeholder="Note (optional) — e.g. bonus, birthday gift"
                value={contribNote}
                onChange={(e) => setContribNote(e.target.value)}
              />

              {/* Recent contributions */}
              {(initialValue?.contributions || []).length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Recent</p>
                  {[...(initialValue.contributions || [])].reverse().slice(0, 4).map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs text-ink-500">
                      <span>{c.note || (type === 'asset' ? 'Contribution' : 'Payment')}</span>
                      <span className="font-semibold">{fmtDate(c.date)} · {fmtMoney(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
