/**
 * True Number v2 — alternative calculation driven by the schema exported
 * from the North America Residential Real Estate Tracker.
 *
 * NOT wired into the app. Nothing in src/utils/ imports this. Live here so
 * we can iterate on the shape + numbers without touching production.
 *
 * The v1 pipeline (src/utils/idealSpending.js + src/utils/trueNumber.js)
 * builds spending from qualitative wizard signals with per-country
 * baselines and multiplier heuristics. v2 replaces the baselines with
 * real per-city rows: cost of living, dwelling price by density, and a
 * seed list of concrete activities the user could actually spend on.
 *
 * SHELTER MODEL — "lifetime housing envelope"
 * The mortgage-equivalent annual payment is treated as a LIFELONG
 * outflow, not just during amortization: pre-payoff it funds debt
 * service; post-payoff it funds renovations, upgrades, and wishlist
 * items that empirically fill the same slot in a household budget.
 * Collapses the two-phase NPV into one clean annuity. Property tax,
 * city utilities, and maintenance run alongside as a separate carry
 * line so both phases stay honest.
 *
 * INPUT SHAPE
 *   {
 *     cityId,               // number — CITIES.id
 *     densityTierId,        // number — DENSITY_TIERS.id (urban/suburbs/rural)
 *     financialTier,        // 'basic' | 'comfortable' | 'abundant'
 *     investmentApproach,   // 'conservative' | 'balanced' | 'ambitious'
 *     lifestyleTier,        // 'quiet' | 'balanced' | 'high'
 *     lifestyleTypeIds,     // number[] — the user's chosen lifestyleType ids
 *                           //   (from LIFESTYLE_TYPES: 1=active..5=culture);
 *                           //   pass all 5 for the "does everything" case
 *     housingMode,          // 'need_home' | 'upgrade' | 'own_ideal' | 'prefer_rent'
 *                           //   — matches Wizard Step 1 housingSituation ids
 *     currentHomeValue,     // number USD — required only when housingMode='upgrade'
 *     currentAge,           // number
 *     retirementAge,        // number, defaults to 65
 *     lifeExpectancy,       // number, defaults to 90
 *     currentNetWorth,      // number USD (optional) — for gap + % to target
 *   }
 *
 * OUTPUT
 *   Ready-to-render dashboard summary. See return value at the bottom.
 */

import {
  CITIES, CITY_LIFE, REAL_ESTATE, DENSITY_TIERS,
  LIFESTYLES, LIFESTYLE_TIERS, LIFESTYLE_TABLE, LIFESTYLE_TYPES, LIFESTYLE_BASELINES,
  FINANCIAL_SECURITY_TIERS, INVESTMENT_TIERS,
} from './data.js'

// ── Tuning constants ────────────────────────────────────────────────
// One place to update as the market moves — no data-row edits needed.

/**
 * Mortgage assumptions used to compute the shelter envelope's annual
 * payment. 20% down / 25-year amort / 6.5% fixed is a mid-2026 baseline
 * that lands roughly between CA and US norms.
 */
export const MORTGAGE_ASSUMPTIONS = {
  downPaymentPct:  0.20,
  amortizationYrs: 25,
  annualRate:      0.065,
}

/**
 * Annual home upkeep as a share of home price. Layered onto property
 * tax + city utilities so the ongoing carry line stays honest both
 * during amortization years and after payoff. 1% is the industry rule of
 * thumb; nudge up for older / bigger homes.
 */
export const MAINTENANCE_RATE = 0.010

// ── Financial primitives ────────────────────────────────────────────

/** Present value of a level annuity paying `annual` for `years` at `rate`. */
export function annuityPV(annual, years, rate) {
  const c = Number(annual) || 0
  const n = Number(years)  || 0
  const r = Number(rate)   || 0
  if (c <= 0 || n <= 0) return 0
  if (r === 0)          return c * n
  return c * (1 - Math.pow(1 + r, -n)) / r
}

/**
 * Annual payment on a fully-amortizing fixed-rate loan of `principal` at
 * `annualRate` over `amortizationYrs`. Standard monthly-compounding
 * mortgage formula, then × 12 to annualize. Returns 0 for a zero-dollar
 * loan (so pass-through works for own_ideal / prefer_rent).
 */
export function annualMortgagePayment(
  principal,
  annualRate      = MORTGAGE_ASSUMPTIONS.annualRate,
  amortizationYrs = MORTGAGE_ASSUMPTIONS.amortizationYrs,
) {
  const P = Number(principal) || 0
  if (P <= 0) return 0
  const r = (Number(annualRate) || 0) / 12
  const n = (Number(amortizationYrs) || 0) * 12
  if (n <= 0) return 0
  if (r === 0) return (P / n) * 12
  const monthly = (P * r) / (1 - Math.pow(1 + r, -n))
  return monthly * 12
}

// ── Lookups ─────────────────────────────────────────────────────────

function requireRow(rows, predicate, label) {
  const hit = rows.find(predicate)
  if (!hit) throw new Error(`[trueNumberV2] no ${label} match`)
  return hit
}

// ── Component builders ──────────────────────────────────────────────

/**
 * Base necessities pulled straight from cityLife. cityLife.utilities
 * covers day-to-day utility bills; city.utilities is treated separately as
 * the home-attached utility bundle (see homeCarry below). If your data
 * ends up merging the two, drop one to avoid a double-count.
 */
function computeNecessities(cityLife) {
  const food      = Number(cityLife.food)      || 0
  const transport = Number(cityLife.transport) || 0
  const utilities = Number(cityLife.utilities) || 0
  const annual = food + transport + utilities
  return { annual, food, transport, utilities }
}

/**
 * Shelter cost model — see the file header ("lifetime housing envelope")
 * for the rationale. Mode names match the Wizard's housingSituation ids:
 *
 *   need_home   → envelope on full price · lump = down-payment on full price · full carry
 *   upgrade     → envelope on delta only · lump = down-payment on delta only · full carry (new home)
 *   own_ideal   → no envelope (no debt or renovation stream) · no lump · full carry
 *   prefer_rent → rent annual only · no lump · no separate carry (rent bundles it)
 *
 * Returns totalAnnual = envelope + carry, plus each line broken out so
 * the dashboard can show a legible "why is this number this?" popover.
 */
function computeShelter(city, realEstate, mode, currentHomeValue = 0) {
  const price = Number(realEstate.amountPrice) || 0

  if (mode === 'prefer_rent') {
    const priceToRent = Number(city.priceToRent) || 1
    const annualRent  = price / priceToRent
    return {
      mode,
      envelopeAnnual: annualRent,
      carryAnnual:    0,
      totalAnnual:    annualRent,
      lumpSum:        0,
      referencePrice: price,
      notes: `Rent = price ÷ priceToRent (${priceToRent}) — carry bundled in rent`,
    }
  }

  // Every owner mode shares the same lifelong carry line.
  const propertyTaxAnnual = price * (Number(city.propertyTax) || 0)
  const cityUtilities     = Number(city.utilities) || 0
  const maintenanceAnnual = price * MAINTENANCE_RATE
  const carryAnnual = propertyTaxAnnual + cityUtilities + maintenanceAnnual

  if (mode === 'own_ideal') {
    return {
      mode,
      envelopeAnnual: 0,
      carryAnnual,
      totalAnnual:    carryAnnual,
      lumpSum:        0,
      referencePrice: price,
      financeableBase: 0,
      loanPrincipal:   0,
      propertyTaxAnnual, cityUtilities, maintenanceAnnual,
      notes: 'Already own the ideal home — carry only, no debt or renovation envelope.',
    }
  }

  // need_home + upgrade: envelope on the financeable base.
  //   need_home → full price
  //   upgrade   → new price − user's current home equity (capped at 0)
  const financeableBase = mode === 'upgrade'
    ? Math.max(0, price - (Number(currentHomeValue) || 0))
    : price
  const downPayment    = financeableBase * MORTGAGE_ASSUMPTIONS.downPaymentPct
  const loanPrincipal  = financeableBase - downPayment
  const envelopeAnnual = annualMortgagePayment(loanPrincipal)

  return {
    mode,
    envelopeAnnual,
    carryAnnual,
    totalAnnual:    envelopeAnnual + carryAnnual,
    lumpSum:        downPayment,
    referencePrice: price,
    financeableBase,
    loanPrincipal,
    propertyTaxAnnual, cityUtilities, maintenanceAnnual,
    notes: mode === 'upgrade'
      ? `Envelope on delta (${price} − ${currentHomeValue}); carry on new home value.`
      : 'Envelope on full price; carry on full home value.',
  }
}

/**
 * Discretionary spend for the chosen lifestyle types in the chosen city,
 * scaled by the user's intensity tier. Resolved per category, in order:
 *
 *   1. activities — LIFESTYLES rows for this city × category (amount ×
 *      frequency; per-activity LIFESTYLE_TABLE overrides win when present)
 *   2. baseline   — LIFESTYLE_BASELINES[country × category] × city.lifestyleIndex
 *                   (index defaults to 1.00). Flagged as estimated.
 *   3. none       — no data at all → $0, flagged as estimated.
 */
function computeDiscretionary(city, lifestyleTypeIds, lifestyleTier) {
  const overridesByActivity = new Map(
    LIFESTYLE_TABLE.map((o) => [`${o.lifestyleActivityId}:${o.lifestyleTierId}`, o]),
  )
  const index = Number(city.lifestyleIndex) > 0 ? Number(city.lifestyleIndex) : 1
  const breakdown = []
  const estimatedCategories = []
  let base = 0
  let activitiesConsidered = 0

  for (const typeId of new Set(lifestyleTypeIds || [])) {
    const category = LIFESTYLE_TYPES.find((t) => t.id === typeId)?.category ?? null
    const rows = LIFESTYLES.filter((a) => a.cityId === city.id && a.lifestyleTypeId === typeId)

    if (rows.length > 0) {
      for (const a of rows) {
        const override = overridesByActivity.get(`${a.id}:${lifestyleTier.lifestyleTiers}`)
        const perOccurrence = override ? Number(override.lifestyleBudget) : Number(a.amount)
        const annualForRow = perOccurrence * (Number(a.frequency) || 0)
        base += annualForRow
        activitiesConsidered += 1
        breakdown.push({
          activity: a.activity, category, source: 'activities',
          perOccurrence, frequency: a.frequency, annual: annualForRow, overridden: !!override,
        })
      }
      continue
    }

    const baseline = LIFESTYLE_BASELINES.find(
      (b) => b.country === city.country && b.lifestyleTypeId === typeId,
    )
    const annualForRow = baseline ? Number(baseline.annualAmount) * index : 0
    base += annualForRow
    estimatedCategories.push(category)
    breakdown.push({
      activity: `${category} (${baseline ? `${city.country} baseline × ${index}` : 'no data'})`,
      category, source: baseline ? 'baseline' : 'none',
      perOccurrence: null, frequency: null, annual: annualForRow, overridden: false,
    })
  }

  const multiple = Number(lifestyleTier.multiple) || 1
  return {
    annual: base * multiple,
    baseAnnual: base,
    tier: lifestyleTier.intensityTier,
    tierMultiplier: multiple,
    lifestyleIndex: index,
    activitiesConsidered,
    estimatedCategories,
    breakdown,
  }
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * @param {object} input   See file header for shape.
 * @returns {object}       Dashboard-ready v2 summary.
 */
export function computeTrueNumberV2(input) {
  const {
    cityId, densityTierId, financialTier, investmentApproach, lifestyleTier,
    lifestyleTypeIds = [1, 2, 3, 4, 5],
    housingMode = 'need_home',
    currentHomeValue = 0,
    currentAge, retirementAge = 65, lifeExpectancy = 90,
    currentNetWorth = 0,
  } = input

  // Reference-table lookups (throw early if the caller passed a bad id).
  const city         = requireRow(CITIES,                    (c) => c.id === cityId, 'city')
  const cityLife     = requireRow(CITY_LIFE,                 (r) => r.cityId === cityId, 'cityLife')
  const realEstate   = requireRow(REAL_ESTATE,               (r) => r.cityId === cityId && r.densityTierId === densityTierId, 'realEstate (city + density)')
  const density      = requireRow(DENSITY_TIERS,             (d) => d.id === densityTierId, 'densityTier')
  const securityRow  = requireRow(FINANCIAL_SECURITY_TIERS,  (s) => s.financialTier === financialTier, 'financialSecurityTier')
  const investRow    = requireRow(INVESTMENT_TIERS,          (i) => i.investApproach === investmentApproach, 'investmentTier')
  const lifestyleRow = requireRow(LIFESTYLE_TIERS,           (l) => l.intensityTier === lifestyleTier, 'lifestyleTier')

  // Component annuals.
  const necessities  = computeNecessities(cityLife)
  const shelter      = computeShelter(city, realEstate, housingMode, currentHomeValue)
  const discretion   = computeDiscretionary(city, lifestyleTypeIds, lifestyleRow)

  // Blend + apply the security multiplier over the whole envelope. The
  // multiplier is applied AFTER shelter because "abundant" security means
  // more room to enjoy — not that property tax goes up.
  const preTierAnnual   = necessities.annual + shelter.totalAnnual + discretion.annual
  const securityMult    = Number(securityRow.multiple) || 1
  const scaledAnnual    = preTierAnnual * securityMult

  // NPV to today's dollars over the remaining lifespan.
  const rate    = Number(investRow.workToInvest) || 0.05
  const years   = Math.max(0, lifeExpectancy - currentAge)
  const spendingPV = annuityPV(scaledAnnual, years, rate)

  // Down-payment lump lands on top of the NPV. Zero for own_ideal (no
  // purchase) and prefer_rent (no ownership), so unconditional add is safe.
  const trueNumber = spendingPV + shelter.lumpSum

  const gap = Math.max(0, trueNumber - currentNetWorth)
  const percentToTarget = trueNumber > 0
    ? Math.min(1, Math.max(0, currentNetWorth / trueNumber))
    : 0

  return {
    // Headline
    trueNumber:       Math.round(trueNumber),
    currentNetWorth:  Math.round(currentNetWorth),
    gap:              Math.round(gap),
    percentToTarget,

    // True when any lifestyle category fell back to a country baseline (or
    // had no data at all) — drives the "estimated" badge in comparisons.
    isEstimated:          discretion.estimatedCategories.length > 0,
    estimatedCategories:  discretion.estimatedCategories,

    // What it costs to live this life for one year at today's prices
    annualSpending:   Math.round(scaledAnnual),
    monthlySpending:  Math.round(scaledAnnual / 12),

    // Component breakdown — perfect for a "why is this number what it is?"
    // popover or a Compare Cities table.
    components: {
      necessities,
      shelter,
      discretion,
      securityMultiplier: securityMult,
      preTierAnnual: Math.round(preTierAnnual),
    },

    // Every input the calc took — makes it easy to diff runs.
    assumptions: {
      city:          { id: city.id, name: city.name, country: city.country, state: city.state },
      density:       density.densityTier,
      housingMode:   shelter.mode,
      currentHomeValue: currentHomeValue || null,
      mortgage: {
        downPaymentPct:  MORTGAGE_ASSUMPTIONS.downPaymentPct,
        amortizationYrs: MORTGAGE_ASSUMPTIONS.amortizationYrs,
        annualRate:      MORTGAGE_ASSUMPTIONS.annualRate,
        maintenanceRate: MAINTENANCE_RATE,
      },
      financialTier: securityRow.financialTier,
      investmentApproach: investRow.investApproach,
      discountRate:  rate,
      lifestyleTier: lifestyleRow.intensityTier,
      lifestyleTypeIds,
      currentAge,
      retirementAge,
      lifeExpectancy,
      yearsProjected: years,
    },
  }
}
