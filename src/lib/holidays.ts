// The big six holidays, worked out for any year (so the calendar never runs out of them).
// Days are '2026-12-25' strings, the same as calendar events.

export type Holiday = { day: string; title: string }

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const weekday = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday

/** The nth weekday (1st Monday, 4th Thursday…) of a month. */
function nth(y: number, m: number, dow: number, n: number) {
  const first = 1 + ((dow - weekday(y, m, 1) + 7) % 7)
  return iso(y, m, first + 7 * (n - 1))
}

/** The last given weekday of a month. */
function last(y: number, m: number, dow: number) {
  const end = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return iso(y, m, end - ((weekday(y, m, end) - dow + 7) % 7))
}

export function holidays(year: number): Holiday[] {
  return [
    { day: iso(year, 1, 1), title: "New Year's Day" },
    { day: last(year, 5, 1), title: 'Memorial Day' },
    { day: iso(year, 7, 4), title: 'Independence Day' },
    { day: nth(year, 9, 1, 1), title: 'Labor Day' },
    { day: nth(year, 11, 4, 4), title: 'Thanksgiving' },
    { day: iso(year, 12, 25), title: 'Christmas' },
  ]
}
