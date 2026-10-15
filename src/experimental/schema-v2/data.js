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
// Loaded from data/revised_city_costs.xlsx (Oct 2026). Working estimates,
// not a validated dataset — see that file's Methodology + Assumptions tabs.
// All dollars USD; Canadian rows converted at CAD_TO_USD below.
// medianPrice = suburban all-home median · priceToRent = price ÷ annual rent
// propertyTax as decimal · utilities = annual home utility bundle.

export const CAD_TO_USD = 0.70 // mid-market, Oct 14 2026

export const CITIES = [
  { id:   1, name: 'Toronto',                                  country: 'CA', state: 'ON',  region: 'GTA',              population:  2930000, medianPrice:  560000, priceToRent: 26.67, propertyTax: 0.0075, utilities: 4200 },
  { id:   2, name: 'Vancouver',                                country: 'CA', state: 'BC',  region: 'Lower Mainland',   population:   700000, medianPrice:  735000, priceToRent: 31.25, propertyTax:  0.003, utilities: 3650 },
  { id:   3, name: 'Halifax',                                  country: 'CA', state: 'NS',  region: 'Atlantic',         population:   440000, medianPrice:  385000, priceToRent: 24.12, propertyTax: 0.0077, utilities: 4650 },
  { id:   4, name: 'Austin',                                   country: 'US', state: 'TX',  region: 'Hill Country',     population:  1010000, medianPrice:  440000, priceToRent:  19.3, propertyTax:  0.016, utilities: 4250 },
  { id:   5, name: 'Denver-Aurora-Lakewood',                   country: 'US', state: 'CO',  region: 'Front Range',      population:  3000000, medianPrice:  550000, priceToRent: 21.83, propertyTax: 0.0055, utilities: 3700 },
  { id:   6, name: 'Riverside-San Bernardino-Ontario',         country: 'US', state: 'CA',  region: 'West',             population:  4700000, medianPrice:  555000, priceToRent: 20.11, propertyTax: 0.0075, utilities: 4050 },
  { id:   7, name: 'McAllen',                                  country: 'US', state: 'TX',  region: 'South',            population:   145000, medianPrice:  230000, priceToRent: 17.42, propertyTax:  0.018, utilities: 3850 },
  { id:   8, name: 'Minneapolis-St. Paul-Bloomington',         country: 'US', state: 'MN',  region: 'Midwest',          population:  3800000, medianPrice:  349900, priceToRent: 17.15, propertyTax:  0.011, utilities: 3900 },
  { id:   9, name: 'Billings',                                 country: 'US', state: 'MT',  region: 'Rockies',          population:   120000, medianPrice:  380000, priceToRent: 23.46, propertyTax:  0.008, utilities: 3650 },
  { id:  10, name: 'Boston-Cambridge-Newton',                  country: 'US', state: 'MA',  region: 'Northeast',        population:  5000000, medianPrice:  675000, priceToRent: 18.75, propertyTax:  0.011, utilities: 4650 },
  { id:  11, name: 'Boise',                                    country: 'US', state: 'ID',  region: 'Northeast',        population:   240000, medianPrice:  480000, priceToRent: 23.53, propertyTax:  0.006, utilities: 3300 },
  { id:  12, name: 'Calgary-Edmonton',                         country: 'CA', state: 'AB',  region: 'Prairies',         population:  3530000, medianPrice:  336000, priceToRent:  25.0, propertyTax: 0.0066, utilities: 4450 },
  { id:  13, name: 'Washington-Arlington-Alexandria',          country: 'US', state: 'DC',  region: 'South',            population:  6500000, medianPrice:  520000, priceToRent: 17.33, propertyTax: 0.0085, utilities: 4700 },
  { id:  14, name: 'Phoenix-Mesa-Chandler',                    country: 'US', state: 'AZ',  region: 'Southwest',        population:  5200000, medianPrice:  445000, priceToRent: 21.81, propertyTax:  0.006, utilities: 4350 },
  { id:  15, name: 'San Francisco-Oakland-Berkeley',           country: 'US', state: 'CA',  region: 'West',             population:  4600000, medianPrice:  930000, priceToRent: 23.48, propertyTax: 0.0075, utilities: 4700 },
  { id:  16, name: 'Chicago-Naperville-Elgin',                 country: 'US', state: 'IL',  region: 'Midwest',          population:  9400000, medianPrice:  313000, priceToRent: 13.04, propertyTax:  0.018, utilities: 4400 },
  { id:  17, name: 'Nashville-Davidson-Murfressboro-Franklin', country: 'US', state: 'TN',  region: 'South',            population:  2200000, medianPrice:  425000, priceToRent: 19.14, propertyTax: 0.0065, utilities: 3600 },
  { id:  18, name: 'El Paso',                                  country: 'US', state: 'TX',  region: 'South',            population:   680000, medianPrice:  220000, priceToRent: 17.46, propertyTax:  0.018, utilities: 3750 },
  { id:  19, name: 'Philadephia-Camden-Wilmington',            country: 'US', state: 'PA',  region: 'Northeast',        population:  6400000, medianPrice:  340000, priceToRent: 16.67, propertyTax:  0.013, utilities: 4550 },
  { id:  20, name: 'New Orleans-Metairie',                     country: 'US', state: 'LA',  region: 'South',            population:   970000, medianPrice:  300000, priceToRent: 16.67, propertyTax:  0.006, utilities: 4100 },
  { id:  21, name: 'Memphis',                                  country: 'US', state: 'TN',  region: 'South',            population:  1340000, medianPrice:  230000, priceToRent: 15.97, propertyTax:  0.011, utilities: 3550 },
  { id:  22, name: 'New York-Newark-Jersey City',              country: 'US', state: 'NYC', region: 'Northeast',        population: 19800000, medianPrice:  650000, priceToRent: 16.93, propertyTax:  0.014, utilities: 5300 },
  { id:  23, name: 'Montreal',                                 country: 'CA', state: 'QC',  region: 'East',             population:  4600000, medianPrice:  406000, priceToRent: 29.29, propertyTax: 0.0085, utilities: 3250 },
  { id:  24, name: 'Dallas-Fort Worth-Arlington',              country: 'US', state: 'TX',  region: 'South',            population:  8400000, medianPrice:  370000, priceToRent: 18.14, propertyTax:  0.018, utilities: 4050 },
  { id:  25, name: 'Houston-Pasadena-The Woodlands',           country: 'US', state: 'TX',  region: 'South',            population:  7800000, medianPrice:  315000, priceToRent: 15.91, propertyTax:  0.018, utilities: 4250 },
  { id:  26, name: 'Miami-Fort Lauderdale-West Palm Beach',    country: 'US', state: 'FL',  region: 'South',            population:  6300000, medianPrice:  475000, priceToRent: 15.22, propertyTax:  0.008, utilities: 4100 },
  { id:  27, name: 'Detroit-Warren-Dearborn',                  country: 'US', state: 'MI',  region: 'Great Lakes',      population:  4400000, medianPrice:  230000, priceToRent: 14.74, propertyTax:  0.014, utilities: 4000 },
  { id:  28, name: 'Seattle-Tacoma-Bellevue',                  country: 'US', state: 'WA',  region: 'Pacifc Northwest', population:  4100000, medianPrice:  635000, priceToRent: 21.17, propertyTax: 0.0095, utilities: 4200 },
  { id:  29, name: 'Tampa-St. Petersburg-Clearwater',          country: 'US', state: 'FL',  region: 'Gulf Coast',       population:  3500000, medianPrice:  345000, priceToRent: 15.13, propertyTax:  0.008, utilities: 3950 },
  { id:  30, name: 'San Diego-Chula Vista-Carlsbad',           country: 'US', state: 'CA',  region: 'Pacific',          population:  3300000, medianPrice:  875000, priceToRent: 25.14, propertyTax: 0.0075, utilities: 4200 },
  { id:  31, name: 'Orlando-Kissimmee-Sanford',                country: 'US', state: 'FL',  region: 'South',            population:  2900000, medianPrice:  375800, priceToRent:  17.4, propertyTax: 0.0085, utilities: 4000 },
  { id:  32, name: 'Baltimore-Columbia-Towson',                country: 'US', state: 'MD',  region: 'Atlantic',         population:  2900000, medianPrice:  360000, priceToRent: 17.64, propertyTax:   0.01, utilities: 4550 },
  { id:  33, name: 'Charlotte-Concord-Gastonia',               country: 'US', state: 'NC',  region: 'Carolinas',        population:  2900000, medianPrice:  375000, priceToRent: 18.38, propertyTax:  0.008, utilities: 3650 },
  { id:  34, name: 'St. Louis',                                country: 'US', state: 'MO',  region: 'Central',          population:  2800000, medianPrice:  235000, priceToRent: 15.06, propertyTax:   0.01, utilities: 3800 },
  { id:  35, name: 'San Antonio-New Braunfels',                country: 'US', state: 'TX',  region: 'South',            population:  2800000, medianPrice:  290000, priceToRent: 17.26, propertyTax:  0.017, utilities: 3900 },
  { id:  36, name: 'Las Vegas-Henderson',                      country: 'US', state: 'NV',  region: 'South',            population:  2400000, medianPrice:  415000, priceToRent: 20.34, propertyTax:  0.005, utilities: 3750 },
  { id:  37, name: 'Urban Honolulu',                           country: 'US', state: 'HI',  region: 'Pacific',          population:   988702, medianPrice:  750000, priceToRent: 29.76, propertyTax: 0.0025, utilities: 5050 },
  { id:  38, name: 'Anchorage',                                country: 'US', state: 'AK',  region: 'Northwest',        population:   405821, medianPrice:  400000, priceToRent: 20.83, propertyTax:  0.011, utilities: 5250 },
  { id:  39, name: 'Birmingham-Hoover',                        country: 'US', state: 'AL',  region: 'Southeast',        population:  1200000, medianPrice:  220000, priceToRent: 14.67, propertyTax: 0.0035, utilities: 3500 },
  { id:  40, name: 'Louisville/Jefferson County',              country: 'US', state: 'KY',  region: 'Midwest',          population:  1400000, medianPrice:  255000, priceToRent: 16.35, propertyTax:  0.008, utilities: 3700 },
]

// Base cost-of-living per city (annual USD). Food + transport are national
// placeholders (no city differentiation yet) converted from monthly figures.
export const CITY_LIFE = [
  { id:  1, cityId:  1, food:  6130, transport: 11530, utilities: 4200 },
  { id:  2, cityId:  2, food:  6130, transport: 11530, utilities: 3650 },
  { id:  3, cityId:  3, food:  6130, transport: 11530, utilities: 4650 },
  { id:  4, cityId:  4, food:  7140, transport: 11580, utilities: 4250 },
  { id:  5, cityId:  5, food:  7140, transport: 11580, utilities: 3700 },
  { id:  6, cityId:  6, food:  7140, transport: 11580, utilities: 4050 },
  { id:  7, cityId:  7, food:  7140, transport: 11580, utilities: 3850 },
  { id:  8, cityId:  8, food:  7140, transport: 11580, utilities: 3900 },
  { id:  9, cityId:  9, food:  7140, transport: 11580, utilities: 3650 },
  { id: 10, cityId: 10, food:  7140, transport: 11580, utilities: 4650 },
  { id: 11, cityId: 11, food:  7140, transport: 11580, utilities: 3300 },
  { id: 12, cityId: 12, food:  6130, transport: 11530, utilities: 4450 },
  { id: 13, cityId: 13, food:  7140, transport: 11580, utilities: 4700 },
  { id: 14, cityId: 14, food:  7140, transport: 11580, utilities: 4350 },
  { id: 15, cityId: 15, food:  7140, transport: 11580, utilities: 4700 },
  { id: 16, cityId: 16, food:  7140, transport: 11580, utilities: 4400 },
  { id: 17, cityId: 17, food:  7140, transport: 11580, utilities: 3600 },
  { id: 18, cityId: 18, food:  7140, transport: 11580, utilities: 3750 },
  { id: 19, cityId: 19, food:  7140, transport: 11580, utilities: 4550 },
  { id: 20, cityId: 20, food:  7140, transport: 11580, utilities: 4100 },
  { id: 21, cityId: 21, food:  7140, transport: 11580, utilities: 3550 },
  { id: 22, cityId: 22, food:  7140, transport: 11580, utilities: 5300 },
  { id: 23, cityId: 23, food:  6130, transport: 11530, utilities: 3250 },
  { id: 24, cityId: 24, food:  7140, transport: 11580, utilities: 4050 },
  { id: 25, cityId: 25, food:  7140, transport: 11580, utilities: 4250 },
  { id: 26, cityId: 26, food:  7140, transport: 11580, utilities: 4100 },
  { id: 27, cityId: 27, food:  7140, transport: 11580, utilities: 4000 },
  { id: 28, cityId: 28, food:  7140, transport: 11580, utilities: 4200 },
  { id: 29, cityId: 29, food:  7140, transport: 11580, utilities: 3950 },
  { id: 30, cityId: 30, food:  7140, transport: 11580, utilities: 4200 },
  { id: 31, cityId: 31, food:  7140, transport: 11580, utilities: 4000 },
  { id: 32, cityId: 32, food:  7140, transport: 11580, utilities: 4550 },
  { id: 33, cityId: 33, food:  7140, transport: 11580, utilities: 3650 },
  { id: 34, cityId: 34, food:  7140, transport: 11580, utilities: 3800 },
  { id: 35, cityId: 35, food:  7140, transport: 11580, utilities: 3900 },
  { id: 36, cityId: 36, food:  7140, transport: 11580, utilities: 3750 },
  { id: 37, cityId: 37, food:  7140, transport: 11580, utilities: 5050 },
  { id: 38, cityId: 38, food:  7140, transport: 11580, utilities: 5250 },
  { id: 39, cityId: 39, food:  7140, transport: 11580, utilities: 3500 },
  { id: 40, cityId: 40, food:  7140, transport: 11580, utilities: 3700 },
]

// Dwelling price by city × density, derived from each city's suburban
// medianPrice. Edit medianPrice (or the multipliers) and every row follows.
// To pin a real figure for one city + density, replace the generated row.
export const DENSITY_PRICE_MULTIPLIERS = { 1: 1.30, 2: 1.00, 3: 0.75 } // urban / suburbs / rural

export const REAL_ESTATE = CITIES.flatMap((c) =>
  DENSITY_TIERS.map((d) => ({
    id:            (c.id - 1) * DENSITY_TIERS.length + d.id,
    cityId:        c.id,
    densityTierId: d.id,
    amountPrice:   Math.round((c.medianPrice * DENSITY_PRICE_MULTIPLIERS[d.id]) / 1000) * 1000,
  })),
)

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

// Country-level fallback for discretionary spend — annual USD per category
// at the "balanced" tier. Used for any city × category with no activity rows
// in LIFESTYLES, scaled by the city's optional `lifestyleIndex` (1.00 =
// national average; omit on a city row to use 1.00). Loaded from
// data/lifestyle_baseline_template.csv — seed estimates, Oct 2026.
export const LIFESTYLE_BASELINES = [
  { country: 'US', lifestyleTypeId: 1, annualAmount: 1800 }, // active
  { country: 'US', lifestyleTypeId: 2, annualAmount: 4500 }, // social
  { country: 'US', lifestyleTypeId: 3, annualAmount: 3000 }, // luxury
  { country: 'US', lifestyleTypeId: 4, annualAmount:  900 }, // digital
  { country: 'US', lifestyleTypeId: 5, annualAmount: 1200 }, // culture
  { country: 'CA', lifestyleTypeId: 1, annualAmount: 1700 },
  { country: 'CA', lifestyleTypeId: 2, annualAmount: 4000 },
  { country: 'CA', lifestyleTypeId: 3, annualAmount: 2700 },
  { country: 'CA', lifestyleTypeId: 4, annualAmount:  850 },
  { country: 'CA', lifestyleTypeId: 5, annualAmount: 1100 },
]

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
