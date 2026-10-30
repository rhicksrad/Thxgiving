import { useEffect, useState } from 'react'
import type { Gathering } from '../lib/types'

/** Days, hours, minutes and seconds until it starts. */
export default function Countdown({ gathering }: { gathering: Gathering }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = new Date(gathering.starts_at).getTime() - now
  if (ms <= 0) return <div className="countdown live">{gathering.time_tbd ? "It's today!" : "It's time to eat!"}</div>
  const s = Math.floor(ms / 1000)
  const parts: [number, string][] = [
    [Math.floor(s / 86400), 'days'],
    [Math.floor((s % 86400) / 3600), 'hrs'],
    [Math.floor((s % 3600) / 60), 'min'],
    [s % 60, 'sec'],
  ]
  return (
    <div className="countdown">
      {parts.map(([n, l]) => (
        <div key={l} className="cd-cell">
          <span className="cd-num">{String(n).padStart(2, '0')}</span>
          <span className="cd-lbl">{l}</span>
        </div>
      ))}
    </div>
  )
}
