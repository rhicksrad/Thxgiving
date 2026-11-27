import { useSyncExternalStore } from 'react'
import { dayKey } from './days'

/**
 * Purdue game days. Each season's football and men's basketball schedule comes from ESPN's public feed
 * (no key; the browser asks for it directly and keeps the answer for half a day). On a game day the site
 * wears a game-day look, a different one for every game of the year: looks are dealt out in schedule order.
 */
export type Sport = 'fb' | 'bb'
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

const TEAM = '2509'
const FEED: Record<Sport, string> = {
  fb: `https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${TEAM}/schedule`,
  bb: `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${TEAM}/schedule`,
}
export const SPORT_NAME: Record<Sport, string> = { fb: 'football', bb: 'basketball' }

// Game-day looks, in the order a season hands them out. The names match the painted art
// (public/art/bg-game-<sport>-NN.webp and hero-game-<sport>-NN.webp).
const LOOKS: Record<Sport, string[]> = {
  fb: ['Opening kickoff', 'Tailgate', 'The big drum', 'Full steam ahead', 'Under the lights', 'Forged in gold', 'Homecoming',
    'Strike up the band', 'The student section', 'Frost on the field', 'Goal line', 'Rivalry week', 'Snow game',
    'Trophy case', 'Bowl trip', 'Victory fireworks'],
  bb: ['Tip-off', 'Hardwood', 'Nothing but net', 'The dome', 'Loud house', 'Fast break', 'From downtown', 'In the paint',
    'Pep band', 'Scoreboard glow', 'Squeaky sneakers', 'Road trip', 'Holiday hoops', 'Snowy night', 'New year, new game',
    'Winter grind', 'Buzzer beater', 'Full house', 'Chalk talk', 'Locker room', 'Gold out', 'Black out', 'Train whistle',
    'At the line', 'Crash the boards', 'Slam dunk', 'Rivalry night', 'Senior night', 'Cut down the nets', 'Hardware',
    'Bracket time', 'Tournament time', 'Selection day', 'The big dance', 'Survive and advance', 'Final buzzer'],
}
// Old gold and black every time, with the accent taking turns.
const ACCENTS: [string, string][] = [['#f5f1e6', '#8e8a7c'], ['#ffd76a', '#a8842e'], ['#e8e2d0', '#6f6a5c'], ['#f0c05a', '#9c7a2a']]

export type GameLook = { art: string; name: string; colors: { bg: string; text: string; gold: string; goldHi: string; rush: string; aged: string; dust: string } }
export function gameLook(g: Game): GameLook {
  const names = LOOKS[g.sport]
  const i = g.n % names.length
  const [rush, aged] = ACCENTS[i % ACCENTS.length]
  return {
    art: `game-${g.sport}-${String(i + 1).padStart(2, '0')}`, name: names[i],
    colors: { bg: '#12100b', text: '#f8f3e6', gold: '#cfb991', goldHi: '#e3d2ae', rush, aged, dust: '#efe6d0' },
  }
}

/** "Purdue vs Indiana" at home, "Purdue at Indiana" on the road. */
export const gameTitle = (g: Game) => `Purdue ${g.where === 'away' ? 'at' : 'vs'} ${g.opponent}`
export const gameTime = (g: Game) =>
  g.timed ? new Date(g.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time to be announced'

const KEY = 'family:purdue'
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
    const us = sides.find((s) => String(s?.team?.id) === TEAM)
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
    const res = await fetch(`${FEED[sport]}?seasontype=${type}`)
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
    const next = (await Promise.all([season('fb'), season('bb')])).flat()
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

/** Today's game, if there is one: football first when both play. ?game=fb-3 previews a look any day. */
export function gameToday(d = new Date()): Game | null {
  const want = /^(fb|bb)-(\d+)$/.exec(new URLSearchParams(window.location.search).get('game') ?? '')
  if (want) {
    const sport = want[1] as Sport, n = Number(want[2]) - 1
    return games.find((g) => g.sport === sport && g.n === n)
      ?? { id: 'preview', sport, at: d.toISOString(), day: dayKey(d), timed: true, opponent: 'the other guys', where: 'home', result: null, n }
  }
  const today = gamesOn(dayKey(d))
  return today.find((g) => g.sport === 'fb') ?? today[0] ?? null
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useGames = () => useSyncExternalStore(subscribe, () => games)
