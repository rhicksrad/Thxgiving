import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarPlus, ChevronLeft, ChevronRight, PartyPopper, Repeat, Star, Trash2, Users } from 'lucide-react'
import { api, seg } from '../lib/api'
import { useAuth } from '../auth'
import { dateInput, gatheringTime } from '../lib/format'
import { holidays } from '../lib/holidays'
import { useLiveTable, upsertById } from '../lib/realtime'
import type { FamilyEvent, Gathering } from '../lib/types'
import Spot from '../components/Spot'

/** One thing on a day: a holiday, a get-together (from its own page), or something someone added. */
type Item =
  | { kind: 'holiday'; key: string; title: string }
  | { kind: 'gathering'; key: string; title: string; time: string; id: string }
  | { kind: 'event'; key: string; title: string; time: string | null; ev: FamilyEvent; age?: number }

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const todayKey = () => dateInput(new Date().toISOString())
const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return { y, m, d } }
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }))
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const longDay = (k: string) => { const { y, m, d } = parse(k); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }
const shortDay = (k: string) => { const { y, m, d } = parse(k); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }
const clock = (t: string) => { const [h, mi] = t.split(':').map(Number); return new Date(2000, 0, 1, h, mi).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }

/** The family calendar: everyone's events, every get-together, and the big six holidays. */
export default function Calendar() {
  const today = todayKey()
  const [cursor, setCursor] = useState(() => { const { y, m } = parse(today); return { y, m } })
  const [selected, setSelected] = useState(today)
  const [events, setEvents] = useState<FamilyEvent[] | null>(null)
  const [gatherings, setGatherings] = useState<Gathering[]>([])

  const load = useCallback(async () => {
    const [e, g] = await Promise.all([api.get<FamilyEvent[]>('/events'), api.get<Gathering[]>('/gatherings')])
    setEvents((cur) => e.data ?? cur ?? [])
    if (g.data) setGatherings(g.data)
  }, [])
  useEffect(() => { load() }, [load])
  useLiveTable<FamilyEvent>('events', undefined, {
    onUpsert: (ev) => setEvents((all) => (all ? upsertById(all, ev) : all)),
    onDelete: (id) => setEvents((all) => all?.filter((x) => x.id !== id) ?? all),
    onResync: load,
  })
  useLiveTable<Gathering>('gatherings', undefined, {
    onUpsert: (g) => setGatherings((all) => upsertById(all, g)),
    onDelete: (id) => setGatherings((all) => all.filter((x) => x.id !== id)),
    onResync: load,
  })

  // Everything on a given day, holidays first, then by time.
  const itemsOn = useCallback((k: string): Item[] => {
    const { y } = parse(k)
    const out: Item[] = holidays(y).filter((h) => h.day === k).map((h) => ({ kind: 'holiday', key: `h:${h.day}`, title: h.name }))
    for (const g of gatherings) {
      if (dateInput(g.starts_at) === k) out.push({ kind: 'gathering', key: `g:${g.id}`, title: g.title, time: gatheringTime(g), id: g.id })
    }
    for (const ev of events ?? []) {
      const start = parse(ev.day)
      const end = ev.end_day ?? ev.day
      const hit = (k >= ev.day && k <= end) || (ev.yearly && y > start.y && k.slice(5) >= ev.day.slice(5) && k.slice(5) <= end.slice(5))
      if (hit) out.push({ kind: 'event', key: `e:${ev.id}:${k}`, title: ev.title, time: ev.time, ev, age: ev.yearly && y > start.y ? y - start.y : undefined })
    }
    const t = (i: Item) => (i.kind === 'holiday' ? '' : i.kind === 'event' ? i.time ?? '' : '')
    return out.sort((a, b) => t(a).localeCompare(t(b)))
  }, [events, gatherings])

  // The month grid: whole weeks, Sunday first.
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m - 1, 1).getDay()
    const days = new Date(cursor.y, cursor.m, 0).getDate()
    const list: (string | null)[] = Array(first).fill(null)
    for (let d = 1; d <= days; d++) list.push(dayKey(cursor.y, cursor.m, d))
    while (list.length % 7) list.push(null)
    return list
  }, [cursor])

  // The next few things from today on, a year out.
  const upcoming = useMemo(() => {
    const out: { day: string; item: Item }[] = []
    const seen = new Set<string>() // a trip shows once, on its first day (or today, if it's under way)
    const { y, m, d } = parse(today)
    for (let i = 0; i < 366 && out.length < 8; i++) {
      const k = dateInput(new Date(Date.UTC(y, m - 1, d + i, 12)).toISOString())
      for (const item of itemsOn(k)) {
        const id = item.kind === 'event' ? item.ev.id : item.key
        if (out.length < 8 && !seen.has(id)) { seen.add(id); out.push({ day: k, item }) }
      }
    }
    return out
  }, [itemsOn, today])

  const move = (n: number) => setCursor(({ y, m }) => { const t = new Date(y, m - 1 + n, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 } })
  const pick = (k: string) => { setSelected(k); const { y, m } = parse(k); setCursor({ y, m }) }

  return (
    <div className="stack-lg">
      <header className="page-head with-spot">
        <div>
          <h1 className="display">Family calendar</h1>
          <p className="muted">Birthdays, games, trips, anything. Everyone can add to it, and get-togethers and the big holidays are already on it.</p>
        </div>
        <Spot name="calendar" className="page-spot" />
      </header>

      <div className="cal-layout">
        <section className="card cal">
          <div className="cal-head">
            <button className="btn ghost sm icon" onClick={() => move(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <h2 className="display">{MONTHS[cursor.m - 1]} {cursor.y}</h2>
            <button className="btn ghost sm icon" onClick={() => move(1)} aria-label="Next month"><ChevronRight size={18} /></button>
            <button className="btn ghost sm cal-today" onClick={() => pick(today)}>Today</button>
          </div>
          <div className="cal-grid" role="grid">
            {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
            {cells.map((k, i) => {
              if (!k) return <div key={`x${i}`} className="cal-cell empty" />
              const items = itemsOn(k)
              return (
                <button key={k} className={`cal-cell${k === today ? ' today' : ''}${k === selected ? ' on' : ''}`} onClick={() => setSelected(k)}
                  aria-label={`${longDay(k)}${items.length ? `, ${items.length} on the calendar` : ''}`}>
                  <span className="cal-num">{parse(k).d}</span>
                  <span className="cal-chips">
                    {items.slice(0, 3).map((it) => <span key={it.key} className={`cal-chip ${it.kind}`}>{it.title}</span>)}
                    {items.length > 3 && <span className="cal-more">+{items.length - 3}</span>}
                  </span>
                  <span className="cal-dots" aria-hidden="true">{items.slice(0, 4).map((it) => <i key={it.key} className={it.kind} />)}</span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="stack-lg">
          <DayPanel day={selected} items={itemsOn(selected)} />
          <section className="card stack">
            <h2 className="display">Coming up</h2>
            {events === null ? <p className="muted small">Loading…</p> : (
              <ul className="cal-list">
                {upcoming.map(({ day, item }) => (
                  <li key={item.key}><button onClick={() => pick(day)}>
                    <span className="cal-list-day">{day === today ? 'Today' : shortDay(day)}</span>
                    <ItemLine item={item} />
                  </button></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function ItemLine({ item }: { item: Item }) {
  const Icon = item.kind === 'holiday' ? Star : item.kind === 'gathering' ? Users : item.ev.yearly ? Repeat : PartyPopper
  return (
    <span className={`cal-item ${item.kind}`}>
      <Icon size={15} aria-hidden="true" />
      <span className="cal-item-title">{item.title}{item.kind === 'event' && item.age ? ` (${item.age} yrs)` : ''}</span>
      {item.kind === 'gathering' && <span className="muted small">{item.time}</span>}
      {item.kind === 'event' && item.time && <span className="muted small">{clock(item.time)}</span>}
    </span>
  )
}

function DayPanel({ day, items }: { day: string; items: Item[] }) {
  const { profiles } = useAuth()
  const [adding, setAdding] = useState(false)
  useEffect(() => { setAdding(false) }, [day])
  return (
    <section className="card stack">
      <h2 className="display cal-day-title">{longDay(day)}</h2>
      {items.length === 0 && !adding && <p className="muted small">Nothing on the calendar yet.</p>}
      {items.length > 0 && (
        <ul className="cal-day-items">
          {items.map((it) => (
            <li key={it.key}>
              {it.kind === 'gathering' ? <Link to={`/g/${it.id}`}><ItemLine item={it} /></Link> : <ItemLine item={it} />}
              {it.kind === 'event' && (
                <div className="cal-ev-meta">
                  {it.ev.note && <p className="small">{it.ev.note}</p>}
                  <span className="muted small">
                    {it.ev.end_day ? `${shortDay(it.ev.day)} to ${shortDay(it.ev.end_day)} · ` : ''}{it.ev.yearly ? 'Every year · ' : ''}Added by {profiles[it.ev.created_by]?.display_name ?? 'family'}
                  </span>
                  <button className="btn ghost sm icon danger" aria-label={`Delete ${it.title}`} title="Delete" onClick={async () => {
                    if (!confirm(`Take "${it.title}" off the calendar${it.ev.yearly ? ' (every year)' : ''}?`)) return
                    const { error } = await api.del(`/events/${seg(it.ev.id)}`)
                    if (error) alert(error.message)
                  }}><Trash2 size={14} aria-hidden="true" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding ? <AddEvent day={day} onDone={() => setAdding(false)} /> : (
        <button className="btn gold" onClick={() => setAdding(true)}><CalendarPlus size={16} aria-hidden="true" />Add to this day</button>
      )}
    </section>
  )
}

function AddEvent({ day, onDone }: { day: string; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(day)
  const [time, setTime] = useState('')
  const [yearly, setYearly] = useState(false)
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form className="stack cal-add" onSubmit={async (e) => {
      e.preventDefault()
      setBusy(true); setErr(null)
      const { error } = await api.post('/events', { title: title.trim(), day: date, end_day: end || null, time: time || null, yearly, note: note.trim() || null })
      setBusy(false)
      if (error) return setErr(error.message)
      onDone()
    }}>
      <input className="input" required maxLength={80} placeholder="What is it? (Grandma's birthday, Colts game…)" value={title}
        onChange={(e) => setTitle(e.target.value)} aria-label="What is it" autoFocus />
      <div className="grid-2">
        <input className="input" required type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (blank for all day)" title="Leave blank for all day" />
      </div>
      <label className="cal-field small muted">Last day, for trips (optional)
        <input className="input" type="date" min={date} value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <textarea className="input" rows={2} maxLength={500} placeholder="Notes (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Notes" />
      <label className="cal-check"><input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />Every year (birthdays, anniversaries)</label>
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button className="btn gold" disabled={busy || !title.trim()}>{busy ? 'Adding…' : 'Add it'}</button>
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
