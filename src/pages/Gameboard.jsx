import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlanner } from '../context/PlannerContext.jsx'
import WealthMark, { wealthLevel, WEALTH_LEVELS } from '../components/WealthMark.jsx'
import { ageFromPersonal } from '../utils/age.js'

/* ----------------------------------------------------------------------
   Net Worth Arena — a sandbox strategy board.

   Every asset, liability, and goal becomes a tile. Drag an asset onto a
   liability or goal: if the asset is worth at least as much as the target
   at the current point on the timeline, the asset "captures" it. The
   asset is then reduced by the captured amount.

   Scrub the timeline forward to let assets appreciate (and liabilities
   accrue interest) until an asset is large enough to take a target.

   This board is a pure what-if sandbox — it never writes back to the
   planner profile. Resetting restores the original positions.
   ---------------------------------------------------------------------- */

const MAX_MONTHS = 360 // 30-year horizon

const ASSET_ICON = {
  savings: '🏦', retirement: '🏖️', investments: '📈',
  realEstate: '🏠', crypto: '🪙', vehicle: '🚗',
  stockOptions: '📊', pension: '💼', collectibles: '💎',
}
const LIABILITY_ICON = {
  creditCard: '💳', lineOfCredit: '🧾', overdueBills: '⏰',
  carLoan: '🚗', mortgage: '🏚️',
}
const GOAL_ICON = {
  debt: '🔻', investment: '📈', spending: '💸', other: '🎯',
  // legacy theme categories
  money: '💰', career: '🧑‍💻', health: '💪',
  learning: '📚', relationships: '❤️', lifestyle: '🌿',
}

// ── Rate lookup — mirrors the Snapshot's per-hex rate resolution ───────
function inferSubtype(type, label) {
  const s = (label || '').toLowerCase()
  if (type === 'asset') {
    if (/saving|chequing|checking|\bcash\b/.test(s)) return 'savings'
    if (/pension/.test(s))                            return 'pension'
    if (/retire|rrsp|401/.test(s))                    return 'retirement'
    if (/real estate|property|home equity|house/.test(s)) return 'realEstate'
    if (/crypto|bitcoin|eth|btc/.test(s))            return 'crypto'
    if (/\bcar\b|\bauto\b|vehicle|truck|motorcycle/.test(s)) return 'vehicle'
    if (/stock option|\brsu\b|\beso\b/.test(s))      return 'stockOptions'
    if (/collectible|pokemon|sneaker|\bcard\b|\bart\b|watch|wine|vintage|antique|\bnft\b/.test(s)) return 'collectibles'
    return 'investments'
  }
  if (/credit card|visa|master|amex/.test(s))        return 'creditCard'
  if (/line of credit|heloc|\bloc\b/.test(s))        return 'lineOfCredit'
  if (/overdue|late/.test(s))                        return 'overdueBills'
  if (/car|auto|vehicle/.test(s))                    return 'carLoan'
  if (/mortgage/.test(s))                            return 'mortgage'
  return 'creditCard'
}
function annualRatePct(type, item, rates) {
  // Per-asset override wins (e.g., stockOptions ROI set in AddItemModal).
  if (type === 'asset' && item?.customRate !== undefined && item.customRate !== null && item.customRate !== '') {
    const r = Number(item.customRate)
    if (Number.isFinite(r)) return r
  }
  const scope = type === 'asset' ? 'asset' : 'liability'
  const key   = item.subtype || inferSubtype(type, item.label)
  // Pension assets compound at the retirement rate from the Money page.
  if (type === 'asset' && key === 'pension') {
    return Number(rates?.asset?.retirement) || 0
  }
  return Number(rates?.[scope]?.[key]) || 0
}

// Compound a value forward `months` months. `pmt` is an end-of-month
// annuity (a contribution for assets, a paydown for liabilities).
// Vehicles depreciate 40%/yr and floor at 10% of the originally entered
// value; the standard appreciation math doesn't apply to them.
function compound(value, annualPct, months, pmt, isLiability, subtype, originalValue) {
  const v = Number(value) || 0
  if (months <= 0) return v
  if (!isLiability && subtype === 'vehicle') {
    const orig = Number(originalValue) || v
    const floor = orig * 0.1
    if (v <= floor) return v // already at/below the floor — stop decaying
    const years = months / 12
    const depreciated = v * Math.pow(0.6, years)
    return Math.max(depreciated, floor)
  }
  const r = (Number(annualPct) || 0) / 100 / 12
  const p = Number(pmt) || 0
  const fvPrincipal = v * Math.pow(1 + r, months)
  const fvPmt = r === 0 ? p * months : p * (Math.pow(1 + r, months) - 1) / r
  return isLiability ? Math.max(0, fvPrincipal - fvPmt) : fvPrincipal + fvPmt
}

function fmtMoney(n) {
  return (Number(n) || 0).toLocaleString(undefined, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  })
}

function fmtTimeline(months) {
  if (months <= 0) return 'Today'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m} mo`
  if (m === 0) return `${y} yr`
  return `${y} yr ${m} mo`
}

// A goal's "value" — what an asset must cover to claim it. Investment and
// "other" goals carry a target amount; spending goals are annualized.
function goalValue(g) {
  const t = Number(g.targetAmount)
  if (Number.isFinite(t) && t > 0) return t
  const s = Number(g.spendingIncrease)
  if (Number.isFinite(s) && s > 0) return s * 12
  return 0
}

// Project a tile's worth at a given timeline month.
function assetValueAt(tile, month) {
  return compound(
    tile.baseValue, tile.rate, month - tile.baseMonth, tile.pmt, false,
    tile.subtype, tile.originalValue,
  )
}
function targetValueAt(tile, month) {
  if (tile.kind === 'goal') return tile.baseValue // goals don't appreciate
  return compound(tile.baseValue, tile.rate, month - tile.baseMonth, tile.pmt, true)
}

// Build the starting board from the planner profile.
function buildBoard(profile) {
  const rates = profile?.rates
  const assetTiles = (profile?.assets || []).map((a) => {
    const subtype = a.subtype || inferSubtype('asset', a.label)
    const amount  = Number(a.amount) || 0
    return {
      id: `asset:${a.id}`,
      label: a.label || 'Asset',
      icon: ASSET_ICON[subtype] || '💰',
      subtype,
      baseValue: amount,
      originalValue: amount, // anchor for the vehicle depreciation floor
      baseMonth: 0,
      rate: annualRatePct('asset', a, rates),
      pmt: Number(a.monthlyPayment) || 0,
    }
  })
  const liabilityTiles = (profile?.liabilities || []).map((l) => {
    const subtype = l.subtype || inferSubtype('liability', l.label)
    return {
      id: `liability:${l.id}`,
      kind: 'liability',
      label: l.label || 'Liability',
      icon: LIABILITY_ICON[subtype] || '🔻',
      subtype, // needed so capture rules (carLoan, mortgage) can match
      baseValue: Number(l.amount) || 0,
      baseMonth: 0,
      rate: annualRatePct('liability', l, rates),
      pmt: Number(l.monthlyPayment) || 0,
      captured: false,
    }
  })
  const goalTiles = (profile?.goals || []).map((g) => ({
    id: `goal:${g.id}`,
    kind: 'goal',
    label: g.title || 'Goal',
    icon: GOAL_ICON[g.category] || '🎯',
    category: g.category,       // drives milestone vs purchase behaviour
    liabilityId: g.liabilityId, // debt-category goals borrow their value from this linked liability
    baseValue: goalValue(g),
    baseMonth: 0,
    rate: 0,
    pmt: 0,
    captured: false,
  }))
  return { assetTiles, targetTiles: [...liabilityTiles, ...goalTiles] }
}

export default function Gameboard() {
  const { profile } = usePlanner()

  // The planner profile loads from storage in an effect, so it is null on
  // the very first render. Wait for it before snapshotting the board —
  // otherwise GameboardInner's useState would freeze an empty board.
  if (!profile) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="card text-center py-12">
          <div className="animate-pulse text-ink-500">Setting up the board…</div>
        </div>
      </div>
    )
  }
  return <GameboardInner profile={profile} />
}

function GameboardInner({ profile }) {
  const { updateSection, updateProfile } = usePlanner()
  const [board, setBoard]           = useState(() => buildBoard(profile))
  const [month, setMonth]           = useState(0)
  const [floorMonth, setFloorMonth] = useState(0) // time only moves forward
  const [draggingId, setDraggingId] = useState(null)
  const [hoverId, setHoverId]       = useState(null)
  const [showContributions, setShowContributions] = useState(false)
  const [showIncome, setShowIncome]               = useState(false)
  const [showPortrait, setShowPortrait]           = useState(false)
  const [showLoanModal, setShowLoanModal]         = useState(false)
  const [showIncomeModal, setShowIncomeModal]     = useState(false)

  // Running total of after-tax monthly income added via the "Increase
  // income" powerup. Folds into the Income modal's left-over equation so
  // the user can see how powerups affect their budget.
  const [addedIncome, setAddedIncome] = useState(0)

  // Every meaningful move on the board (capture, contribution change, loan)
  // is logged into profile.actionPlan so the strategy survives navigation
  // and can be ticked off from anywhere in the app.
  const actions = profile.actionPlan || []
  const setActions = (updater) => {
    updateProfile((current) => ({
      actionPlan: typeof updater === 'function'
        ? updater(current.actionPlan || [])
        : updater,
    }))
  }
  const addActions = (...items) =>
    setActions((prev) => [
      ...prev,
      ...items.map((a) => ({ id: crypto.randomUUID(), done: false, ...a })),
    ])
  const toggleAction = (id) =>
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, done: !a.done } : a)))
  const removeAction = (id) =>
    setActions((prev) => prev.filter((a) => a.id !== id))

  const { assetTiles, targetTiles } = board
  const draggingAsset = assetTiles.find((a) => a.id === draggingId) || null

  const remaining   = targetTiles.filter((t) => !t.captured)
  const clearedCount = targetTiles.length - remaining.length
  const won = targetTiles.length > 0 && remaining.length === 0
  const lastCaptureMonth = targetTiles
    .filter((t) => t.captured)
    .reduce((m, t) => Math.max(m, t.capturedMonth || 0), 0)

  // Strongest asset right now — used for idle "how short" hints. Real
  // estate is excluded from the liability figure since it can't clear debt.
  const assetVals = assetTiles.map((a) => ({
    subtype: a.subtype,
    val: assetValueAt(a, month),
  }))
  const strongestAny = assetVals.length
    ? Math.max(...assetVals.map((x) => x.val))
    : 0
  const nonRealEstate = assetVals.filter((x) => x.subtype !== 'realEstate')
  const strongestNonRE = nonRealEstate.length
    ? Math.max(...nonRealEstate.map((x) => x.val))
    : 0
  // For a car loan, also exclude vehicles — a car can't clear its own loan.
  const strongestNonRENonVehicle = nonRealEstate.filter((x) => x.subtype !== 'vehicle')
  const strongestForCarLoan = strongestNonRENonVehicle.length
    ? Math.max(...strongestNonRENonVehicle.map((x) => x.val))
    : 0
  const strongestFor = (target) => {
    if (target.kind !== 'liability') return strongestAny
    if (target.subtype === 'carLoan')  return strongestForCarLoan
    return strongestNonRE
  }
  const anyCapturableNow = remaining.some(
    (t) => targetValueAt(t, month) <= strongestFor(t),
  )

  // Live net worth at the current timeline position.
  const liveAssets = assetTiles.reduce((s, a) => s + assetValueAt(a, month), 0)
  const liveDebt = targetTiles
    .filter((t) => t.kind === 'liability' && !t.captured)
    .reduce((s, t) => s + targetValueAt(t, month), 0)
  const netWorth = liveAssets - liveDebt

  // Project the user's age at the current timeline position so every
  // timeline display can show "(age X)" alongside the duration. Age is
  // a fractional value derived from birth month/year (or the legacy age
  // field) so birthdays land on the right month, not just the right year.
  const ageNow = ageFromPersonal(profile.personal)
  const projectedAge = ageNow != null ? Math.floor(ageNow + month / 12) : null
  const ageSuffix = projectedAge != null ? ` (age ${projectedAge})` : ''

  // ── Shared cashflow + portrait math ─────────────────────────────────
  // Two breakdowns of cash flowing out each month — assets (contributions
  // into savings/investments/etc.) and liabilities (debt paydowns). They
  // sum into monthlyContributions, reused by the Portrait math.
  const assetContributions = assetTiles.reduce(
    (s, a) => s + (Number(a.pmt) || 0), 0,
  )
  const liabilityPayments = targetTiles
    .filter((t) => t.kind === 'liability' && !t.captured)
    .reduce((s, t) => s + (Number(t.pmt) || 0), 0)
  const monthlyContributions = assetContributions + liabilityPayments

  // Liquid pool feeds Protection; interest-bearing pool feeds Passive Income.
  const liquidValue = assetTiles
    .filter((a) => a.subtype === 'savings' || a.subtype === 'investments' || a.subtype === 'crypto')
    .reduce((s, a) => s + assetValueAt(a, month), 0)
  const interestPassive = assetTiles
    .filter((a) =>
      a.subtype === 'savings' || a.subtype === 'investments' ||
      a.subtype === 'crypto'  || a.subtype === 'retirement',
    )
    .reduce((s, a) => s + assetValueAt(a, month) * ((Number(a.rate) || 0) / 100), 0)

  // Foundation = 10 years of income + the full estate value (assets).
  const monthlyIncomeAfterTax = Number(profile.finances?.monthlyIncome) || 0
  const foundationAmount = monthlyIncomeAfterTax * 12 * 10 + liveAssets

  // ── Pension annuity income ──────────────────────────────────────────
  // Once the user's projected age crosses a pension's retirement age,
  // its forecasted annual annuity starts flowing as monthly income.
  // Multiple pensions are summed.
  const activePensions = (profile.assets || []).filter((a) => {
    const sub = a.subtype || inferSubtype('asset', a.label)
    if (sub !== 'pension') return false
    const ra = Number(a.retirementAge)
    if (!Number.isFinite(ra) || ra <= 0) return false
    return projectedAge != null && projectedAge >= ra
  })
  const pensionAnnualIncome  = activePensions.reduce(
    (s, p) => s + (Number(p.annualAnnuity) || 0), 0,
  )
  const pensionMonthlyIncome = pensionAnnualIncome / 12

  // Total passive income = interest earned + pension annuity (post-retirement).
  const passiveIncome = interestPassive + pensionAnnualIncome

  // Countdown = years until the next wealth band, projected linearly off
  // current annual growth (returns + contributions − liability interest).
  const annualLiabilityInterest = targetTiles
    .filter((t) => t.kind === 'liability' && !t.captured)
    .reduce((s, t) => s + targetValueAt(t, month) * ((Number(t.rate) || 0) / 100), 0)
  const annualGrowth = passiveIncome + monthlyContributions * 12 - annualLiabilityInterest

  // ── Auto-capture: liabilities paid down + investment-target milestones ─
  // Two timeline triggers fire here:
  //  1. Any uncaptured liability whose balance has reached zero at this
  //     month is marked paid off (via monthly contributions).
  //  2. Any uncaptured investment-target goal whose target value is
  //     covered by the user's investment pool (investments + retirement +
  //     crypto) at this month is marked reached (a milestone, not a
  //     purchase — assets aren't consumed).
  // The effect is idempotent: once captured, the matching filters return
  // empty on the next pass.
  useEffect(() => {
    const investmentPool = assetTiles
      .filter((a) =>
        a.subtype === 'investments' || a.subtype === 'retirement' || a.subtype === 'crypto',
      )
      .reduce((s, a) => s + assetValueAt(a, month), 0)

    const debtsCleared = targetTiles.filter(
      (t) => t.kind === 'liability' && !t.captured && targetValueAt(t, month) <= 0,
    )
    const goalsReached = targetTiles.filter(
      (t) => t.kind === 'goal' && !t.captured &&
        t.category === 'investment' && investmentPool >= t.baseValue,
    )
    // Debt-clearing goals fire the moment their linked liability is
    // captured (paydown, drag, or anything else).
    const debtGoalsReached = targetTiles.filter((t) => {
      if (t.kind !== 'goal' || t.captured) return false
      if (t.category !== 'debt' || !t.liabilityId) return false
      const linked = targetTiles.find(
        (tl) => tl.kind === 'liability' && tl.id === `liability:${t.liabilityId}`,
      )
      return Boolean(linked && linked.captured)
    })
    if (
      debtsCleared.length === 0 &&
      goalsReached.length === 0 &&
      debtGoalsReached.length === 0
    ) return

    setBoard((prev) => ({
      ...prev,
      targetTiles: prev.targetTiles.map((t) => {
        if (t.captured) return t
        if (t.kind === 'liability' && targetValueAt(t, month) <= 0) {
          return {
            ...t,
            captured: true,
            capturedBy: 'timeline',
            capturedValue: 0,
            capturedMonth: month,
            capturedVia: 'paydown',
          }
        }
        if (t.kind === 'goal' && t.category === 'investment' && investmentPool >= t.baseValue) {
          return {
            ...t,
            captured: true,
            capturedBy: 'timeline',
            capturedValue: t.baseValue,
            capturedMonth: month,
            capturedVia: 'milestone',
          }
        }
        if (t.kind === 'goal' && t.category === 'debt' && t.liabilityId) {
          const linked = targetTiles.find(
            (tl) => tl.kind === 'liability' && tl.id === `liability:${t.liabilityId}`,
          )
          if (linked && linked.captured) {
            return {
              ...t,
              captured: true,
              capturedBy: 'timeline',
              capturedValue: linked.capturedValue || 0,
              capturedMonth: month,
              capturedVia: 'milestone',
            }
          }
        }
        return t
      }),
    }))
    setActions((prev) => [
      ...prev,
      ...debtsCleared.map((t) => ({
        id: crypto.randomUUID(),
        done: false,
        kind: 'capture',
        emoji: t.icon,
        title: `Finish paying off ${t.label}`,
        detail: `Driven to zero by ${fmtTimeline(month)} via monthly contributions.`,
        month,
      })),
      ...goalsReached.map((t) => ({
        id: crypto.randomUUID(),
        done: false,
        kind: 'capture',
        emoji: t.icon,
        title: `Reach "${t.label}" investment target`,
        detail: `Investment pool hit ${fmtMoney(t.baseValue)} by ${fmtTimeline(month)}.`,
        month,
      })),
      ...debtGoalsReached.map((t) => ({
        id: crypto.randomUUID(),
        done: false,
        kind: 'capture',
        emoji: t.icon,
        title: `Reach "${t.label}" debt-clearing goal`,
        detail: `Linked debt cleared by ${fmtTimeline(month)} — goal achieved.`,
        month,
      })),
    ])
  }, [month, targetTiles, assetTiles])

  // Debt-category goals don't carry a stand-alone value — their "size" is
  // the current balance of the liability they're linked to. This helper
  // gives every target tile a single, render-consistent value to compare
  // assets against.
  const effectiveTargetValueAt = (target, m) => {
    if (target.kind === 'goal' && target.category === 'debt' && target.liabilityId) {
      const linked = targetTiles.find(
        (t) => t.kind === 'liability' && t.id === `liability:${target.liabilityId}`,
      )
      if (linked && !linked.captured) return targetValueAt(linked, m)
      return 0
    }
    return targetValueAt(target, m)
  }

  const canCapture = (target) => {
    if (!draggingAsset || target.captured) return false
    // Rule: real estate can't be liquidated to wipe out a debt.
    if (draggingAsset.subtype === 'realEstate' && target.kind === 'liability') {
      return false
    }
    // Rule: a vehicle can't be used to clear out its car loan.
    if (
      draggingAsset.subtype === 'vehicle' &&
      target.kind === 'liability' &&
      target.subtype === 'carLoan'
    ) {
      return false
    }
    return assetValueAt(draggingAsset, month) >= effectiveTargetValueAt(target, month)
  }

  // ── Capture: asset takes the target, then shrinks by its value ──────
  // Real estate is the exception — the house isn't sold to fund a goal,
  // it's borrowed against. The asset keeps its value and a matching amount
  // is piled onto an existing mortgage (or a fresh mortgage tile is born).
  const handleCapture = (targetId) => {
    setBoard((prev) => {
      const asset  = prev.assetTiles.find((a) => a.id === draggingId)
      const target = prev.targetTiles.find((t) => t.id === targetId)
      if (!asset || !target || target.captured) return prev
      // Rule: real estate can't be liquidated to wipe out a debt.
      if (asset.subtype === 'realEstate' && target.kind === 'liability') return prev
      // Rule: a vehicle can't be used to clear out its car loan.
      if (
        asset.subtype === 'vehicle' &&
        target.kind === 'liability' &&
        target.subtype === 'carLoan'
      ) return prev
      const aVal = assetValueAt(asset, month)
      // Debt-category goals borrow their value from the linked liability;
      // every other target uses its own balance.
      const tVal =
        target.kind === 'goal' && target.category === 'debt' && target.liabilityId
          ? (() => {
              const linked = prev.targetTiles.find(
                (t) => t.kind === 'liability' && t.id === `liability:${target.liabilityId}`,
              )
              if (linked && !linked.captured) return targetValueAt(linked, month)
              return 0
            })()
          : targetValueAt(target, month)
      if (aVal < tVal) return prev // not enough — reject

      const markCaptured = (t, extra) =>
        t.id === target.id
          ? {
              ...t,
              captured: true,
              capturedBy: asset.id,
              capturedValue: tVal,
              capturedMonth: month,
              ...extra,
            }
          : t

      // Investment- and debt-category goals are milestones, not purchases.
      // Reaching the value is the achievement — no asset is spent, no
      // mortgage is taken, and retirement triggers no tax bill. The
      // linked debt (if any) isn't auto-paid here; that's a separate drag.
      if (
        target.kind === 'goal' &&
        (target.category === 'investment' || target.category === 'debt')
      ) {
        return {
          assetTiles: prev.assetTiles,
          targetTiles: prev.targetTiles.map((t) => markCaptured(t, { capturedVia: 'milestone' })),
        }
      }

      // Real estate funds a goal via mortgage debt.
      if (asset.subtype === 'realEstate' && target.kind === 'goal') {
        // Prefer an uncaptured mortgage; fall back to any mortgage for rate.
        const liveMortgage = prev.targetTiles.find(
          (t) => t.kind === 'liability' && !t.captured && t.subtype === 'mortgage',
        )
        const anyMortgage = prev.targetTiles.find(
          (t) => t.kind === 'liability' && t.subtype === 'mortgage',
        )
        const mortgageRate = anyMortgage?.rate || 5
        if (liveMortgage) {
          // Top up the existing mortgage — re-anchor so the new balance
          // compounds from today, not retroactively.
          const mortVal = targetValueAt(liveMortgage, month)
          return {
            assetTiles: prev.assetTiles,
            targetTiles: prev.targetTiles.map((t) => {
              if (t.id === target.id) return markCaptured(t, { capturedVia: 'mortgage' })
              if (t.id === liveMortgage.id) {
                return { ...t, baseValue: mortVal + tVal, baseMonth: month }
              }
              return t
            }),
          }
        }
        // No live mortgage — spin up a new one.
        const newMortgage = {
          id: `mortgage:${crypto.randomUUID()}`,
          kind: 'liability',
          label: 'Mortgage (top-up)',
          icon: LIABILITY_ICON.mortgage,
          subtype: 'mortgage',
          baseValue: tVal,
          baseMonth: month,
          rate: mortgageRate,
          pmt: 0,
          captured: false,
        }
        return {
          assetTiles: prev.assetTiles,
          targetTiles: [
            ...prev.targetTiles.map((t) => markCaptured(t, { capturedVia: 'mortgage' })),
            newMortgage,
          ],
        }
      }

      // Standard capture — asset shrinks by what it took. Cashing out a
      // retirement account for any reason (debt or goal) also triggers a
      // 20% early-withdrawal tax bill. If a tax tile already exists, the
      // new amount stacks onto it so the board doesn't fill with
      // duplicate tax liabilities each time RRSP money is withdrawn.
      const isRetirementWithdrawal = asset.subtype === 'retirement'
      const taxAmount = isRetirementWithdrawal ? Math.round(tVal * 0.2) : 0
      const liveTax = isRetirementWithdrawal
        ? prev.targetTiles.find(
            (t) => t.kind === 'liability' && !t.captured && t.isTax,
          )
        : null

      let nextTargets = prev.targetTiles.map((t) => {
        if (t.id === target.id) return markCaptured(t)
        if (liveTax && t.id === liveTax.id) {
          // Re-anchor the running tax balance to today, then add the new
          // 20% slice. The tile keeps accruing interest from here forward.
          const currentTaxVal = targetValueAt(t, month)
          return { ...t, baseValue: currentTaxVal + taxAmount, baseMonth: month }
        }
        return t
      })

      if (isRetirementWithdrawal && !liveTax) {
        // No tax tile yet — spin one up with a generic label so it can
        // accumulate withdrawals from any RRSP/retirement account.
        nextTargets = [
          ...nextTargets,
          {
            id: `tax:${crypto.randomUUID()}`,
            kind: 'liability',
            label: 'Early-withdrawal tax',
            icon: '🏛️',
            subtype: 'overdueBills',
            isTax: true,
            baseValue: taxAmount,
            baseMonth: month,
            rate: 8, // tax debt accrues interest until paid
            pmt: 0,
            captured: false,
          },
        ]
      }

      return {
        assetTiles: prev.assetTiles.map((a) =>
          a.id === asset.id
            ? { ...a, baseValue: aVal - tVal, baseMonth: month }
            : a,
        ),
        targetTiles: nextTargets,
      }
    })

    // ── Log the move as a real-world action plan step ────────────────
    // Re-derive context from current state so the action copy reads right.
    const asset  = assetTiles.find((a) => a.id === draggingId)
    const target = targetTiles.find((t) => t.id === targetId)
    if (asset && target && !target.captured) {
      const tVal = targetValueAt(target, month)
      if (target.kind === 'goal' && target.category === 'investment') {
        addActions({
          kind: 'capture',
          emoji: target.icon,
          title: `Reach "${target.label}" investment target`,
          detail: `Milestone hit — ${asset.label} put you at ${fmtMoney(tVal)} by ${fmtTimeline(month)}.`,
          month,
        })
      } else if (target.kind === 'goal' && target.category === 'debt') {
        addActions({
          kind: 'capture',
          emoji: target.icon,
          title: `Reach "${target.label}" debt-clearing goal`,
          detail: `Milestone — ${asset.label} is large enough (${fmtMoney(tVal)}) to cover the linked debt at ${fmtTimeline(month)}.`,
          month,
        })
      } else if (asset.subtype === 'realEstate' && target.kind === 'goal') {
        const liveMortgage = targetTiles.find(
          (t) => t.kind === 'liability' && !t.captured && t.subtype === 'mortgage',
        )
        const anyMortgage = targetTiles.find(
          (t) => t.kind === 'liability' && t.subtype === 'mortgage',
        )
        const mortgageRate = anyMortgage?.rate || 5
        addActions(
          {
            kind: 'capture',
            emoji: target.icon,
            title: `Fund "${target.label}" using ${asset.label}`,
            detail: `${fmtMoney(tVal)} borrowed against the property at ${fmtTimeline(month)}.`,
            month,
          },
          liveMortgage
            ? {
                kind: 'mortgage',
                emoji: LIABILITY_ICON.mortgage,
                title: `Top up ${liveMortgage.label} by ${fmtMoney(tVal)}`,
                detail: `Refinance or open a HELOC — aim for around ${mortgageRate}% APR.`,
                month,
              }
            : {
                kind: 'mortgage',
                emoji: LIABILITY_ICON.mortgage,
                title: `Open a new mortgage for ${fmtMoney(tVal)}`,
                detail: `Target an APR near ${mortgageRate}% and budget the payment in.`,
                month,
              },
        )
      } else {
        addActions({
          kind: 'capture',
          emoji: target.icon,
          title: target.kind === 'goal'
            ? `Spend ${fmtMoney(tVal)} from ${asset.label} on "${target.label}"`
            : `Use ${asset.label} to pay off "${target.label}"`,
          detail: `At ${fmtTimeline(month)} on the timeline.`,
          month,
        })
        if (asset.subtype === 'retirement') {
          const taxAmount = Math.round(tVal * 0.2)
          // Was there already a tax tile before this capture fired?
          const hadExistingTax = targetTiles.some(
            (t) => t.kind === 'liability' && !t.captured && t.isTax,
          )
          addActions({
            kind: 'tax',
            emoji: '🏛️',
            title: hadExistingTax
              ? `Add ${fmtMoney(taxAmount)} to your early-withdrawal tax`
              : `Set aside ${fmtMoney(taxAmount)} for the early-withdrawal tax`,
            detail: `20% of the ${fmtMoney(tVal)} pulled from ${asset.label} — owed at tax time.`,
            month,
          })
        }
      }
    }

    setFloorMonth(month) // committing an action locks the timeline forward
    setDraggingId(null)
    setHoverId(null)
  }

  const handleReset = () => {
    setBoard(buildBoard(profile))
    setMonth(0)
    setFloorMonth(0)
    setDraggingId(null)
    setHoverId(null)
    setActions([])
    setAddedIncome(0)
  }

  // Apply edited monthly contributions. Each touched tile is re-anchored
  // to the current month (value-preserving) so the new contribution
  // applies going forward rather than retroactively. Because re-anchoring
  // freezes a tile's history, changing anything also locks the timeline
  // forward — same forward-only rule as committing a capture.
  const handleSaveContributions = (newPmts) => {
    const changes = []
    assetTiles.forEach((a) => {
      const next = newPmts[a.id]
      if (next != null && next !== a.pmt) {
        changes.push({ kind: 'asset', tile: a, oldPmt: a.pmt, newPmt: next })
      }
    })
    targetTiles.forEach((t) => {
      if (t.kind !== 'liability' || t.captured) return
      const next = newPmts[t.id]
      if (next != null && next !== t.pmt) {
        changes.push({ kind: 'liability', tile: t, oldPmt: t.pmt, newPmt: next })
      }
    })
    setBoard((prev) => ({
      assetTiles: prev.assetTiles.map((a) => {
        const next = newPmts[a.id]
        if (next == null || next === a.pmt) return a
        return { ...a, baseValue: assetValueAt(a, month), baseMonth: month, pmt: next }
      }),
      targetTiles: prev.targetTiles.map((t) => {
        if (t.kind !== 'liability' || t.captured) return t
        const next = newPmts[t.id]
        if (next == null || next === t.pmt) return t
        return { ...t, baseValue: targetValueAt(t, month), baseMonth: month, pmt: next }
      }),
    }))
    if (changes.length) {
      setFloorMonth(month)
      addActions(
        ...changes.map((c) => ({
          kind: 'contribution',
          emoji: c.tile.icon,
          title: c.kind === 'asset'
            ? c.newPmt > 0
              ? `Set ${c.tile.label} contribution to ${fmtMoney(c.newPmt)}/mo`
              : `Pause monthly contributions to ${c.tile.label}`
            : c.newPmt > 0
              ? `Send ${fmtMoney(c.newPmt)}/mo toward ${c.tile.label}`
              : `Pause paydown on ${c.tile.label}`,
          detail: c.oldPmt
            ? `Was ${fmtMoney(c.oldPmt)}/mo · starts at ${fmtTimeline(month)}.`
            : `New cashflow starting at ${fmtTimeline(month)}.`,
          month,
        })),
      )
    }
  }

  // ── Powerup: take out a loan ────────────────────────────────────────
  // A loan always adds a debt tile that accrues interest. The borrowed cash
  // either lands in a brand-new "loan cash" asset tile, or gets deposited
  // into an existing asset's balance — the user's choice. Either way, net
  // worth is unchanged the moment the loan is created.
  const handleAddLoan = ({ amount, rate, label, depositTo }) => {
    const amt = Math.round(Number(amount)) || 0
    if (amt <= 0) return
    const groupId = crypto.randomUUID()
    const name = (label && label.trim()) || 'Loan'
    const loanDebt = {
      id: `loanL:${groupId}`,
      kind: 'liability',
      label: `${name} · debt`,
      icon: '🧾',
      subtype: 'lineOfCredit',
      isLoan: true,
      baseValue: amt,
      baseMonth: month,
      rate: Number(rate) || 0,
      pmt: 0,
      captured: false,
    }
    setBoard((prev) => {
      // Deposit into an existing asset — re-anchor to today so the new
      // balance compounds from here, not retroactively.
      const target = depositTo && depositTo !== 'new'
        ? prev.assetTiles.find((a) => a.id === depositTo)
        : null
      const nextAssets = target
        ? prev.assetTiles.map((a) =>
            a.id === target.id
              ? { ...a, baseValue: assetValueAt(a, month) + amt, baseMonth: month }
              : a,
          )
        : [
            ...prev.assetTiles,
            {
              id: `loanA:${groupId}`,
              label: `${name} · cash`,
              icon: '💵',
              subtype: 'savings', // borrowed cash — never real estate, so it can clear debt
              isLoan: true,
              baseValue: amt,
              baseMonth: month,
              rate: 0,            // idle cash sits flat until you deploy it
              pmt: 0,
            },
          ]
      return {
        assetTiles: nextAssets,
        targetTiles: [...prev.targetTiles, loanDebt],
      }
    })

    // Log the loan as an action-plan step.
    const depositAsset = depositTo && depositTo !== 'new'
      ? assetTiles.find((a) => a.id === depositTo)
      : null
    const named = (label && label.trim()) || 'Loan'
    addActions({
      kind: 'loan',
      emoji: '💵',
      title: `Apply for a ${fmtMoney(amt)} loan${named !== 'Loan' ? ` (${named})` : ''}`,
      detail: `${Number(rate) || 0}% APR · ${
        depositAsset
          ? `funds deposited to ${depositAsset.label}`
          : 'park the cash to deploy later'
      }.`,
      month,
    })

    setFloorMonth(month)
  }

  // ── Powerup: increase employment income ─────────────────────────────
  // The user adds extra after-tax monthly income, then allocates that
  // fresh cashflow across existing assets and uncaptured liabilities.
  // The modal enforces total allocations ≤ added income, so the user
  // can't deploy more than they've earned.
  const handleAddIncome = ({ addedIncome, allocations }) => {
    const incomeAmt = Math.round(Number(addedIncome)) || 0
    const allocs = allocations || {}
    if (incomeAmt <= 0) return

    const changes = []
    assetTiles.forEach((a) => {
      const extra = Number(allocs[a.id]) || 0
      if (extra > 0) {
        changes.push({ kind: 'asset', tile: a, oldPmt: a.pmt, newPmt: a.pmt + extra, extra })
      }
    })
    targetTiles.forEach((t) => {
      if (t.kind !== 'liability' || t.captured) return
      const extra = Number(allocs[t.id]) || 0
      if (extra > 0) {
        changes.push({ kind: 'liability', tile: t, oldPmt: t.pmt, newPmt: t.pmt + extra, extra })
      }
    })

    setBoard((prev) => ({
      assetTiles: prev.assetTiles.map((a) => {
        const extra = Number(allocs[a.id]) || 0
        if (extra <= 0) return a
        return {
          ...a,
          baseValue: assetValueAt(a, month),
          baseMonth: month,
          pmt: a.pmt + extra,
        }
      }),
      targetTiles: prev.targetTiles.map((t) => {
        if (t.kind !== 'liability' || t.captured) return t
        const extra = Number(allocs[t.id]) || 0
        if (extra <= 0) return t
        return {
          ...t,
          baseValue: targetValueAt(t, month),
          baseMonth: month,
          pmt: t.pmt + extra,
        }
      }),
    }))

    setAddedIncome((prev) => prev + incomeAmt)
    addActions(
      {
        kind: 'income',
        emoji: '💼',
        title: `Earn ${fmtMoney(incomeAmt)}/mo more after-tax`,
        detail: `Negotiate a raise, take on side income, or change roles to free up this cashflow.`,
        month,
      },
      ...changes.map((c) => ({
        kind: 'contribution',
        emoji: c.tile.icon,
        title: c.kind === 'asset'
          ? `Add ${fmtMoney(c.extra)}/mo to ${c.tile.label}`
          : `Add ${fmtMoney(c.extra)}/mo paydown on ${c.tile.label}`,
        detail: `New total: ${fmtMoney(c.newPmt)}/mo · starting at ${fmtTimeline(month)}.`,
        month,
      })),
    )
    setFloorMonth(month)
  }

  const jump = (deltaMonths) => {
    setMonth((m) => Math.min(MAX_MONTHS, Math.max(floorMonth, m + deltaMonths)))
  }

  // ── Empty state ─────────────────────────────────────────────────────
  if (assetTiles.length === 0 || targetTiles.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="card text-center py-12">
          <div className="text-5xl">🎲</div>
          <h3 className="mt-3 font-display text-lg font-bold">Your arena is empty</h3>
          <p className="mt-1 text-sm text-ink-500 max-w-md mx-auto">
            The board needs at least one asset and one liability or goal to play.
            Add them on your Snapshot and Goals pages, then come back.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link to="/dashboard?view=snapshot" className="btn-secondary !py-2 !px-4 text-sm">
              Go to Snapshot
            </Link>
            <Link to="/dashboard?view=goals" className="btn-secondary !py-2 !px-4 text-sm">
              Go to Goals
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const pct = targetTiles.length
    ? Math.round((clearedCount / targetTiles.length) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <Header />
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <button
            onClick={() => setShowContributions(true)}
            className="btn-secondary !py-2 !px-3 text-sm"
          >
            ✎ Contributions
          </button>
          <button
            onClick={() => setShowIncome(true)}
            className="btn-secondary !py-2 !px-3 text-sm"
          >
            💰 Income
          </button>
          <button
            onClick={() => setShowPortrait(true)}
            className="btn-secondary !py-2 !px-3 text-sm"
          >
            🪞 Portrait
          </button>
          <button onClick={handleReset} className="btn-ghost !py-2 !px-3 text-sm">
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Victory banner */}
      {won && (
        <div className="card bg-card-gradient border-brand-200 text-center">
          <div className="text-4xl">🏆</div>
          <h3 className="mt-2 font-display text-xl font-extrabold text-brand-700">
            Net worth conquered!
          </h3>
          <p className="mt-1 text-sm text-ink-500">
            Every debt and goal cleared by {fmtTimeline(lastCaptureMonth)}. Net worth now: {fmtMoney(netWorth)}.
          </p>
        </div>
      )}

      {/* Progress + live stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card bg-card-gradient sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-grape-700">
              Targets cleared
            </p>
            <p className="text-sm font-bold">{clearedCount} / {targetTiles.length}</p>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-white/70 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Net worth</p>
          <p className={`mt-1 font-display text-2xl font-extrabold ${
            netWorth >= 0 ? 'text-brand-700' : 'text-red-600'
          }`}>
            {fmtMoney(netWorth)}
          </p>
          <p className="mt-1 text-xs text-ink-500">At {fmtTimeline(month)}{ageSuffix}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Debts left</p>
          <p className="mt-1 font-display text-2xl font-extrabold">
            {remaining.filter((t) => t.kind === 'liability').length}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {remaining.filter((t) => t.kind === 'goal').length} goals left
          </p>
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display font-bold text-lg">Timeline</h3>
          <p className="font-display text-2xl font-extrabold text-grape-700">
            {fmtTimeline(month)}{ageSuffix}
          </p>
        </div>
        <input
          type="range"
          min={floorMonth}
          max={MAX_MONTHS}
          step="1"
          value={month}
          onChange={(e) => setMonth(Math.max(floorMonth, Number(e.target.value)))}
          className="mt-3 w-full accent-grape-600"
          aria-label="Timeline in months"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-400">
            {floorMonth > 0
              ? `Time only moves forward — committed to ${fmtTimeline(floorMonth)}.`
              : 'Scroll forward to grow your assets.'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => jump(12)} className="chip border border-slate-200 hover:border-grape-400">
              +1 yr
            </button>
            <button onClick={() => jump(60)} className="chip border border-slate-200 hover:border-grape-400">
              +5 yr
            </button>
            <button
              onClick={() => setMonth(MAX_MONTHS)}
              className="chip border border-slate-200 hover:border-grape-400"
            >
              Max
            </button>
          </div>
        </div>
        {!won && !anyCapturableNow && (
          <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            No asset is large enough yet — scroll the timeline forward, or take
            out a loan from Powerups below.
          </p>
        )}
      </div>

      {/* Powerups */}
      <section className="card">
        <h3 className="font-display font-bold text-lg">Powerups</h3>
        <p className="text-xs text-ink-500 mt-0.5">
          Out of moves? Spend a powerup to shift the board.
        </p>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => setShowLoanModal(true)}
            className="flex items-start gap-3 w-full rounded-2xl border-2
                       border-amber-300 bg-gradient-to-br from-amber-50 to-white p-3
                       text-left transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <span className="text-2xl leading-none">💵</span>
            <span>
              <span className="block text-sm font-bold">Take out a loan</span>
              <span className="block text-xs text-ink-500 mt-0.5">
                Adds loan cash to your assets and an equal debt to your
                liabilities — net worth stays flat. Spend the cash on a goal,
                then pay the debt off later.
              </span>
            </span>
          </button>
          <button
            onClick={() => setShowIncomeModal(true)}
            className="flex items-start gap-3 w-full rounded-2xl border-2
                       border-brand-300 bg-gradient-to-br from-brand-50 to-white p-3
                       text-left transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <span className="text-2xl leading-none">💼</span>
            <span>
              <span className="block text-sm font-bold">Increase income</span>
              <span className="block text-xs text-ink-500 mt-0.5">
                Raise, side hustle, or new role — assign extra after-tax monthly
                income to any contribution or paydown.
              </span>
            </span>
          </button>
        </div>
      </section>

      {/* Asset tiles + Targets — side-by-side on tablet+ so drags are short */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Asset tiles — the draggable pieces */}
        <section className="card flex flex-col">
          <h3 className="font-display font-bold text-lg">Your assets</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Drag an asset onto a debt or goal to capture it. The asset shrinks
            by what it takes. Real estate funds goals by borrowing against the
            property — the house keeps its value and the mortgage grows.
            Tapping retirement for anything also drops a 20% tax bill on the
            board.
          </p>
          <div
            className="mt-4 flex-1 flex flex-wrap content-start gap-3 rounded-2xl p-3
                       bg-[radial-gradient(circle,_rgba(13,27,42,0.05)_1px,_transparent_1px)]
                       [background-size:16px_16px]"
          >
            {assetTiles.map((tile) => (
              <AssetTile
                key={tile.id}
                tile={tile}
                value={assetValueAt(tile, month)}
                dragging={draggingId === tile.id}
                onDragStart={() => setDraggingId(tile.id)}
                onDragEnd={() => { setDraggingId(null); setHoverId(null) }}
              />
            ))}
          </div>
        </section>

        {/* Target tiles — debts & goals to clear */}
        <section className="card flex flex-col">
          <h3 className="font-display font-bold text-lg">Debts &amp; goals</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Drop an asset here. Green tiles are within reach; dim tiles need a
            bigger asset.
          </p>
          <div
            className="mt-4 flex-1 flex flex-wrap content-start gap-3 rounded-2xl p-3
                       bg-[radial-gradient(circle,_rgba(13,27,42,0.05)_1px,_transparent_1px)]
                       [background-size:16px_16px]"
          >
            {targetTiles.map((tile) => {
              const droppable = canCapture(tile)
              let state = 'idle'
              if (tile.captured) state = 'captured'
              else if (draggingAsset && hoverId === tile.id && droppable) state = 'hover'
              else if (draggingAsset && droppable) state = 'droppable'
              else if (draggingAsset) state = 'blocked'
              return (
                <TargetTile
                  key={tile.id}
                  tile={tile}
                  value={effectiveTargetValueAt(tile, month)}
                  state={state}
                  gap={effectiveTargetValueAt(tile, month) - strongestFor(tile)}
                  droppable={droppable}
                  onDragEnter={() => droppable && setHoverId(tile.id)}
                  onDragLeave={() => setHoverId((h) => (h === tile.id ? null : h))}
                  onDragOver={(e) => { if (droppable) e.preventDefault() }}
                  onDrop={(e) => { e.preventDefault(); handleCapture(tile.id) }}
                />
              )
            })}
          </div>
        </section>
      </div>

      {/* Action plan — every move becomes a real-life step */}
      <section className="card">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-lg">Your action plan</h3>
            <p className="text-xs text-ink-500 mt-0.5">
              Every move on the board becomes a step. Check them off as you take
              them in real life.
            </p>
          </div>
          {actions.length > 0 && (
            <p className="text-xs font-semibold text-ink-500 shrink-0">
              {actions.filter((a) => a.done).length} / {actions.length} done
            </p>
          )}
        </div>
        {actions.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
            <p className="text-sm text-ink-400">
              No moves yet. Capture a target, edit contributions, or use a
              powerup — your strategy will appear here.
            </p>
          </div>
        ) : (
          <ol className="mt-4 space-y-2">
            {actions.map((a, i) => (
              <ActionStep
                key={a.id}
                step={a}
                index={i + 1}
                onToggle={() => toggleAction(a.id)}
                onRemove={() => removeAction(a.id)}
              />
            ))}
          </ol>
        )}
      </section>

      {showContributions && (
        <ContributionsModal
          assetTiles={assetTiles}
          targetTiles={targetTiles}
          onClose={() => setShowContributions(false)}
          onSave={handleSaveContributions}
        />
      )}

      {showIncome && (
        <IncomeDisclosureModal
          currentTotal={profile.finances?.monthlyIncome}
          currentSources={profile.finances?.incomeSources}
          bareNecessities={profile.finances?.bareNecessities}
          addedIncome={addedIncome}
          pensionMonthlyIncome={pensionMonthlyIncome}
          assetContributions={assetContributions}
          liabilityPayments={liabilityPayments}
          country={profile.personal?.country}
          onClose={() => setShowIncome(false)}
          onSave={(payload) => updateSection('finances', payload)}
        />
      )}

      {showPortrait && (
        <PortraitModal
          netWorth={netWorth}
          month={month}
          projectedAge={projectedAge}
          liquidValue={liquidValue}
          passiveIncome={passiveIncome}
          monthlyIncomeAfterTax={monthlyIncomeAfterTax}
          foundationAmount={foundationAmount}
          annualGrowth={annualGrowth}
          onClose={() => setShowPortrait(false)}
        />
      )}

      {showIncomeModal && (
        <IncomeModal
          assetTiles={assetTiles}
          liabilityTiles={targetTiles.filter((t) => t.kind === 'liability' && !t.captured)}
          onClose={() => setShowIncomeModal(false)}
          onSave={handleAddIncome}
        />
      )}

      {showLoanModal && (
        <LoanModal
          assets={assetTiles.map((a) => ({
            id: a.id,
            icon: a.icon,
            label: a.label,
            subtype: a.subtype,
            value: assetValueAt(a, month),
          }))}
          goals={remaining
            .filter((t) => t.kind === 'goal')
            .map((t) => ({ id: t.id, icon: t.icon, label: t.label, value: t.baseValue }))}
          onClose={() => setShowLoanModal(false)}
          onCreate={handleAddLoan}
        />
      )}
    </div>
  )
}

function Header() {
  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">
        🎮 Net Worth Arena
      </h2>
      <p className="text-sm text-ink-500 mt-0.5">
        Turn your finances into a board. Capture every debt and goal with your assets.
      </p>
    </div>
  )
}

// ── Asset tile — a draggable piece ────────────────────────────────────
function AssetTile({ tile, value, dragging, onDragStart, onDragEnd }) {
  // Loan cash is tinted amber so it's traceable to its matching debt tile.
  const tone = tile.isLoan
    ? { border: 'border-amber-300', from: 'from-amber-50',
        chip: 'bg-amber-100 text-amber-700', val: 'text-amber-700', label: 'Loan cash' }
    : { border: 'border-brand-300', from: 'from-brand-50',
        chip: 'bg-brand-100 text-brand-700', val: 'text-brand-700', label: 'Asset' }
  return (
    <div
      draggable
      onDragStart={(e) => {
        // setData is required for the drag to initiate in Firefox.
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', tile.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={`relative w-40 h-40 shrink-0 rounded-2xl border-2 p-3 flex flex-col
                  cursor-grab active:cursor-grabbing select-none transition
                  ${tone.border} bg-gradient-to-br ${tone.from} to-white
                  ${dragging ? 'opacity-40 scale-95' : 'hover:-translate-y-1 hover:shadow-soft'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl leading-none">{tile.icon}</span>
        <span className={`chip ${tone.chip}`}>{tone.label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-tight line-clamp-2">{tile.label}</p>
      <div className="mt-auto">
        <p className={`font-display text-xl font-extrabold ${tone.val}`}>{fmtMoney(value)}</p>
        <p className="text-[11px] text-ink-400">
          {tile.subtype === 'vehicle'
            ? '-40% / yr (floors at 10%)'
            : tile.rate > 0 ? `${tile.rate}% / yr` : 'flat'}
          {tile.subtype !== 'vehicle' && tile.pmt > 0 ? ` · +${fmtMoney(tile.pmt)}/mo` : ''}
        </p>
        {tile.subtype === 'realEstate' && (
          <p className="text-[10px] font-semibold text-amber-600">🏠 Goals via mortgage</p>
        )}
        {tile.subtype === 'retirement' && (
          <p className="text-[10px] font-semibold text-amber-600">🏖️ +20% withdrawal tax</p>
        )}
        {tile.subtype === 'vehicle' && (
          <p className="text-[10px] font-semibold text-amber-600">🚗 Depreciates · skips car loan</p>
        )}
      </div>
      <span className="absolute bottom-2 right-2.5 text-ink-300 text-xs select-none">⠿</span>
    </div>
  )
}

// ── Target tile — a debt or goal to capture ───────────────────────────
function TargetTile({
  tile, value, state, gap, droppable,
  onDragEnter, onDragLeave, onDragOver, onDrop,
}) {
  const isGoal = tile.kind === 'goal'
  const accent = tile.isLoan
    ? { border: 'border-amber-300', bg: 'from-amber-50',  text: 'text-amber-700', chip: 'bg-amber-100 text-amber-700' }
    : tile.isTax
    ? { border: 'border-amber-500', bg: 'from-amber-100', text: 'text-amber-800', chip: 'bg-amber-200 text-amber-800' }
    : isGoal
    ? { border: 'border-grape-300', bg: 'from-grape-50',  text: 'text-grape-700', chip: 'bg-grape-100 text-grape-700' }
    : { border: 'border-red-300',   bg: 'from-red-50',    text: 'text-red-600',   chip: 'bg-red-100 text-red-700' }

  // State-driven styling layered on top of the accent colours.
  let stateClass = `${accent.border} bg-gradient-to-br ${accent.bg} to-white`
  if (state === 'captured') {
    stateClass = 'border-brand-300 bg-brand-50 opacity-90'
  } else if (state === 'hover') {
    stateClass = 'border-brand-500 ring-4 ring-brand-300 scale-105 bg-white'
  } else if (state === 'droppable') {
    stateClass = 'border-brand-400 ring-2 ring-brand-200 bg-white animate-pulse'
  } else if (state === 'blocked') {
    stateClass = `${accent.border} bg-gradient-to-br ${accent.bg} to-white opacity-40`
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative w-40 h-40 shrink-0 rounded-2xl border-2 p-3 flex flex-col
                  select-none transition-all duration-150 [&_*]:pointer-events-none ${stateClass}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl leading-none">{tile.icon}</span>
        <span className={`chip ${state === 'captured' ? 'bg-brand-100 text-brand-700' : accent.chip}`}>
          {tile.isLoan ? 'Loan' : tile.isTax ? 'Tax' : isGoal ? 'Goal' : 'Debt'}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-tight line-clamp-2">{tile.label}</p>

      {state === 'captured' ? (
        <div className="mt-auto">
          <p className="font-display text-lg font-extrabold text-brand-700">✓ Cleared</p>
          <p className="text-[11px] text-ink-400">
            {tile.capturedVia === 'paydown'
              ? `Paid down · ${fmtTimeline(tile.capturedMonth)}`
              : `${fmtMoney(tile.capturedValue)} · ${fmtTimeline(tile.capturedMonth)}`}
          </p>
          {tile.capturedVia === 'mortgage' && (
            <p className="mt-0.5 text-[10px] font-semibold text-amber-600">
              🏠 Added to mortgage
            </p>
          )}
          {tile.capturedVia === 'paydown' && (
            <p className="mt-0.5 text-[10px] font-semibold text-brand-600">
              💪 Paid via contributions
            </p>
          )}
          {tile.capturedVia === 'milestone' && (
            <p className="mt-0.5 text-[10px] font-semibold text-brand-600">
              📈 Milestone reached
            </p>
          )}
        </div>
      ) : (
        <div className="mt-auto">
          <p className={`font-display text-xl font-extrabold ${accent.text}`}>
            {fmtMoney(value)}
          </p>
          <p className="text-[11px] text-ink-400">
            {droppable
              ? 'Drop to capture'
              : gap > 0
                ? `${fmtMoney(gap)} short`
                : 'Ready to claim'}
          </p>
        </div>
      )}

      {state === 'captured' && (
        <span className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="text-4xl opacity-20">✓</span>
        </span>
      )}
    </div>
  )
}

// ── Contributions modal — edit each piece's monthly contribution ──────
function ContributionsModal({ assetTiles, targetTiles, onClose, onSave }) {
  const liabilityTiles = targetTiles.filter(
    (t) => t.kind === 'liability' && !t.captured,
  )

  const [draft, setDraft] = useState(() => {
    const m = {}
    assetTiles.forEach((a) => { m[a.id] = a.pmt ? String(a.pmt) : '' })
    liabilityTiles.forEach((l) => { m[l.id] = l.pmt ? String(l.pmt) : '' })
    return m
  })

  // Tab between asset contributions and liability paydowns so the user
  // can focus on one side at a time when there are a lot of tiles.
  // Default to whichever side has rows to edit.
  const [view, setView] = useState(
    assetTiles.length === 0 && liabilityTiles.length > 0 ? 'liabilities' : 'assets',
  )

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const setVal = (id, v) => setDraft((d) => ({ ...d, [id]: v }))

  const save = () => {
    const out = {}
    Object.entries(draft).forEach(([id, v]) => {
      const n = Number(v)
      out[id] = Number.isFinite(n) && n >= 0 ? n : 0
    })
    onSave(out)
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
                      max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold">Monthly contributions</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              Tune what flows into each piece every month.
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

        {/* Segmented toggle */}
        <div className="mt-5 flex gap-1 p-1 bg-slate-100 rounded-full">
          <button
            type="button"
            onClick={() => setView('assets')}
            className={`flex-1 py-1.5 rounded-full text-sm font-semibold transition ${
              view === 'assets'
                ? 'bg-white shadow-soft text-ink-900'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            🟢 Assets
            <span className={`ml-1.5 text-[11px] font-bold ${
              view === 'assets' ? 'text-brand-700' : 'text-ink-400'
            }`}>
              {assetTiles.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView('liabilities')}
            className={`flex-1 py-1.5 rounded-full text-sm font-semibold transition ${
              view === 'liabilities'
                ? 'bg-white shadow-soft text-ink-900'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            🔻 Liabilities
            <span className={`ml-1.5 text-[11px] font-bold ${
              view === 'liabilities' ? 'text-red-700' : 'text-ink-400'
            }`}>
              {liabilityTiles.length}
            </span>
          </button>
        </div>

        <div className="mt-4">
          {view === 'assets' ? (
            assetTiles.length > 0 ? (
              <>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-ink-400 mb-2">
                  Added each month
                </p>
                <div className="space-y-2">
                  {assetTiles.map((a) => (
                    <ContributionRow
                      key={a.id}
                      icon={a.icon}
                      label={a.label}
                      value={draft[a.id] ?? ''}
                      onChange={(v) => setVal(a.id, v)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-400">No assets to tune.</p>
            )
          ) : (
            liabilityTiles.length > 0 ? (
              <>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-ink-400 mb-2">
                  Paid down each month
                </p>
                <div className="space-y-2">
                  {liabilityTiles.map((l) => (
                    <ContributionRow
                      key={l.id}
                      icon={l.icon}
                      label={l.label}
                      value={draft[l.id] ?? ''}
                      onChange={(v) => setVal(l.id, v)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-400">No open liabilities to tune.</p>
            )
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button type="button" onClick={save} className="btn-primary flex-1">
            Save contributions
          </button>
        </div>
      </div>
    </div>
  )
}

function ContributionRow({ icon, label, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl shrink-0">{icon}</span>
      <span className="flex-1 text-sm font-semibold truncate">{label}</span>
      <div className="relative w-32 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 text-sm">$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          className="input !py-2 pl-7 pr-10 text-sm"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">/mo</span>
      </div>
    </div>
  )
}

// ── Action step — one checklist row in the action plan ───────────────
function ActionStep({ step, index, onToggle, onRemove }) {
  const tone = step.kind === 'mortgage' || step.kind === 'loan' || step.kind === 'tax'
    ? 'border-amber-200 bg-amber-50/40'
    : step.kind === 'contribution'
    ? 'border-grape-200 bg-grape-50/40'
    : 'border-brand-200 bg-brand-50/40'

  return (
    <li>
      <div
        className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
          step.done
            ? 'border-slate-200 bg-slate-50 opacity-70'
            : tone
        }`}
      >
        <input
          type="checkbox"
          checked={step.done}
          onChange={onToggle}
          className="mt-1 h-5 w-5 rounded accent-grape-600 shrink-0 cursor-pointer"
          aria-label={`Mark step ${index} done`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none shrink-0" aria-hidden="true">
              {step.emoji}
            </span>
            <p className={`text-sm font-semibold flex-1 leading-snug ${
              step.done ? 'line-through text-ink-400' : ''
            }`}>
              {step.title}
            </p>
            <span className={`chip shrink-0 ${
              step.done ? 'bg-slate-100 text-ink-400' : 'bg-white border border-slate-200 text-ink-500'
            }`}>
              {fmtTimeline(step.month)}
            </span>
          </div>
          {step.detail && (
            <p className={`text-xs mt-1 ${
              step.done ? 'text-ink-300' : 'text-ink-500'
            }`}>
              {step.detail}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 h-7 w-7 grid place-items-center rounded-full text-ink-300
                     hover:text-ink-700 hover:bg-slate-100"
          aria-label="Remove step"
          title="Remove step"
        >
          ✕
        </button>
      </div>
    </li>
  )
}

// ── Income disclosure modal — set baseline after-tax monthly income ──
// The value persists to the planner profile so other parts of the app
// (Portrait vectors, future budget caps) can read a single source of
// truth instead of re-deriving income from contribution sums.
function IncomeDisclosureModal({
  currentTotal, currentSources, bareNecessities = 0, addedIncome = 0,
  pensionMonthlyIncome = 0,
  assetContributions = 0, liabilityPayments = 0,
  country, onClose, onSave,
}) {
  // Localize the deductions hint so US users see federal/state/FICA
  // instead of Canadian payroll deductions.
  const deductionsHint = country === 'US'
    ? 'Take-home pay after federal & state income tax, Social Security, Medicare, 401(k), and other automatic deductions. We\'ll add the gross-up math for taxes in a later update.'
    : 'Take-home pay after income tax, CPP/EI, pension, and other automatic deductions. We\'ll add the gross-up math for taxes in a later update.'
  // Seed the inputs. If we already have a per-source breakdown, use that.
  // Otherwise migrate any legacy single-field total into Employment so we
  // don't lose the user's existing disclosure.
  const seededFromSources =
    currentSources &&
    ((currentSources.employment ?? '') !== '' ||
     (currentSources.selfEmployment ?? '') !== '' ||
     (currentSources.business ?? '') !== '')
  const [employment, setEmployment] = useState(
    seededFromSources
      ? (currentSources.employment ?? '')
      : (currentTotal ?? ''),
  )
  const [selfEmployment, setSelfEmployment] = useState(
    seededFromSources ? (currentSources.selfEmployment ?? '') : '',
  )
  const [business, setBusiness] = useState(
    seededFromSources ? (currentSources.business ?? '') : '',
  )

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const emp     = Number(employment)     || 0
  const selfEmp = Number(selfEmployment) || 0
  const biz     = Number(business)       || 0
  const incomeAmt   = emp + selfEmp + biz
  const added       = Number(addedIncome) || 0
  const pension     = Number(pensionMonthlyIncome) || 0
  const totalIncome = incomeAmt + added + pension
  const necessities = Number(bareNecessities) || 0
  const assets      = Number(assetContributions) || 0
  const liabilities = Number(liabilityPayments)  || 0
  const allocated   = necessities + assets + liabilities
  const remaining   = totalIncome - allocated
  const overAllocated = totalIncome > 0 && allocated > totalIncome

  // Clamp a raw input to a controlled string in the same convention used
  // across the rest of the planner profile.
  const clean = (v) => v === '' ? '' : String(Math.max(0, Math.round(Number(v) || 0)))

  const save = () => {
    onSave({
      monthlyIncome: incomeAmt > 0 ? String(incomeAmt) : '',
      incomeSources: {
        employment:     clean(employment),
        selfEmployment: clean(selfEmployment),
        business:       clean(business),
      },
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
                      max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold">Monthly income</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              {(currentTotal || seededFromSources)
                ? 'Edit if any of your sources have changed.'
                : 'Disclose what you actually take home each month after tax.'}
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

        <div className="mt-5 space-y-4">
          <div>
            <p className="label">Income sources (after tax)</p>
            <div className="space-y-2">
              <IncomeSourceRow
                id="src-employment"
                label="Employment"
                value={employment}
                onChange={setEmployment}
                autoFocus
              />
              <IncomeSourceRow
                id="src-self-emp"
                label="Self-employment"
                value={selfEmployment}
                onChange={setSelfEmployment}
              />
              <IncomeSourceRow
                id="src-business"
                label="Business"
                value={business}
                onChange={setBusiness}
              />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Total monthly income
              </span>
              <span className="font-display text-base font-extrabold text-ink-900">
                {fmtMoney(incomeAmt)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-400">
              {deductionsHint}
            </p>
          </div>

          {totalIncome > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                Where it's going
              </p>
              <div className="mt-2 space-y-1.5 text-sm">
                <Row label="Income" value={fmtMoney(incomeAmt)} bold />
                {added > 0 && (
                  <Row
                    label="Added income (powerup)"
                    value={`+ ${fmtMoney(added)}`}
                    tone="good"
                  />
                )}
                {pension > 0 && (
                  <Row
                    label="Pension annuity"
                    value={`+ ${fmtMoney(pension)}`}
                    tone="good"
                  />
                )}
                <Row label="Bare necessities"             value={`− ${fmtMoney(necessities)}`} />
                <Row label="Going to asset contributions" value={`− ${fmtMoney(assets)}`} />
                <Row label="Going to debt payments"       value={`− ${fmtMoney(liabilities)}`} />
                <div className="border-t border-slate-200 my-1" />
                <Row
                  label={overAllocated ? 'Over budget' : 'Left over'}
                  value={fmtMoney(remaining)}
                  bold
                  tone={overAllocated ? 'bad' : remaining > 0 ? 'good' : 'default'}
                />
              </div>
              {overAllocated && (
                <p className="mt-2 text-[11px] text-red-600">
                  Your current contributions exceed the income you have available.
                  Trim them in the Contributions modal, raise your income, or take
                  another income powerup.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button type="button" onClick={save} className="btn-primary flex-1">
            Save income
          </button>
        </div>
      </div>
    </div>
  )
}

function IncomeSourceRow({ id, label, value, onChange, autoFocus = false }) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="flex-1 text-sm font-semibold truncate">
        {label}
      </label>
      <div className="relative w-36 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 text-sm">$</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          className="input !py-2 pl-7 pr-10 text-sm"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">/mo</span>
      </div>
    </div>
  )
}

function Row({ label, value, bold = false, tone = 'default' }) {
  const toneClass =
    tone === 'good' ? 'text-brand-700'
    : tone === 'bad' ? 'text-red-600'
    : 'text-ink-700'
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-xs ${bold ? 'font-bold uppercase tracking-wide text-ink-500' : 'text-ink-500'}`}>
        {label}
      </span>
      <span className={`${bold ? 'font-display text-sm font-extrabold' : 'text-sm font-semibold'} ${toneClass}`}>
        {value}
      </span>
    </div>
  )
}

// ── Portrait modal — a live read on the health of the plan ────────────
// The center circle uses the Snapshot's WealthMark / WEALTH_LEVELS so the
// two screens speak the same language. The six surrounding containers
// hold "vector" feedback attributes — placeholders for now, real metrics
// can be slotted in later without changing the layout.
function PortraitModal({
  netWorth, month, projectedAge = null,
  liquidValue = 0, passiveIncome = 0, monthlyIncomeAfterTax = 0,
  foundationAmount = 0, annualGrowth = 0,
  onClose,
}) {
  // Mirror the time-bar's "(age X)" suffix everywhere this modal echoes
  // the current month so the user keeps their place on the timeline.
  const ageSuffix = projectedAge != null ? ` (age ${projectedAge})` : ''
  const lvl  = wealthLevel(netWorth)
  const meta = WEALTH_LEVELS[lvl] || WEALTH_LEVELS[0]

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Vector values ───────────────────────────────────────────────────
  // Upper bound of each wealth band — the user reaches the next level by
  // crossing past these. Last entry is the entry into the top tier.
  const WEALTH_THRESHOLDS = [1000, 10000, 100000, 500000, 4000000, 20000000]
  const nextThreshold = lvl < 6 ? WEALTH_THRESHOLDS[lvl] : null

  // Protection: liquid investments ÷ monthly income = months of income
  // your liquid pool could replace if your earnings stopped.
  let protectionLabel
  let protectionDetail
  if (monthlyIncomeAfterTax <= 0) {
    protectionLabel = '—'
    protectionDetail = 'Disclose your monthly income to see runway.'
  } else if (liquidValue <= 0) {
    protectionLabel = '0 mo'
    protectionDetail = `No liquid pool to cover your ${fmtMoney(monthlyIncomeAfterTax)}/mo income.`
  } else {
    const months = liquidValue / monthlyIncomeAfterTax
    if (months < 1) {
      protectionLabel = '< 1 mo'
    } else if (months < 48) {
      protectionLabel = `${Math.round(months)} mo`
    } else {
      // Beyond 48 months, switch the unit so the chip stays readable.
      const years = months / 12
      if (years < 10)        protectionLabel = `${years.toFixed(1)} yr`
      else if (years < 100)  protectionLabel = `${Math.round(years)} yr`
      else                   protectionLabel = '99+ yr'
    }
    protectionDetail = `${fmtMoney(liquidValue)} liquid ÷ ${fmtMoney(monthlyIncomeAfterTax)}/mo income.`
  }

  // Countdown: gap to the next threshold ÷ annual growth.
  let countdownLabel
  let countdownDetail = 'Years until the next wealth level at the current growth rate.'
  if (nextThreshold == null) {
    countdownLabel = 'Max'
    countdownDetail = "You're already at the top wealth level."
  } else if (annualGrowth <= 0 || !Number.isFinite(annualGrowth)) {
    countdownLabel = '—'
    countdownDetail = 'No clear path to the next level at the current growth rate.'
  } else {
    const gap = nextThreshold - netWorth
    if (gap <= 0) {
      countdownLabel = 'Now'
      countdownDetail = "You've crossed the threshold — your level updates next render."
    } else {
      const years = gap / annualGrowth
      if (years < 0.1)      countdownLabel = '< 1 mo'
      else if (years < 1)   countdownLabel = `${Math.round(years * 12)} mo`
      else if (years < 10)  countdownLabel = `${years.toFixed(1)} yr`
      else if (years < 100) countdownLabel = `${Math.round(years)} yr`
      else                  countdownLabel = '99+ yr'
    }
  }

  // Six surrounding "vector" attributes. Ordered clockwise from the top.
  const attributes = [
    { id: 'protection', emoji: '🛡️', label: 'Protection',
      value: protectionLabel,
      detail: protectionDetail },
    { id: 'passive', emoji: '💸', label: 'Passive Income',
      value: `${fmtMoney(passiveIncome)}/yr`,
      detail: 'Annual interest earned on savings, investments, retirement, and crypto.' },
    { id: 'generational', emoji: '🌳', label: 'Generational Wealth',
      value: fmtMoney(netWorth),
      detail: `Net worth at ${fmtTimeline(month)}${ageSuffix}.` },
    { id: 'foundation', emoji: '🧱', label: 'Foundation',
      value: fmtMoney(foundationAmount),
      detail: '10 years of income + the total estate value.' },
    { id: 'risk', emoji: '⚠️', label: 'Risk Exposure',
      value: '—',
      detail: 'How exposed the plan is to a downturn.' },
    { id: 'countdown', emoji: '⏱️', label: 'Countdown',
      value: countdownLabel,
      detail: countdownDetail },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-ink-900/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-soft
                      p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-6
                      max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold">Portrait of your plan</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              A live read on the health of your strategy at {fmtTimeline(month)}{ageSuffix}.
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

        {/* Desktop: radial constellation */}
        <div className="hidden md:block relative mt-6 h-[520px]">
          <PortraitCenter lvl={lvl} meta={meta} netWorth={netWorth} />
          {attributes.map((a, i) => {
            // Spread evenly around the circle, starting at the top (−90°).
            const deg = i * 60 - 90
            const rad = (deg * Math.PI) / 180
            const r   = 210 // distance from center, in px
            const x   = Math.cos(rad) * r
            const y   = Math.sin(rad) * r
            return (
              <div
                key={a.id}
                className="absolute left-1/2 top-1/2 w-40"
                style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
              >
                <PortraitAttribute attribute={a} />
              </div>
            )
          })}
        </div>

        {/* Mobile / narrow: stacked layout */}
        <div className="md:hidden mt-6">
          <div className="grid place-items-center">
            <PortraitCenter lvl={lvl} meta={meta} netWorth={netWorth} compact />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {attributes.map((a) => (
              <PortraitAttribute key={a.id} attribute={a} />
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button type="button" onClick={onClose} className="btn-ghost !py-2 !px-4 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function PortraitCenter({ lvl, meta, netWorth, compact = false }) {
  const size = compact ? 'w-44 h-44' : 'w-56 h-56'
  const mark = compact ? 'h-16 w-24' : 'h-20 w-28'
  return (
    <div
      className={`${size} rounded-full border-4 border-olive-300
                  bg-gradient-to-br from-olive-50 to-white shadow-soft
                  flex flex-col items-center justify-center text-center p-4
                  md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-10`}
    >
      <WealthMark level={lvl} className={`${mark} text-olive-600`} />
      <p className="mt-2 font-display text-sm font-extrabold text-olive-700 leading-none">
        {meta.label}
      </p>
      <p className="text-[10px] text-ink-500 mt-1 leading-tight">
        {meta.range}
      </p>
      <p className="text-[11px] font-semibold text-ink-700 mt-1">
        {fmtMoney(netWorth)}
      </p>
    </div>
  )
}

function PortraitAttribute({ attribute }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center
                    shadow-soft transition hover:border-grape-300 hover:-translate-y-0.5">
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-lg leading-none">{attribute.emoji}</span>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500 leading-tight">
          {attribute.label}
        </p>
      </div>
      <p className="mt-1.5 font-display text-lg font-extrabold text-ink-900 leading-none">
        {attribute.value}
      </p>
      <p className="text-[10px] text-ink-500 mt-1.5 leading-snug">
        {attribute.detail}
      </p>
    </div>
  )
}

// ── Income powerup modal — earn more, then allocate the extra cashflow
function IncomeModal({ assetTiles, liabilityTiles, onClose, onSave }) {
  const [addedIncome, setAddedIncome] = useState('')
  const [allocations, setAllocations] = useState({})

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const setAlloc = (id, v) => setAllocations((a) => ({ ...a, [id]: v }))

  const incomeAmt = Number(addedIncome) || 0
  const allocSum = Object.values(allocations).reduce(
    (s, v) => s + (Number(v) || 0), 0,
  )
  const remaining = incomeAmt - allocSum
  const overAllocated = allocSum > incomeAmt
  const valid = incomeAmt > 0 && allocSum > 0 && !overAllocated

  // The board already knows how much the user is moving every month. Show it
  // for context so the new income feels like an addition, not a reset.
  const currentTotal =
    assetTiles.reduce((s, a) => s + (Number(a.pmt) || 0), 0) +
    liabilityTiles.reduce((s, t) => s + (Number(t.pmt) || 0), 0)

  const save = () => {
    if (!valid) return
    const clean = {}
    Object.entries(allocations).forEach(([id, v]) => {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) clean[id] = n
    })
    onSave({ addedIncome: incomeAmt, allocations: clean })
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
                      max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold">Increase income</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              Earn more, then funnel the new cashflow into your pieces.
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

        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="income-amount">
              How much more after-tax monthly income are you adding?
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
              <input
                id="income-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                className="input pl-8 pr-12"
                placeholder="e.g. 500"
                value={addedIncome}
                onChange={(e) => setAddedIncome(e.target.value)}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">/mo</span>
            </div>
            <p className="mt-1 text-[11px] text-ink-400">
              You're already moving {fmtMoney(currentTotal)}/mo through your
              pieces. We'll add the gross-up math for taxes in a later update.
            </p>
          </div>

          {incomeAmt > 0 && (assetTiles.length > 0 || liabilityTiles.length > 0) ? (
            <div>
              <div className="flex items-baseline justify-between">
                <p className="label !mb-1">Where does the new income go?</p>
                <p className={`text-xs font-semibold shrink-0 ${
                  overAllocated ? 'text-red-600' : remaining === 0 ? 'text-brand-700' : 'text-ink-500'
                }`}>
                  {overAllocated
                    ? `Over by ${fmtMoney(-remaining)}`
                    : remaining === 0
                      ? 'Fully assigned'
                      : `${fmtMoney(remaining)} left`}
                </p>
              </div>
              <p className="text-[11px] text-ink-400 mb-2">
                You can't assign more than the income you added.
              </p>
              {assetTiles.length > 0 && (
                <>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-ink-400 mt-2">
                    Assets
                  </p>
                  <div className="mt-1 space-y-2">
                    {assetTiles.map((a) => (
                      <AllocationRow
                        key={a.id}
                        icon={a.icon}
                        label={a.label}
                        current={a.pmt}
                        value={allocations[a.id] ?? ''}
                        onChange={(v) => setAlloc(a.id, v)}
                      />
                    ))}
                  </div>
                </>
              )}
              {liabilityTiles.length > 0 && (
                <>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-ink-400 mt-3">
                    Liabilities
                  </p>
                  <div className="mt-1 space-y-2">
                    {liabilityTiles.map((l) => (
                      <AllocationRow
                        key={l.id}
                        icon={l.icon}
                        label={l.label}
                        current={l.pmt}
                        value={allocations[l.id] ?? ''}
                        onChange={(v) => setAlloc(l.id, v)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : incomeAmt > 0 ? (
            <p className="text-sm text-ink-400">
              No assets or open liabilities to allocate to yet.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!valid}
            className="btn-primary flex-1"
          >
            Add income
          </button>
        </div>
      </div>
    </div>
  )
}

function AllocationRow({ icon, label, current, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{label}</span>
        <span className="block text-[11px] text-ink-400">
          Now: {fmtMoney(Number(current) || 0)}/mo
        </span>
      </span>
      <div className="relative w-32 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 text-sm">+$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          className="input !py-2 pl-9 pr-10 text-sm"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">/mo</span>
      </div>
    </div>
  )
}

// ── Loan powerup modal — set up a cash + debt pair ────────────────────
function LoanModal({ assets = [], goals, onClose, onCreate }) {
  const [amount, setAmount]       = useState('')
  const [rate, setRate]           = useState('8')
  const [label, setLabel]         = useState('')
  const [depositTo, setDepositTo] = useState('new')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const amt = Number(amount)
  const valid = Number.isFinite(amt) && amt > 0
  const depositAsset = depositTo !== 'new'
    ? assets.find((a) => a.id === depositTo) || null
    : null
  // Real estate can't be liquidated to clear debts — warn if the user picks
  // it so the consequence is obvious before they commit.
  const depositIsRealEstate = depositAsset?.subtype === 'realEstate'

  const create = () => {
    if (!valid) return
    onCreate({ amount: amt, rate: Number(rate) || 0, label, depositTo })
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
                      max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold">Take out a loan</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              Adds matching cash and debt tiles — your net worth doesn't move.
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

        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="loan-name">
              Name <span className="text-ink-400 font-normal">(optional)</span>
            </label>
            <input
              id="loan-name"
              className="input"
              placeholder="e.g. Renovation loan"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="loan-amount">Loan amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
              <input
                id="loan-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                className="input pl-8"
                placeholder="e.g. 20000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="loan-deposit">Deposit cash to</label>
            <select
              id="loan-deposit"
              className="input"
              value={depositTo}
              onChange={(e) => setDepositTo(e.target.value)}
            >
              <option value="new">💵 New cash tile</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.icon} {a.label} — {fmtMoney(a.value)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink-400">
              {depositTo === 'new'
                ? 'Creates a fresh cash tile you can drag onto a goal or debt.'
                : `Adds ${valid ? fmtMoney(amt) : 'the loan'} to that asset's balance. The matching debt tile still appears.`}
            </p>
            {depositIsRealEstate && (
              <p className="mt-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-700">
                🏠 Heads up — real estate can fund goals but can't clear debts.
                Borrowed cash deposited here can't be used to pay the loan off later.
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="loan-rate">Interest rate (APR)</label>
            <div className="relative">
              <input
                id="loan-rate"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                className="input pr-9"
                placeholder="8"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">%</span>
            </div>
            <p className="mt-1 text-[11px] text-ink-400">
              The debt tile grows at this rate as the timeline advances.
            </p>
          </div>

          {goals.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                Goals you could fund
              </p>
              <ul className="mt-1.5 space-y-1">
                {goals.map((g) => (
                  <li key={g.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="truncate">{g.icon} {g.label}</span>
                    <span className="font-semibold shrink-0">{fmtMoney(g.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={!valid}
            className="btn-primary flex-1"
          >
            Take out loan
          </button>
        </div>
      </div>
    </div>
  )
}
