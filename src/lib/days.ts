import type { ParticleKind } from './marks'

/**
 * One-day looks: holidays and special days that take over the month's theme for just that day
 * (a birthday or anniversary still wins). Dates are worked out for any year on the visitor's own clock.
 */
export type DayLook = {
  key: string
  title: string              // "Halloween"
  name: string               // the look's own name, shown on the Home badge
  tagline: string            // under "Hicks Family"
  greeting: string
  colors: { bg: string; text: string; gold: string; goldHi: string; rush: string; aged: string; dust: string }
  particle: ParticleKind
  motion: 'fall' | 'rise' | 'twinkle' | 'sway'
  prompts: string[]          // the chat's questions for the day
}

type C = DayLook['colors']
const c = (bg: string, text: string, gold: string, goldHi: string, rush: string, aged: string, dust: string): C =>
  ({ bg, text, gold, goldHi, rush, aged, dust })
const look = (key: string, title: string, name: string, tagline: string, greeting: string, colors: C,
  particle: ParticleKind, motion: DayLook['motion'], prompts: string[]): DayLook =>
  ({ key, title, name, tagline, greeting, colors, particle, motion, prompts })

export const DAY_LOOKS: DayLook[] = [
  look('newyear', "New Year's Day", 'Fresh start', 'Happy New Year!', 'A brand new year, and all of us in it together.',
    c('#0d1422', '#f2f6fd', '#f2cf6b', '#f8e2a0', '#9fd0ff', '#6f8fd8', '#e6eefc'), 'confetti', 'fall',
    ['What are you looking forward to most this year?', 'Any resolutions? Be honest.', 'Best moment of last year?']),
  look('superbowl', 'Super Bowl Sunday', 'Game day', 'Super Bowl Sunday', 'Wings are hot, the couch is full, and kickoff is coming.',
    c('#0f1a12', '#f3f8ee', '#f2b84a', '#f7cf80', '#f08a5a', '#4f9e5a', '#e8f0d8'), 'star', 'twinkle',
    ['Who are you picking today?', 'Best Super Bowl snack? Defend it.', 'Here for the game, the ads or the halftime show?']),
  look('valentine', "Valentine's Day", 'Be mine', "Happy Valentine's Day", 'Hearts, roses and a whole lot of love for this family.',
    c('#1f0b14', '#fff0f4', '#ff5c85', '#ff8fab', '#ffc2d1', '#d81e4f', '#ffdbe4'), 'heart', 'rise',
    ['Who was your first crush?', 'Tell someone here what you love about them.', 'Chocolates or flowers?']),
  look('pi', 'Pi Day', 'Easy as pie', 'Happy Pi Day', '3.14159… and an excuse to eat pie for dinner.',
    c('#1a120c', '#fbf1e2', '#f0a04b', '#f6bd7c', '#e86a5c', '#b5524a', '#f6e2c6'), 'sparkle', 'twinkle',
    ['Pick one pie for the rest of your life.', 'Who makes the best pie in the family?', 'How many digits of pi do you know?']),
  look('stpatrick', "St. Patrick's Day", 'Pot of gold', "Happy St. Patrick's Day", 'Wear your green, or get pinched.',
    c('#08190f', '#eefbf1', '#4fd07a', '#86e3a4', '#f2cf4a', '#2f9e55', '#d6f3de'), 'clover', 'sway',
    ['Are you wearing green today? Prove it.', 'What would you do with a pot of gold?', 'Luckiest moment of your life?']),
  look('aprilfools', "April Fools' Day", 'Gotcha', 'yadoT slooF lirpA', 'Don\'t believe anything you read today. Especially this.',
    c('#1a0f24', '#fbf3ff', '#ffd23f', '#ffe27d', '#ff5ca8', '#3fd0c9', '#f0e0ff'), 'confetti', 'sway',
    ['Best prank you ever pulled?', 'Who in the family falls for it every time?', 'Has anyone gotten you today?']),
  look('easter', 'Easter', 'Easter morning', 'Happy Easter', 'Baskets out, eggs hidden, Sunday best on.',
    c('#17131f', '#fbf5ff', '#c9a6f2', '#dcc4f7', '#ffd66b', '#7fd1a8', '#f1e6fb'), 'flower', 'sway',
    ['Who found the most eggs?', 'Best thing in an Easter basket?', 'Share an Easter photo, new or old.']),
  look('earth', 'Earth Day', 'Green planet', 'Happy Earth Day', 'Go outside, plant something, hug a tree.',
    c('#0a1a16', '#eefaf4', '#5fcf9a', '#8fe0b8', '#7cc4f0', '#3f8fb5', '#d7f2e6'), 'leaf', 'sway',
    ['Favorite place outdoors?', 'What are you planting this year?', 'Share a photo of a view you love.']),
  look('mothers', "Mother's Day", 'For Mom', "Happy Mother's Day", 'For the moms who hold this family together.',
    c('#1c1118', '#fff2f5', '#ff9db5', '#ffc0cf', '#f6d27a', '#c86a9a', '#ffe2ea'), 'petal', 'fall',
    ['Tell a mom in the family what she means to you.', 'Best thing your mom ever taught you?', 'Share a photo with your mom.']),
  look('indy500', 'Indy 500', 'Race day', 'Back home again in Indiana', 'Drivers, start your engines.',
    c('#111114', '#f6f6f6', '#ffd23f', '#ffe27d', '#f05a4a', '#9aa3ad', '#e9e9ee'), 'star', 'twinkle',
    ['Who are you picking to win?', 'Ever been to the track? Tell the story.', 'Milk: whole, 2% or skim?']),
  look('memorial', 'Memorial Day', 'We remember', 'Memorial Day', 'Remembering those who gave everything.',
    c('#0d1322', '#f3f5fb', '#e2574c', '#ee8279', '#f3e6c8', '#3f62b5', '#dfe6f5'), 'star', 'twinkle',
    ['Who are you remembering today?', 'Any family service stories to share?', 'What is on the grill today?']),
  look('fathers', "Father's Day", 'For Dad', "Happy Father's Day", 'For the dads, the grill masters and the fixers of everything.',
    c('#0f1620', '#f2f6fb', '#f2a65a', '#f7c48c', '#7fc0e8', '#3f6f9e', '#e0e9f2'), 'star', 'twinkle',
    ['Best dad joke you know?', 'Best thing your dad ever taught you?', 'Share a photo with your dad.']),
  look('summer', 'First day of summer', 'Hello, summer', 'First day of summer', 'Longest day of the year. Go soak it up.',
    c('#0b1b22', '#f1fafb', '#ffc94a', '#ffdc80', '#ff8a65', '#3fc7d0', '#fff0c2'), 'sparkle', 'twinkle',
    ['What is on your summer list?', 'Pool, lake or beach?', 'Best summer you ever had?']),
  look('july4', 'Fourth of July', 'Fireworks night', 'Happy Fourth of July', 'Sparklers lit, flag out, fireworks at dark.',
    c('#0a1026', '#f3f5ff', '#ff5c5c', '#ff8c8c', '#f5f7ff', '#3d6fd8', '#dfe7ff'), 'star', 'twinkle',
    ['Where are you watching fireworks?', 'Hot dogs or burgers?', 'Share your best fireworks photo.']),
  look('grandparents', "Grandparents' Day", 'For the grandparents', "Happy Grandparents' Day", 'For the ones who started it all.',
    c('#1b130f', '#fbf2e6', '#f0b56a', '#f6cf9a', '#f29aa8', '#b5724a', '#f6e2c6'), 'heart', 'rise',
    ['Favorite memory with a grandparent?', 'Best thing a grandparent ever cooked for you?', 'Share an old photo of a grandparent.']),
  look('fall', 'First day of fall', 'Sweater weather', 'First day of fall', 'Crisp air, red leaves and something with cinnamon in it.',
    c('#1a110b', '#fbf1e4', '#f08a3c', '#f6ad73', '#f2c94a', '#b5432f', '#f5e0c0'), 'leaf', 'fall',
    ['Best thing about fall?', 'Pumpkin spice: yes or no?', 'Share a photo of the leaves near you.']),
  look('halloween', 'Halloween', 'Fright night', 'Happy Halloween', 'Porch light on, candy bowl full, something creaking upstairs.',
    c('#120a17', '#f8f0fc', '#ff8a1f', '#ffad5e', '#b98cff', '#7ad957', '#f1dcc4'), 'bat', 'sway',
    ['Costume photos, please!', 'Best candy in the bowl?', 'Scariest thing that ever happened to you?']),
  look('veterans', 'Veterans Day', 'Thank you', 'Veterans Day', 'Thank you to everyone in this family who served.',
    c('#0d1322', '#f3f5fb', '#f3d27a', '#f8e2a8', '#e2574c', '#3f62b5', '#dfe6f5'), 'star', 'twinkle',
    ['Who in the family served? Tell us about them.', 'Thank a veteran here today.', 'Share a photo of someone in uniform.']),
  look('thanksgiving', 'Thanksgiving', 'The big table', 'Happy Thanksgiving', 'Everybody around one table. That is the whole point.',
    c('#1c120a', '#fbf0e0', '#f0a04b', '#f6bd7c', '#f2cf6b', '#c8553d', '#f3dfb8'), 'leaf', 'fall',
    ['What are you thankful for today?', 'What is on your plate first?', 'Share a photo from the table.']),
  look('blackfriday', 'Black Friday', 'Leftovers day', 'Leftovers day', 'Turkey sandwiches, pie for breakfast and nowhere to be.',
    c('#16110f', '#f8f0e6', '#f2b85a', '#f7d08c', '#e8785c', '#8a6f5a', '#efe0cc'), 'leaf', 'sway',
    ['What goes on your leftover sandwich?', 'Shopping today or staying on the couch?', 'Pie for breakfast: yes or yes?']),
  look('xmas-eve', 'Christmas Eve', 'Silent night', 'Merry Christmas Eve', 'Stockings hung, cookies out, listen for sleigh bells.',
    c('#0a1224', '#f1f5ff', '#f4d37a', '#f8e3a6', '#ff6b6b', '#5f8fd8', '#dfe8fa'), 'snow', 'fall',
    ['What is your Christmas Eve tradition?', 'Open one present tonight, or wait?', 'What did you leave out for Santa?']),
  look('christmas', 'Christmas', 'Christmas morning', 'Merry Christmas!', 'Wrapping paper everywhere and everybody home.',
    c('#0b1712', '#f3faf5', '#ff5d5d', '#ff8a8a', '#f4d37a', '#4caf6e', '#f6e6c4'), 'snow', 'fall',
    ['What was the best thing under the tree?', 'Share a photo from this morning.', 'Favorite Christmas memory?']),
  look('nye', "New Year's Eve", 'Countdown', "Happy New Year's Eve", 'Ten, nine, eight… see you at midnight.',
    c('#0c0c14', '#f7f4ea', '#f2cf6b', '#f8e2a0', '#c9a6f2', '#8a8fa8', '#efe6cc'), 'sparkle', 'twinkle',
    ['Best thing that happened this year?', 'Staying up until midnight?', 'One word for this year?']),
  // The next tier of holidays.
  look('mlk', 'Martin Luther King Jr. Day', 'The dream', 'MLK Day', 'A day to remember the dream, and to do something good for somebody.',
    c('#12121a', '#f4f2ee', '#e8b54a', '#f2cd7e', '#b8a6e8', '#7a6fb5', '#e8e2f2'), 'star', 'twinkle',
    ['What is one good thing you can do for somebody today?', 'Who inspires you?', 'What is your dream for this family?']),
  look('groundhog', 'Groundhog Day', 'Six more weeks?', 'Happy Groundhog Day', 'Did he see his shadow? Either way, winter isn\'t done with Indiana.',
    c('#111a20', '#f0f6f8', '#c9a26b', '#dcc097', '#9fd0e8', '#6f8fa8', '#e2ecf0'), 'snow', 'fall',
    ['Six more weeks of winter, or early spring?', 'Team snow or team sunshine?', 'What are you most ready for when it warms up?']),
  look('presidents', "Presidents' Day", 'Hail to the chief', "Presidents' Day", 'A day off for some, a mattress sale for all.',
    c('#0d1322', '#f3f5fb', '#f3d27a', '#f8e2a8', '#e2574c', '#3f62b5', '#dfe6f5'), 'star', 'twinkle',
    ['Who would you put on Mount Rushmore?', 'If you were president for a day, what is the first thing you would do?', 'Day off today, or working?']),
  look('mardigras', 'Mardi Gras', 'Fat Tuesday', 'Happy Mardi Gras', 'Beads, masks and king cake. Let the good times roll.',
    c('#150c22', '#f8f2ff', '#f2c84a', '#f8dc80', '#4fcf7a', '#8a4fd8', '#eadcf8'), 'confetti', 'fall',
    ['Who got the baby in the king cake?', 'Purple, green or gold?', 'What are you giving up tomorrow?']),
  look('spring', 'First day of spring', 'Thaw', 'First day of spring', 'Coats off, windows open, something green coming up.',
    c('#111b14', '#f3faf2', '#8fd18a', '#b4e3b0', '#ffb8c9', '#f2d46b', '#e3f2dc'), 'petal', 'fall',
    ['First sign of spring near you?', 'What are you planting?', 'Share a photo of something blooming.']),
  look('taxday', 'Tax Day', 'Paid in full', 'Tax Day', 'Death and taxes. At least one of them is done for the year.',
    c('#101a14', '#f1f7f1', '#8fcf8a', '#b4e0b0', '#f2d46b', '#5f8f6a', '#dfecdc'), 'confetti', 'fall',
    ['Refund or pay up?', 'What would you do with a surprise refund?', 'Who files in January and who files today?']),
  look('cinco', 'Cinco de Mayo', 'Fiesta', 'Happy Cinco de Mayo', 'Tacos, chips and salsa, and something cold with lime.',
    c('#1c100c', '#fdf3e6', '#ff8a3c', '#ffad73', '#3fc78a', '#e8384f', '#fbe3c6'), 'confetti', 'fall',
    ['Tacos: hard shell or soft?', 'Best Mexican restaurant near you?', 'Salsa: mild, medium or hot?']),
  look('derby', 'Derby Day', 'Run for the roses', 'Derby Day', 'Big hats, red roses and the fastest two minutes in sports.',
    c('#161a12', '#f8f6ee', '#e8384f', '#f06a7c', '#f2d27a', '#4f9e6a', '#f2e6d0'), 'petal', 'fall',
    ['Pick your horse by name. Go.', 'Who has the best Derby hat?', 'Ever been to Churchill Downs?']),
  look('flagday', 'Flag Day', 'Stars and stripes', 'Flag Day', 'Long may she wave.',
    c('#0c1226', '#f3f5ff', '#ff6b6b', '#ff9696', '#f5f7ff', '#3d6fd8', '#dfe7ff'), 'star', 'twinkle',
    ['Is there a flag on your porch?', 'Favorite patriotic song?', 'Share a photo with a flag in it.']),
  look('juneteenth', 'Juneteenth', 'Freedom day', 'Juneteenth', 'Celebrating freedom, with good food and good company.',
    c('#14100c', '#faf3e8', '#f2c14e', '#f7d684', '#e8384f', '#3f9e5a', '#f2e2c6'), 'star', 'twinkle',
    ['What does freedom mean to you?', 'What is on the cookout menu today?', 'What is something you learned about history this year?']),
  look('labor', 'Labor Day', 'Last splash', 'Happy Labor Day', 'Summer\'s last long weekend. Fire up the grill one more time.',
    c('#0f1820', '#f2f7fb', '#f2a65a', '#f7c48c', '#7fc8e8', '#3f7f9e', '#e0ecf2'), 'bubble', 'rise',
    ['Last cookout of summer: what is on the grill?', 'Best thing you did this summer?', 'First job you ever had?']),
  look('winter', 'First day of winter', 'Longest night', 'First day of winter', 'The shortest day of the year. Light a fire and stay in.',
    c('#0c1320', '#f0f5fc', '#a8d0f2', '#c8e2f8', '#f2e2b0', '#5f7fb5', '#dfe8f5'), 'snow', 'fall',
    ['Snow: love it or done with it already?', 'Best thing to do on a snow day?', 'Hot chocolate or cider?']),
  // Not on the calendar by rule: the family's beach week and the day of a get-together (see specialDay).
  look('beach', 'Beach week', 'Toes in the sand', 'Beach week!', 'Sunscreen on, chairs out, tide coming in.',
    c('#08191e', '#effbfa', '#ffc46b', '#ffd899', '#ff8f7a', '#3fc7c9', '#fbe9cf'), 'bubble', 'rise',
    ['Beach photos, please!', 'Who is getting in the water first?', 'Best thing you ate on the trip?']),
  look('together', 'Get-together day', 'Everybody home', 'See you today!', 'Today is the day. Can\'t wait to see everybody.',
    c('#1a1020', '#fdf3f8', '#ffb347', '#ffcc80', '#ff7eb6', '#8f6bff', '#fbe3ef'), 'confetti', 'fall',
    ['Who is on their way?', 'What are you bringing?', 'Take pictures today and put them here.']),
]
const BY_KEY = Object.fromEntries(DAY_LOOKS.map((l) => [l.key, l]))

/** Looks whose painted art (public/art/bg-day-<key>.webp, hero-day-<key>.webp) exists; any other uses the month's. */
const UNPAINTED = ['mlk', 'groundhog', 'presidents', 'mardigras', 'spring', 'taxday', 'cinco', 'derby', 'flagday', 'juneteenth', 'labor', 'winter']
export const DAY_ART = new Set<string>(DAY_LOOKS.map((l) => l.key).filter((k) => !UNPAINTED.includes(k)))

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** The nth given weekday (0 = Sunday) of a month; n = -1 for the last one. */
function nth(y: number, m: number, weekday: number, n: number) {
  if (n > 0) return 1 + ((weekday - new Date(y, m - 1, 1).getDay() + 7) % 7) + (n - 1) * 7
  const lastDay = new Date(y, m, 0).getDate()
  return lastDay - ((new Date(y, m - 1, lastDay).getDay() - weekday + 7) % 7)
}
/** Easter Sunday as [month, day] (the usual Gregorian reckoning). */
function easter(y: number): [number, number] {
  const a = y % 19, b = Math.floor(y / 100), cc = y % 100
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(cc / 4) - h - (cc % 4)) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  return [Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1]
}

/** Every holiday look's date in a year, as "M-D" → key. Later entries win a tie, so the bigger day goes last. */
function calendar(y: number): Record<string, string> {
  const [em, ed] = easter(y)
  const memorial = nth(y, 5, 1, -1), thanks = nth(y, 11, 4, 4), labor = nth(y, 9, 1, 1)
  const fat = new Date(y, em - 1, ed - 47) // Mardi Gras: 47 days before Easter
  const mardi: [number, number, string] = [fat.getMonth() + 1, fat.getDate(), 'mardigras']
  const list: [number, number, string][] = [
    [2, 2, 'groundhog'], [4, 15, 'taxday'], [5, 5, 'cinco'], [6, 14, 'flagday'], [3, 20, 'spring'], [12, 21, 'winter'],
    [1, nth(y, 1, 1, 3), 'mlk'], [2, nth(y, 2, 1, 3), 'presidents'], [5, nth(y, 5, 6, 1), 'derby'], [6, 19, 'juneteenth'],
    [9, labor, 'labor'], mardi,
    [3, 14, 'pi'], [4, 22, 'earth'], [6, 21, 'summer'], [9, 22, 'fall'], [4, 1, 'aprilfools'],
    [2, nth(y, 2, 0, 2), 'superbowl'], [5, memorial - 1, 'indy500'], [9, labor + 6, 'grandparents'],
    [11, thanks + 1, 'blackfriday'],
    [1, 1, 'newyear'], [2, 14, 'valentine'], [3, 17, 'stpatrick'], [em, ed, 'easter'],
    [5, nth(y, 5, 0, 2), 'mothers'], [5, memorial, 'memorial'], [6, nth(y, 6, 0, 3), 'fathers'], [7, 4, 'july4'],
    [10, 31, 'halloween'], [11, 11, 'veterans'], [11, thanks, 'thanksgiving'],
    [12, 24, 'xmas-eve'], [12, 25, 'christmas'], [12, 31, 'nye'],
  ]
  return Object.fromEntries(list.map(([m, d, k]) => [`${m}-${d}`, k]))
}

// The family's own days. Trips are listed here; get-together days come from the list Home last loaded.
const TRIPS: { from: string; to: string; key: string }[] = [{ from: '2027-07-17', to: '2027-07-24', key: 'beach' }]
const GATHER_KEY = 'family:gathering-days'

/** Home hands over the days of the get-togethers that are still on, so the site can dress up on the day. */
export function rememberGatherings(days: { day: string; title: string }[]) {
  try { localStorage.setItem(GATHER_KEY, JSON.stringify(days)) } catch { /* private mode */ }
}
function gatheringOn(k: string): string | null {
  try {
    const list = JSON.parse(localStorage.getItem(GATHER_KEY) ?? '[]') as { day: string; title: string }[]
    return list.find((g) => g.day === k)?.title ?? null
  } catch { return null }
}

/** Today's one-day look, if today has one. ?day=halloween in the address previews any of them. */
export function specialDay(d = new Date()): DayLook | null {
  const want = new URLSearchParams(window.location.search).get('day')
  if (want && BY_KEY[want]) return BY_KEY[want]
  const k = dayKey(d)
  const holiday = calendar(d.getFullYear())[`${d.getMonth() + 1}-${d.getDate()}`]
  if (holiday) return BY_KEY[holiday]
  const title = gatheringOn(k)
  if (title) return { ...BY_KEY.together, title, tagline: `${title} is today!` }
  const trip = TRIPS.find((t) => k >= t.from && k <= t.to)
  return trip ? BY_KEY[trip.key] : null
}
