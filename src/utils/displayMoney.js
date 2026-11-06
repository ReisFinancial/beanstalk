import { CAD_TO_USD } from '../experimental/schema-v2/data.js'

/**
 * The True Number model runs in USD. Users think in their own currency, so
 * dashboard cards convert at display time. Returns a formatter that takes a
 * USD amount and renders it compactly in `currency` ($2.37M, $640k, $950).
 */
export function moneyFormatter(currency = 'USD') {
  const rate = currency === 'CAD' ? 1 / CAD_TO_USD : 1
  return (usd) => {
    const v = (Number(usd) || 0) * rate
    const abs = Math.abs(v)
    const sign = v < 0 ? '−' : ''
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
    if (abs >= 1_000)     return `${sign}$${Math.round(abs / 1_000)}k`
    return `${sign}$${Math.round(abs).toLocaleString()}`
  }
}

export function fmtYears(y) {
  const n = Number(y) || 0
  if (n < 1)   return `${Math.round(n * 12)} mo`
  if (n < 10)  return `${n.toFixed(1)} yr`
  if (n < 100) return `${Math.round(n)} yr`
  return '99+ yr'
}
