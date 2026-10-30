// Phone numbers are saved as digits with the country code and no "+" (13175550123). US numbers can be typed any way: (317) 555-0123, 317.555.0123, +1 317 555 0123.

/** Digits with the country code, or '' if it doesn't look like a phone number. Matches cleanPhone() in worker/index.js. */
export function cleanPhone(raw: string) {
  const d = raw.replace(/\D/g, '')
  const full = d.length === 10 ? `1${d}` : d
  return /^[0-9]{11,15}$/.test(full) ? full : ''
}

/** For showing: 13175550123 → (317) 555-0123. Other countries keep a plain +<digits>. */
export function formatPhone(digits?: string | null) {
  const d = (digits ?? '').replace(/\D/g, '')
  if (/^1\d{10}$/.test(d)) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return d ? `+${d}` : ''
}

