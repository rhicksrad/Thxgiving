/** A round little turkey with a fanned tail, in the site's harvest colors. Transparent background. */
export default function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`logo ${className}`} width={size} height={size} viewBox="-3 -1 70 66" aria-hidden="true" focusable="false">
      <TurkeyMark />
    </svg>
  )
}

const FEATHERS = ['#c8553d', '#f0a04b', '#f2cf6b', '#f0a04b', '#c8553d', '#f0a04b', '#f2cf6b', '#f0a04b', '#c8553d']

/** The drawing itself, on a 64×64 grid (scripts/make-icons.mjs draws the app icons from the same shapes). */
export function TurkeyMark() {
  return (
    <g>
      {FEATHERS.map((c, i) => (
        <ellipse key={i} cx="32" cy="16" rx="6.2" ry="15" fill={c} transform={`rotate(${(i - 4) * 21} 32 38)`} />
      ))}
      <circle cx="32" cy="40" r="14" fill="#8a5a3b" />
      <ellipse cx="32" cy="45" rx="8" ry="7" fill="#a8714a" />
      <circle cx="32" cy="27" r="8.5" fill="#a8714a" />
      <circle cx="28.8" cy="25.5" r="1.7" fill="#1c140e" />
      <circle cx="35.2" cy="25.5" r="1.7" fill="#1c140e" />
      <path d="M29.6 29 L34.4 29 L32 33 Z" fill="#f2cf6b" />
      <path d="M33.6 30.5 q2.6 2.4 0.6 6 q-2.6 -1.6 -0.6 -6 Z" fill="#c8553d" />
      <path d="M26 53.5 l-1.5 4 M28 53.8 l0 4.2 M38 53.5 l1.5 4 M36 53.8 l0 4.2" stroke="#f2cf6b" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  )
}
