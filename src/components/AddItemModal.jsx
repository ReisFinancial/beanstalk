import { useEffect, useRef, useState } from 'react'

const GOAL_CATEGORIES = [
  { id: 'money',         label: 'Money',         emoji: '💰' },
  { id: 'career',        label: 'Career',        emoji: '🧑‍💻' },
  { id: 'health',        label: 'Health',        emoji: '💪' },
  { id: 'learning',      label: 'Learning',      emoji: '📚' },
  { id: 'relationships', label: 'Relationships', emoji: '❤️' },
  { id: 'lifestyle',     label: 'Lifestyle',     emoji: '🌿' },
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
 *   initialValue  : existing item for edit mode — { label|title, amount?, category?, horizon? }
 *   onClose       : () => void
 *   onSubmit      : (type, payload) => void — callback receives the (possibly reclassified) type
 *   onDelete      : optional () => void — shown only in edit mode
 */
export default function AddItemModal({
  type: initialType,
  mode = 'add',
  initialValue,
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
  // Goal-only
  const [category, setCategory] = useState(initialValue?.category || 'money')
  const [horizon, setHorizon]   = useState(initialValue?.horizon  || 'mid')

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
      onSubmit(type, { title: trimmed, category, horizon })
    } else {
      const amt = Number(amount)
      if (!Number.isFinite(amt) || amt < 0) return
      onSubmit(type, { label: trimmed, amount: amt })
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
                    onClick={() => setType(c.id)}
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
          )}

          {type === 'goal' && (
            <>
              <div>
                <p className="label">Category</p>
                <div className="flex flex-wrap gap-2">
                  {GOAL_CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className={`chip border ${
                        category === c.id
                          ? 'bg-grape-50 border-grape-400 text-grape-800'
                          : 'bg-white border-slate-200 text-ink-700'
                      }`}
                    >
                      <span>{c.emoji}</span> {c.label}
                    </button>
                  ))}
                </div>
              </div>
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
