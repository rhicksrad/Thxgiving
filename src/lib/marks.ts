// The site's little drawings, as plain SVG markup on a 64×64 grid, so the app (Logo.tsx) and the icon
// script (scripts/make-icons.mjs) draw from the same source. Keep this file free of imports.

/** The year-round family mark: a house with a heart for a door. The app icons use this one. */
export const HOME_MARK = `
  <rect x="42" y="11" width="6" height="12" rx="1.5" fill="#c8553d"/>
  <path d="M14 30 L32 14 L50 30 L50 54 Q50 57 47 57 L17 57 Q14 57 14 54 Z" fill="#f3dfb8"/>
  <path d="M8 31 L32 9 L56 31" fill="none" stroke="#f0a04b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 50 C23 44 21.5 39.5 22.5 36.5 C23.8 32.6 29.2 32 32 36.2 C34.8 32 40.2 32.6 41.5 36.5 C42.5 39.5 41 44 32 50 Z" fill="#e3707a"/>`

const feathers = ['#c8553d', '#f0a04b', '#f2cf6b', '#f0a04b', '#c8553d', '#f0a04b', '#f2cf6b', '#f0a04b', '#c8553d']
  .map((c, i) => `<ellipse cx="32" cy="16" rx="6.2" ry="15" fill="${c}" transform="rotate(${(i - 4) * 21} 32 38)"/>`).join('')

const spokes = (n: number, draw: (deg: number) => string) => Array.from({ length: n }, (_, i) => draw((360 / n) * i)).join('')

/** One emblem per month, January first. Each is drawn in that month's colors. */
export const MONTH_MARKS: string[] = [
  // January: a snowflake
  spokes(6, (d) => `<g transform="rotate(${d} 32 32)" stroke="#cfe8ff" stroke-width="3.4" stroke-linecap="round" fill="none">
    <path d="M32 32 L32 6"/><path d="M32 14 L25.5 8.5 M32 14 L38.5 8.5"/><path d="M32 22 L27 18 M32 22 L37 18"/></g>`) +
    `<circle cx="32" cy="32" r="4.5" fill="#8fc8f0"/>`,

  // February: a heart
  `<path d="M32 56 C12 42 5 31 7.5 21.5 C10.5 10.5 25 8 32 19 C39 8 53.5 10.5 56.5 21.5 C59 31 52 42 32 56 Z" fill="#ff6f91"/>
   <path d="M17 20 C19 15.5 24 14.5 27 17" fill="none" stroke="#ffc2d1" stroke-width="3.4" stroke-linecap="round"/>`,

  // March: a shamrock
  `<path d="M32 36 Q34 48 42 59" fill="none" stroke="#3f9e5a" stroke-width="4.5" stroke-linecap="round"/>` +
    spokes(3, (d) => `<g transform="rotate(${d} 32 32)">
      <circle cx="26.5" cy="17" r="9" fill="#5fcf80"/><circle cx="37.5" cy="17" r="9" fill="#5fcf80"/>
      <path d="M18.5 21 L32 34 L45.5 21 Z" fill="#5fcf80"/></g>`) +
    `<circle cx="32" cy="32" r="3.5" fill="#e8d36a"/>`,

  // April: a tulip in the rain
  `<path d="M32 58 L32 32" stroke="#7fc8a9" stroke-width="4" stroke-linecap="round"/>
   <path d="M32 50 Q20 48 16 36 Q28 38 32 50 Z" fill="#7fc8a9"/>
   <path d="M32 46 Q44 44 48 32 Q36 34 32 46 Z" fill="#7fc8a9"/>
   <path d="M19 14 L25 21 L32 11 L39 21 L45 14 L45 26 Q45 37 32 37 Q19 37 19 26 Z" fill="#c3a3f0"/>
   <path d="M32 11 L39 21 L45 14 L45 26 Q45 37 32 37 Z" fill="#a988e0"/>
   <path d="M53 6 q3 5 0 7 q-3 -2 0 -7 Z M9 40 q3 5 0 7 q-3 -2 0 -7 Z" fill="#8fb8f0"/>`,

  // May: a flower in bloom
  spokes(5, (d) => `<ellipse cx="32" cy="16" rx="9" ry="13" fill="#ff9aa8" transform="rotate(${d} 32 32)"/>`) +
    spokes(5, (d) => `<ellipse cx="32" cy="20" rx="4" ry="7" fill="#ffc3cc" transform="rotate(${d} 32 32)"/>`) +
    `<circle cx="32" cy="32" r="8" fill="#ffd66b"/><circle cx="29.5" cy="29.5" r="2.2" fill="#fff1b8"/>`,

  // June: the sun
  spokes(12, (d) => `<path d="M32 3 L35.5 13 L28.5 13 Z" fill="#ffe28a" transform="rotate(${d} 32 32)"/>`) +
    `<circle cx="32" cy="32" r="15" fill="#ffc94a"/>
     <path d="M25 30 q2.5 -3 5 0 M34 30 q2.5 -3 5 0" fill="none" stroke="#a8660b" stroke-width="2.4" stroke-linecap="round"/>
     <path d="M26 36 q6 6 12 0" fill="none" stroke="#a8660b" stroke-width="2.4" stroke-linecap="round"/>`,

  // July: a firework burst around a star
  spokes(12, (d) => `<path d="M32 12 L32 4" stroke="${d % 60 === 0 ? '#ff6b6b' : '#9cc2ff'}" stroke-width="3" stroke-linecap="round" transform="rotate(${d} 32 32)"/>`) +
    `<path d="M32 15 L36.9 25.3 L48.2 26.7 L39.9 34.5 L42 45.7 L32 40.2 L22 45.7 L24.1 34.5 L15.8 26.7 L27.1 25.3 Z" fill="#f5f7ff"/>
     <circle cx="32" cy="31" r="4" fill="#ff6b6b"/>`,

  // August: a watermelon slice
  `<path d="M5 24 A27 27 0 0 0 59 24 Z" fill="#3fa86b"/>
   <path d="M9.5 24 A22.5 22.5 0 0 0 54.5 24 Z" fill="#e9f5d0"/>
   <path d="M12.5 24 A19.5 19.5 0 0 0 51.5 24 Z" fill="#ff6b6b"/>
   <g fill="#2a1a1a"><ellipse cx="22" cy="31" rx="1.6" ry="2.6"/><ellipse cx="32" cy="36" rx="1.6" ry="2.6"/>
   <ellipse cx="42" cy="31" rx="1.6" ry="2.6"/><ellipse cx="27" cy="28" rx="1.4" ry="2.2"/><ellipse cx="37" cy="28" rx="1.4" ry="2.2"/></g>`,

  // September: an apple
  `<path d="M32 18 Q30 10 34 5" fill="none" stroke="#7a5230" stroke-width="3.4" stroke-linecap="round"/>
   <path d="M34 13 Q42 4 50 9 Q44 18 34 13 Z" fill="#8fbf4f"/>
   <path d="M32 19 C24 13 10 15 10 31 C10 46 20 58 27 58 C30 58 30.5 56.5 32 56.5 C33.5 56.5 34 58 37 58 C44 58 54 46 54 31 C54 15 40 13 32 19 Z" fill="#d9483b"/>
   <path d="M17 28 Q18 22 24 21" fill="none" stroke="#f08a7e" stroke-width="3" stroke-linecap="round"/>`,

  // October: a jack-o'-lantern
  `<path d="M32 16 Q31 9 35 6" fill="none" stroke="#6c8f3a" stroke-width="4" stroke-linecap="round"/>
   <ellipse cx="21" cy="37" rx="13" ry="19" fill="#e2741a"/><ellipse cx="43" cy="37" rx="13" ry="19" fill="#e2741a"/>
   <ellipse cx="32" cy="37" rx="13" ry="20" fill="#ff8a1f"/>
   <g fill="#2a1208"><path d="M19 32 L25 25 L28 33 Z"/><path d="M45 32 L39 25 L36 33 Z"/>
   <path d="M18 41 Q32 54 46 41 L42 43 L39 39 L35 44 L32 40 L29 44 L25 39 L22 43 Z"/></g>`,

  // November: the Thanksgiving turkey
  feathers + `
   <circle cx="32" cy="40" r="14" fill="#8a5a3b"/>
   <ellipse cx="32" cy="45" rx="8" ry="7" fill="#a8714a"/>
   <circle cx="32" cy="27" r="8.5" fill="#a8714a"/>
   <circle cx="28.8" cy="25.5" r="1.7" fill="#1c140e"/>
   <circle cx="35.2" cy="25.5" r="1.7" fill="#1c140e"/>
   <path d="M29.6 29 L34.4 29 L32 33 Z" fill="#f2cf6b"/>
   <path d="M33.6 30.5 q2.6 2.4 0.6 6 q-2.6 -1.6 -0.6 -6 Z" fill="#c8553d"/>
   <path d="M26 53.5 l-1.5 4 M28 53.8 l0 4.2 M38 53.5 l1.5 4 M36 53.8 l0 4.2" stroke="#f2cf6b" stroke-width="1.8" stroke-linecap="round"/>`,

  // December: a Christmas tree
  `<rect x="28" y="50" width="8" height="9" rx="1.5" fill="#8a5a3b"/>
   <path d="M32 12 L50 52 L14 52 Z" fill="#2f8f57"/>
   <path d="M32 12 L44 38 L20 38 Z" fill="#4caf6e"/>
   <path d="M32 12 L39 26 L25 26 Z" fill="#6cc98a"/>
   <path d="M20 46 Q32 40 45 44 M24 32 Q32 28 40 31" fill="none" stroke="#f4d37a" stroke-width="2" stroke-linecap="round"/>
   <g fill="#ff5d5d"><circle cx="23" cy="48" r="2.6"/><circle cx="38" cy="44" r="2.6"/><circle cx="29" cy="35" r="2.3"/><circle cx="36" cy="24" r="2"/></g>
   <path d="M32 3 L34.2 8 L39.5 8.4 L35.4 11.8 L36.7 17 L32 14.2 L27.3 17 L28.6 11.8 L24.5 8.4 L29.8 8 Z" fill="#f4d37a"/>`,
]

/** Birthdays: a cake with three candles, on the same 64×64 grid as the month emblems. */
export const BIRTHDAY_MARK = `<ellipse cx="32" cy="57" rx="25" ry="4" fill="#000" opacity=".18"/>
   <rect x="9" y="36" width="46" height="20" rx="5" fill="#f08aa0"/>
   <path d="M9 43c4 5 8 5 11.5 0s7.5-5 11.5 0 7.5 5 11.5 0 7.5-5 11.5 0v-3a5 5 0 0 0-5-5H14a5 5 0 0 0-5 5Z" fill="#fff4e0"/>
   <rect x="15" y="26" width="34" height="12" rx="4" fill="#ffc94a"/>
   <g fill="#5fd0e0"><rect x="20.5" y="14" width="3" height="12" rx="1.5"/><rect x="30.5" y="12" width="3" height="14" rx="1.5"/><rect x="40.5" y="14" width="3" height="12" rx="1.5"/></g>
   <g fill="#ff8a3d"><path d="M22 6c2 2.5 2.5 4 2.5 5a2.5 2.5 0 0 1-5 0c0-1 .5-2.5 2.5-5Z"/><path d="M32 4c2 2.5 2.5 4 2.5 5a2.5 2.5 0 0 1-5 0c0-1 .5-2.5 2.5-5Z"/><path d="M42 6c2 2.5 2.5 4 2.5 5a2.5 2.5 0 0 1-5 0c0-1 .5-2.5 2.5-5Z"/></g>`

/** Small one-color shapes (currentColor) that drift across the background, on a 24×24 grid. */
export const PARTICLES = {
  snow: `<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/>
    <path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/></g>`,
  heart: `<path d="M12 21C5 16 2 12 3 8.5 4.2 4.6 9.3 4 12 7.6 14.7 4 19.8 4.6 21 8.5 22 12 19 16 12 21Z" fill="currentColor"/>`,
  clover: `<g fill="currentColor"><circle cx="9" cy="8" r="4"/><circle cx="15" cy="8" r="4"/><circle cx="12" cy="13.5" r="4"/></g>
    <path d="M12 15q1 5 4 7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  drop: `<path d="M12 2C9 8 6 11.5 6 15a6 6 0 0 0 12 0c0-3.5-3-7-6-13Z" fill="currentColor"/>`,
  petal: `<path d="M12 2C17 6 18 13 12 22 6 13 7 6 12 2Z" fill="currentColor"/>`,
  sparkle: `<path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6Z" fill="currentColor"/>`,
  star: `<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.2 5.8 20.9l1.6-7L2 9.2l7.1-.6Z" fill="currentColor"/>`,
  bubble: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9.5q1.5-2.5 4-2.8" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  leaf: `<path d="M20 3C9 3 3 9 4 19c0 1 .5 1.8 1.2 2C6 14 10 10 15 8c-4 3-7 7-8.5 13.5C17 21 21 13 20 3Z" fill="currentColor"/>`,
  bat: `<path d="M12 9c1 0 1.5-1.8 1.5-1.8L14.5 9c2.5-.5 4-2.5 4.5-4.5C20 7 22.5 8.5 23.5 9 21.5 10 20.5 12 21 14.5 19 13 17 13.5 15.5 15.5 14.5 14 13 14 12 16c-1-2-2.5-2-3.5-.5C7 13.5 5 13 3 14.5 3.5 12 2.5 10 .5 9 1.5 8.5 4 7 5 4.5c.5 2 2 4 4.5 4.5l1-1.8S11 9 12 9Z" fill="currentColor"/>`,
  confetti: `<rect x="5" y="9" width="14" height="6" rx="1.5" fill="currentColor" transform="rotate(-28 12 12)"/>`,
  balloon: `<path d="M12 2a7 7 0 0 1 7 7c0 4-3.2 7.6-7 8.2C8.2 16.6 5 13 5 9a7 7 0 0 1 7-7Z" fill="currentColor"/><path d="M12 17.2q-1.5 2 0 4.8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  flower: `<g fill="currentColor"><circle cx="12" cy="5.5" r="3.5"/><circle cx="18" cy="10" r="3.5"/><circle cx="15.8" cy="17" r="3.5"/><circle cx="8.2" cy="17" r="3.5"/><circle cx="6" cy="10" r="3.5"/></g><circle cx="12" cy="12" r="2.6" fill="currentColor" opacity=".55"/>`,
  note: `<path d="M9 18V5l11-2.5v13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="6.5" cy="18" rx="3.2" ry="2.6" fill="currentColor"/><ellipse cx="17.5" cy="15.5" rx="3.2" ry="2.6" fill="currentColor"/>`,
  fish: `<path d="M2 12c3-5 8-6.5 13-4.5L21 4v16l-6-3.5C10 18.5 5 17 2 12Z" fill="currentColor"/>`,
} as const
export type ParticleKind = keyof typeof PARTICLES
