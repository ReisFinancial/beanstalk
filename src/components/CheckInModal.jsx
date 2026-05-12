import { useRef, useState } from 'react'

function fmtMoney(n) {
  const x = Number(n) || 0
  return x.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function Delta({ label, before, after, unit = '' }) {
  const diff = after - before
  if (diff === 0) return null
  const positive = diff > 0
  const formatted = unit === '$'
    ? `${diff >= 0 ? '+' : ''}${fmtMoney(Math.abs(diff))}${diff < 0 ? ' less' : ''}`
    : `${diff > 0 ? '+' : ''}${diff}${unit}`
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span className={`text-sm font-semibold ${positive ? 'text-brand-700' : 'text-red-600'}`}>
        {formatted}
      </span>
    </div>
  )
}

function MoneyInput({ label, value, onChange, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="text-xs text-ink-400 mb-1">{hint}</p>}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
        <input
          type="number" inputMode="decimal" min="0"
          className="input pl-8" placeholder="0"
          value={value} onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}

const ASSET_ICONS = { savings: '🏦', retirement: '🧓', investments: '📈', realEstate: '🏠', crypto: '₿' }
const LIAB_ICONS  = { creditCard: '💳', lineOfCredit: '🔁', overdueBills: '⚠️', carLoan: '🚗', mortgage: '🏘️' }

export default function CheckInModal({ profile, onSave, onDismiss, logContribution }) {
  const f = profile.finances

  // Freeze the "before" snapshot at mount so re-renders after onSave don't shift it
  const [prev] = useState(() => profile.checkIns?.at(-1) || null)

  const [form, setForm] = useState({
    monthlyIncome:   f.monthlyIncome   || '',
    monthlyExpenses: f.monthlyExpenses || '',
    bareNecessities: f.bareNecessities || '',
    liquidAssets:    f.liquidAssets    || '',
    investments:     f.investments     || '',
    realEstate:      f.realEstate      || '',
    debts:           f.debts           || '',
  })

  // Accounts with a planned monthly payment — shown in contributions phase
  const planAssets = (profile.assets || []).filter((a) => (a.monthlyPayment || 0) > 0)
  const planLiabs  = (profile.liabilities || []).filter((l) => (l.monthlyPayment || 0) > 0)
  const hasPlans   = planAssets.length > 0 || planLiabs.length > 0

  // Actual amounts — pre-filled with the planned payment for each account
  const [actuals, setActuals] = useState(() => ({
    assets: Object.fromEntries(planAssets.map((a) => [a.id, String(a.monthlyPayment)])),
    liabs:  Object.fromEntries(planLiabs.map((l)  => [l.id, String(l.monthlyPayment)])),
  }))

  // phase: 'form' | 'flip1' | 'contributions' | 'flip2' | 'result'
  const [phase,    setPhase]    = useState('form')
  const [cardKey,  setCardKey]  = useState(0)
  const [snapshot, setSnapshot] = useState(null)
  const savedFormRef = useRef(null) // hold form data across the flip1 animation

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }))

  const inc  = Number(form.monthlyIncome)   || 0
  const exp  = Number(form.monthlyExpenses) || 0
  const cash = Number(form.liquidAssets)    || 0
  const inv  = Number(form.investments)     || 0
  const re   = Number(form.realEstate)      || 0
  const debt = Number(form.debts)           || 0
  const savingsRate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : null
  const netWorth    = cash + inv + re - debt
  const runway      = exp > 0 ? +(cash / exp).toFixed(1) : null

  const prevRate   = prev?.savingsRate ?? null
  const prevNW     = prev?.netWorth    ?? null
  const prevRunway = prev
    ? (() => {
        const pE = Number(prev.finances?.monthlyExpenses) || 0
        const pC = Number(prev.finances?.liquidAssets)    || 0
        return pE > 0 ? +(pC / pE).toFixed(1) : null
      })()
    : null

  // ── Phase transitions ────────────────────────────────────────────────

  // User clicks "Save check-in" on the form phase
  const handleFormSave = () => {
    setSnapshot({ savingsRate, netWorth, runway })
    savedFormRef.current = form
    setPhase('flip1')
  }

  // flipOut animation ends — commit save, advance to next phase
  const handleFlip1End = () => {
    if (phase !== 'flip1') return
    onSave(savedFormRef.current)
    setPhase(hasPlans ? 'contributions' : 'result')
    setCardKey((k) => k + 1)
  }

  // User submits or skips contributions
  const handleContribsDone = (shouldLog) => {
    if (shouldLog && logContribution) {
      planAssets.forEach((a) => {
        const n = Number(actuals.assets[a.id])
        if (n > 0) logContribution('asset', a.id, { amount: n })
      })
      planLiabs.forEach((l) => {
        const n = Number(actuals.liabs[l.id])
        if (n > 0) logContribution('liability', l.id, { amount: n })
      })
    }
    setPhase('flip2')
  }

  const handleFlip2End = () => {
    if (phase !== 'flip2') return
    setPhase('result')
    setCardKey((k) => k + 1)
  }

  const headline = (() => {
    if (!prev) return "Baseline set. We'll track your progress from here."
    if (snapshot?.savingsRate > prevRate) return "Your savings rate went up — great month."
    if (snapshot?.netWorth   > prevNW)   return "Your net worth is growing. Keep going."
    if (snapshot?.savingsRate === prevRate) return "Holding steady. Consistency counts."
    return "Check-in complete. Every month of data helps."
  })()

  const isFlipping = phase === 'flip1' || phase === 'flip2'
  const onAnimEnd  = phase === 'flip1' ? handleFlip1End : phase === 'flip2' ? handleFlip2End : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        key={cardKey}
        className={`w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden
                    ${isFlipping ? 'flip-out' : 'flip-enter'}`}
        onAnimationEnd={onAnimEnd}
      >

        {/* ── FORM phase ─────────────────────────────────────────────── */}
        {(phase === 'form' || phase === 'flip1') && (
          <>
            <div className="bg-hero-gradient px-6 pt-6 pb-5 text-white">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📅</span>
                <div>
                  <h2 className="font-display text-xl font-extrabold">Monthly check-in</h2>
                  <p className="text-sm text-white/80 mt-0.5">Update your numbers — takes 2 minutes.</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyInput label="Monthly income"   value={form.monthlyIncome}   onChange={set('monthlyIncome')}   hint="After tax" />
                <MoneyInput label="Monthly expenses" value={form.monthlyExpenses} onChange={set('monthlyExpenses')} hint="Total outgoing" />
              </div>
              <MoneyInput label="Bare necessities" value={form.bareNecessities} onChange={set('bareNecessities')} hint="Rent, utilities, groceries" />

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">Net worth snapshot</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MoneyInput label="Liquid savings" value={form.liquidAssets} onChange={set('liquidAssets')} />
                  <MoneyInput label="Investments"    value={form.investments}  onChange={set('investments')}  />
                  <MoneyInput label="Real estate"    value={form.realEstate}   onChange={set('realEstate')}   />
                  <MoneyInput label="Debts"          value={form.debts}        onChange={set('debts')}        />
                </div>
              </div>

              {savingsRate !== null && (
                <div className={`rounded-2xl px-4 py-3 ${savingsRate >= 15 ? 'bg-brand-50 border border-brand-100' : savingsRate >= 0 ? 'bg-amber-50 border border-amber-100' : 'bg-red-50 border border-red-100'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Savings rate</p>
                  <p className="font-display text-2xl font-extrabold mt-0.5">{savingsRate}%</p>
                  {prev && prevRate !== null && savingsRate !== prevRate && (
                    <p className={`text-xs mt-1 ${savingsRate > prevRate ? 'text-brand-700' : 'text-amber-700'}`}>
                      {savingsRate > prevRate ? '▲' : '▼'} {Math.abs(savingsRate - prevRate)} pts from last month
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex items-center gap-3">
              <button type="button" onClick={handleFormSave} className="btn-primary flex-1">
                {hasPlans ? 'Next — confirm contributions →' : 'Save check-in'}
              </button>
              <button type="button" onClick={onDismiss} className="btn-secondary">Later</button>
            </div>
          </>
        )}

        {/* ── CONTRIBUTIONS phase ─────────────────────────────────────── */}
        {(phase === 'contributions' || phase === 'flip2') && (
          <>
            <div className="bg-hero-gradient px-6 pt-6 pb-5 text-white">
              <div className="flex items-center gap-3">
                <span className="text-3xl">💸</span>
                <div>
                  <h2 className="font-display text-xl font-extrabold">This month's contributions</h2>
                  <p className="text-sm text-white/80 mt-0.5">
                    Did you hit your plan? Edit any amount that was different.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[55vh]">
              {planAssets.length > 0 && (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">Building wealth</p>
                  <div className="space-y-3">
                    {planAssets.map((a) => (
                      <div key={a.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{ASSET_ICONS[a.subtype] || '💰'}</span>
                            <p className="font-semibold text-sm">{a.label}</p>
                          </div>
                          <span className="text-xs text-ink-400">Plan: {fmtMoney(a.monthlyPayment)}/mo</span>
                        </div>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-ink-300 text-sm">$</span>
                          <input
                            type="number" inputMode="decimal" min="0"
                            className="input pl-7 pr-14 py-2.5 text-sm bg-white"
                            placeholder="0"
                            value={actuals.assets[a.id] ?? ''}
                            onChange={(e) => setActuals((p) => ({ ...p, assets: { ...p.assets, [a.id]: e.target.value } }))}
                          />
                          <span className="absolute right-4 text-ink-400 text-xs font-medium">actual</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {planLiabs.length > 0 && (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">Paying down debt</p>
                  <div className="space-y-3">
                    {planLiabs.map((l) => (
                      <div key={l.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{LIAB_ICONS[l.subtype] || '🔴'}</span>
                            <p className="font-semibold text-sm">{l.label}</p>
                          </div>
                          <span className="text-xs text-ink-400">Plan: {fmtMoney(l.monthlyPayment)}/mo</span>
                        </div>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-ink-300 text-sm">$</span>
                          <input
                            type="number" inputMode="decimal" min="0"
                            className="input pl-7 pr-14 py-2.5 text-sm bg-white"
                            placeholder="0"
                            value={actuals.liabs[l.id] ?? ''}
                            onChange={(e) => setActuals((p) => ({ ...p, liabs: { ...p.liabs, [l.id]: e.target.value } }))}
                          />
                          <span className="absolute right-4 text-ink-400 text-xs font-medium">actual</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <p className="text-xs text-ink-400 text-center">
                Logging a contribution updates that account's balance automatically.
              </p>
            </div>

            <div className="px-6 pb-6 flex items-center gap-3">
              <button type="button" onClick={() => handleContribsDone(true)} className="btn-primary flex-1">
                Log contributions
              </button>
              <button type="button" onClick={() => handleContribsDone(false)} className="btn-secondary">
                Skip
              </button>
            </div>
          </>
        )}

        {/* ── RESULT phase ─────────────────────────────────────────────── */}
        {phase === 'result' && (
          <>
            <div className="bg-hero-gradient px-6 pt-6 pb-5 text-white">
              <div className="flex items-center gap-3">
                <span className="text-3xl">✅</span>
                <div>
                  <h2 className="font-display text-xl font-extrabold">Check-in saved</h2>
                  <p className="text-sm text-white/80 mt-0.5">{headline}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {prev ? (
                <>
                  <p className="text-sm font-semibold text-ink-500 uppercase tracking-wide">Since last month</p>
                  <div className="rounded-2xl bg-slate-50 px-4 py-2">
                    {prevRate !== null && snapshot && <Delta label="Savings rate" before={prevRate} after={snapshot.savingsRate} unit="%" />}
                    {prevNW   !== null && snapshot && <Delta label="Net worth"    before={prevNW}   after={snapshot.netWorth}    unit="$" />}
                    {prevRunway !== null && snapshot?.runway !== null && (
                      <Delta label="Runway" before={prevRunway} after={snapshot.runway} unit=" mo" />
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl bg-brand-50 border border-brand-100 px-4 py-4 text-center">
                  <p className="font-semibold text-brand-700">Your starting point is locked in.</p>
                  <p className="text-sm text-ink-500 mt-1">Next month we'll show how much you've grown.</p>
                </div>
              )}

              {snapshot && (
                <div className="grid grid-cols-2 gap-3">
                  {snapshot.savingsRate !== null && (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Savings rate</p>
                      <p className="font-display text-xl font-extrabold mt-0.5">{snapshot.savingsRate}%</p>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full bar-fill ${snapshot.savingsRate >= 15 ? 'bg-brand-500' : snapshot.savingsRate >= 0 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(100, (snapshot.savingsRate / 20) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Net worth</p>
                    <p className="font-display text-xl font-extrabold mt-0.5">{fmtMoney(snapshot.netWorth)}</p>
                    {snapshot.netWorth > 0 && (
                      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bar-fill bg-gradient-to-r from-grape-500 to-brand-400" style={{ width: '100%' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6">
              <button type="button" onClick={onDismiss} className="btn-primary w-full">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
