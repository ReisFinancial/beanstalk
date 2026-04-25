/**
 * Six monoline illustrations representing the user's wealth level,
 * keyed off liquid net worth. Each is a single-color SVG using
 * stroke="currentColor", so they inherit color from the parent's
 * `text-*` Tailwind utility.
 *
 * Usage:
 *   <WealthMark amount={liquidNetWorth} className="h-20 w-28 text-olive-600" />
 *   <WealthLevel3 className="h-16 w-20 text-olive-600" />
 *
 * Thresholds (inclusive upper-bound matches user's stated ranges):
 *   Level 0: < $1,000             — chair & desk
 *   Level 1: $1,000 – $10,000     — shopping cart
 *   Level 2: $10,000 – $100,000   — car
 *   Level 3: $100,000 – $500,000  — house
 *   Level 4: $500,000 – $4M       — bigger house + neat property
 *   Level 5: $4M and above        — multi-floor mixed-use building
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function MarkWrap({ label, children, className = '', viewBox = '0 0 240 180', ...rest }) {
  return (
    <svg
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      className={className}
      {...rest}
    >
      <g {...STROKE}>{children}</g>
    </svg>
  )
}

// ─── Level 0 — Chair & desk ──────────────────────────────────────────
export function WealthLevel0(props) {
  return (
    <MarkWrap label="Wealth level 0 — chair and desk" {...props}>
      {/* Floor */}
      <path d="M 20 160 L 220 160" />
      {/* Chair: backrest, seat, front leg, back leg */}
      <path d="M 60 85 L 60 125" />
      <path d="M 55 125 L 100 125" />
      <path d="M 95 125 L 95 160" />
      <path d="M 60 125 L 60 160" />
      {/* Desk: top, two legs, drawer line, drawer handle */}
      <path d="M 120 100 L 220 100" />
      <path d="M 130 100 L 130 160" />
      <path d="M 210 100 L 210 160" />
      <path d="M 130 122 L 210 122" />
      <path d="M 165 134 L 180 134" />
    </MarkWrap>
  )
}

// ─── Level 1 — Shopping cart ─────────────────────────────────────────
export function WealthLevel1(props) {
  return (
    <MarkWrap label="Wealth level 1 — shopping cart" {...props}>
      {/* Floor */}
      <path d="M 20 160 L 220 160" />
      {/* Handle bar */}
      <path d="M 30 70 L 55 70" />
      {/* Diagonal connector down to back-top of basket */}
      <path d="M 55 70 L 78 96" />
      {/* Basket — trapezoid (top, right, bottom, left) */}
      <path d="M 75 95 L 200 95" />
      <path d="M 200 95 L 180 130" />
      <path d="M 180 130 L 95 130" />
      <path d="M 95 130 L 75 95" />
      {/* Wheel struts + wheels */}
      <path d="M 100 130 L 100 142" />
      <path d="M 175 130 L 175 142" />
      <circle cx="100" cy="150" r="9" />
      <circle cx="175" cy="150" r="9" />
    </MarkWrap>
  )
}

// ─── Level 2 — Car ───────────────────────────────────────────────────
export function WealthLevel2(props) {
  return (
    <MarkWrap label="Wealth level 2 — car" {...props}>
      {/* Floor */}
      <path d="M 20 160 L 220 160" />
      {/* Sedan silhouette: left bumper → hood → windshield → roof → rear → trunk → right bumper */}
      <path d="M 25 130 L 25 115 Q 28 105 45 105 L 75 105 L 95 75 L 150 75 L 170 105 L 200 105 Q 218 105 220 115 L 220 130" />
      {/* B-pillar (separates front and rear windows) */}
      <path d="M 122 75 L 122 105" />
      {/* Wheels */}
      <circle cx="65" cy="145" r="15" />
      <circle cx="180" cy="145" r="15" />
    </MarkWrap>
  )
}

// ─── Level 3 — House ─────────────────────────────────────────────────
export function WealthLevel3(props) {
  return (
    <MarkWrap label="Wealth level 3 — house" {...props}>
      {/* Floor */}
      <path d="M 20 160 L 220 160" />
      {/* Walls */}
      <path d="M 70 95 L 70 160" />
      <path d="M 170 95 L 170 160" />
      {/* Roof (with eaves overhang) */}
      <path d="M 60 95 L 120 50 L 180 95" />
      {/* Door */}
      <path d="M 110 160 L 110 130 L 130 130 L 130 160" />
      {/* Left window */}
      <path d="M 82 110 L 82 125 L 97 125 L 97 110 Z" />
      {/* Right window */}
      <path d="M 143 110 L 143 125 L 158 125 L 158 110 Z" />
    </MarkWrap>
  )
}

// ─── Level 4 — Bigger house with neat property ───────────────────────
export function WealthLevel4(props) {
  return (
    <MarkWrap label="Wealth level 4 — bigger house with neat property" {...props}>
      {/* Floor */}
      <path d="M 10 160 L 230 160" />
      {/* Tree (left): trunk + crown */}
      <path d="M 28 160 L 28 140" />
      <circle cx="28" cy="124" r="16" />
      {/* House walls */}
      <path d="M 65 85 L 65 160" />
      <path d="M 185 85 L 185 160" />
      {/* House roof */}
      <path d="M 55 85 L 125 35 L 195 85" />
      {/* Chimney (open at bottom — sits on the roof slope) */}
      <path d="M 150 30 L 150 56" />
      <path d="M 165 30 L 165 56" />
      <path d="M 150 30 L 165 30" />
      {/* Front door */}
      <path d="M 115 160 L 115 125 L 140 125 L 140 160" />
      {/* Two front windows */}
      <path d="M 78 100 L 78 118 L 98 118 L 98 100 Z" />
      <path d="M 152 100 L 152 118 L 172 118 L 172 100 Z" />
      {/* Hedge (right) — three small scallops */}
      <path d="M 198 160 Q 203 148 208 160 Q 213 148 218 160 Q 223 148 228 160" />
    </MarkWrap>
  )
}

// ─── Level 5 — Multi-floor mixed-use ─────────────────────────────────
export function WealthLevel5(props) {
  return (
    <MarkWrap label="Wealth level 5 — multi-floor mixed-use building" {...props}>
      {/* Floor */}
      <path d="M 20 170 L 220 170" />
      {/* Building outline (open at bottom — floor line is the base) */}
      <path d="M 60 30 L 60 170" />
      <path d="M 180 30 L 180 170" />
      <path d="M 60 30 L 180 30" />
      {/* Floor dividers */}
      <path d="M 60 75 L 180 75" />
      <path d="M 60 110 L 180 110" />
      {/* Top-floor windows (3) */}
      <path d="M 75 45 L 75 65 L 95 65 L 95 45 Z" />
      <path d="M 110 45 L 110 65 L 130 65 L 130 45 Z" />
      <path d="M 145 45 L 145 65 L 165 65 L 165 45 Z" />
      {/* Mid-floor windows (3) */}
      <path d="M 75 83 L 75 103 L 95 103 L 95 83 Z" />
      <path d="M 110 83 L 110 103 L 130 103 L 130 83 Z" />
      <path d="M 145 83 L 145 103 L 165 103 L 165 83 Z" />
      {/* Awning bar (separates retail from residence) */}
      <path d="M 55 122 L 185 122" />
      {/* Storefront door */}
      <path d="M 110 170 L 110 140 L 130 140 L 130 170" />
      {/* Storefront windows */}
      <path d="M 70 132 L 70 165 L 105 165 L 105 132 Z" />
      <path d="M 135 132 L 135 165 L 175 165 L 175 132 Z" />
    </MarkWrap>
  )
}

// ─── Wrapper + helpers ───────────────────────────────────────────────
const MARKS = [WealthLevel0, WealthLevel1, WealthLevel2, WealthLevel3, WealthLevel4, WealthLevel5]

export const WEALTH_LEVELS = [
  { id: 0, label: 'Level 0', range: 'Below $1,000',         illustration: 'Chair & desk' },
  { id: 1, label: 'Level 1', range: '$1,000 – $10,000',     illustration: 'Shopping cart' },
  { id: 2, label: 'Level 2', range: '$10,000 – $100,000',   illustration: 'Car' },
  { id: 3, label: 'Level 3', range: '$100,000 – $500,000',  illustration: 'House' },
  { id: 4, label: 'Level 4', range: '$500,000 – $4M',       illustration: 'Bigger house + property' },
  { id: 5, label: 'Level 5', range: '$4M and above',        illustration: 'Mixed-use building' },
]

/**
 * Map a dollar amount → wealth level (0–5), per the user's stated bands.
 * Boundaries are inclusive on the upper end (so $1,000 is still Level 0,
 * matching the spec where Level 1 starts at $1,000.01).
 */
export function wealthLevel(amount) {
  const n = Number(amount) || 0
  if (n <= 1000)    return 0
  if (n <= 10000)   return 1
  if (n <= 100000)  return 2
  if (n <= 500000)  return 3
  if (n <= 4000000) return 4
  return 5
}

/**
 * <WealthMark amount={number} /> picks the right illustration automatically.
 * <WealthMark level={0..5} /> bypasses the lookup if the level is known.
 */
export default function WealthMark({ amount, level, ...rest }) {
  const lv = level !== undefined ? level : wealthLevel(amount)
  const Cmp = MARKS[Math.max(0, Math.min(5, lv))]
  return <Cmp {...rest} />
}
