import { useSyncExternalStore } from 'react'
import { dayKey } from './days'

/**
 * Game days: Purdue football and men's basketball, and the Bears, Colts and Chiefs. Each season's schedule
 * comes from ESPN's public feed (no key; the browser asks for it directly and keeps the answer for half a day).
 * On a game day the site wears that team's game-day look, a different one for each game: looks are dealt out
 * in schedule order. When several of the family's teams play on one day, the look takes turns week to week.
 */
export type Sport = 'fb' | 'bb' | 'bears' | 'colts' | 'chiefs'
export type Game = {
  id: string
  sport: Sport
  at: string          // kickoff or tip, ISO
  day: string         // the visitor's own calendar day, YYYY-MM-DD
  timed: boolean      // false while the time is still to be announced
  opponent: string
  where: 'home' | 'away' | 'neutral'
  result: string | null // "W 31-24", once it's over
  n: number           // its place in that sport's season, from 0
}

type Colors = { bg: string; text: string; gold: string; goldHi: string; rush: string; aged: string; dust: string }
type Team = {
  name: string         // "Purdue", "Bears"
  what: string         // "Purdue football", "Bears"
  id: string           // ESPN's team id
  feed: string
  cheer: string        // under "Hicks Family" on game day
  colors: Colors
  accents: [string, string][] // the second and third accent take turns from game to game
  stripe: string[]
  looks: string[]      // one name per painted look, in the order a season hands them out
}
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports'
// Old gold and black for Purdue; each NFL team in its own colors.
const PURDUE: Pick<Team, 'name' | 'id' | 'cheer' | 'colors' | 'accents' | 'stripe'> = {
  name: 'Purdue', id: '2509', cheer: 'Boiler up!',
  colors: { bg: '#12100b', text: '#f8f3e6', gold: '#cfb991', goldHi: '#e3d2ae', rush: '#f5f1e6', aged: '#8e8a7c', dust: '#efe6d0' },
  accents: [['#f5f1e6', '#8e8a7c'], ['#ffd76a', '#a8842e'], ['#e8e2d0', '#6f6a5c'], ['#f0c05a', '#9c7a2a']],
  stripe: ['#cfb991', '#000000'],
}
const NFL_LOOKS = ['Kickoff', 'Tailgate', 'Watch party', 'Under the lights', 'Snow game', 'Red zone', 'Two-minute drill',
  'Home crowd', 'Road trip', 'Rivalry Sunday', 'Playoff push', 'Victory confetti']
export const TEAMS: Record<Sport, Team> = {
  fb: { ...PURDUE, what: 'Purdue football', feed: `${ESPN}/football/college-football/teams/2509/schedule`,
    looks: ['Opening kickoff', 'Tailgate', 'The big drum', 'Full steam ahead', 'Under the lights', 'Forged in gold', 'Homecoming',
      'Strike up the band', 'The student section', 'Frost on the field', 'Goal line', 'Rivalry week', 'Snow game',
      'Trophy case', 'Bowl trip', 'Victory fireworks'] },
  bb: { ...PURDUE, what: 'Purdue basketball', feed: `${ESPN}/basketball/mens-college-basketball/teams/2509/schedule`,
    looks: ['Tip-off', 'Hardwood', 'Nothing but net', 'The dome', 'Loud house', 'Fast break', 'From downtown', 'In the paint',
      'Pep band', 'Scoreboard glow', 'Squeaky sneakers', 'Road trip', 'Holiday hoops', 'Snowy night', 'New year, new game',
      'Winter grind', 'Buzzer beater', 'Full house', 'Chalk talk', 'Locker room', 'Gold out', 'Black out', 'Train whistle',
      'At the line', 'Crash the boards', 'Slam dunk', 'Rivalry night', 'Senior night', 'Cut down the nets', 'Hardware',
      'Bracket time', 'Tournament time', 'Selection day', 'The big dance', 'Survive and advance', 'Final buzzer'] },
  bears: { name: 'Bears', what: 'Bears', id: '3', feed: `${ESPN}/football/nfl/teams/3/schedule`, cheer: 'Bear down!',
    colors: { bg: '#0b1220', text: '#f4f6fb', gold: '#f26a2e', goldHi: '#f7915f', rush: '#dfe6f2', aged: '#3a5a8f', dust: '#e3e9f3' },
    accents: [['#dfe6f2', '#3a5a8f'], ['#ffb38a', '#2f4670']], stripe: ['#0b162a', '#f26a2e'], looks: NFL_LOOKS },
  colts: { name: 'Colts', what: 'Colts', id: '11', feed: `${ESPN}/football/nfl/teams/11/schedule`, cheer: 'For the Shoe!',
    colors: { bg: '#081426', text: '#f5f8fd', gold: '#5aa2f2', goldHi: '#8cc0f7', rush: '#ffffff', aged: '#2f6fc0', dust: '#e2ecf8' },
    accents: [['#ffffff', '#2f6fc0'], ['#cfe2fa', '#a5acaf']], stripe: ['#1f5fb5', '#ffffff'], looks: NFL_LOOKS },
  chiefs: { name: 'Chiefs', what: 'Chiefs', id: '12', feed: `${ESPN}/football/nfl/teams/12/schedule`, cheer: 'Go Chiefs!',
    colors: { bg: '#1c0b0d', text: '#fff3ee', gold: '#ffb81c', goldHi: '#ffcf5c', rush: '#ff5a66', aged: '#e31837', dust: '#ffe6b8' },
    accents: [['#ff5a66', '#e31837'], ['#fff3ee', '#c4142f']], stripe: ['#e31837', '#ffb81c'], looks: NFL_LOOKS },
}
const SPORTS = Object.keys(TEAMS) as Sport[]
/** Teams whose game-day art (public/art/bg-game-<team>-NN.webp, hero-game-<team>-NN.webp) is painted; the rest wear the month's. */
const PAINTED: Sport[] = ['fb', 'bb', 'bears', 'colts', 'chiefs']

export type GameLook = { art?: string; name: string; colors: Colors; stripe: string[] }
export function gameLook(g: Game): GameLook {
  const team = TEAMS[g.sport]
  const i = g.n % team.looks.length
  const [rush, aged] = team.accents[i % team.accents.length]
  return {
    art: PAINTED.includes(g.sport) ? `game-${g.sport}-${String(i + 1).padStart(2, '0')}` : undefined,
    name: team.looks[i], colors: { ...team.colors, rush, aged }, stripe: [...team.stripe, rush, team.stripe[1]],
  }
}

/** "Purdue vs Indiana" at home, "Purdue at Indiana" on the road. */
export const gameTitle = (g: Game) => `${TEAMS[g.sport].name} ${g.where === 'away' ? 'at' : 'vs'} ${g.opponent}`
export const gameTime = (g: Game) =>
  g.timed ? new Date(g.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time to be announced'

const KEY = 'family:games'
const FRESH = 12 * 3600_000
let games: Game[] = read().games
const listeners = new Set<() => void>()

function read(): { at: number; games: Game[] } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && Array.isArray(v.games)) return v
  } catch { /* private mode */ }
  return { at: 0, games: [] }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parse(sport: Sport, feed: any): Omit<Game, 'n'>[] {
  const out: Omit<Game, 'n'>[] = []
  for (const e of feed?.events ?? []) {
    const comp = e?.competitions?.[0]
    const sides: any[] = comp?.competitors ?? []
    const us = sides.find((s) => String(s?.team?.id) === TEAMS[sport].id)
    const them = sides.find((s) => s !== us)
    const at = new Date(e?.date)
    if (!us || !them || Number.isNaN(at.getTime())) continue
    const done = Boolean(comp?.status?.type?.completed)
    const pts = (s: any) => s?.score?.displayValue ?? (typeof s?.score === 'string' ? s.score : null)
    out.push({
      id: `${sport}:${e.id}`, sport, at: at.toISOString(), day: dayKey(at), timed: comp?.timeValid !== false,
      opponent: them.team?.shortDisplayName ?? them.team?.displayName ?? 'TBD',
      where: comp?.neutralSite ? 'neutral' : us.homeAway === 'home' ? 'home' : 'away',
      result: done && pts(us) != null && pts(them) != null ? `${us.winner ? 'W' : 'L'} ${pts(us)}-${pts(them)}` : null,
    })
  }
  return out
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function season(sport: Sport): Promise<Game[]> {
  // The regular season, then the postseason (bowl, conference and March tournaments), numbered straight through.
  const parts = await Promise.all([2, 3].map(async (type) => {
    const res = await fetch(`${TEAMS[sport].feed}?seasontype=${type}`)
    return res.ok ? parse(sport, await res.json()) : []
  }))
  const seen = new Set<string>()
  return parts.flat().filter((g) => !seen.has(g.id) && seen.add(g.id))
    .sort((a, b) => a.at.localeCompare(b.at)).map((g, n) => ({ ...g, n }))
}

/** Gets the schedules if what's kept is stale. Resolves true when they changed. A failed fetch keeps the old ones. */
export async function loadGames() {
  if (Date.now() - read().at < FRESH) return false
  try {
    // One team's feed failing doesn't lose the others: its last known games stay.
    const next = (await Promise.all(SPORTS.map((sp) => season(sp).then((list) => (list.length ? list : games.filter((g) => g.sport === sp)), () => games.filter((g) => g.sport === sp))))).flat()
    if (!next.length) return false
    const changed = JSON.stringify(next) !== JSON.stringify(games)
    games = next
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), games })) } catch { /* private mode */ }
    if (changed) listeners.forEach((l) => l())
    return changed
  } catch { return false }
}

/** The games on a day (the visitor's own calendar day). */
export const gamesOn = (day: string) => games.filter((g) => g.day === day)

/**
 * The game whose look today wears. With several teams playing, they take turns: the pick moves on one team
 * each week. ?game=fb-3 (or bears-1, colts-5…) previews a look any day.
 */
export function gameToday(d = new Date()): Game | null {
  const want = /^([a-z]+)-(\d+)$/.exec(new URLSearchParams(window.location.search).get('game') ?? '')
  if (want && want[1] in TEAMS) {
    const sport = want[1] as Sport, n = Number(want[2]) - 1
    return games.find((g) => g.sport === sport && g.n === n)
      ?? { id: 'preview', sport, at: d.toISOString(), day: dayKey(d), timed: true, opponent: 'the other guys', where: 'home', result: null, n }
  }
  const today = gamesOn(dayKey(d)).sort((a, b) => SPORTS.indexOf(a.sport) - SPORTS.indexOf(b.sport))
  if (!today.length) return null
  const week = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() / (7 * 86400_000))
  return today[week % today.length]
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useGames = () => useSyncExternalStore(subscribe, () => games)
