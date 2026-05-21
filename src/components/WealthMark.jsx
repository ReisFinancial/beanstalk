/**
 * Six monoline nature illustrations for the user's wealth level.
 * Growth metaphor: Acorn → Sprout → Sapling → Grove → Canopy → Ancient Oak
 *
 * Usage:
 *   <WealthMark amount={netWorth} className="h-20 w-24 text-brand-600" />
 *   <WealthLevel3 className="h-16 w-20 text-olive-700" />
 *
 * Thresholds:
 *   Level 0: < $1,000              — Acorn Seed
 *   Level 1: $1,000 – $10,000      — Sprout
 *   Level 2: $10,000 – $100,000    — Sapling
 *   Level 3: $100,000 – $500,000   — Grove
 *   Level 4: $500,000 – $4M        — Canopy
 *   Level 5: $4M and above         — Ancient Oak
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

// ─── Level 0 — Acorn Seed ────────────────────────────────────────────
export function WealthLevel0(props) {
  return (
    <MarkWrap label="Wealth level 0 — acorn seed" {...props}>
      {/* Ground */}
      <path d="M 20 160 L 220 160" />
      {/* Soil mound */}
      <path d="M 88 160 Q 120 148 152 160" />
      {/* Acorn body — open U-shape; cap closes the top */}
      <path d="M 102 140 Q 100 160 120 161 Q 140 160 138 140" />
      {/* Acorn cap */}
      <path d="M 100 138 Q 120 120 140 138" />
      {/* Cap rim line */}
      <path d="M 104 132 L 136 132" />
      {/* Stem */}
      <path d="M 120 120 L 120 106" />
      {/* Tiny bud */}
      <path d="M 113 106 Q 120 95 127 106" />
    </MarkWrap>
  )
}

// ─── Level 1 — Sprout ────────────────────────────────────────────────
export function WealthLevel1(props) {
  return (
    <MarkWrap label="Wealth level 1 — sprout" {...props}>
      {/* Ground */}
      <path d="M 20 160 L 220 160" />
      {/* Soil mound */}
      <path d="M 84 160 Q 120 144 156 160" />
      {/* Main stem */}
      <path d="M 120 144 L 120 86" />
      {/* Left leaf — curves out and returns */}
      <path d="M 120 130 Q 98 116 93 98 Q 110 108 120 122" />
      {/* Right leaf */}
      <path d="M 120 116 Q 142 102 147 84 Q 130 94 120 108" />
      {/* Tiny top bud */}
      <path d="M 113 86 Q 120 74 127 86" />
    </MarkWrap>
  )
}

// ─── Level 2 — Sapling ───────────────────────────────────────────────
export function WealthLevel2(props) {
  return (
    <MarkWrap label="Wealth level 2 — sapling" {...props}>
      {/* Ground */}
      <path d="M 20 160 L 220 160" />
      {/* Trunk */}
      <path d="M 120 160 L 120 108" />
      {/* Small left twig */}
      <path d="M 120 134 Q 103 124 95 114" />
      {/* Small right twig */}
      <path d="M 120 128 Q 137 118 145 108" />
      {/* Crown — rounded canopy */}
      <path d="M 95 112 Q 95 68 120 64 Q 145 68 145 112 Q 145 128 120 130 Q 95 128 95 112" />
    </MarkWrap>
  )
}

// ─── Level 3 — Grove ─────────────────────────────────────────────────
export function WealthLevel3(props) {
  return (
    <MarkWrap label="Wealth level 3 — grove" {...props}>
      {/* Ground */}
      <path d="M 20 160 L 220 160" />
      {/* Trunk */}
      <path d="M 120 160 L 120 102" />
      {/* Left branch */}
      <path d="M 120 136 L 90 120" />
      {/* Right branch */}
      <path d="M 120 130 L 150 114" />
      {/* Fuller crown */}
      <path d="M 76 108 Q 76 56 120 52 Q 164 56 164 108 Q 164 132 120 135 Q 76 132 76 108" />
    </MarkWrap>
  )
}

// ─── Level 4 — Canopy ────────────────────────────────────────────────
export function WealthLevel4(props) {
  return (
    <MarkWrap label="Wealth level 4 — canopy" {...props}>
      {/* Ground */}
      <path d="M 20 160 L 220 160" />
      {/* Root flares */}
      <path d="M 109 160 Q 108 146 115 130" />
      <path d="M 131 160 Q 132 146 125 130" />
      {/* Trunk (two converging lines) */}
      <path d="M 115 130 L 118 102" />
      <path d="M 125 130 L 122 102" />
      {/* Left major branch */}
      <path d="M 118 110 Q 84 96 70 78" />
      {/* Right major branch */}
      <path d="M 122 110 Q 156 96 170 78" />
      {/* Left sub-branch */}
      <path d="M 70 78 Q 54 66 56 50" />
      {/* Right sub-branch */}
      <path d="M 170 78 Q 186 66 182 50" />
      {/* Large crown */}
      <path d="M 50 92 Q 50 38 120 34 Q 190 38 190 92 Q 190 132 120 136 Q 50 132 50 92" />
    </MarkWrap>
  )
}

// ─── Level 5 — Ancient Oak ───────────────────────────────────────────
export function WealthLevel5(props) {
  return (
    <MarkWrap label="Wealth level 5 — ancient oak" viewBox="0 0 240 185" {...props}>
      {/* Ground */}
      <path d="M 10 170 L 230 170" />
      {/* Buttress roots */}
      <path d="M 106 170 Q 94 154 107 134" />
      <path d="M 134 170 Q 146 154 133 134" />
      <path d="M 100 170 Q 80 164 70 154" />
      <path d="M 140 170 Q 160 164 170 154" />
      {/* Wide trunk */}
      <path d="M 107 134 L 113 96" />
      <path d="M 133 134 L 127 96" />
      <path d="M 113 96 Q 120 93 127 96" />
      {/* Four major branches */}
      <path d="M 113 104 Q 77 90 58 70" />
      <path d="M 127 104 Q 163 90 182 70" />
      <path d="M 58 70 Q 40 54 44 34" />
      <path d="M 58 70 Q 56 52 70 38" />
      <path d="M 182 70 Q 200 54 196 34" />
      <path d="M 182 70 Q 184 52 170 38" />
      {/* Enormous crown */}
      <path d="M 26 88 Q 26 16 120 12 Q 214 16 214 88 Q 214 136 120 140 Q 26 136 26 88" />
    </MarkWrap>
  )
}

// ─── Wrapper + helpers ───────────────────────────────────────────────
const MARKS = [WealthLevel0, WealthLevel1, WealthLevel2, WealthLevel3, WealthLevel4, WealthLevel5]

export const WEALTH_NAMES = ['Seed', 'Sprout', 'Sapling', 'Grove', 'Canopy', 'Ancient Oak']

export const WEALTH_LEVELS = [
  { id: 0, label: 'Level 0', range: 'Below $1,000',         illustration: 'Acorn seed' },
  { id: 1, label: 'Level 1', range: '$1,000 – $10,000',     illustration: 'Sprout' },
  { id: 2, label: 'Level 2', range: '$10,000 – $100,000',   illustration: 'Sapling' },
  { id: 3, label: 'Level 3', range: '$100,000 – $500,000',  illustration: 'Grove' },
  { id: 4, label: 'Level 4', range: '$500,000 – $4M',       illustration: 'Canopy' },
  { id: 5, label: 'Level 5', range: '$4M and above',        illustration: 'Ancient Oak' },
]

/**
 * Map a dollar amount → wealth level (0–5).
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
