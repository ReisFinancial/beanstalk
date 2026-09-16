/**
 * Runnable example — verifies the v2 pipeline end-to-end on one persona
 * per housing mode. Kept out of the main app; run with:
 *
 *   node src/experimental/schema-v2/example.js
 *
 * Or import into a scratch UI to see the numbers live.
 */

import { computeTrueNumberV2 } from './trueNumberV2.js'

const personas = [
  {
    name: "Toronto suburban first buyer  (need_home · comfortable · balanced)",
    input: {
      cityId: 1, densityTierId: 2,
      housingMode: 'need_home',
      financialTier: 'comfortable',
      investmentApproach: 'balanced',
      lifestyleTier: 'balanced',
      lifestyleTypeIds: [1, 2, 5],       // active + social + culture
      currentAge: 35, currentNetWorth: 180000,
    },
  },
  {
    name: "Vancouver urban upgrader     (upgrade · abundant · ambitious)",
    input: {
      cityId: 2, densityTierId: 1,
      housingMode: 'upgrade',
      currentHomeValue: 850000,          // trading up from an $850k condo
      financialTier: 'abundant',
      investmentApproach: 'ambitious',
      lifestyleTier: 'high',
      lifestyleTypeIds: [1, 2, 3, 4, 5], // everything
      currentAge: 46, currentNetWorth: 1200000,
    },
  },
  {
    name: "Halifax rural — already home  (own_ideal · basic · conservative)",
    input: {
      cityId: 3, densityTierId: 3,
      housingMode: 'own_ideal',
      financialTier: 'basic',
      investmentApproach: 'conservative',
      lifestyleTier: 'quiet',
      lifestyleTypeIds: [1, 5],          // active + culture
      currentAge: 58, currentNetWorth: 620000,
    },
  },
  {
    name: "Austin urban renter          (prefer_rent · comfortable · balanced)",
    input: {
      cityId: 4, densityTierId: 1,
      housingMode: 'prefer_rent',
      financialTier: 'comfortable',
      investmentApproach: 'balanced',
      lifestyleTier: 'balanced',
      lifestyleTypeIds: [1, 2],          // active + social
      currentAge: 29, currentNetWorth: 55000,
    },
  },
]

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

for (const p of personas) {
  const r = computeTrueNumberV2(p.input)
  const s = r.components.shelter
  console.log(`\n=== ${p.name} ===`)
  console.log(`True Number:        ${fmt(r.trueNumber)}`)
  console.log(`Annual spending:    ${fmt(r.annualSpending)}  (${fmt(r.monthlySpending)}/mo)`)
  console.log(`Current net worth:  ${fmt(r.currentNetWorth)}   →   Gap ${fmt(r.gap)}   (${(r.percentToTarget * 100).toFixed(1)}% of target)`)
  console.log('Breakdown:')
  console.log(`  Necessities        ${fmt(r.components.necessities.annual)}`)
  console.log(`  Shelter (${s.mode})`)
  console.log(`     envelope        ${fmt(s.envelopeAnnual)}` + (s.loanPrincipal ? `   (mortgage-equiv on ${fmt(s.loanPrincipal)} loan)` : ''))
  console.log(`     carry           ${fmt(s.carryAnnual)}` + (s.propertyTaxAnnual != null ? `   (tax ${fmt(s.propertyTaxAnnual)} + util ${fmt(s.cityUtilities)} + maint ${fmt(s.maintenanceAnnual)})` : ''))
  if (s.lumpSum) console.log(`     down payment    ${fmt(s.lumpSum)}   (on top of the annuity NPV)`)
  console.log(`  Discretion         ${fmt(r.components.discretion.annual)}   (${r.components.discretion.tier} × ${r.components.discretion.tierMultiplier} over ${r.components.discretion.activitiesConsidered} activities)`)
  console.log(`  × security         ${r.components.securityMultiplier}`)
  console.log(`Discount rate:      ${(r.assumptions.discountRate * 100).toFixed(1)}%   ·   Years projected: ${r.assumptions.yearsProjected}`)
}
