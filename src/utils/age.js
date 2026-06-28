/**
 * Age helpers — derive a precise (fractional) age from a birth month/year
 * pair so projections shift on the exact month the user has a birthday,
 * not on a static integer typed in at the start of the year.
 */

// Returns months elapsed since birth, or null when inputs are invalid.
export function monthsSinceBirth(year, month, now = new Date()) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isFinite(y) || y <= 0) return null
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  const elapsed =
    (now.getFullYear() - y) * 12 +
    (now.getMonth() + 1 - m)
  if (elapsed < 0) return null
  return elapsed
}

// Fractional age in years (e.g. 34.08). Returns null when inputs invalid.
export function computeCurrentAge(year, month, now = new Date()) {
  const elapsed = monthsSinceBirth(year, month, now)
  return elapsed == null ? null : elapsed / 12
}

// One-shot reader from profile.personal — uses birth date when present and
// falls back to the legacy numeric `age` field so older profiles still work.
export function ageFromPersonal(personal, now = new Date()) {
  if (!personal) return null
  const fromBirth = computeCurrentAge(personal.birthYear, personal.birthMonth, now)
  if (fromBirth != null) return fromBirth
  const legacy = Number(personal.age)
  if (Number.isFinite(legacy) && legacy > 0) return legacy
  return null
}

export const MONTH_NAMES = [
  'January', 'February', 'March',     'April',   'May',      'June',
  'July',    'August',   'September', 'October', 'November', 'December',
]
