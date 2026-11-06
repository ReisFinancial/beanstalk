/**
 * Run the same persona through every listed city. Powers the dashboard's
 * "Where else could you build this life?" card.
 */
import { computeTrueNumberV2 } from './trueNumberV2.js'
import { LISTED_CITIES } from './data.js'

/**
 * @param {object} input  A computeTrueNumberV2 input (e.g. from wizardToV2Input).
 * @returns {{ baseline: object, rows: object[] }}
 *   rows sorted by biggest True Number reduction vs the baseline city first.
 */
export function compareAllCities(input) {
  const baseline = computeTrueNumberV2(input)
  const rows = LISTED_CITIES
    .filter((c) => c.id !== input.cityId)
    .map((city) => {
      const r = computeTrueNumberV2({ ...input, cityId: city.id })
      const delta = baseline.trueNumber - r.trueNumber
      return {
        city,
        trueNumber: r.trueNumber,
        delta,
        pctReduction: baseline.trueNumber > 0 ? delta / baseline.trueNumber : 0,
      }
    })
    .sort((a, b) => b.pctReduction - a.pctReduction)
  return { baseline, rows }
}
