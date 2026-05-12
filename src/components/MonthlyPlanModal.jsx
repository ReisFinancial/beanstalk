import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

function fmtMoney(n) {
  const x = Number(n) || 0
  return x.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const ASSET_META = {
  savings:     { icon: '🏦', label: 'Savings',           hint: 'Chequing, high-yield, emergency fund' },
  retirement:  { icon: '🧓', label: 'RRSP / 401(k)',     hint: 'Retirement savings — grows tax-sheltered' },
  investments: { icon: '📈', label: 'Investments',        hint: 'Stocks, ETFs, mutual funds' },
  realEstate:  { icon: '🏠', label: 'Real estate',        hint: 'Mortgage principal paydown or property savings' },
  crypto:      { icon: '₿',  label: 'Crypto',             hint: 'Bitcoin, Ethereum, or other crypto' },
}

const LIABILITY_META = {
  creditCard:   { icon: '💳', label: 'Credit card',      hint: 'Pay more than the minimum to save on interest' },
  lineOfCredit: { icon: '🔁', label: 'Line of credit',   hint: 'HELOC or unsecured LOC' },
  overdueBills: { icon: '⚠️', label: 'Overdue bills',    hint: 'Late payments or collections' },
  carLoan:      { icon: '🚗', label: 'Car loan',          hint: 'Monthly auto financing payment' },
  mortgage:     { icon: '🏘️', label: 'Mortgage',          hint: 'Monthly mortgage payment' },
}

function ContributionRow({ icon, label, hint, balance, value, onChange, accent, index }) {
  const parsed = Number(value) || 0
  return (
    <div
      className="rounded-2xl border border-slate-100 bg-white p-4 animate-fade-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-ink-900 leading-tight">{label}</p>
            <p className="text-xs text-ink-400 mt-0.5 leading-snug">{hint}</p>
          </div>
        </div>
        {balance > 0 && (
          <span className="shrink-0 text-xs text-ink-400 font-medium mt-0.5">
            {fmtMoney(balance)}
          </span>
        )}
      </div>

      <div className={`mt-3 relative flex items-center rounded-2xl border-2 bg-slate-50 transition-colors focus-within:bg-white ${accent}`}>
        <span className="pl-4 text-ink-300 font-medium">$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          className="flex-1 bg-transparent px-2 py-3 text-lg font-bold text-ink-900
                     focus:outline-none placeholder:text-ink-200 placeholder:font-normal"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="pr-4 text-ink-400 text-sm font-medium">/mo</span>
      </div>

      {parsed > 0 && (
        <p className="mt-1.5 text-xs text-ink-400">
          {fmtMoney(parsed * 12)} per year
        </p>
      )}
    </div>
  )
}

function SectionHeader({ emoji, title, subtitle, color }) {
  return (
    <div className={`flex items-center gap-3 px-1 mb-3`}>
      <span className={`h-8 w-8 rounded-xl grid place-items-center text-lg ${color}`}>{emoji}</span>
      <div>
        <p className="font-display font-bold text-sm">{title}</p>
        {subtitle && <p className="text-xs text-ink-400">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function MonthlyPlanModal({
  profile,
  updateAsset,
  updateLiability,
  updateSection,
  onClose,
}) {
  const assets      = profile.assets      || []
  const liabilities = profile.liabilities || []
  const income      = Number(profile.finances?.monthlyIncome) || 0

  // Local edits — keyed by item id, values as strings
  const [assetPmts, setAssetPmts] = useState(
    () => Object.fromEntries(assets.map((a) => [a.id, String(a.monthlyPayment || '')]))
  )
  const [liabPmts, setLiabPmts] = useState(
    () => Object.fromEntries(liabilities.map((l) => [l.id, String(l.monthlyPayment || '')]))
  )
  const [necessities, setNecessities] = useState(profile.finances?.bareNecessities || '')

  const firstInput = useRef(null)
  useEffect(() => {
    firstInput.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const totalAssetPmts   = assets.reduce((s, a)   => s + (Number(assetPmts[a.id]) || 0), 0)
  const totalLiabPmts    = liabilities.reduce((s, l) => s + (Number(liabPmts[l.id]) || 0), 0)
  const totalNecessities = Number(necessities) || 0
  const totalAllocated   = totalAssetPmts + totalLiabPmts + totalNecessities
  const discretionary    = Math.max(0, income - totalAllocated)
  const overSpent        = income > 0 && totalAllocated > income

  const handleSave = () => {
    assets.forEach((a) => {
      const pmt = Number(assetPmts[a.id]) || 0
      if (pmt !== (a.monthlyPayment || 0)) updateAsset(a.id, { monthlyPayment: pmt })
    })
    liabilities.forEach((l) => {
      const pmt = Number(liabPmts[l.id]) || 0
      if (pmt !== (l.monthlyPayment || 0)) updateLiability(l.id, { monthlyPayment: pmt })
    })
    updateSection('finances', { bareNecessities: necessities })
    onClose()
  }

  const isEmpty = assets.length === 0 && liabilities.length === 0

  let rowIndex = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-ink-900/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-lg bg-slate-50 rounded-t-3xl sm:rounded-3xl shadow-soft
                      flex flex-col max-h-[92dvh] sm:max-h-[85vh] flip-enter">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 bg-white rounded-t-3xl sm:rounded-t-3xl border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-xl font-extrabold">Monthly plan</h2>
              <p className="text-sm text-ink-500 mt-0.5">
                How much flows to each account every month?
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 grid place-items-center rounded-full bg-slate-100 hover:bg-slate-200 shrink-0"
              aria-label="Close"
            >✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {isEmpty ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">🌱</p>
              <p className="font-display font-bold text-lg">Nothing to track yet</p>
              <p className="text-sm text-ink-500 mt-1 mb-4">
                Add your savings accounts, investments, and debts on the Snapshot first — then come back here to set how much you put toward each one every month.
              </p>
              <Link to="/dashboard?view=snapshot" onClick={onClose} className="btn-primary inline-flex">
                Go to Snapshot
              </Link>
            </div>
          ) : (
            <>
              {/* Building wealth — assets */}
              {assets.length > 0 && (
                <section>
                  <SectionHeader
                    emoji="🌱"
                    title="Building wealth"
                    subtitle="How much you add to each account each month"
                    color="bg-brand-50 text-brand-600"
                  />
                  <div className="space-y-3">
                    {assets.map((a) => {
                      const meta = ASSET_META[a.subtype] || { icon: '💰', label: a.label, hint: '' }
                      const ri = rowIndex++
                      return (
                        <ContributionRow
                          key={a.id}
                          icon={meta.icon}
                          label={a.label}
                          hint={meta.hint}
                          balance={a.amount}
                          value={assetPmts[a.id] ?? ''}
                          onChange={(v) => setAssetPmts((p) => ({ ...p, [a.id]: v }))}
                          accent="focus-within:border-brand-400"
                          index={ri}
                        />
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Paying down debt — liabilities */}
              {liabilities.length > 0 && (
                <section>
                  <SectionHeader
                    emoji="🧯"
                    title="Paying down debt"
                    subtitle="How much you put toward each debt each month"
                    color="bg-red-50 text-red-600"
                  />
                  <div className="space-y-3">
                    {liabilities.map((l) => {
                      const meta = LIABILITY_META[l.subtype] || { icon: '🔴', label: l.label, hint: '' }
                      const ri = rowIndex++
                      return (
                        <ContributionRow
                          key={l.id}
                          icon={meta.icon}
                          label={l.label}
                          hint={meta.hint}
                          balance={l.amount}
                          value={liabPmts[l.id] ?? ''}
                          onChange={(v) => setLiabPmts((p) => ({ ...p, [l.id]: v }))}
                          accent="focus-within:border-red-400"
                          index={ri}
                        />
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Fixed costs */}
              <section>
                <SectionHeader
                  emoji="🧱"
                  title="Fixed monthly costs"
                  subtitle="Rent, utilities, groceries — things you can't skip"
                  color="bg-amber-50 text-amber-600"
                />
                <div
                  className="rounded-2xl border border-slate-100 bg-white p-4 animate-fade-slide-up"
                  style={{ animationDelay: `${rowIndex * 50}ms` }}
                >
                  <div className={`relative flex items-center rounded-2xl border-2 bg-slate-50 transition-colors focus-within:bg-white focus-within:border-amber-400`}>
                    <span className="pl-4 text-ink-300 font-medium">$</span>
                    <input
                      ref={firstInput}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      className="flex-1 bg-transparent px-2 py-3 text-lg font-bold text-ink-900
                                 focus:outline-none placeholder:text-ink-200 placeholder:font-normal"
                      placeholder="0"
                      value={necessities}
                      onChange={(e) => setNecessities(e.target.value)}
                    />
                    <span className="pr-4 text-ink-400 text-sm font-medium">/mo</span>
                  </div>
                  {Number(necessities) > 0 && (
                    <p className="mt-1.5 text-xs text-ink-400">{fmtMoney(Number(necessities) * 12)} per year</p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer — live summary + save */}
        {!isEmpty && (
          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 rounded-b-3xl sm:rounded-b-3xl space-y-3">
            {/* Allocation bar */}
            {income > 0 && (
              <div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  <div className="bg-brand-500 bar-fill h-full" style={{ width: `${Math.min(100, (totalAssetPmts / income) * 100)}%` }} />
                  <div className="bg-red-400 bar-fill h-full"   style={{ width: `${Math.min(100, (totalLiabPmts / income) * 100)}%` }} />
                  <div className="bg-amber-400 bar-fill h-full" style={{ width: `${Math.min(100, (totalNecessities / income) * 100)}%` }} />
                </div>
                <div className="mt-1 flex gap-3 text-[11px] text-ink-400 flex-wrap">
                  <span><span className="inline-block h-2 w-2 rounded-full bg-brand-500 mr-1" />Wealth {fmtMoney(totalAssetPmts)}</span>
                  <span><span className="inline-block h-2 w-2 rounded-full bg-red-400 mr-1" />Debt {fmtMoney(totalLiabPmts)}</span>
                  <span><span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1" />Fixed {fmtMoney(totalNecessities)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                {income > 0 ? (
                  <p className={`text-sm font-semibold ${overSpent ? 'text-red-600' : 'text-ink-700'}`}>
                    {overSpent
                      ? `Over by ${fmtMoney(totalAllocated - income)} — trim somewhere`
                      : `${fmtMoney(discretionary)}/mo unallocated`}
                  </p>
                ) : (
                  <p className="text-xs text-ink-400">Add income in the check-in to see your breakdown.</p>
                )}
              </div>
              <button type="button" onClick={handleSave} className="btn-primary">
                Save plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
