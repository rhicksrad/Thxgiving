import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Camera, ChevronRight, MessageCircle, Plus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fromInputs, gatheringDay, gatheringTime, isPast } from '../lib/format'
import { useLiveTable, upsertById } from '../lib/realtime'
import type { Gathering, GatheringStats } from '../lib/types'
import { InstallBanner } from '../components/Install'
import { Board } from './GatheringPage'

const byDate = (a: Gathering, b: Gathering) => a.starts_at.localeCompare(b.starts_at)

/** Home: the next gathering's board (Thanksgiving 2026), with every other one listed below it. */
export default function Home() {
  const [gatherings, setGatherings] = useState<Gathering[] | null>(null)
  const [stats, setStats] = useState<Record<string, GatheringStats>>({})

  const load = useCallback(async () => {
    const [g, s] = await Promise.all([
      supabase.from('gatherings').select('*').order('starts_at'),
      supabase.from('gathering_stats').select('*'),
    ])
    setGatherings((cur) => (g.error && cur ? cur : (g.data ?? []) as Gathering[])) // a failed refresh keeps the board on screen
    if (!s.error) setStats(Object.fromEntries(((s.data ?? []) as GatheringStats[]).map((x) => [x.gathering_id, x])))
  }, [])

  useEffect(() => { load() }, [load])

  useLiveTable<Gathering>('gatherings', undefined, {
    onUpsert: (g) => setGatherings((all) => (all ? upsertById(all, g).sort(byDate) : all)),
    onDelete: (id) => setGatherings((all) => all?.filter((g) => g.id !== id) ?? all),
    onResync: load,
  })

  // The board up top is the next one coming up, or the most recent if they're all past.
  const { featured, others } = useMemo(() => {
    const list = gatherings ?? []
    const featured = list.find((g) => !isPast(g)) ?? list[list.length - 1]
    return { featured, others: list.filter((g) => g !== featured).reverse() }
  }, [gatherings])

  if (!gatherings) return <div className="loading">Loading…</div>

  return (
    <div className="stack-lg">
      <InstallBanner />
      {featured ? <Board gathering={featured} /> : (
        <div className="card hero-empty">
          <h2 className="display">Nothing planned yet</h2>
          <p className="muted">Add a gathering below to get the lists going.</p>
        </div>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="section-title">Other gatherings</h2>
          <div className="gathering-list">
            {others.map((g) => <GatheringRow key={g.id} gathering={g} stats={stats[g.id]} />)}
          </div>
        </section>
      )}

      <AddGathering onAdded={load} />
    </div>
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
        <Plus size={15} aria-hidden="true" />Plan another get-together (Christmas, birthdays, next year…)
      </button>
    )
  }
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault()
        const { error } = await supabase.from('gatherings')
          .insert({ title: title.trim(), starts_at: fromInputs(date, time), time_tbd: !time })
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
