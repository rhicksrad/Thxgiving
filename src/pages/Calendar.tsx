import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarDays, ChevronLeft, ChevronRight, PartyPopper, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { api, seg } from '../lib/api'
import { useAuth } from '../auth'
import { dateInput, gatheringTime } from '../lib/format'
import { holidays } from '../lib/holidays'
import { upsertById, useLiveTable } from '../lib/realtime'
import type { CalendarEvent, Gathering } from '../lib/types'

// The family calendar: what anyone puts on it, every get-together, and the big six holidays.

type Item =
  | { kind: 'holiday'; key: string; title: string }
  | { kind: 'gathering'; key: string; title: string; g: Gathering }
  | { kind: 'event'; key: string; title: string; ev: CalendarEvent }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad = (n: number) => String(n).padStart(2, '0')
const todayStr = () => dateInput(new Date().toISOString()) // in the family's time zone

/** '2026-12-24' → 'Thursday, December 24' (the year too when it isn't this year). */
function longDay(day: string) {
  const d = new Date(`${day}T12:00:00Z`)
  const sameYear = day.slice(0, 4) === todayStr().slice(0, 4)
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}
/** '14:30' → '2:30 PM' */
function clock12(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}
/** Every day an event covers: just its day, or each day of a trip (capped, in case of typos). */
function* daysOf(ev: CalendarEvent) {
  const end = ev.end_day && ev.end_day > ev.day ? ev.end_day : ev.day
  const t = new Date(`${ev.day}T12:00:00Z`)
  for (let i = 0; i < 400; i++) {
    const d = t.toISOString().slice(0, 10)
    yield d
    if (d >= end) return
    t.setUTCDate(t.getUTCDate() + 1)
  }
}

export default function Calendar() {
  const { profiles } = useAuth()
  const today = todayStr()
  const [view, setView] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }))
  const [selected, setSelected] = useState(today)
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [e, g] = await Promise.all([api.get<CalendarEvent[]>('/events'), api.get<Gathering[]>('/gatherings')])
    if (e.data) setEvents(e.data); else setErr(e.error?.message ?? 'Could not load the calendar')
    if (g.data) setGatherings(g.data)
  }, [])
  useEffect(() => { load() }, [load])

  useLiveTable<CalendarEvent>('events', undefined, {
    onUpsert: (row) => setEvents((list) => upsertById(list ?? [], row)),
    onDelete: (id) => setEvents((list) => list?.filter((x) => x.id !== id) ?? list),
    onResync: load,
  })
  useLiveTable<Gathering>('gatherings', undefined, {
    onUpsert: (row) => setGatherings((list) => upsertById(list, row)),
    onDelete: (id) => setGatherings((list) => list.filter((x) => x.id !== id)),
    onResync: load,
  })

  // Everything on each day: holidays first, then get-togethers, then events (all-day ones before timed ones).
  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>()
    const add = (day: string, item: Item) => { const l = map.get(day); if (l) l.push(item); else map.set(day, [item]) }
    for (const y of [view.y - 1, view.y, view.y + 1]) for (const h of holidays(y)) add(h.day, { kind: 'holiday', key: `h${h.day}`, title: h.title })
    for (const g of gatherings) add(dateInput(g.starts_at), { kind: 'gathering', key: g.id, title: g.title, g })
    const sorted = [...(events ?? [])].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title))
    for (const ev of sorted) for (const d of daysOf(ev)) add(d, { kind: 'event', key: `${ev.id}${d}`, title: ev.title, ev })
    return map
  }, [events, gatherings, view.y])

  // The month as weeks, Sunday first, with the end of last month and start of next filling the gaps.
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m - 1, 1))
    const start = new Date(first)
    start.setUTCDate(1 - first.getUTCDay())
    const daysIn = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate()
    const count = Math.ceil((first.getUTCDay() + daysIn) / 7) * 7
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + i)
      return { day: d.toISOString().slice(0, 10), num: d.getUTCDate(), inMonth: d.getUTCMonth() === view.m - 1 }
    })
  }, [view])

  const move = (by: number) => setView(({ y, m }) => {
    const n = (y * 12 + (m - 1)) + by
    return { y: Math.floor(n / 12), m: (n % 12) + 1 }
  })
  const goToday = () => { setView({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }); setSelected(today) }
  const pick = (day: string) => {
    setSelected(day); setEditing(null)
    const y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7))
    if (y !== view.y || m !== view.m) setView({ y, m })
  }

  const remove = async (ev: CalendarEvent) => {
    if (!confirm(`Take "${ev.title}" off the calendar?`)) return
    const { error } = await api.del(`/events/${seg(ev.id)}`)
    if (error) setErr(error.message)
    else setEvents((list) => list?.filter((x) => x.id !== ev.id) ?? list)
  }

  const dayItems = byDay.get(selected) ?? []
  const isThisMonth = view.y === Number(today.slice(0, 4)) && view.m === Number(today.slice(5, 7))

  return (
    <div className="stack-lg">
      <section className="card stack cal">
        <div className="cal-head">
          <h1 className="display">{MONTHS[view.m - 1]} <span className="cal-year">{view.y}</span></h1>
          <div className="row">
            {!isThisMonth && <button className="btn ghost sm" onClick={goToday}>Today</button>}
            <button className="btn ghost sm icon" onClick={() => move(-1)} aria-label="Last month"><ChevronLeft size={18} /></button>
            <button className="btn ghost sm icon" onClick={() => move(1)} aria-label="Next month"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="cal-grid" role="grid" aria-label={`${MONTHS[view.m - 1]} ${view.y}`}>
          {WEEKDAYS.map((w) => <div key={w} className="cal-wd" role="columnheader">{w}</div>)}
          {cells.map((c) => {
            const items = byDay.get(c.day) ?? []
            const cls = ['cal-cell', c.inMonth ? '' : 'out', c.day === today ? 'today' : '', c.day === selected ? 'sel' : '',
              items.some((i) => i.kind === 'holiday') ? 'holiday' : ''].filter(Boolean).join(' ')
            return (
              <button key={c.day} className={cls} onClick={() => pick(c.day)} role="gridcell" aria-selected={c.day === selected}
                aria-label={`${longDay(c.day)}${items.length ? `: ${items.map((i) => i.title).join(', ')}` : ''}`}>
                <span className="cal-num">{c.num}</span>
                <span className="cal-items">
                  {items.slice(0, 3).map((i) => <span key={i.key} className={`cal-chip ${i.kind}`}><span>{i.title}</span></span>)}
                  {items.length > 3 && <span className="cal-more">+{items.length - 3}</span>}
                </span>
              </button>
            )
          })}
        </div>
        <div className="cal-key muted small">
          <span><i className="cal-dot holiday" />Holiday</span>
          <span><i className="cal-dot gathering" />Get-together</span>
          <span><i className="cal-dot event" />Family calendar</span>
        </div>
      </section>

      <section className="card stack">
        <div className="row spread wrap">
          <h2 className="display">{selected === today ? `Today · ${longDay(selected)}` : longDay(selected)}</h2>
          {editing === null && (
            <button className="btn gold sm" onClick={() => setEditing('new')}><Plus size={15} aria-hidden="true" />Add to the calendar</button>
          )}
        </div>
        {editing !== null && (
          <EventForm key={editing === 'new' ? `new${selected}` : editing.id} day={selected} ev={editing === 'new' ? null : editing}
            onDone={(saved) => {
              setEditing(null)
              if (saved) { setEvents((list) => upsertById(list ?? [], saved)); pick(saved.day) }
            }} />
        )}
        {err && <p className="error">{err}</p>}
        {events === null && !err ? <div className="loading">Loading…</div> : dayItems.length === 0 ? (
          editing === null && <div className="empty"><CalendarDays size={22} aria-hidden="true" />Nothing on this day yet.</div>
        ) : (
          <ul className="cal-list">
            {dayItems.map((i) => (
              <li key={i.key} className={`cal-entry ${i.kind}`}>
                {i.kind === 'holiday' && (<><Star size={16} aria-hidden="true" /><div className="grow"><b>{i.title}</b></div></>)}
                {i.kind === 'gathering' && (
                  <>
                    <PartyPopper size={16} aria-hidden="true" />
                    <Link className="grow" to={`/g/${i.g.id}`}><b>{i.title}</b>
                      <div className="muted small">{gatheringTime(i.g)}{i.g.place ? ` · ${i.g.place}` : ''} · open the sign-up board</div></Link>
                  </>
                )}
                {i.kind === 'event' && (
                  <>
                    <CalendarDays size={16} aria-hidden="true" />
                    <div className="grow">
                      <b>{i.title}</b>
                      <div className="muted small">
                        {i.ev.time ? clock12(i.ev.time) : 'All day'}
                        {i.ev.end_day && ` · ${longDay(i.ev.day)} to ${longDay(i.ev.end_day)}`}
                        {i.ev.created_by && profiles[i.ev.created_by] && ` · added by ${profiles[i.ev.created_by].display_name}`}
                      </div>
                      {i.ev.notes && <div className="cal-notes small">{i.ev.notes}</div>}
                    </div>
                    <button className="btn ghost sm icon" onClick={() => setEditing(i.ev)} aria-label={`Change ${i.title}`}><Pencil size={14} /></button>
                    <button className="btn ghost sm icon danger" onClick={() => remove(i.ev)} aria-label={`Remove ${i.title}`}><Trash2 size={14} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function EventForm({ day, ev, onDone }: { day: string; ev: CalendarEvent | null; onDone: (saved: CalendarEvent | null) => void }) {
  const [title, setTitle] = useState(ev?.title ?? '')
  const [start, setStart] = useState(ev?.day ?? day)
  const [end, setEnd] = useState(ev?.end_day ?? '')
  const [time, setTime] = useState(ev?.time ?? '')
  const [notes, setNotes] = useState(ev?.notes ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <form className="stack cal-form" onSubmit={async (e) => {
      e.preventDefault()
      setBusy(true); setErr(null)
      const body = { title: title.trim(), day: start, end_day: end && end !== start ? end : null, time: time || null, notes: notes.trim() || null }
      const { data, error } = ev ? await api.patch<CalendarEvent>(`/events/${seg(ev.id)}`, body) : await api.post<CalendarEvent>('/events', body)
      setBusy(false)
      if (error || !data) return setErr(error?.message ?? 'Could not save')
      onDone(data)
    }}>
      <input className="input" required maxLength={100} autoFocus placeholder="Grandma's birthday, beach trip, Jake's ballgame…"
        value={title} onChange={(e) => setTitle(e.target.value)} aria-label="What" />
      <div className="grid-3">
        <label className="field"><span className="label">Day</span>
          <input className="input" type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field"><span className="label">Time (blank = all day)</span>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="field"><span className="label">Last day (for trips)</span>
          <input className="input" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <textarea className="input" rows={2} maxLength={500} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button className="btn gold" disabled={busy}>{ev ? 'Save' : 'Add it'}</button>
        <button type="button" className="btn ghost" onClick={() => onDone(null)}>Cancel</button>
      </div>
    </form>
  )
}
