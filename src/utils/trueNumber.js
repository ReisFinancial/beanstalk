/**
 * True Number — the total wealth (in today's dollars) the user needs to
 * sustain their ideal lifestyle from now until end of life expectancy.
 *
 * Inspired by "Think and Grow Rich" — the specific dollar amount that
 * defines financial freedom. Framed two ways:
 *
 *   trueNumber        The "coast" number. If the user had this today,
 *                     invested at their real-return rate, they'd never
 *                     need to work again. NPV of lifetime spending.
 *
 *   retirementNumber  The traditional retirement target. Wealth needed
 *                     at retirement age to fund retirement-only spending.
 *                     Smaller, more familiar to most planners.
 *
 * Both come from the same two-phase NPV math applied to the annual
 * spending figure produced by src/utils/idealSpending.js. Pension
 * annuities offset retirement-phase spending. Chunk 4 (Dashboard) reads
 * this module directly for the hero card + Compare Cities feature.
 *
 * Everything is a pure function of the input. No side effects, no state.
 */
import { ageFromPersonal } from './age.js'


// ── Tuning constants ────────────────────────────────────────────────

/** Life expectancy for retirement-planning math. User-configurable later. */
const LIFE_EXPECTANCY = 90

/** Retirement age fallback when no pension asset defines one. */
const DEFAULT_RETIREMENT_AGE = 65

/** Discount rate fallback when the spending estimator hasn't set one. */
const DEFAULT_DISCOUNT_RATE = 0.05

/** The "20" in 50/30/20 — the savings share of ideal income that funds
 *  wealth-building during working years. Used for the rough "years to
 *  target" projection when the user hasn't disclosed their actual income. */
const ASSUMED_SAVINGS_RATE = 0.20

/**
 * Asset subtypes that produce passive income (interest / appreciation)
 * used in the annualGrowth calculation for "years to target". Vehicles,
 * real estate, and pensions have their own treatment elsewhere.
 */
const INTEREST_SUBTYPES = new Set([
  'savings', 'investments', 'retirement', 'crypto', 'stockOptions', 'collectibles',
])


// ── Financial primitives ────────────────────────────────────────────
// Kept exported and pure so they can be tested + reused by the Compare
// Cities module without going through the full computeTrueNumber().

/**
 * Present value of a level annuity paying `annual` for `years` at real
 * discount rate `rate`. Uses the closed-form annuity formula.
 */
export function annuityPV(annual, years, rate) {
  const c = Number(annual) || 0
  const n = Number(years)  || 0
  const r = Number(rate)   || 0
  if (c <= 0 || n <= 0) return 0
  if (r === 0)          return c * n
  return c * (1 - Math.pow(1 + r, -n)) / r
}

/**
 * Present value of a payment stream that starts at year `startYear` and
 * ends at year `endYear`, discounted to today at rate `rate`. Used for
 * retirement-phase spending that only begins after the working years.
 */
export function deferredAnnuityPV(annual, startYear, endYear, rate) {
  const start = Math.max(0, Number(startYear) || 0)
  const end   = Math.max(0, Number(endYear)   || 0)
  const n = end - start
  if (n <= 0) return 0
  const streamPV = annuityPV(annual, n, rate)
  const r = Number(rate) || 0
  if (r === 0) return streamPV
  return streamPV * Math.pow(1 + r, -start)
}


// ── Profile aggregators ─────────────────────────────────────────────
// Each helper is stateless and defensive so a partly-filled profile
// never blows up the True Number card.

/** Total assets minus liabilities. Matches the Snapshot's net-worth math. */
function currentNetWorth(profile) {
  const assets = (profile?.assets || []).reduce(
    (s, a) => s + (Number(a?.amount) || 0), 0,
  )
  const debts = (profile?.liabilities || []).reduce(
    (s, l) => s + (Number(l?.amount) || 0), 0,
  )
  return assets - debts
}

/** Earliest retirement age from any pension asset; otherwise the default. */
function earliestRetirementAge(profile) {
  const ages = (profile?.assets || [])
    .filter((a) => a?.subtype === 'pension' && Number(a?.retirementAge) > 0)
    .map((p) => Number(p.retirementAge))
  return ages.length > 0 ? Math.min(...ages) : DEFAULT_RETIREMENT_AGE
}

/** Sum of every pension's annual annuity — offsets retirement spending. */
function annualPensionIncome(profile) {
  return (profile?.assets || [])
    .filter((a) => a?.subtype === 'pension')
    .reduce((s, p) => s + (Number(p?.annualAnnuity) || 0), 0)
}

/**
 * Rough annual passive income from interest-bearing assets, used only
 * for the "years to target" linear estimate. Prefers each asset's own
 * customRate when set (stockOptions, collectibles), otherwise reads the
 * per-subtype rate from profile.rates.asset.
 */
function annualPassiveIncome(profile) {
  const rates = profile?.rates?.asset || {}
  return (profile?.assets || [])
    .filter((a) => a && INTEREST_SUBTYPES.has(a.subtype))
    .reduce((sum, a) => {
      const amount = Number(a.amount) || 0
      const rate =
        Number.isFinite(Number(a.customRate)) && a.customRate !== null && a.customRate !== ''
          ? Number(a.customRate)
          : Number(rates[a.subtype]) || 0
      return sum + amount * (rate / 100)
    }, 0)
}


// ── Main entry point ────────────────────────────────────────────────

/**
 * Compute the True Number and companion figures for the given profile
 * and pre-computed spending estimate.
 *
 * @param {object} profile   Full PlannerContext profile.
 * @param {object} spending  Output of estimateIdealSpending() — must
 *                           carry annualSpending, retirementMultiplier,
 *                           discountRate, and idealAnnualIncome.
 * @returns {object}         Dashboard-ready summary; every field is
 *                           either a number, null, or a small object of
 *                           traceable assumptions.
 */
export function computeTrueNumber(profile, spending) {
  const rate = Number(spending?.discountRate) || DEFAULT_DISCOUNT_RATE
  const annualSpending = Number(spending?.annualSpending) || 0
  const retMult = Number(spending?.retirementMultiplier) || 1.0

  const currentAge = ageFromPersonal(profile?.personal) ?? 35
  const retireAge  = earliestRetirementAge(profile)

  const yearsWorking = Math.max(0, retireAge - currentAge)
  const yearsRetired = Math.max(0, LIFE_EXPECTANCY - Math.max(currentAge, retireAge))
  const yearsRemaining = yearsWorking + yearsRetired

  const pensionIncome  = annualPensionIncome(profile)
  const retirementSpending = Math.max(0, annualSpending * retMult - pensionIncome)

  // Two-phase NPV:
  //   1) Working years — full lifestyle spending (if the user weren't working).
  //   2) Retirement years — reduced by the retirement multiplier and by
  //      any guaranteed pension income.
  const workingSpendingPV    = annuityPV(annualSpending, yearsWorking, rate)
  const retirementSpendingPV = deferredAnnuityPV(
    retirementSpending, yearsWorking, yearsRemaining, rate,
  )
  const trueNumber = workingSpendingPV + retirementSpendingPV

  // Traditional retirement target — NPV at retirement age (still USD today).
  // Not discounted back to now, so it reads as "the wealth you need to
  // have on hand the day you retire".
  const retirementNumber = annuityPV(retirementSpending, yearsRetired, rate)

  // Progress bookkeeping
  const netWorth = currentNetWorth(profile)
  const gap = Math.max(0, trueNumber - netWorth)
  const percentToTarget = trueNumber > 0
    ? Math.min(1, Math.max(0, netWorth / trueNumber))
    : 0
  const multiplier = annualSpending > 0 ? trueNumber / annualSpending : 0

  // Rough linear years-to-target. Uses actual disclosed income if the
  // user has set it; otherwise assumes they earn their ideal income
  // (from Chunk 2) and save 20% of it — the "20" in 50/30/20.
  const disclosedMonthlyIncome = Number(profile?.finances?.monthlyIncome) || 0
  const effectiveAnnualIncome  = disclosedMonthlyIncome > 0
    ? disclosedMonthlyIncome * 12
    : (Number(spending?.idealAnnualIncome) || 0)
  const assumedAnnualSavings = effectiveAnnualIncome * ASSUMED_SAVINGS_RATE
  const passiveIncome        = annualPassiveIncome(profile)
  const annualGrowth         = assumedAnnualSavings + passiveIncome

  let yearsToTarget = null
  if (gap <= 0) {
    yearsToTarget = 0
  } else if (annualGrowth > 0) {
    yearsToTarget = gap / annualGrowth
  }

  return {
    // Headline numbers
    trueNumber:       Math.round(trueNumber),
    retirementNumber: Math.round(retirementNumber),
    currentNetWorth:  Math.round(netWorth),
    gap:              Math.round(gap),

    // Progress framing — Dashboard picks whichever fits
    percentToTarget,                                       // 0..1
    multiplier:  Math.round(multiplier * 10) / 10,        // Nx annual spending, 1 decimal
    yearsToTarget: yearsToTarget != null
      ? Math.round(yearsToTarget * 10) / 10
      : null,

    // Income offsets that shaped the number — useful for tooltips
    annualGuaranteedIncome: Math.round(pensionIncome),

    // Every input that went into the calc — great for a "why is this
    // number what it is?" popover in the Dashboard hero card.
    assumptions: {
      currentAge:          Math.round(currentAge * 10) / 10,
      retirementAge:       retireAge,
      lifeExpectancy:      LIFE_EXPECTANCY,
      yearsWorking:        Math.round(yearsWorking * 10) / 10,
      yearsRetired:        Math.round(yearsRetired * 10) / 10,
      discountRate:        rate,
      retirementMultiplier: retMult,
      annualSpending:      Math.round(annualSpending),
      retirementSpending:  Math.round(retirementSpending),
      effectiveAnnualIncome: Math.round(effectiveAnnualIncome),
      assumedAnnualSavings:  Math.round(assumedAnnualSavings),
      annualPassiveIncome:   Math.round(passiveIncome),
      annualGrowth:          Math.round(annualGrowth),
    },
  }
}


/** Constants surfaced so downstream code / tests can reason about them. */
export const TRUE_NUMBER_CONSTANTS = Object.freeze({
  LIFE_EXPECTANCY,
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_DISCOUNT_RATE,
  ASSUMED_SAVINGS_RATE,
  INTEREST_SUBTYPES: Array.from(INTEREST_SUBTYPES),
})
