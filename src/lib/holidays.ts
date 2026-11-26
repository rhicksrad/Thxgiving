// The big six holidays, worked out for any year. Days are YYYY-MM-DD.
const pad = (n: number) => String(n).padStart(2, '0')
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** The nth given weekday (0 = Sunday) of a month; n = -1 for the last one. */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  if (n > 0) {
    const first = new Date(y, m - 1, 1).getDay()
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  }
  const lastDay = new Date(y, m, 0).getDate()
  const last = new Date(y, m - 1, lastDay).getDay()
  return lastDay - ((last - weekday + 7) % 7)
}

export type Holiday = { day: string; name: string }

export function holidays(y: number): Holiday[] {
  return [
    { day: key(y, 1, 1), name: "New Year's Day" },
    { day: key(y, 5, nthWeekday(y, 5, 1, -1)), name: 'Memorial Day' },
    { day: key(y, 7, 4), name: 'Fourth of July' },
    { day: key(y, 9, nthWeekday(y, 9, 1, 1)), name: 'Labor Day' },
    { day: key(y, 11, nthWeekday(y, 11, 4, 4)), name: 'Thanksgiving' },
    { day: key(y, 12, 25), name: 'Christmas' },
  ]
}
