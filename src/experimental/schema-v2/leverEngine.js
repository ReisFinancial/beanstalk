/**
 * Lever engine — measures what each single change would do to the user's
 * True Number and timeline. Plain code, no AI: every lever is a rerun of
 * computeTrueNumberV2 with one input changed.
 *
 *   const levers = computeLevers(input, { priorityRanking, defaultsUsed })
 *
 * Each lever:
 *   { id, category, title, detail,
 *     trueNumberDelta,   // USD the True Number drops by (0 for savings levers)
 *     yearsSaved,        // years sooner the user reaches it (null if unknown)
 *     newTrueNumber, newYears,
 *     status,            // 'fits' | 'tradeoff'
 *     reasons,           // why it's a trade-off (empty when it fits)
 *     youChose }         // the explicit answer this lever reverses, or null
 *
 * Ranking rules:
 *   • A lever is a TRADE-OFF when it works against one of the user's top-3
 *     Step 5 priorities (or adds investment risk). Trade-offs are shown,
 *     labelled with the reason, below the levers that fit.
 *   • Reversing an answer the user gave on purpose doesn't demote a lever —
 *     otherwise anyone who completes the wizard would see only trade-offs.
 *     It's surfaced as context instead ("You chose suburbs"). Answers we
 *     assumed don't count as choices.
 *   • Levers that don't apply to the user are never generated.
 *   • Only levers that lower the number or shorten the timeline are returned.
 *
 * The user's savings are held constant across every variant, so a lever's
 * timeline change reflects only the change in target — not an assumed income
 * that would shrink alongside spending.
 */
import { computeTrueNumberV2 } from './trueNumberV2.js'
import { LISTED_CITIES, CITIES, LIFESTYLE_TYPES, CAD_TO_USD } from './data.js'

const DENSITY_NAME = { 1: 'urban', 2: 'suburbs', 3: 'rural' }
const DENSITY_LEVER_TITLE = { 1: 'Look in an urban neighbourhood', 2: 'Look in the suburbs instead', 3: 'Look at rural homes instead' }
const LIFESTYLE_DOWN = { high: 'balanced', balanced: 'quiet' }
const SECURITY_DOWN = { abundant: 'comfortable', comfortable: 'basic' }
const INVEST_UP = { conservative: 'balanced', balanced: 'ambitious' }

// Which Step 5 priority each lever can work against.
const PRIORITY_REASON = {
  home:       'Trades against your priority "A home worth never leaving"',
  loved_ones: 'Could move you away from the people you love — your priority "Fully present for the ones I love"',
  lifestyle:  'Trades against your priority "A life without price tags"',
  wealth:     'Shrinks the cushion behind your priority "Wealth that outlasts me"',
}

/** Extra monthly savings tested by the savings lever, in the user's currency. */
export const EXTRA_SAVINGS_MONTHLY = 500

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const shortCity = (c) => c.name.split('-')[0]

export function computeLevers(input, { priorityRanking = [], defaultsUsed = [], displayCurrency = 'USD' } = {}) {
  const base = computeTrueNumberV2(input)
  const savings = base.savings.annualSavings
  const topPriorities = new Set((priorityRanking || []).slice(0, 3))
  const assumed = new Set(defaultsUsed)
  const chose = (field) => !assumed.has(field)
  const owning = input.housingMode === 'need_home' || input.housingMode === 'upgrade'

  const candidates = []
  const add = (lever) => candidates.push(lever)

  // ── Housing ───────────────────────────────────────────────────────
  if (owning) {
    for (const d of [1, 2, 3]) {
      if (d === input.densityTierId) continue
      add({
        id: `density_${DENSITY_NAME[d]}`, category: 'housing',
        title: DENSITY_LEVER_TITLE[d],
        detail: `Price your ideal home in a ${DENSITY_NAME[d] === 'suburbs' ? 'suburban' : DENSITY_NAME[d]} neighbourhood instead of ${DENSITY_NAME[input.densityTierId]}.`,
        patch: { densityTierId: d },
        reasons: [],
        youChose: chose('neighbourhoodType') ? `You chose ${DENSITY_NAME[input.densityTierId]}` : null,
      })
    }
    add({
      id: 'rent_instead', category: 'housing',
      title: 'Rent instead of buying',
      detail: 'Rent a comparable home and skip the down payment and mortgage.',
      patch: { housingMode: 'prefer_rent' },
      reasons: topPriorities.has('home') ? [PRIORITY_REASON.home] : [],
      youChose: chose('housingSituation') ? 'You chose to own' : null,
    })
  }
  if (input.housingMode === 'prefer_rent') {
    add({
      id: 'buy_instead', category: 'housing',
      title: 'Buy instead of renting',
      detail: 'Own a comparable home in the suburbs instead of renting.',
      patch: { housingMode: 'need_home', densityTierId: 2 },
      reasons: [],
      youChose: chose('housingSituation') ? 'You chose to rent' : null,
    })
  }

  // Cheapest listed city in the same country (moving countries is a much
  // bigger decision than a lever).
  const baseCity = CITIES.find((c) => c.id === input.cityId)
  let bestCity = null
  for (const c of LISTED_CITIES) {
    if (c.id === input.cityId || c.country !== baseCity?.country) continue
    const n = computeTrueNumberV2({ ...input, cityId: c.id, annualContributions: savings }).trueNumber
    if (!bestCity || n < bestCity.n) bestCity = { city: c, n }
  }
  if (bestCity) {
    add({
      id: 'cheaper_city', category: 'housing',
      title: `Build this life in ${shortCity(bestCity.city)}`,
      detail: `The same ideal life costs least in ${shortCity(bestCity.city)}, ${bestCity.city.state} among our ${baseCity.country === 'CA' ? 'Canadian' : 'US'} cities.`,
      patch: { cityId: bestCity.city.id },
      reasons: topPriorities.has('loved_ones') ? [PRIORITY_REASON.loved_ones] : [],
      youChose: chose('idealCity') && !baseCity.isNationalAverage ? `You chose ${shortCity(baseCity)}` : null,
    })
  }

  // ── Lifestyle ─────────────────────────────────────────────────────
  if (LIFESTYLE_DOWN[input.lifestyleTier]) {
    const next = LIFESTYLE_DOWN[input.lifestyleTier]
    add({
      id: 'lifestyle_calmer', category: 'lifestyle',
      title: `Dial lifestyle to ${next}`,
      detail: `Spend at a ${next} pace on the things you enjoy instead of ${input.lifestyleTier}.`,
      patch: { lifestyleTier: next },
      reasons: topPriorities.has('lifestyle') ? [PRIORITY_REASON.lifestyle] : [],
      youChose: chose('socialIntensity') ? `You chose ${input.lifestyleTier}` : null,
    })
  }
  if ((input.lifestyleTypeIds || []).length > 1) {
    const dropId = input.lifestyleTypeIds[input.lifestyleTypeIds.length - 1]
    const name = LIFESTYLE_TYPES.find((t) => t.id === dropId)?.category ?? 'one category'
    add({
      id: 'lifestyle_drop', category: 'lifestyle',
      title: `Let go of ${name}`,
      detail: `Drop ${name}, the lowest of your ranked lifestyle categories.`,
      patch: { lifestyleTypeIds: input.lifestyleTypeIds.slice(0, -1) },
      reasons: topPriorities.has('lifestyle') ? [PRIORITY_REASON.lifestyle] : [],
      youChose: chose('hobbyRanking') ? `You ranked ${name} #${input.lifestyleTypeIds.length}` : null,
    })
  }

  // ── Security & investing ──────────────────────────────────────────
  if (SECURITY_DOWN[input.financialTier]) {
    const next = SECURITY_DOWN[input.financialTier]
    add({
      id: 'security_down', category: 'security',
      title: `Aim for ${next} security`,
      detail: `Plan for ${next} financial security instead of ${input.financialTier} — less cushion on top of your ideal year.`,
      patch: { financialTier: next },
      reasons: topPriorities.has('wealth') ? [PRIORITY_REASON.wealth] : [],
      youChose: chose('financialSecurity') ? `You chose ${input.financialTier}` : null,
    })
  }
  if (INVEST_UP[input.investmentApproach]) {
    const next = INVEST_UP[input.investmentApproach]
    add({
      id: 'invest_up', category: 'investing',
      title: `Invest ${next === 'ambitious' ? 'more ambitiously' : 'for balance'}`,
      detail: `${next === 'ambitious' ? 'An' : 'A'} ${next} portfolio is expected to earn more than ${input.investmentApproach}, so you need less set aside.`,
      patch: { investmentApproach: next },
      // More expected return always means more risk — always a trade-off.
      reasons: ['Takes on more investment risk'],
      youChose: chose('investmentApproach') ? `You chose ${input.investmentApproach}` : null,
    })
  }

  // ── Measure ───────────────────────────────────────────────────────
  const measured = candidates.map((lever) => {
    const r = computeTrueNumberV2({ ...input, ...lever.patch, annualContributions: savings })
    return finish(lever, base, r)
  })

  // Savings — shortens the timeline only; the number itself doesn't move.
  const extraUsd = EXTRA_SAVINGS_MONTHLY * 12 * (displayCurrency === 'CAD' ? CAD_TO_USD : 1)
  const saved = computeTrueNumberV2({ ...input, annualContributions: savings + extraUsd })
  measured.push(finish({
    id: 'save_more', category: 'savings',
    title: `Put $${EXTRA_SAVINGS_MONTHLY} more a month toward your future`,
    detail: 'Every extra dollar invested now compounds toward your True Number.',
    reasons: [],
    youChose: null,
  }, base, saved))

  return measured
    .filter((l) => l.trueNumberDelta > 0 || (l.yearsSaved ?? 0) >= 0.5)
    .sort((a, b) =>
      (a.status === 'fits' ? 0 : 1) - (b.status === 'fits' ? 0 : 1)
      || b.trueNumberDelta - a.trueNumberDelta
      || (b.yearsSaved ?? 0) - (a.yearsSaved ?? 0))
}

function finish(lever, base, r) {
  const { patch, ...rest } = lever
  const yearsSaved = base.yearsToTarget != null && r.yearsToTarget != null
    ? Math.round((base.yearsToTarget - r.yearsToTarget) * 10) / 10
    : null
  return {
    ...rest,
    trueNumberDelta: Math.max(0, base.trueNumber - r.trueNumber),
    yearsSaved,
    newTrueNumber: r.trueNumber,
    newYears: r.yearsToTarget,
    status: lever.reasons.length ? 'tradeoff' : 'fits',
    title: cap(lever.title),
  }
}
