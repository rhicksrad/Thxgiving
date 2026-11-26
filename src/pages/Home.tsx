import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, CalendarDays, Camera, ChevronRight, Images, MapPin, MessageCircle, MessagesSquare, Plus, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import { useTheme } from '../lib/theme'
import { fromInputs, gatheringDay, gatheringTime, isPast, isToday } from '../lib/format'
import { useLiveTable, upsertById } from '../lib/realtime'
import type { Gathering, GatheringStats } from '../lib/types'
import { InstallBanner } from '../components/Install'
import Logo from '../components/Logo'
import Countdown from '../components/Countdown'

const byDate = (a: Gathering, b: Gathering) => a.starts_at.localeCompare(b.starts_at)

/** Home: the family's front page. This month's welcome, the next get-together, and every one before and after it. */
export default function Home() {
  const { me } = useAuth()
  const theme = useTheme()
  const [gatherings, setGatherings] = useState<Gathering[] | null>(null)
  const [stats, setStats] = useState<Record<string, GatheringStats>>({})

  const load = useCallback(async () => {
    const [g, s] = await Promise.all([api.get<Gathering[]>('/gatherings'), api.get<GatheringStats[]>('/stats')])
    setGatherings((cur) => (!g.data && cur ? cur : g.data ?? [])) // a failed refresh keeps the page on screen
    if (s.data) setStats(Object.fromEntries(s.data.map((x) => [x.gathering_id, x])))
  }, [])

  useEffect(() => { load() }, [load])

  useLiveTable<Gathering>('gatherings', undefined, {
    onUpsert: (g) => setGatherings((all) => (all ? upsertById(all, g).sort(byDate) : all)),
    onDelete: (id) => setGatherings((all) => all?.filter((g) => g.id !== id) ?? all),
    onResync: load,
  })

  // The next one coming up gets the spotlight; the rest are split into what's ahead and the archive (past or archived).
  const { next, upcoming, past } = useMemo(() => {
    const list = gatherings ?? []
    const done = (g: Gathering) => g.archived || isPast(g)
    const ahead = list.filter((g) => !done(g))
    return { next: ahead[0], upcoming: ahead.slice(1), past: list.filter(done).reverse() }
  }, [gatherings])

  const first = me?.display_name?.split(' ')[0]
  const monthName = new Date(2000, theme.month - 1, 1).toLocaleString('en-US', { month: 'long' })

  return (
    <div className="stack-lg">
      <InstallBanner />

      <section className="card welcome">
        <Logo size={84} className="welcome-mark" />
        <div className="welcome-text">
          <span className="badge">{monthName} · {theme.name}</span>
          <h1 className="display">{first ? `Welcome home, ${first}` : 'Welcome home'}</h1>
          <p className="welcome-greet">{theme.greeting}</p>
          <p className="muted small">This month: {theme.highlights}</p>
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">Coming up</h2>
        {!gatherings ? <div className="loading">Loading…</div> : next ? <NextUp gathering={next} stats={stats[next.id]} /> : (
          <div className="card hero-empty">
            <h3 className="display">Nothing on the calendar</h3>
            <p className="muted">Plan the next get-together below and everyone can sign up.</p>
          </div>
        )}
      </section>

      <nav className="quick-links">
        <Link to="/calendar" className="card quick"><CalendarDays size={22} aria-hidden="true" /><span><b>Calendar</b><span className="muted small">Birthdays, plans and holidays</span></span></Link>
        <Link to="/chat" className="card quick"><MessagesSquare size={22} aria-hidden="true" /><span><b>Family chat</b><span className="muted small">Talk about anything, any day</span></span></Link>
        <Link to="/gallery" className="card quick"><Images size={22} aria-hidden="true" /><span><b>Photos</b><span className="muted small">Every get-together's pictures</span></span></Link>
        <Link to="/family" className="card quick"><Users size={22} aria-hidden="true" /><span><b>Family</b><span className="muted small">Who's here, and your profile</span></span></Link>
      </nav>

      {upcoming.length > 0 && (
        <section>
          <h2 className="section-title">Also on the calendar</h2>
          <div className="gathering-list">
            {upcoming.map((g) => <GatheringRow key={g.id} gathering={g} stats={stats[g.id]} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="section-title">Archive</h2>
          <div className="gathering-list">
            {past.map((g) => <GatheringRow key={g.id} gathering={g} stats={stats[g.id]} />)}
          </div>
        </section>
      )}

      <AddGathering onAdded={load} />
    </div>
  )
}

/** The next get-together, in short: when, where, the countdown, and the way into its board. */
function NextUp({ gathering, stats }: { gathering: Gathering; stats?: GatheringStats }) {
  return (
    <Link to={`/g/${gathering.id}`} className="card next-up hero">
      <div className="hero-kicker">{isToday(gathering) ? <span className="badge live">Today!</span> : <span className="badge">Save the date</span>}</div>
      <h3 className="display next-title">{gathering.title}</h3>
      <div className="hero-when">
        <span>{gatheringDay(gathering, true)}</span>
        <span className="dot">•</span>
        <span>{gatheringTime(gathering)}</span>
      </div>
      {gathering.place && <div className="hero-lot"><MapPin size={15} aria-hidden="true" />{gathering.place}</div>}
      <Countdown gathering={gathering} />
      {stats && (
        <div className="muted small next-stats">
          {stats.coming} coming · {stats.food_claimed}/{stats.food_total} dishes covered
        </div>
      )}
      <span className="btn gold">Open the sign-up board<ArrowRight size={16} aria-hidden="true" /></span>
    </Link>
  )
}

function GatheringRow({ gathering, stats }: { gathering: Gathering; stats?: GatheringStats }) {
  return (
    <Link to={`/g/${gathering.id}`} className="gathering-row card">
      <div className="gr-main">
        <div className="gr-title">{gathering.title}</div>
        <div className="muted small">{gatheringDay(gathering)}, {new Date(gathering.starts_at).getFullYear()} · {gatheringTime(gathering)}</div>
      </div>
      {stats && (
        <span className="gr-stats">
          <span title="Coming"><Users size={13} aria-hidden="true" />{stats.coming}</span>
          <span title="Messages"><MessageCircle size={13} aria-hidden="true" />{stats.message_count}</span>
          <span title="Photos"><Camera size={13} aria-hidden="true" />{stats.photo_count}</span>
        </span>
      )}
      <ChevronRight size={18} className="chev" aria-hidden="true" />
    </Link>
  )
}

function AddGathering({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [err, setErr] = useState<string | null>(null)

  if (!open) {
    return (
      <button className="btn ghost sm add-gathering-toggle" onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" />Plan a get-together (birthdays, holidays, cookouts…)
      </button>
    )
  }
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault()
        const { error } = await api.post('/gatherings', { title: title.trim(), starts_at: fromInputs(date, time), time_tbd: !time })
        if (error) return setErr(error.message)
        setOpen(false); setTitle(''); setDate(''); setTime(''); onAdded()
      }}
    >
      <h3 className="display">Plan a get-together</h3>
      <p className="muted small">It gets its own food list, help list, chat and photos.</p>
      <div className="grid-3">
        <input className="input" required maxLength={80} placeholder="Christmas 2026" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input" required type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} title="Leave blank if not decided" aria-label="Time" />
      </div>
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button className="btn gold">Add it</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}
