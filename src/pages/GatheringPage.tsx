import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  ArrowLeft, ArrowRight, Camera, CalendarClock, HandHelping, MapPin, MessageCircle, Pencil, StickyNote, UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { api, seg } from '../lib/api'
import { dateInput, fromInputs, gatheringDay, gatheringTime, isPast, isToday, timeInput } from '../lib/format'
import { useLiveTable, upsertById } from '../lib/realtime'
import type { Gathering, GatheringStats, Photo } from '../lib/types'
import List from '../components/Lists'
import Chat from '../components/Chat'
import RsvpCard, { headcount, useRsvps } from '../components/Rsvp'
import Countdown from '../components/Countdown'
import { byShot, Lightbox, PhotoGrid, stackDupes, Uploader, useStackKeys } from '../components/Photos'
import { scroller } from '../lib/scroller'

type Tab = 'food' | 'asks' | 'chat' | 'pics'

const TABS: { id: Tab; Icon: LucideIcon; label: string }[] = [
  { id: 'food', Icon: UtensilsCrossed, label: 'Food' },
  { id: 'asks', Icon: HandHelping, label: 'Help' },
  { id: 'chat', Icon: MessageCircle, label: 'Chat' },
  { id: 'pics', Icon: Camera, label: 'Photos' },
]

/** /g/:id — one gathering's board, by id (older years, or anything added by hand). */
export default function GatheringPage() {
  const { id } = useParams()
  const [gathering, setGathering] = useState<Gathering | null | undefined>(undefined)

  const load = useCallback(() => {
    if (!id) return
    api.get<Gathering | null>(`/gatherings/${seg(id)}`)
      .then(({ data, error }) => { if (!error) setGathering(data) })
  }, [id])

  useEffect(() => { setGathering(undefined); load() }, [load])
  useLiveTable<Gathering>('gatherings', id ? `id=eq.${id}` : undefined, { onUpsert: setGathering, onResync: load }, Boolean(id))

  if (gathering === undefined) return <div className="loading">Loading…</div>
  if (gathering === null) return <div className="card">That one isn't on the board. <Link to="/">Back home</Link></div>
  return (
    <div className="stack-lg">
      <Link to="/" className="back"><ArrowLeft size={16} aria-hidden="true" />Home</Link>
      <Board gathering={gathering} />
    </div>
  )
}

/** Everything for one gathering: when and where, who's coming, the food, help, chat and photos. */
export function Board({ gathering }: { gathering: Gathering }) {
  const id = gathering.id
  const [photos, setPhotos] = useState<Photo[]>([])
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>('food')
  const chatRef = useRef<HTMLElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  // The open photo goes by id, so a new upload landing at the front of the grid doesn't swap what's on screen.
  const [openId, setOpenId] = useState<string | null>(null)

  const loadPhotos = useCallback(() => {
    api.get<Photo[]>(`/photos?gathering=${seg(id)}`).then(({ data }) => { if (data) setPhotos(data) })
  }, [id])

  // Going from one gathering to another reuses this board, so clear the last one's photos first.
  useEffect(() => { setPhotos([]); setOpenId(null); loadPhotos() }, [loadPhotos])

  useLiveTable<Photo>('photos', `gathering_id=eq.${id}`, {
    onUpsert: (p) => setPhotos((cur) => (cur.some((x) => x.id === p.id) ? upsertById(cur, p) : [p, ...cur])),
    onDelete: (pid) => setPhotos((cur) => cur.filter((x) => x.id !== pid)),
    onResync: loadPhotos,
  })

  // ?tab=… (from the bell) opens that tab on phones; ?tab=chat also scrolls to the thread on wider screens.
  const wantTab = params.get('tab')
  useEffect(() => {
    const t = TABS.find((x) => x.id === wantTab)?.id
    if (!t) return
    setTab(t)
    if (t === 'chat') requestAnimationFrame(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [wantTab, id])

  // Phones: switching tabs brings the tab bar to the top so the list or chat is right there.
  const pickTab = (t: Tab) => {
    setTab(t)
    const el = tabsRef.current
    if (!el || getComputedStyle(el).display === 'none') return
    const box = scroller()
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    const stuckAt = parseFloat(getComputedStyle(el).top) || 0
    requestAnimationFrame(() => box.scrollTo({ top: Math.max(0, top - stuckAt) }))
  }

  const byId = useMemo(() => ({ [gathering.id]: gathering }), [gathering])
  const stackKey = useStackKeys(photos)
  // The day in the order it happened, with the same pic from more than one person stacked into one tile.
  const shots = useMemo(() => stackDupes(byShot(photos, byId), stackKey), [photos, byId, stackKey])
  const open = openId ? shots.findIndex((p) => p.id === openId) : -1
  const past = isPast(gathering)

  return (
    <div className="stack-lg gathering-page">
      <Hero gathering={gathering} />

      <section className="card gathering-details">
        <div className="grid-2">
          <EditableField gathering={gathering} field="place" Icon={MapPin} label="Where" placeholder="Whose house? Add the address" />
          <EditableField gathering={gathering} field="notes" Icon={StickyNote} label="Notes" placeholder="Parking, bring a chair, kids' table, anything else" />
        </div>
      </section>

      <RsvpCard gathering={gathering} />

      <div className="tabs" ref={tabsRef}>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => pickTab(t.id)} aria-pressed={tab === t.id}>
            <t.Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>{t.label}{t.id === 'pics' && shots.length ? ` ${shots.length}` : ''}</span>
          </button>
        ))}
      </div>

      <div className="gathering-grid">
        <div className={`gp-section gp-food ${tab === 'food' ? 'active' : ''}`}>
          <List gatheringId={id} kind="food" />
        </div>
        <div className={`gp-section gp-asks ${tab === 'asks' ? 'active' : ''}`}>
          <List gatheringId={id} kind="ask" />
        </div>
        <section ref={chatRef} className={`gp-section gp-chat card ${tab === 'chat' ? 'active' : ''}`}>
          <h3 className="display panel-title"><MessageCircle size={20} aria-hidden="true" />{gathering.title} chat</h3>
          <Chat gatheringId={id} placeholder={past ? 'Share a memory…' : 'Plans, questions, who\'s driving…'} />
        </section>
        <section className={`gp-section gp-pics card ${tab === 'pics' ? 'active' : ''}`}>
          <div className="panel-head">
            <h3 className="display"><Camera size={20} aria-hidden="true" />Photos</h3>
            <Link to={`/gallery?gathering=${id}`} className="link-btn">Open in gallery<ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <Uploader gatherings={[gathering]} defaultGatheringId={id}
            onUploaded={(p) => setPhotos((cur) => (cur.some((x) => x.id === p.id) ? cur : [p, ...cur]))} />
          {photos.length ? <PhotoGrid photos={shots} gatherings={byId} onOpen={(i) => setOpenId(shots[i].id)} />
            : <div className="empty"><Camera size={22} aria-hidden="true" />No photos yet. Add the first one!</div>}
        </section>
      </div>

      {open >= 0 && (
        <Lightbox photos={shots} index={open} gatherings={byId} onClose={() => setOpenId(null)} onIndex={(i) => setOpenId(shots[i].id)}
          onDeleted={(pid) => { setPhotos((cur) => cur.filter((x) => x.id !== pid)); setOpenId(null) }} />
      )}
    </div>
  )
}

function Hero({ gathering }: { gathering: Gathering }) {
  const [editing, setEditing] = useState(false)
  const [rsvps] = useRsvps(gathering.id)
  const [stats, setStats] = useState<GatheringStats | null>(null)
  const loadStats = useCallback(() => {
    api.get<GatheringStats | null>(`/stats/${seg(gathering.id)}`).then(({ data, error }) => { if (!error) setStats(data) })
  }, [gathering.id])
  useEffect(() => { setStats(null); loadStats() }, [loadStats])
  // The totals come from the lists, so recount whenever something on them changes.
  useLiveTable<{ id: string }>('list_items', `gathering_id=eq.${gathering.id}`, { onUpsert: loadStats, onDelete: loadStats, onResync: loadStats })
  const past = isPast(gathering)
  return (
    <section className="hero card">
      <div className="hero-kicker">
        {isToday(gathering) ? <span className="badge live">Today!</span> : past ? <span className="badge">Looking back</span> : <span className="badge">Save the date</span>}
      </div>
      <h1 className="display huge">{gathering.title}</h1>
      <div className="hero-when">
        <span>{gatheringDay(gathering, true)}</span>
        <span className="dot">•</span>
        <span>{gatheringTime(gathering)}</span>
        <button className="btn ghost sm icon" title="Change the name, date or time" aria-label="Change the name, date or time"
          onClick={() => setEditing((v) => !v)}><Pencil size={14} aria-hidden="true" /></button>
      </div>
      {gathering.place && <div className="hero-lot"><MapPin size={15} aria-hidden="true" />{gathering.place}</div>}
      {editing && <EditWhen gathering={gathering} onDone={() => setEditing(false)} />}
      {!past && <Countdown gathering={gathering} />}
      {stats && (
        <div className="hero-stats">
          <Stat n={String(rsvps ? headcount(rsvps) : stats.coming)} label={past ? 'Were there' : 'Coming'} />
          <Stat n={`${stats.food_claimed}/${stats.food_total}`} label="Dishes covered" ok={stats.food_claimed >= stats.food_total} />
          <Stat n={String(stats.asks_open)} label="Still need help" ok={stats.asks_open === 0} />
        </div>
      )}
    </section>
  )
}

function Stat({ n, label, ok }: { n: string; label: string; ok?: boolean }) {
  return (
    <div className={`stat ${ok === true ? 'ok' : ok === false ? 'warn' : ''}`}>
      <span className="stat-n">{n}</span>
      <span className="stat-l">{label}</span>
    </div>
  )
}

/** Name, date and time. Leave the time blank while it's still being decided. */
function EditWhen({ gathering, onDone }: { gathering: Gathering; onDone: () => void }) {
  const [title, setTitle] = useState(gathering.title)
  const [date, setDate] = useState(dateInput(gathering.starts_at))
  const [time, setTime] = useState(gathering.time_tbd ? '' : timeInput(gathering.starts_at))
  const [err, setErr] = useState<string | null>(null)
  return (
    <form className="stack edit-when" onSubmit={async (e) => {
      e.preventDefault()
      const { error } = await api.patch(`/gatherings/${seg(gathering.id)}`,
        { title: title.trim() || gathering.title, starts_at: fromInputs(date, time), time_tbd: !time })
      if (error) return setErr(error.message)
      onDone()
    }}>
      <input className="input" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Name" />
      <div className="grid-2">
        <input className="input" required type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (blank if not decided)"
          title="Leave blank if the time isn't decided yet" />
      </div>
      <p className="muted small"><CalendarClock size={13} aria-hidden="true" /> Leave the time blank if it isn't decided yet.</p>
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button className="btn gold">Save</button>
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

function EditableField({ gathering, field, Icon, label, placeholder }: {
  gathering: Gathering; field: 'place' | 'notes'; Icon: LucideIcon; label: string; placeholder: string
}) {
  const [val, setVal] = useState(gathering[field] ?? '')
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setVal(gathering[field] ?? '') }, [gathering, field, focused])
  const save = async () => {
    setFocused(false)
    const v = val.trim()
    if (v === (gathering[field] ?? '')) return
    const { error } = await api.patch(`/gatherings/${seg(gathering.id)}`, { [field]: v || null })
    if (error) { setVal(gathering[field] ?? ''); alert(`Couldn't save that: ${error.message}`) }
  }
  return (
    <label className="field">
      <span className="label"><Icon size={14} aria-hidden="true" />{label}</span>
      <textarea className="input" rows={2} value={val} placeholder={placeholder} maxLength={500}
        onFocus={() => setFocused(true)} onChange={(e) => setVal(e.target.value)} onBlur={save} />
    </label>
  )
}
