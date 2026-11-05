/**
 * Wizard profile → computeTrueNumberV2 input.
 *
 * Pure function. Reads the PlannerContext profile exactly as the wizard
 * leaves it and returns `{ input, defaultsUsed }`. `defaultsUsed` lists every
 * field that fell back to a default, so the dashboard can say "we assumed X —
 * change it" instead of silently guessing.
 *
 *   import { wizardToV2Input } from '…/wizardToV2Input.js'
 *   import { computeTrueNumberV2 } from '…/trueNumberV2.js'
 *   const { input, defaultsUsed } = wizardToV2Input(profile)
 *   const result = computeTrueNumberV2(input)
 */
import { ageFromPersonal } from '../../utils/age.js'
import { CITIES, CAD_TO_USD } from './data.js'
import { nationalAverageCityId } from './regions.js'

// ── Mappings ────────────────────────────────────────────────────────

const DENSITY_ID = { urban: 1, suburbs: 2, rural: 3 }
const DEFAULT_DENSITY_ID = 2

const HOUSING_MODES = new Set(['need_home', 'upgrade', 'own_ideal', 'prefer_rent'])

// Wizard Step 3 hobby ids → LIFESTYLE_TYPES ids.
const HOBBY_TO_LIFESTYLE_TYPE = { active: 1, social: 2, luxury: 3, digital: 4, culture: 5 }
const DEFAULT_HOBBY_ORDER = ['active', 'social', 'luxury', 'digital', 'culture']

/**
 * How many of the user's top-ranked hobby categories count toward their
 * lifestyle spend. Ranking orders all five, so we treat the top N as the
 * ones they'd actually spend on. Tunable.
 */
export const LIFESTYLE_CATEGORIES_COUNTED = 3

// Mirrors v1's liquid-wealth definition — real estate, vehicles and
// collectibles don't fund lifestyle spending.
const LIQUID_ASSET_SUBTYPES = new Set([
  'savings', 'investments', 'crypto', 'retirement', 'pension', 'stockOptions',
])

const firstGoal = (profile, category) =>
  (profile?.goals || []).find((g) => g?.category === category) || null

// ── Adapter ─────────────────────────────────────────────────────────

export function wizardToV2Input(profile) {
  const p = profile?.personal || {}
  const defaultsUsed = []
  const lifestyleGoal = firstGoal(profile, 'lifestyle')
  const financialGoal = firstGoal(profile, 'financial')

  // City — where they want to live; national average of their current
  // country when they haven't picked one.
  let cityId = Number(p.idealCityId)
  if (!CITIES.some((c) => c.id === cityId)) {
    cityId = nationalAverageCityId(p.country)
    defaultsUsed.push('idealCity')
  }

  // Housing
  let housingMode = p.housingSituation
  if (!HOUSING_MODES.has(housingMode)) {
    housingMode = 'need_home'
    defaultsUsed.push('housingSituation')
  }

  let densityTierId = DENSITY_ID[p.neighbourhoodType]
  if (!densityTierId) {
    densityTierId = DEFAULT_DENSITY_ID
    // Only a "default" when the wizard actually asked; renters and
    // already-ideal owners never see the neighbourhood question.
    if (housingMode === 'need_home' || housingMode === 'upgrade') defaultsUsed.push('neighbourhoodType')
  }

  // Current home value is entered in the user's current country's currency.
  let currentHomeValue = 0
  if (housingMode === 'upgrade') {
    const raw = Number(p.currentHomeValue) || 0
    currentHomeValue = p.country === 'CA' ? raw * CAD_TO_USD : raw
    if (raw <= 0) defaultsUsed.push('currentHomeValue')
  }

  // Lifestyle
  let lifestyleTier = lifestyleGoal?.socialIntensity
  if (!['quiet', 'balanced', 'high'].includes(lifestyleTier)) {
    lifestyleTier = 'balanced'
    defaultsUsed.push('socialIntensity')
  }

  const ranked = Array.isArray(lifestyleGoal?.hobbyRanking) && lifestyleGoal.hobbyRanking.length
    ? lifestyleGoal.hobbyRanking
    : (defaultsUsed.push('hobbyRanking'), DEFAULT_HOBBY_ORDER)
  const lifestyleTypeIds = ranked
    .map((h) => HOBBY_TO_LIFESTYLE_TYPE[h])
    .filter(Boolean)
    .slice(0, LIFESTYLE_CATEGORIES_COUNTED)

  // Financial
  let financialTier = financialGoal?.financialSecurity
  if (!['basic', 'comfortable', 'abundant'].includes(financialTier)) {
    financialTier = 'comfortable'
    defaultsUsed.push('financialSecurity')
  }
  let investmentApproach = financialGoal?.investmentApproach
  if (!['conservative', 'balanced', 'ambitious'].includes(investmentApproach)) {
    investmentApproach = 'balanced'
    defaultsUsed.push('investmentApproach')
  }

  // Age
  let currentAge = ageFromPersonal(p)
  if (currentAge == null) {
    currentAge = 35
    defaultsUsed.push('birthDate')
  }

  // Starting point — liquid net worth. Empty until the user adds figures
  // (MVP priority #3); not flagged as a default because it's genuinely 0.
  const liquid = (profile?.assets || [])
    .filter((a) => LIQUID_ASSET_SUBTYPES.has(a?.subtype))
    .reduce((s, a) => s + (Number(a?.amount) || 0), 0)
  const debts = (profile?.liabilities || [])
    .reduce((s, l) => s + (Number(l?.amount) || 0), 0)

  return {
    input: {
      cityId,
      densityTierId,
      housingMode,
      currentHomeValue,
      financialTier,
      investmentApproach,
      lifestyleTier,
      lifestyleTypeIds,
      currentAge: Math.floor(currentAge),
      currentNetWorth: liquid - debts,
    },
    defaultsUsed,
  }
}
