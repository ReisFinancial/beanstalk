import { useEffect, useState } from 'react'

/**
 * Five-dimension self-assessment of how content the user is with the
 * discretionary side of their budget. Each rating is a 0–10 slider; the
 * average drives the verdict (Content vs. Level Up).
 */
export const BUYING_POWER_QUESTIONS = [
  { id: 'lifestyleFit', title: 'Lifestyle fit',
    question: 'How satisfied are you with the lifestyle your current spending allows?' },
  { id: 'spontaneity', title: 'Spontaneity',
    question: 'How freely can you make spontaneous purchases without stress?' },
  { id: 'quality', title: 'Quality',
    question: 'Can you afford the quality of goods and experiences you actually want?' },
  { id: 'frequency', title: 'Treats',
    question: 'How often can you treat yourself without feeling guilty?' },
  { id: 'roomToGrow', title: 'Room to grow',
    question: 'Do you have headroom to expand your spending if you wanted to?' },
]

// Three-tier verdict on a 10-point average:
//   ≥ 8     → content       (you're happy where you sit)
//   ≥ 5     → underutilized (you have headroom you're not using)
//   else    → levelUp       (constrained — work on income/budget)
const TIER_THRESHOLDS = { content: 8, underutilized: 5 }

export function buyingPowerTier(avg) {
  const a = Number(avg) || 0
  if (a >= TIER_THRESHOLDS.content) return 'content'
  if (a >= TIER_THRESHOLDS.underutilized) return 'underutilized'
  return 'levelUp'
}

export const BUYING_POWER_TIER_META = {
  content: {
    emoji: '😊',
    title: "You're content",
    headerSub: "You're happy with where your buying power sits.",
    cardBg: 'bg-brand-50 border-brand-200',
    text: 'text-brand-700',
    chip: 'bg-brand-100 text-brand-700',
    chipShort: '😊 Content',
  },
  underutilized: {
    emoji: '🤔',
    title: 'Not fully utilizing buying power',
    headerSub: 'You have headroom — consider being a little more generous.',
    cardBg: 'bg-sky-50 border-sky-200',
    text: 'text-sky-700',
    chip: 'bg-sky-100 text-sky-700',
    chipShort: '🤔 Underutilized',
  },
  levelUp: {
    emoji: '🎯',
    title: 'Time to level up',
    headerSub: 'Your buying power is constrained — time to expand it.',
    cardBg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    chip: 'bg-amber-100 text-amber-700',
    chipShort: '🎯 Level up',
  },
}

export function computeBuyingPowerVerdict(ratings = {}) {
  const vals = BUYING_POWER_QUESTIONS.map((q) => Number(ratings[q.id]) || 0)
  const total = vals.reduce((s, v) => s + v, 0)
  const avg = total / vals.length
  const tier = buyingPowerTier(avg)
  return {
    avg,
    score: total,
    max: vals.length * 10,
    tier,
    content: tier === 'content', // legacy field — kept for downstream readers
  }
}

/**
 * BuyingPowerModal — collects ratings, shows a verdict, persists results.
 *
 * Props:
 *   initial : prior assessment object (or null) — used to seed sliders
 *   onClose : () => void
 *   onSave  : (assessment) => void   // shape mirrors profile.finances.buyingPowerAssessment
 */
export default function BuyingPowerModal({ initial, onClose, onSave }) {
  const [step, setStep] = useState('questions') // 'questions' | 'result'
  const [ratings, setRatings] = useState(() => {
    const seed = {}
    BUYING_POWER_QUESTIONS.forEach((q) => {
      const prior = Number(initial?.ratings?.[q.id])
      seed[q.id] = Number.isFinite(prior) ? prior : 5
    })
    return seed
  })

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const verdict = computeBuyingPowerVerdict(ratings)
  const tierMeta = BUYING_POWER_TIER_META[verdict.tier]

  const save = () => {
    onSave({
      ratings,
      avg: verdict.avg,
      tier: verdict.tier,
      content: verdict.content, // legacy field — kept for downstream readers
      assessedAt: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-ink-900/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-soft
                      p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-6
                      max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold">
              {step === 'questions' ? 'Buying power check' : 'Your buying power'}
            </h2>
            <p className="text-sm text-ink-500 mt-0.5">
              {step === 'questions'
                ? 'Rate each prompt on a 0–10 scale.'
                : tierMeta.headerSub}
            </p>
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

        {step === 'questions' ? (
          <div className="mt-5 space-y-4">
            {BUYING_POWER_QUESTIONS.map((q) => (
              <RatingRow
                key={q.id}
                question={q}
                value={ratings[q.id]}
                onChange={(v) => setRatings((r) => ({ ...r, [q.id]: v }))}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className={`rounded-2xl border p-4 text-center ${tierMeta.cardBg}`}>
              <div className="text-4xl">{tierMeta.emoji}</div>
              <p className={`mt-2 font-display text-lg font-extrabold ${tierMeta.text}`}>
                {tierMeta.title}
              </p>
              <p className="text-xs text-ink-500 mt-1">
                Score {verdict.score} of {verdict.max} · {verdict.avg.toFixed(1)} / 10 average
              </p>
            </div>

            {verdict.tier === 'underutilized' && (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-bold mb-2">Consider this</p>
                <ul className="text-sm text-ink-500 space-y-1.5">
                  <li>· Treat yourself a bit more often — guilt-free.</li>
                  <li>· Upgrade the quality of things you buy regularly.</li>
                  <li>· Try a new experience or hobby you've been putting off.</li>
                </ul>
              </div>
            )}

            {verdict.tier === 'levelUp' && (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-bold mb-2">Ways to level up</p>
                <ul className="text-sm text-ink-500 space-y-1.5">
                  <li>· Increase income — raise, side hustle, or new role.</li>
                  <li>· Trim bare necessities where you can.</li>
                  <li>· Re-balance wealth-gen contributions to free cashflow.</li>
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-bold mb-2">Your ratings</p>
              <ul className="text-sm space-y-1.5">
                {BUYING_POWER_QUESTIONS.map((q) => (
                  <li key={q.id} className="flex items-baseline justify-between gap-2">
                    <span className="text-ink-500 truncate">{q.title}</span>
                    <span className="font-bold tabular-nums shrink-0">
                      {ratings[q.id]} / 10
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          {step === 'questions' ? (
            <>
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('result')}
                className="btn-primary flex-1"
              >
                See result
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('questions')}
                className="btn-ghost flex-1"
              >
                Adjust ratings
              </button>
              <button type="button" onClick={save} className="btn-primary flex-1">
                Save assessment
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RatingRow({ question, value, onChange }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-ink-700">{question.title}</p>
        <span className="font-display text-xl font-extrabold text-grape-700 tabular-nums">
          {value}
          <span className="text-[10px] text-ink-400 font-bold ml-1">/ 10</span>
        </span>
      </div>
      <p className="text-xs text-ink-500 mt-1 leading-snug">{question.question}</p>
      <input
        type="range"
        min="0"
        max="10"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-2 accent-grape-600"
        aria-label={question.title}
      />
      <div className="flex justify-between text-[10px] text-ink-400">
        <span>Not at all</span>
        <span>Completely</span>
      </div>
    </div>
  )
}
