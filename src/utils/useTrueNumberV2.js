import { useMemo } from 'react'
import { computeTrueNumberV2 } from '../experimental/schema-v2/trueNumberV2.js'
import { wizardToV2Input } from '../experimental/schema-v2/wizardToV2Input.js'
import { moneyFormatter } from './displayMoney.js'

/**
 * One place that turns a profile into the True Number v2 result, shared by
 * the dashboard card and the "read more" page so they never disagree.
 *
 * Returns { input, defaultsUsed, displayCurrency, result, money, place }
 *   money — formatter: USD in, user's currency out
 *   place — friendly name for where the number is priced ("Toronto", "the US")
 */
export function useTrueNumberV2(profile) {
  return useMemo(() => {
    const mapped = wizardToV2Input(profile)
    const result = computeTrueNumberV2(mapped.input)
    const city = result.assumptions.city
    const place = result.isNationalAverage
      ? (city.country === 'CA' ? 'Canada' : 'the US')
      : city.name.split('-')[0]
    return { ...mapped, result, money: moneyFormatter(mapped.displayCurrency), place }
  }, [profile])
}
