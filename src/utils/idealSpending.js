/**
 * Ideal-spending estimator.
 *
 * Turns the qualitative wizard answers (home + lifestyle + financial goals,
 * plus personal country/region) into an annual dollar figure for the user's
 * ideal lifestyle, broken into 50/30/20 buckets (needs + wants + savings).
 *
 * The True Number only funds needs + wants (the 80% the user must spend
 * from wealth once income stops); the 20% savings is the *engine* that
 * builds toward the True Number, not spending we need to project.
 *
 * All figures are USD by default so comparisons across US/CA cities line
 * up. Everything is a pure function of the profile input — no side
 * effects, no localStorage reads, safe to call from anywhere.
 */
import { findMarket, searchMarkets } from '../data/realEstateMarkets.js'

// ── Tuning constants ────────────────────────────────────────────────
// These live in one place so we can trace every dollar back to a lever
// and swap in real data sources without touching the pipeline.

/** Fallback purchase price when the user hasn't picked a market. */
const NATIONAL_MEDIAN_USD = { US: 420000, CA: 430000 }

/** Fallback monthly rent when a chosen market has no rent data. */
const NATIONAL_MEDIAN_RENT_USD = { US: 1750, CA: 1550 }

/**
 * Annual carrying cost as a share of home price. Covers property tax,
 * insurance, and maintenance for owned homes, plus a modest reserve.
 * The user might have a mortgage that raises this, but for True Number
 * math we want steady-state ongoing cost.
 */
const HOME_CARRY_RATE = 0.05

/** Home-type multipliers relative to the median mixed-type market home. */
const HOME_TYPE_MULTIPLIER = {
  Detached:  1.00,
  Bungalow:  0.85,
  Townhouse: 0.75,
  Condo:     0.60,
  Apartment: 0.50,
  Other:     1.00,
}
const DEFAULT_HOME_TYPE_MULTIPLIER = 1.00

/**
 * Bedroom multipliers assuming the market median represents ~3 beds.
 * Users are asked their ideal bed count in the wizard.
 */
function bedsMultiplier(beds) {
  const n = Number(beds)
  if (!Number.isFinite(n) || n <= 0) return 1.0
  if (n === 1) return 0.55
  if (n === 2) return 0.75
  if (n === 3) return 1.00
  if (n === 4) return 1.25
  return 1.5 // 5+ beds
}

/**
 * Density tier scales cost-of-living for non-housing items. Serves as
 * our proxy for a real cost-of-living index (which the source dataset
 * doesn't include yet).
 */
const DENSITY_COL_MULTIPLIER = {
  'Dense Urban Core': 1.35,
  'Urban':            1.15,
  'Suburban Metro':   1.00,
  'Smaller Metro':    0.90,
  'Small City':       0.85,
}
const DEFAULT_DENSITY_MULTIPLIER = 1.00

/**
 * How the user's target financial-security level flexes both needs and
 * wants. "Basic" is bills-covered, "Abundant" is generous-and-generational.
 */
const SECURITY_MULTIPLIER = {
  basic:       1.00,
  comfortable: 1.25,
  abundant:    1.60,
}
const DEFAULT_SECURITY = 'comfortable'

/**
 * Retirement-lifestyle modifier — applied by Chunk 3's NPV math to the
 * retirement-phase spending, not to spending today. Included here so the
 * estimator's output carries the multiplier alongside the numbers.
 */
const RETIREMENT_MULTIPLIER = {
  modest:   0.70,
  same:     1.00,
  upgraded: 1.30,
}
const DEFAULT_RETIREMENT = 'same'

/**
 * Real (post-inflation) discount rates used by Chunk 3 to compute the
 * True Number's NPV. Exposed here so the estimator can carry the value
 * derived from the user's stated investment approach.
 */
const DISCOUNT_RATE = {
  conservative: 0.03,
  balanced:     0.05,
  ambitious:    0.07,
}
const DEFAULT_INVESTMENT_APPROACH = 'balanced'

/** Base necessities floor per country — food, utilities, transport, healthcare. */
const BASE_NECESSITIES_USD = { US: 18000, CA: 16000 }

/** Social-intensity annual base (USD, before density and security scaling). */
const SOCIAL_BASE_USD = {
  quiet:    2000,
  balanced: 5000,
  high:     12000,
}

/** Per-vacation cost baseline (USD, before density and security scaling). */
const VACATION_UNIT_COST_USD = 2500

/** Hobbies annual base (USD). A future v2 can parse the free-text field
 *  for expensive keywords (skiing, golf, etc.) and scale up. */
const HOBBIES_BASE_USD = 2500

/** Default lifestyle assumptions when no lifestyle goal exists. */
const LIFESTYLE_DEFAULTS = {
  vacationsPerYear: 2,
  socialIntensity:  'balanced',
  hobbies:          '',
}


// ── Utilities ────────────────────────────────────────────────────────

const round100 = (n) => Math.round((Number(n) || 0) / 100) * 100

/**
 * Find the first goal of a given category in profile.goals.
 * Returns null when the user hasn't set one.
 */
function firstGoalByCategory(profile, category) {
  const goals = profile?.goals || []
  return goals.find((g) => g?.category === category) || null
}

/**
 * Look up a market from the goal's homeLocation. Handles two cases:
 *   1) The user picked a market from a future dropdown — homeLocation
 *      is a slug like 'toronto' or 'austin-tx'.
 *   2) The user typed free text ("Austin", "Vancouver BC") — we
 *      substring-search the market names and take the top hit.
 * Returns null when nothing plausible matches; the caller falls back
 * to the national median.
 */
function resolveMarketFromGoal(homeGoal) {
  if (!homeGoal) return null
  const raw = (homeGoal.homeLocation || '').toString().trim()
  if (!raw) return null
  // Try slug lookup first — cheapest and unambiguous.
  const bySlug = findMarket(raw.toLowerCase())
  if (bySlug) return bySlug
  // Otherwise search by name/state/region substring; top hit wins.
  const hits = searchMarkets(raw, 1)
  return hits[0] || null
}


// ── Individual spending components ──────────────────────────────────

/** Annual cost of owning + maintaining the user's ideal home. */
function computeHomeCost(homeGoal, market, country) {
  const typeMultiplier =
    HOME_TYPE_MULTIPLIER[homeGoal?.homeType] ?? DEFAULT_HOME_TYPE_MULTIPLIER
  const bedsMult = bedsMultiplier(homeGoal?.homeBeds)

  let basePriceUsd
  let source

  if (market && Number.isFinite(market.medianPriceUsd) && market.medianPriceUsd > 0) {
    basePriceUsd = market.medianPriceUsd
    source = `${market.name} median (${market.priceSource || 'unknown source'})`
  } else {
    basePriceUsd = NATIONAL_MEDIAN_USD[country] || NATIONAL_MEDIAN_USD.US
    source = `National ${country || 'US'} median (fallback)`
  }

  const adjustedPrice = basePriceUsd * typeMultiplier * bedsMult
  const annual = adjustedPrice * HOME_CARRY_RATE

  return {
    annual: round100(annual),
    monthly: round100(annual / 12),
    homePriceUsd: round100(adjustedPrice),
    source,
    typeMultiplier,
    bedsMultiplier: bedsMult,
    carryRate: HOME_CARRY_RATE,
  }
}

/** Annual base necessities — food, utilities, transport, healthcare. */
function computeBaseNecessities(country, densityTier, security) {
  const base = BASE_NECESSITIES_USD[country] || BASE_NECESSITIES_USD.US
  const colMult = DENSITY_COL_MULTIPLIER[densityTier] ?? DEFAULT_DENSITY_MULTIPLIER
  const secMult = SECURITY_MULTIPLIER[security] ?? SECURITY_MULTIPLIER[DEFAULT_SECURITY]
  const annual = base * colMult * secMult
  return {
    annual: round100(annual),
    monthly: round100(annual / 12),
    source: `${country || 'US'} baseline × ${densityTier || 'default'} × ${security || DEFAULT_SECURITY} security`,
    baseUsd: base,
    colMultiplier: colMult,
    securityMultiplier: secMult,
  }
}

/** Annual vacation spend. */
function computeVacationsCost(lifestyleGoal, densityTier, security) {
  const per = Number(lifestyleGoal?.vacationsPerYear ?? LIFESTYLE_DEFAULTS.vacationsPerYear)
  const count = Number.isFinite(per) && per >= 0 ? per : LIFESTYLE_DEFAULTS.vacationsPerYear
  const colMult = DENSITY_COL_MULTIPLIER[densityTier] ?? DEFAULT_DENSITY_MULTIPLIER
  const secMult = SECURITY_MULTIPLIER[security] ?? SECURITY_MULTIPLIER[DEFAULT_SECURITY]
  const annual = count * VACATION_UNIT_COST_USD * colMult * secMult
  return {
    annual: round100(annual),
    monthly: round100(annual / 12),
    perVacation: round100(VACATION_UNIT_COST_USD * colMult * secMult),
    countPerYear: count,
    source: `${count} × ~$${round100(VACATION_UNIT_COST_USD * colMult * secMult)}/trip`,
  }
}

/** Annual social spend (dinners out, hosting, memberships). */
function computeSocialCost(lifestyleGoal, densityTier, security) {
  const intensity = lifestyleGoal?.socialIntensity || LIFESTYLE_DEFAULTS.socialIntensity
  const base = SOCIAL_BASE_USD[intensity] ?? SOCIAL_BASE_USD.balanced
  const colMult = DENSITY_COL_MULTIPLIER[densityTier] ?? DEFAULT_DENSITY_MULTIPLIER
  const secMult = SECURITY_MULTIPLIER[security] ?? SECURITY_MULTIPLIER[DEFAULT_SECURITY]
  const annual = base * colMult * secMult
  return {
    annual: round100(annual),
    monthly: round100(annual / 12),
    intensity,
    source: `${intensity} social × ${densityTier || 'default'} × ${security || DEFAULT_SECURITY} security`,
  }
}

/** Annual hobbies spend (flat baseline; scaled by security only for now). */
function computeHobbiesCost(lifestyleGoal, security) {
  // v1: no hobby-text parsing; every user with a lifestyle goal gets
  // the same baseline, scaled by financial security level. Later we
  // can key on words like "skiing", "golf", "collector" to scale up,
  // or weight by hobbyRanking position (top-ranked category paying more).
  // Accepts either the new hobbyRanking array or the legacy free-text
  // hobbies string so existing profiles keep computing the same cost.
  const hasHobbies = !!(
    lifestyleGoal && (
      (lifestyleGoal.hobbies || '').trim() ||
      (Array.isArray(lifestyleGoal.hobbyRanking) && lifestyleGoal.hobbyRanking.length > 0)
    )
  )
  const secMult = SECURITY_MULTIPLIER[security] ?? SECURITY_MULTIPLIER[DEFAULT_SECURITY]
  const annual = hasHobbies ? HOBBIES_BASE_USD * secMult : 0
  return {
    annual: round100(annual),
    monthly: round100(annual / 12),
    source: hasHobbies
      ? `Baseline hobbies × ${security || DEFAULT_SECURITY}`
      : 'No hobbies listed',
  }
}


// ── Public API ──────────────────────────────────────────────────────

/**
 * Estimate the user's ideal annual spending, broken into needs / wants
 * and their sub-lines. Handles missing goals with baseline defaults and
 * reports what fell back in the `gaps` array.
 *
 * @param {object} profile   Full PlannerContext profile (or a subset).
 * @param {object} [opts]    Optional overrides — { market } for the
 *                           Compare Cities feature, so Chunk 4 can force
 *                           a specific market without mutating the profile.
 * @returns {object}         Structured spending breakdown, ready for the
 *                           True Number NPV math in Chunk 3.
 */
export function estimateIdealSpending(profile, opts = {}) {
  const gaps = []

  // Resolve context — country, and the market we'll price housing in.
  const country = profile?.personal?.country || 'US'
  const homeGoal      = firstGoalByCategory(profile, 'home')
  const lifestyleGoal = firstGoalByCategory(profile, 'lifestyle')
  const financialGoal = firstGoalByCategory(profile, 'financial')

  if (!homeGoal)      gaps.push('No home goal set — using national median.')
  if (!lifestyleGoal) gaps.push('No lifestyle goal set — using balanced defaults.')
  if (!financialGoal) gaps.push('No financial goal set — using "comfortable" defaults.')

  const market =
    opts.market
      ?? resolveMarketFromGoal(homeGoal)

  // Financial-status inputs — with sensible defaults.
  const security   = financialGoal?.financialSecurity   || DEFAULT_SECURITY
  const retirement = financialGoal?.retirementLifestyle || DEFAULT_RETIREMENT
  const approach   = financialGoal?.investmentApproach  || DEFAULT_INVESTMENT_APPROACH

  const densityTier = market?.densityTier || 'Suburban Metro'

  const home            = computeHomeCost(homeGoal, market, country)
  const baseNecessities = computeBaseNecessities(country, densityTier, security)
  const vacations       = computeVacationsCost(lifestyleGoal, densityTier, security)
  const social          = computeSocialCost(lifestyleGoal, densityTier, security)
  const hobbies         = computeHobbiesCost(lifestyleGoal, security)

  const needsTotal = home.annual + baseNecessities.annual
  const wantsTotal = vacations.annual + social.annual + hobbies.annual
  const annualSpending = needsTotal + wantsTotal

  // Under 50/30/20, the user's *ideal income* would be needs+wants+savings.
  // We surface that too so the Dashboard can show "you need to earn X/yr"
  // alongside "you need to accumulate Y in wealth".
  const idealAnnualIncome = round100(annualSpending / 0.80)

  return {
    // Bucketed dollars
    needs: {
      home,
      baseNecessities,
      total: needsTotal,
    },
    wants: {
      vacations,
      social,
      hobbies,
      total: wantsTotal,
    },
    annualSpending: round100(annualSpending),
    monthlySpending: round100(annualSpending / 12),
    idealAnnualIncome,

    // Signals Chunk 3 (NPV math) reads directly
    retirementMultiplier: RETIREMENT_MULTIPLIER[retirement] ?? 1.0,
    discountRate:         DISCOUNT_RATE[approach]           ?? 0.05,

    // Provenance / debugging
    assumptions: {
      country,
      market: market ? { id: market.id, name: market.name, densityTier: market.densityTier } : null,
      security,
      retirement,
      investmentApproach: approach,
      homeType:  homeGoal?.homeType ?? null,
      homeBeds:  homeGoal?.homeBeds ?? null,
      homeBaths: homeGoal?.homeBaths ?? null,
      vacationsPerYear: lifestyleGoal?.vacationsPerYear ?? LIFESTYLE_DEFAULTS.vacationsPerYear,
      socialIntensity:  lifestyleGoal?.socialIntensity  ?? LIFESTYLE_DEFAULTS.socialIntensity,
      notes: 'needs+wants = 80% of ideal income under 50/30/20; the remaining 20% is the savings engine that builds toward the True Number, not spending we NPV.',
    },
    gaps,
  }
}

/**
 * Variant that forces a specific market — powers the Compare Cities
 * feature in Chunk 4 without touching the user's profile.
 *
 * @param {object} profile
 * @param {string} marketId  Slug like 'austin-tx' or 'toronto'.
 * @returns {object}         Same shape as estimateIdealSpending.
 */
export function estimateForMarket(profile, marketId) {
  const market = findMarket(marketId)
  return estimateIdealSpending(profile, { market })
}

/** Small helper exports so downstream code can reason about the assumptions. */
export const IDEAL_SPENDING_CONSTANTS = Object.freeze({
  HOME_TYPE_MULTIPLIER,
  DENSITY_COL_MULTIPLIER,
  SECURITY_MULTIPLIER,
  RETIREMENT_MULTIPLIER,
  DISCOUNT_RATE,
  BASE_NECESSITIES_USD,
  SOCIAL_BASE_USD,
  VACATION_UNIT_COST_USD,
  HOBBIES_BASE_USD,
  NATIONAL_MEDIAN_USD,
  NATIONAL_MEDIAN_RENT_USD,
  HOME_CARRY_RATE,
})
