/**
 * Seed data for the v2 schema exported from the North America Residential
 * Real Estate Tracker. Kept intentionally separate from src/data/ so nothing
 * production reads it yet.
 *
 * All dollar amounts are USD (annual unless noted). Values are current-market
 * estimates for mid-2026 — treat as directional, not audited.
 */

// ── Reference tables (small enums) ────────────────────────────────────

export const DENSITY_TIERS = [
  { id: 1, densityTier: 'urban' },
  { id: 2, densityTier: 'suburbs' },
  { id: 3, densityTier: 'rural' },
]

export const LIFESTYLE_TYPES = [
  { id: 1, category: 'active' },
  { id: 2, category: 'social' },
  { id: 3, category: 'luxury' },
  { id: 4, category: 'digital' },
  { id: 5, category: 'culture' },
]

// Intensity multiplier applied to discretionary spend. Matches the
// quiet / balanced / high pattern from the wizard's Social Intensity.
export const LIFESTYLE_TIERS = [
  { lifestyleTiers: 1, intensityTier: 'quiet',    multiple: 0.60 },
  { lifestyleTiers: 2, intensityTier: 'balanced', multiple: 1.00 },
  { lifestyleTiers: 3, intensityTier: 'high',     multiple: 1.80 },
]

// Scales the whole annual spend up when the user wants more headroom.
// Labels match the wizard's SECURITY_LEVELS so the wizard→v2 adapter
// can pass them through untouched. Multipliers set aggressively at the
// top end so `abundant` reads as truly generational, not merely roomy.
export const FINANCIAL_SECURITY_TIERS = [
  { id: 1, financialTier: 'basic',       multiple: 1.10 },
  { id: 2, financialTier: 'comfortable', multiple: 1.60 },
  { id: 3, financialTier: 'abundant',    multiple: 3.50 },
]

// workToInvest is interpreted as the real (post-inflation) discount rate
// used to NPV lifetime spending. Stored as a string per the schema.
export const INVESTMENT_TIERS = [
  { id: 1, investApproach: 'conservative', workToInvest: '0.03' },
  { id: 2, investApproach: 'balanced',     workToInvest: '0.05' },
  { id: 3, investApproach: 'ambitious',    workToInvest: '0.07' },
]

// ── Cities ────────────────────────────────────────────────────────────
// priceToRent = median price / annual rent · propertyTax as decimal
// (e.g. 0.007 = 0.7%) · utilities is a per-city average annual home
// utility bundle (kept separate from cityLife.utilities for now — see
// note in trueNumberV2.js on the potential double-count).

export const CITIES = [
  { id: 1, name: 'Toronto',   country: 'CA', state: 'ON', region: 'GTA',            population: 2930000, priceToRent: 25, propertyTax: 0.0070, utilities: 3600 },
  { id: 2, name: 'Vancouver', country: 'CA', state: 'BC', region: 'Lower Mainland', population:  700000, priceToRent: 30, propertyTax: 0.0030, utilities: 2400 },
  { id: 3, name: 'Halifax',   country: 'CA', state: 'NS', region: 'Atlantic',       population:  440000, priceToRent: 22, propertyTax: 0.0120, utilities: 2800 },
  { id: 4, name: 'Austin',    country: 'US', state: 'TX', region: 'Hill Country',   population: 1010000, priceToRent: 20, propertyTax: 0.0180, utilities: 3000 },
  { id: 5, name: 'Denver',    country: 'US', state: 'CO', region: 'Front Range',    population:  715000, priceToRent: 21, propertyTax: 0.0055, utilities: 2900 },
]

// Base cost-of-living per city (annual USD).
export const CITY_LIFE = [
  { id: 1, cityId: 1, food: 5200, transport: 4800, utilities: 3600 },
  { id: 2, cityId: 2, food: 5400, transport: 4200, utilities: 2400 },
  { id: 3, cityId: 3, food: 4700, transport: 6900, utilities: 2800 },
  { id: 4, cityId: 4, food: 4900, transport: 8400, utilities: 3000 },
  { id: 5, cityId: 5, food: 5000, transport: 7800, utilities: 2900 },
]

// Median dwelling price by city × density.
export const REAL_ESTATE = [
  // Toronto
  { id:  1, cityId: 1, densityTierId: 1, amountPrice:  950000 },
  { id:  2, cityId: 1, densityTierId: 2, amountPrice:  720000 },
  { id:  3, cityId: 1, densityTierId: 3, amountPrice:  550000 },
  // Vancouver
  { id:  4, cityId: 2, densityTierId: 1, amountPrice: 1250000 },
  { id:  5, cityId: 2, densityTierId: 2, amountPrice:  950000 },
  { id:  6, cityId: 2, densityTierId: 3, amountPrice:  750000 },
  // Halifax
  { id:  7, cityId: 3, densityTierId: 1, amountPrice:  620000 },
  { id:  8, cityId: 3, densityTierId: 2, amountPrice:  480000 },
  { id:  9, cityId: 3, densityTierId: 3, amountPrice:  360000 },
  // Austin
  { id: 10, cityId: 4, densityTierId: 1, amountPrice:  680000 },
  { id: 11, cityId: 4, densityTierId: 2, amountPrice:  520000 },
  { id: 12, cityId: 4, densityTierId: 3, amountPrice:  380000 },
  // Denver
  { id: 13, cityId: 5, densityTierId: 1, amountPrice:  720000 },
  { id: 14, cityId: 5, densityTierId: 2, amountPrice:  560000 },
  { id: 15, cityId: 5, densityTierId: 3, amountPrice:  420000 },
]

// Discrete activities per city × lifestyleType. `amount` is per-occurrence
// USD; `frequency` is occurrences per year. Annual base = amount × frequency.
// A small seed — extend as datasets grow.
export const LIFESTYLES = [
  // Toronto — active
  { id:  1, cityId: 1, lifestyleTypeId: 1, activity: 'Ski weekend pass',   amount: 250, frequency:  6 },
  { id:  2, cityId: 1, lifestyleTypeId: 1, activity: 'Gym membership',     amount:  70, frequency: 12 },
  // Toronto — social
  { id:  3, cityId: 1, lifestyleTypeId: 2, activity: 'Dinner out',         amount:  85, frequency: 48 },
  { id:  4, cityId: 1, lifestyleTypeId: 2, activity: 'Concert / event',    amount: 120, frequency:  6 },
  // Toronto — culture
  { id:  5, cityId: 1, lifestyleTypeId: 5, activity: 'Theatre subscription', amount: 90, frequency: 8 },
  // Vancouver — active
  { id:  6, cityId: 2, lifestyleTypeId: 1, activity: 'Ski season pass',    amount: 1500, frequency: 1 },
  { id:  7, cityId: 2, lifestyleTypeId: 1, activity: 'Mountain biking',    amount:  60, frequency: 20 },
  // Vancouver — social
  { id:  8, cityId: 2, lifestyleTypeId: 2, activity: 'Dinner out',         amount:  90, frequency: 40 },
  // Austin — active
  { id:  9, cityId: 4, lifestyleTypeId: 1, activity: 'Kayak / paddle',     amount:  45, frequency: 24 },
  { id: 10, cityId: 4, lifestyleTypeId: 1, activity: 'Gym membership',     amount:  50, frequency: 12 },
  // Austin — social
  { id: 11, cityId: 4, lifestyleTypeId: 2, activity: '6th Street night',   amount:  95, frequency: 30 },
  { id: 12, cityId: 4, lifestyleTypeId: 2, activity: 'Live music show',    amount:  35, frequency: 24 },
  // Denver — active
  { id: 13, cityId: 5, lifestyleTypeId: 1, activity: 'Ski season pass',    amount: 900, frequency:  1 },
  { id: 14, cityId: 5, lifestyleTypeId: 1, activity: 'Hiking permits',     amount:  30, frequency: 20 },
  // Halifax — culture
  { id: 15, cityId: 3, lifestyleTypeId: 5, activity: 'Symphony season',    amount:  75, frequency:  6 },
  { id: 16, cityId: 3, lifestyleTypeId: 2, activity: 'Pub night',          amount:  55, frequency: 40 },
]

// Per-activity override: overrides the amount × frequency baseline for a
// specific tier. When present, use lifestyleBudget × frequency instead.
// Empty in v1 — the tier multiplier from LIFESTYLE_TIERS is used as the
// blanket fallback. Populate here to override specific rows later.
export const LIFESTYLE_TABLE = []

// Combination map — placeholder for a future v2 lookup that ties
// (security tier × invest tier) to a target multiple / savings-rate goal.
export const WEALTH_TABLE = [
  { id: 1, financialSecurityTiers: 1, investTierId: 1 },
  { id: 2, financialSecurityTiers: 1, investTierId: 2 },
  { id: 3, financialSecurityTiers: 1, investTierId: 3 },
  { id: 4, financialSecurityTiers: 2, investTierId: 1 },
  { id: 5, financialSecurityTiers: 2, investTierId: 2 },
  { id: 6, financialSecurityTiers: 2, investTierId: 3 },
  { id: 7, financialSecurityTiers: 3, investTierId: 1 },
  { id: 8, financialSecurityTiers: 3, investTierId: 2 },
  { id: 9, financialSecurityTiers: 3, investTierId: 3 },
]
