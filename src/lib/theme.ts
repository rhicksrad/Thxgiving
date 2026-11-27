import { useSyncExternalStore } from 'react'
import { MONTH_MARKS, type ParticleKind } from './marks'

/**
 * One theme per calendar month, picked from the visitor's own date. Each sets the page colors (styles.css
 * builds the cards, lines and muted text from these), the emblem in the top bar, what drifts across the
 * background, and a few seasonal touches (tagline, chat questions).
 */
export type Theme = {
  month: number            // 1–12
  key: string
  name: string             // "Merry & bright"
  tagline: string          // shown under "Hicks Family"
  greeting: string         // the Home hero's line
  highlights: string       // what's on this month
  colors: {
    bg: string             // page background (dark)
    text: string           // main text, a tinted near-white
    gold: string           // the accent: buttons, links, active tabs
    goldHi: string
    rush: string           // second accent
    aged: string           // third accent (stripes, hero bar)
    dust: string           // soft light accent
  }
  stripe: string[]         // colors for the top bar's decorative edge
  particle: ParticleKind
  motion: 'fall' | 'rise' | 'twinkle' | 'sway'
  prompts: string[]        // the family chat's question of the day
  mark: string             // emblem SVG (64×64 grid)
}

type ThemeDef = Omit<Theme, 'month' | 'mark'>

const DEFS: ThemeDef[] = [
  {
    key: 'january', name: 'Fresh snow', tagline: 'Happy New Year',
    greeting: 'A fresh year, a fresh blanket of snow.',
    highlights: "New Year's Day · MLK Day · snow days",
    colors: { bg: '#0d1520', text: '#eef5fc', gold: '#8fc8f0', goldHi: '#b8dcf6', rush: '#cfe8ff', aged: '#6f8fd8', dust: '#e6f2ff' },
    stripe: ['#6f8fd8', '#cfe8ff', '#8fc8f0'], particle: 'snow', motion: 'fall',
    prompts: [
      'Any New Year\'s resolutions you\'re willing to admit to?',
      'Best snow day memory?',
      'What\'s one thing you want to do as a family this year?',
      'Hot chocolate: marshmallows or whipped cream?',
      'Drop a photo from last year you never shared.',
    ],
  },
  {
    key: 'february', name: 'Sweethearts', tagline: 'Love, the Hicks way',
    greeting: 'Sending a little extra love this month.',
    highlights: "Valentine's Day · Presidents' Day",
    colors: { bg: '#1c0d14', text: '#fdeef2', gold: '#ff6f91', goldHi: '#ff9bb3', rush: '#ffb3c6', aged: '#e0314f', dust: '#ffd9e2' },
    stripe: ['#e0314f', '#ffb3c6', '#ff6f91'], particle: 'heart', motion: 'rise',
    prompts: [
      'How did the couples in the family meet? Tell the story.',
      'Best (or worst) Valentine\'s Day gift ever?',
      'Who in the family gives the best hugs?',
      'Chocolate: milk, dark, or white?',
      'Drop a photo of your favorite people.',
    ],
  },
  {
    key: 'march', name: 'Lucky green', tagline: 'Luck of the Hicks',
    greeting: 'Spring is on its way. Feeling lucky?',
    highlights: "St. Patrick's Day · first day of spring · March Madness",
    colors: { bg: '#0c1a12', text: '#eefaf1', gold: '#5fcf80', goldHi: '#8ee0a4', rush: '#e8d36a', aged: '#3f9e5a', dust: '#d7f2de' },
    stripe: ['#3f9e5a', '#e8d36a', '#5fcf80'], particle: 'clover', motion: 'sway',
    prompts: [
      'Who\'s winning the family bracket this year?',
      'What\'s the luckiest thing that ever happened to you?',
      'First sign of spring you\'ve spotted?',
      'Corned beef and cabbage: yes or no?',
      'Drop an old photo of someone wearing green.',
    ],
  },
  {
    key: 'april', name: 'Spring showers', tagline: 'April showers',
    greeting: 'Rain boots by the door and tulips coming up.',
    highlights: "Easter · April Fools' · spring break",
    colors: { bg: '#15121f', text: '#f4f0fc', gold: '#c3a3f0', goldHi: '#d8c2f6', rush: '#f7d774', aged: '#7fc8a9', dust: '#e8ddfa' },
    stripe: ['#7fc8a9', '#f7d774', '#c3a3f0', '#8fb8f0'], particle: 'drop', motion: 'fall',
    prompts: [
      'Best April Fools\' prank anyone in the family pulled?',
      'Easter dinner: ham or lamb?',
      'Favorite Easter candy? Peeps don\'t count. Or do they?',
      'Where would you go for spring break if you could go anywhere?',
      'Drop a photo of something blooming near you.',
    ],
  },
  {
    key: 'may', name: 'In bloom', tagline: 'Everything in bloom',
    greeting: 'Flowers out, windows open, grills warming up.',
    highlights: "Mother's Day · Memorial Day · graduations",
    colors: { bg: '#18121e', text: '#fdf0f2', gold: '#ff9aa8', goldHi: '#ffbcc5', rush: '#ffd66b', aged: '#8fd18a', dust: '#ffe0e5' },
    stripe: ['#8fd18a', '#ffd66b', '#ff9aa8'], particle: 'petal', motion: 'fall',
    prompts: [
      'What\'s the best advice your mom ever gave you?',
      'Any graduates in the family this year?',
      'First cookout of the year: what\'s on the grill?',
      'What are you planting this spring?',
      'Drop a photo of a mom in the family.',
    ],
  },
  {
    key: 'june', name: 'Sunshine', tagline: 'Hello, summer',
    greeting: 'School\'s out and the days are long.',
    highlights: "Father's Day · first day of summer · Juneteenth",
    colors: { bg: '#0c1a21', text: '#f0f8fa', gold: '#ffc94a', goldHi: '#ffdc80', rush: '#ffe28a', aged: '#4fd1c5', dust: '#fff0c2' },
    stripe: ['#4fd1c5', '#ffe28a', '#ffc94a'], particle: 'sparkle', motion: 'twinkle',
    prompts: [
      'What\'s the best advice your dad ever gave you?',
      'Summer plans? Anybody going anywhere?',
      'Best family vacation you remember?',
      'Lake, pool, or beach?',
      'Drop a photo of a dad in the family.',
    ],
  },
  {
    key: 'july', name: 'Stars & stripes', tagline: 'Red, white & blue',
    greeting: 'Fireworks, sparklers and sweet corn.',
    highlights: 'Fourth of July · cookouts · fireworks',
    colors: { bg: '#0c1228', text: '#f1f4ff', gold: '#ff6b6b', goldHi: '#ff9696', rush: '#9cc2ff', aged: '#3d6fd8', dust: '#dfe7ff' },
    stripe: ['#ff6b6b', '#f5f7ff', '#3d6fd8'], particle: 'star', motion: 'twinkle',
    prompts: [
      'Where\'s the best spot to watch fireworks?',
      'Hot dogs or burgers?',
      'Best Fourth of July you remember?',
      'Who in the family is in charge of the grill?',
      'Drop a summer photo from when you were a kid.',
    ],
  },
  {
    key: 'august', name: 'Beach days', tagline: 'Summer\'s last splash',
    greeting: 'Watermelon, sunscreen and one last trip to the water.',
    highlights: 'State fair · back-to-school shopping · last trips',
    colors: { bg: '#081b1e', text: '#eefbfa', gold: '#3fd0c9', goldHi: '#7ce0db', rush: '#ffd27a', aged: '#ff8a65', dust: '#d4f5f2' },
    stripe: ['#ff8a65', '#ffd27a', '#3fd0c9'], particle: 'bubble', motion: 'rise',
    prompts: [
      'Best thing you ate at the fair this year?',
      'Who\'s going back to school, and what grade?',
      'Favorite summer memory from this year?',
      'Watermelon: salt or no salt?',
      'Drop your best vacation photo.',
    ],
  },
  {
    key: 'september', name: 'Apple picking', tagline: 'Back to school',
    greeting: 'Sharpened pencils, crisp apples and football on Saturday.',
    highlights: 'Labor Day · back to school · first day of fall',
    colors: { bg: '#15170e', text: '#f8f6ec', gold: '#e8b23a', goldHi: '#f0c96b', rush: '#f2d36b', aged: '#d9483b', dust: '#f5e8c2' },
    stripe: ['#d9483b', '#f2d36b', '#8fbf4f'], particle: 'leaf', motion: 'sway',
    prompts: [
      'First day of school pictures, please!',
      'Who are we rooting for this football season?',
      'Apple pie, apple crisp, or caramel apples?',
      'What was your favorite subject in school?',
      'Drop an old school picture. We won\'t laugh. Much.',
    ],
  },
  {
    key: 'october', name: 'Spooky season', tagline: 'Trick or treat',
    greeting: 'Pumpkins on the porch and something spooky in the air.',
    highlights: 'Halloween · pumpkin patches · hayrides',
    colors: { bg: '#110c17', text: '#f7f1fb', gold: '#ff8a1f', goldHi: '#ffad5e', rush: '#b98cff', aged: '#7ad957', dust: '#f1dcc4' },
    stripe: ['#ff8a1f', '#b98cff', '#7ad957'], particle: 'bat', motion: 'sway',
    prompts: [
      'What\'s everyone dressing up as this year?',
      'Best costume you ever wore?',
      'Full-size candy bars or the little ones?',
      'Scariest movie you\'ve ever seen?',
      'Drop a photo of your jack-o\'-lantern.',
    ],
  },
  {
    key: 'november', name: 'Harvest', tagline: 'Gather \'round',
    greeting: 'Thankful for every one of you.',
    highlights: 'Thanksgiving · Veterans Day · football',
    colors: { bg: '#1a120c', text: '#f8efe2', gold: '#f0a04b', goldHi: '#f6bd7c', rush: '#f2cf6b', aged: '#c8553d', dust: '#f3dfb8' },
    stripe: ['#c8553d', '#f0a04b', '#f2cf6b'], particle: 'leaf', motion: 'fall',
    prompts: [
      'What are you most thankful for this year?',
      'Best Thanksgiving dish of all time? Defend your answer.',
      'Stuffing or dressing? Inside the bird or in a pan?',
      'Share a favorite Thanksgiving memory from when you were a kid.',
      'Pumpkin, pecan, or apple? Pick one pie.',
      'Who\'s got the best leftover sandwich recipe?',
      'Drop an old family photo. The older the better.',
    ],
  },
  {
    key: 'december', name: 'Merry & bright', tagline: 'Merry Christmas',
    greeting: 'Lights up, cookies out, everybody home.',
    highlights: "Christmas · Hanukkah · New Year's Eve",
    colors: { bg: '#0b1712', text: '#f3faf5', gold: '#ff5d5d', goldHi: '#ff8a8a', rush: '#f4d37a', aged: '#4caf6e', dust: '#f6e6c4' },
    stripe: ['#ff5d5d', '#f4d37a', '#4caf6e', '#f4d37a'], particle: 'snow', motion: 'fall',
    prompts: [
      'What\'s at the top of your wish list?',
      'Real tree or fake tree?',
      'What\'s your favorite Christmas movie?',
      'Best cookie on the cookie plate?',
      'Share a favorite Christmas morning memory.',
      'Drop a photo of your tree.',
    ],
  },
]

export const THEMES: Theme[] = DEFS.map((d, i) => ({ ...d, month: i + 1, mark: MONTH_MARKS[i] }))

// A device can pin a month (Family page) to preview a theme; ?month=1–12 in the address does the same for one visit.
const PIN_KEY = 'family:theme-month'

function pinned(): number | null {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('month'))
  if (fromUrl >= 1 && fromUrl <= 12) return fromUrl
  try {
    const n = Number(localStorage.getItem(PIN_KEY))
    if (n >= 1 && n <= 12) return n
  } catch { /* private mode */ }
  return null
}

/**
 * The month whose theme shows on a given day, on the visitor's own clock. Christmas doesn't wait for December 1:
 * it starts at 5 PM on Thanksgiving (the 4th Thursday of November), once dinner is done.
 */
export function seasonMonth(d = new Date()) {
  const month = d.getMonth() + 1
  if (month !== 11) return month
  const firstThu = 1 + ((4 - new Date(d.getFullYear(), 10, 1).getDay() + 7) % 7)
  const christmasStarts = new Date(d.getFullYear(), 10, firstThu + 21, 17)
  return d >= christmasStarts ? 12 : 11
}

/** The month that picks the theme: a pinned one, or the season on the visitor's own clock. */
export const currentMonth = () => pinned() ?? seasonMonth()
export const pinnedMonth = pinned

let active: Theme = THEMES[currentMonth() - 1]
const listeners = new Set<() => void>()

/** Puts the theme's colors on the page. Called once before the first render, so there's no flash. */
export function applyTheme() {
  active = THEMES[currentMonth() - 1]
  const root = document.documentElement
  const c = active.colors
  const set = (k: string, v: string) => root.style.setProperty(k, v)
  set('--bg', c.bg); set('--text', c.text); set('--gold', c.gold); set('--gold-hi', c.goldHi)
  set('--rush', c.rush); set('--aged', c.aged); set('--dust', c.dust)
  set('--stripe', `linear-gradient(90deg, ${active.stripe.map((s, i) => `${s} ${(i / active.stripe.length) * 100}% ${((i + 1) / active.stripe.length) * 100}%`).join(', ')})`)
  root.dataset.month = active.key
  // This month's painted art (public/art, made with Codex: scripts/make-art.mjs). Only this month's two files load.
  const art = (name: string) => `url("${new URL(`art/${name}-${active.key}.webp`, document.baseURI).href}")`
  set('--art-bg', art('bg')); set('--art-hero', art('hero'))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg)
  listeners.forEach((l) => l())
}

/** Pin a month on this device (null goes back to automatic). */
export function pinMonth(month: number | null) {
  try {
    if (month) localStorage.setItem(PIN_KEY, String(month))
    else localStorage.removeItem(PIN_KEY)
  } catch { /* private mode */ }
  applyTheme()
}

// A page left open over midnight on the last of the month picks up the new theme within the hour.
setInterval(() => { if (THEMES[currentMonth() - 1] !== active) applyTheme() }, 3600_000)

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useTheme = () => useSyncExternalStore(subscribe, () => active)
