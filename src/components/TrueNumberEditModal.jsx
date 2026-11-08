import { useEffect } from 'react'
import { usePlanner } from '../context/PlannerContext.jsx'
import { MONTH_NAMES } from '../utils/age.js'
import {
  HOUSING_OPTIONS, HOUSING_SITUATIONS_NEEDING_NEIGHBOURHOOD, NEIGHBOURHOOD_OPTIONS,
  SOCIAL_LEVELS, SECURITY_LEVELS, INVESTMENT_APPROACHES,
  IdealCityPicker, HobbyRanker, useSingleGoal,
} from '../pages/Wizard.jsx'

/**
 * Edit one group of True Number inputs in place, from the "read more" page,
 * without sending the user back through the wizard. Reuses the wizard's own
 * controls so answers are stored exactly the same way.
 *
 * Changes save as you make them (like the wizard) — the page behind
 * recalculates live, and "Done" just closes.
 *
 * section: 'city' | 'housing' | 'age' | 'lifestyle' | 'financial' | 'income'
 */
const TITLES = {
  city:      { h: 'Where you want to live',  s: 'Your True Number is priced for this city.' },
  housing:   { h: 'Your housing',            s: 'How your home shows up in the number.' },
  age:       { h: 'Your age',                s: 'Sets how many years your number has to cover.' },
  lifestyle: { h: 'Your lifestyle',          s: 'Shapes the lifestyle part of your ideal year.' },
  financial: { h: 'Security & investing',    s: 'How much cushion you want, and how your money grows.' },
  income:    { h: 'Your income',             s: 'Take-home pay, after tax, all sources combined.' },
}

export default function TrueNumberEditModal({ section, profile, onClose }) {
  const { updateSection, setGoals, setPriorities } = usePlanner()
  const [lifestyleGoal, patchLifestyle] = useSingleGoal(profile, setGoals, setPriorities, 'lifestyle')
  const [financialGoal, patchFinancial] = useSingleGoal(profile, setGoals, setPriorities, 'financial')
  const p = profile.personal || {}
  const setPersonal = (patch) => updateSection('personal', patch)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const t = TITLES[section] || TITLES.city

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tn-edit-title"
    >
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-soft p-6
                      pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="tn-edit-title" className="font-display text-xl font-extrabold">{t.h}</h2>
            <p className="text-sm text-ink-500 mt-0.5">{t.s}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="h-9 w-9 grid place-items-center rounded-full bg-slate-100 hover:bg-slate-200 shrink-0">✕</button>
        </div>

        <div className="mt-5 space-y-5">
          {section === 'city' && (
            <IdealCityPicker
              country={p.country}
              region={p.region}
              value={p.idealCityId}
              onChange={(idealCityId) => setPersonal({ idealCityId })}
            />
          )}

          {section === 'housing' && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {HOUSING_OPTIONS.map((o) => (
                  <Tile
                    key={o.id}
                    selected={p.housingSituation === o.id}
                    emoji={o.emoji} label={o.label} caption={o.caption}
                    onClick={() => {
                      const patch = { housingSituation: o.id }
                      if (!HOUSING_SITUATIONS_NEEDING_NEIGHBOURHOOD.has(o.id)) patch.neighbourhoodType = ''
                      if (o.id !== 'upgrade') patch.currentHomeValue = ''
                      setPersonal(patch)
                    }}
                  />
                ))}
              </div>
              {HOUSING_SITUATIONS_NEEDING_NEIGHBOURHOOD.has(p.housingSituation) && (
                <div>
                  <p className="label">Type of neighbourhood</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {NEIGHBOURHOOD_OPTIONS.map((o) => (
                      <Tile key={o.id} selected={p.neighbourhoodType === o.id}
                            emoji={o.emoji} label={o.label} caption={o.caption}
                            onClick={() => setPersonal({ neighbourhoodType: o.id })} />
                    ))}
                  </div>
                </div>
              )}
              {p.housingSituation === 'upgrade' && (
                <MoneyInput
                  id="edit-home-value"
                  label="What's your current home worth?"
                  hint="We only count the difference between this and your ideal home."
                  placeholder="e.g. 650000"
                  value={p.currentHomeValue}
                  onChange={(v) => setPersonal({ currentHomeValue: v })}
                />
              )}
            </>
          )}

          {section === 'age' && (
            <div>
              <label className="label">Birth date</label>
              <div className="flex gap-2">
                <select aria-label="Birth month" className="input flex-1" value={p.birthMonth ?? ''}
                        onChange={(e) => setPersonal({ birthMonth: e.target.value })}>
                  <option value="">Month</option>
                  {MONTH_NAMES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                </select>
                <input aria-label="Birth year" type="number" inputMode="numeric" min="1900"
                       max={new Date().getFullYear()} className="input w-32" placeholder="Year"
                       value={p.birthYear ?? ''} onChange={(e) => setPersonal({ birthYear: e.target.value })} />
              </div>
            </div>
          )}

          {section === 'lifestyle' && (
            <>
              <div>
                <label className="label" htmlFor="edit-social">Lifestyle intensity</label>
                <select id="edit-social" className="input" value={lifestyleGoal?.socialIntensity || ''}
                        onChange={(e) => patchLifestyle({ socialIntensity: e.target.value || null })}>
                  <option value="">Select…</option>
                  {SOCIAL_LEVELS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <p className="label">Hobbies you'd prioritize</p>
                <p className="text-xs text-ink-500 mb-2">Your top three count toward your lifestyle spending.</p>
                <HobbyRanker ranking={lifestyleGoal?.hobbyRanking}
                             onChange={(next) => patchLifestyle({ hobbyRanking: next })} />
              </div>
            </>
          )}

          {section === 'financial' && (
            <>
              <div>
                <label className="label" htmlFor="edit-security">Financial security you want</label>
                <select id="edit-security" className="input" value={financialGoal?.financialSecurity || ''}
                        onChange={(e) => patchFinancial({ financialSecurity: e.target.value || null })}>
                  <option value="">Select…</option>
                  {SECURITY_LEVELS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="edit-approach">Investment approach</label>
                <select id="edit-approach" className="input" value={financialGoal?.investmentApproach || ''}
                        onChange={(e) => patchFinancial({ investmentApproach: e.target.value || null })}>
                  <option value="">Select…</option>
                  {INVESTMENT_APPROACHES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </>
          )}

          {section === 'income' && (
            <MoneyInput
              id="edit-income"
              label="Monthly take-home income"
              hint="After tax. You can split it by source in Play."
              placeholder="e.g. 6500"
              suffix="/mo"
              value={profile.finances?.monthlyIncome}
              onChange={(v) => updateSection('finances', { monthlyIncome: v })}
            />
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-400">Changes save as you go — your number updates behind this window.</p>
          <button type="button" onClick={onClose} className="btn-primary shrink-0">Done</button>
        </div>
      </div>
    </div>
  )
}

function Tile({ selected, emoji, label, caption, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border-2 p-3 transition ${
        selected ? 'border-grape-400 bg-grape-50' : 'border-slate-200 bg-white hover:border-grape-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <span className="font-display font-bold">{label}</span>
      </div>
      <p className="mt-1 text-xs text-ink-500 leading-snug">{caption}</p>
    </button>
  )
}

function MoneyInput({ id, label, hint, placeholder, suffix, value, onChange }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative max-w-xs">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">$</span>
        <input id={id} type="number" inputMode="numeric" min="0" className={`input pl-8 ${suffix ? 'pr-12' : ''}`}
               placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
    </div>
  )
}
