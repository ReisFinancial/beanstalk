/**
 * Monoline beanstalk mark — single stroke, themeable via `currentColor`.
 *
 * Usage:
 *   <BeanstalkMark className="h-8 w-8 text-olive-600" />
 *
 * The SVG inherits color from its parent (`text-*` Tailwind utility),
 * so the same component can sit on light or dark backgrounds.
 */
export default function BeanstalkMark({ className = '', strokeWidth = 14, ...rest }) {
  return (
    <svg
      viewBox="220 60 260 390"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Beanstalk"
      className={className}
      {...rest}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Ground line */}
        <path d="M 220 430 L 460 430" />
        {/* Soil mound */}
        <path d="M 290 430 Q 340 408 390 430" />
        {/* Main stem: S-curve */}
        <path d="M 340 425 C 312 360, 388 320, 360 250 C 332 185, 388 150, 360 100" />
        {/* Lower-right leaf */}
        <path d="M 360 330 C 410 312, 448 318, 472 290 C 460 332, 418 358, 372 348" />
        {/* Upper-left leaf */}
        <path d="M 364 230 C 312 214, 270 220, 244 192 C 258 234, 300 260, 352 248" />
        {/* Upper-right leaf */}
        <path d="M 370 160 C 412 144, 442 150, 460 128 C 450 164, 416 184, 380 176" />
        {/* Top tendril curl */}
        <path d="M 360 100 C 360 80, 384 70, 392 88 C 398 102, 384 112, 372 104" />
      </g>
    </svg>
  )
}
