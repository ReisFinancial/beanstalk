import { useMemo, useState } from 'react'

/**
 * Walks the user through ranking up to 3 goals across five dimensions
 * (Peace of Mind, Daily life impact, Flexibility, Identity fit, Financial
 * safety), then assigns each a 0–10 score:
 *
 *   score = avg(Q1..Q4) * (1 − 0.6) + Q5 * 0.6
 *         = avg(Q1..Q4) * 0.40     + Q5 * 0.60
 *
 * Financial safety is weighted heaviest because the user's framing
 * privileges it over the more subjective dimensions.
 */

const CATEGORY_EMOJI = {
  debt: '🔻', investment: '📈', spending: '💸', other: '🎯',
  // Legacy theme categories — kept so older saved goals still render
  money: '💰', career: '🧑‍💻', health: '💪',
  learning: '📚', relationships: '❤️', lifestyle: '🌿',
}

// Compact target-age label for goal rows in this modal. No "—" fallback
// when the user hasn't set a target age — the row reads cleaner blank.
const ageLine = (g) => (g?.targetAge ? `By age ${g.targetAge}` : '')

export const QUESTIONS = [
  { id: 'peaceOfMind',     title: 'Peace of Mind',     question: 'How calm and safe does this decision feel?' },
  { id: 'dailyLifeImpact', title: 'Daily life impact', question: 'How much will this improve my daily life?' },
  { id: 'flexibility',     title: 'Flexibility',       question: 'How easy will it be to change your mind or back out later?' },
  { id: 'identityFit',     title: 'Identity fit',      question: 'How well does this match who I want to be?' },
  { id: 'financialSafety', title: 'Financial safety',  question: 'Given my situation, how financially safe does this decision feel?' },
]

const FINANCIAL_WEIGHT = 0.6

function computeScore(r = {}) {
  const vals = [r.peaceOfMind, r.dailyLifeImpact, r.flexibility, r.identityFit]
    .map((v) => Number(v) || 0)
  const avg = vals.reduce((s, v) => s + v, 0) / 4
  const fin = Number(r.financialSafety) || 0
  return avg * (1 - FINANCIAL_WEIGHT) + fin * FINANCIAL_WEIGHT
}

function defaultRating(ratings, goalId, qid) {
  return ratings[goalId]?.[qid] ?? 5
}

export default function PrioritizeGoalsModal({ goals, onClose, onSave }) {
  // step: 0 = select | 1..5 = QUESTIONS[step-1] | 6 = results
  const [step, setStep] = useState(0)
  const [selectedIds, setSelectedIds] = useState([])
  const [ratings, setRatings] = useState({}) // { [goalId]: { qid: number } }

  const selectedGoals = useMemo(
    () => selectedIds.map((id) => goals.find((g) => g.id === id)).filter(Boolean),
    [selectedIds, goals],
  )

  const ranked = useMemo(
    () => selectedGoals
      .map((g) => ({ goal: g, score: computeScore(ratings[g.id]) }))
      .sort((a, b) => b.score - a.score),
    [selectedGoals, ratings],
  )

  const totalSteps = 7 // 1 select + 5 questions + 1 results
  const stepIndex = step
  const currentQ = step >= 1 && step <= 5 ? QUESTIONS[step - 1] : null

  const toggle = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }

  const setRating = (goalId, qid, value) => {
    setRatings((prev) => ({
      ...prev,
      [goalId]: { ...(prev[goalId] || {}), [qid]: value },
    }))
  }

  const next = () => setStep((s) => Math.min(6, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  const handleSave = () => {
    const ids = ranked.map((r) => r.goal.id)
    onSave(ids, ratings)
  }

  // ----- Header copy by step ----------------------------------------------
  let title = 'Prioritize your goals'
  let subtitle = 'Pick up to 3 goals to weigh against each other.'
  if (currentQ) {
    title = currentQ.title
    subtitle = currentQ.question
  } else if (step === 6) {
    title = 'Your priority order'
    subtitle = 'Higher score = better fit overall (out of 10).'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-ink-900/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-soft
                      flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold">{title}</h2>
              <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 grid place-items-center rounded-full bg-slate-100 hover:bg-slate-200 shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Progress dashes */}
          <div className="mt-4 flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < stepIndex ? 'bg-olive-500'
                  : i === stepIndex ? 'bg-olive-300'
                  : 'bg-slate-100'
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] uppercase tracking-wider text-ink-400">
            Step {stepIndex + 1} of {totalSteps}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
          {step === 0 && (
            <SelectStep goals={goals} selectedIds={selectedIds} toggle={toggle} />
          )}

          {currentQ && (
            <RateStep
              question={currentQ}
              goals={selectedGoals}
              ratings={ratings}
              setRating={setRating}
            />
          )}

          {step === 6 && (
            <ResultsStep ranked={ranked} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3
                        pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4">
          {step > 0 ? (
            <button onClick={back} className="btn-secondary !py-2 !px-4 text-sm">← Back</button>
          ) : (
            <button onClick={onClose} className="btn-secondary !py-2 !px-4 text-sm">Cancel</button>
          )}

          {step === 0 && (
            <button
              onClick={next}
              disabled={selectedIds.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next ({selectedIds.length}/3)
            </button>
          )}
          {step >= 1 && step <= 4 && (
            <button onClick={next} className="btn-primary">Next</button>
          )}
          {step === 5 && (
            <button onClick={next} className="btn-primary">See results</button>
          )}
          {step === 6 && (
            <button onClick={handleSave} className="btn-primary">Set as my top focus</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 0 — Select up to 3 goals ──────────────────────────────────────
function SelectStep({ goals, selectedIds, toggle }) {
  if (goals.length === 0) {
    return (
      <p className="text-center text-sm text-ink-500 py-8">
        You haven't added any goals yet. Add some on the Snapshot first, then come back.
      </p>
    )
  }

  const atLimit = selectedIds.length >= 3

  return (
    <div>
      <p className="text-xs text-ink-400 uppercase tracking-wider mb-3">
        Select up to 3 · {selectedIds.length} chosen
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {goals.map((g) => {
          const selected = selectedIds.includes(g.id)
          const disabled = !selected && atLimit
          return (
            <button
              type="button"
              key={g.id}
              onClick={() => toggle(g.id)}
              disabled={disabled}
              className={`text-left rounded-2xl px-4 py-3 border transition flex items-start gap-3 ${
                selected
                  ? 'bg-olive-50 border-olive-400 ring-1 ring-olive-300'
                  : disabled
                    ? 'bg-slate-50 border-slate-100 text-ink-400 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-olive-300'
              }`}
            >
              <span className="text-xl shrink-0">{CATEGORY_EMOJI[g.category] || '🎯'}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug truncate">{g.title}</span>
                <span className="block text-[11px] text-ink-500 mt-0.5">
                  {ageLine(g) || '—'}
                </span>
              </span>
              <span
                aria-hidden
                className={`h-5 w-5 rounded-full border-2 grid place-items-center text-[11px] shrink-0 ${
                  selected
                    ? 'bg-olive-600 border-olive-600 text-white'
                    : 'border-slate-300 text-transparent'
                }`}
              >
                ✓
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Steps 1–5 — Rate each selected goal 0..10 ──────────────────────────
function RateStep({ question, goals, ratings, setRating }) {
  return (
    <div>
      <div
        className={`grid gap-4 ${
          goals.length === 1 ? 'grid-cols-1' :
          goals.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                               'grid-cols-1 sm:grid-cols-3'
        }`}
      >
        {goals.map((g) => {
          const value = defaultRating(ratings, g.id, question.id)
          return (
            <div
              key={g.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3"
            >
              {/* Title above */}
              <div className="flex items-start gap-2 min-h-[3rem]">
                <span className="text-lg shrink-0">{CATEGORY_EMOJI[g.category] || '🎯'}</span>
                <p className="font-semibold text-sm leading-snug">{g.title}</p>
              </div>

              {/* Big value */}
              <div className="grid place-items-center">
                <span className="font-display text-5xl font-extrabold text-olive-700 tabular-nums">
                  {value}
                </span>
                <span className="text-[11px] text-ink-400 uppercase tracking-wider">/ 10</span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={value}
                onChange={(e) => setRating(g.id, question.id, Number(e.target.value))}
                className="w-full accent-olive-600"
                aria-label={`Rate ${g.title} for ${question.title}`}
              />
              <div className="flex justify-between text-[11px] text-ink-400">
                <span>0</span>
                <span>10</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 6 — Final ranked results ──────────────────────────────────────
function ResultsStep({ ranked }) {
  const top = ranked[0]?.score ?? 0

  return (
    <div className="space-y-3">
      {ranked.map((r, i) => {
        const pct = Math.max(4, Math.round((r.score / 10) * 100))
        const isTop = i === 0 && r.score > 0
        return (
          <div
            key={r.goal.id}
            className={`rounded-2xl border p-4 ${
              isTop ? 'bg-olive-50 border-olive-300' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="font-display font-extrabold text-ink-300 text-2xl tabular-nums">
                  #{i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug truncate">
                    {CATEGORY_EMOJI[r.goal.category] || '🎯'} {r.goal.title}
                  </p>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    {ageLine(r.goal) || '—'}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-2xl font-extrabold text-olive-700 tabular-nums">
                  {r.score.toFixed(1)}
                </p>
                <p className="text-[11px] text-ink-400 uppercase tracking-wider">score</p>
              </div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={isTop ? 'h-full bg-olive-500' : 'h-full bg-olive-300'}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
      <p className="text-[11px] text-ink-400 text-center pt-2">
        Score = avg of Peace of Mind, Daily life impact, Flexibility &amp; Identity fit
        (40%) + Financial safety (60%).
      </p>
    </div>
  )
}
