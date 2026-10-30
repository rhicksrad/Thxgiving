import type { Gathering } from './types'

// Every date shows in the family's time zone no matter where the phone is. Change it here if the
// gathering moves (and in schema.sql, where Thanksgiving 2026 is seeded).
export const TZ = 'America/Indiana/Indianapolis'

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts })
const dayFmt = fmt({ weekday: 'short', month: 'short', day: 'numeric' })
const longDayFmt = fmt({ weekday: 'long', month: 'long', day: 'numeric' })
const timeFmt = fmt({ hour: 'numeric', minute: '2-digit' })
const weekdayFmt = fmt({ weekday: 'short' })
const fullDayFmt = fmt({ dateStyle: 'full' })
const ymdFmt = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' })
const isoDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const isoTimeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const gatheringDay = (g: Gathering, long = false) => (long ? longDayFmt : dayFmt).format(new Date(g.starts_at))
export const gatheringTime = (g: Gathering) => (g.time_tbd ? 'Time TBD' : timeFmt.format(new Date(g.starts_at)))
export const clock = (iso: string) => timeFmt.format(new Date(iso))
export const ymd = (d: Date) => ymdFmt.format(d) // MM/DD/YYYY in the family's zone, good for same-day checks
export const fullDay = (iso: string) => fullDayFmt.format(new Date(iso)) // "Thursday, November 26, 2026"

export function when(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (ymd(d) === ymd(now)) return clock(iso)
  const diffDays = (now.getTime() - d.getTime()) / 86400000
  if (diffDays < 6) return `${weekdayFmt.format(d)} ${clock(iso)}`
  return `${dayFmt.format(d)}, ${clock(iso)}`
}

// A gathering stays "current" through the end of its day.
export function gatheringEnd(g: Gathering) {
  return new Date(g.starts_at).getTime() + (g.time_tbd ? 30 : 12) * 3600_000
}
export const isPast = (g: Gathering) => gatheringEnd(g) < Date.now()
export const isToday = (g: Gathering) => !isPast(g) && ymd(new Date(g.starts_at)) === ymd(new Date())

/** The date and time inputs' values ("2026-11-26", "14:00") for a moment, in the family's zone. */
export const dateInput = (iso: string) => isoDayFmt.format(new Date(iso))
export const timeInput = (iso: string) => isoTimeFmt.format(new Date(iso))

/** A typed date and time ("2026-11-26", "14:00"), read as the family's time, as an ISO timestamp. */
export function fromInputs(date: string, time: string) {
  const wall = new Date(`${date}T${time || '12:00'}:00Z`) // the wall time, as if it were UTC
  // Shift by the zone's offset on that day (found by formatting the guess back), twice to settle across DST.
  let t = wall.getTime()
  for (let i = 0; i < 2; i++) {
    const shown = new Date(`${dateInput(new Date(t).toISOString())}T${timeInput(new Date(t).toISOString())}:00Z`)
    t += wall.getTime() - shown.getTime()
  }
  return new Date(t).toISOString()
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
