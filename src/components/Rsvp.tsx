import { useCallback, useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLiveTable, upsertById } from '../lib/realtime'
import { isPast, plural } from '../lib/format'
import type { Gathering, Profile, Rsvp, RsvpStatus } from '../lib/types'
import { useAuth } from '../auth'
import { Avatar, nameOf } from './Avatar'

const MAX_GUESTS = 20 // the database caps it too

/** Everyone who said yes plus the people they're bringing. */
export const headcount = (rows: Rsvp[]) => rows.reduce((n, r) => (r.status === 'yes' ? n + 1 + r.guests : n), 0)

/** One gathering's RSVPs, kept live. */
export function useRsvps(gatheringId: string | undefined) {
  const [rows, setRows] = useState<Rsvp[] | null>(null)
  const load = useCallback(() => {
    if (!gatheringId) return
    supabase.from('rsvps').select('*').eq('gathering_id', gatheringId).then(({ data, error }) => {
      if (!error) setRows((data ?? []) as Rsvp[])
      else setRows((cur) => cur ?? [])
    })
  }, [gatheringId])
  useEffect(() => { setRows(null); load() }, [load])
  useLiveTable<Rsvp>('rsvps', gatheringId ? `gathering_id=eq.${gatheringId}` : undefined, {
    // One row per person: this also replaces the stand-in row a fresh answer shows before the save comes back.
    onUpsert: (r) => setRows((cur) => (cur ? upsertById(cur.filter((x) => x.user_id !== r.user_id || x.id === r.id), r) : cur)),
    onDelete: (id) => setRows((cur) => cur?.filter((x) => x.id !== id) ?? cur),
    onResync: load,
  }, Boolean(gatheringId))
  return [rows, setRows] as const
}

const CHOICES: { s: RsvpStatus; label: string; past: string }[] = [
  { s: 'yes', label: "I'll be there", past: 'I was there' },
  { s: 'maybe', label: 'Maybe', past: 'Sort of' },
  { s: 'no', label: "Can't make it", past: 'Missed it' },
]

/** Your answer for one gathering: in / maybe / out, and how many you're bringing. */
export function RsvpPicker({ gathering, rows, setRows }: {
  gathering: Gathering; rows: Rsvp[]; setRows: (f: (cur: Rsvp[] | null) => Rsvp[] | null) => void
}) {
  const { me } = useAuth()
  const [err, setErr] = useState<string | null>(null)
  const mine = rows.find((r) => r.user_id === me?.id)
  const past = isPast(gathering)

  // Optimistic: show it now, save it, and let realtime tell everyone else.
  const save = async (status: RsvpStatus, guests: number) => {
    if (!me) return
    const row: Rsvp = {
      id: mine?.id ?? `local-${me.id}`, gathering_id: gathering.id, user_id: me.id, status,
      guests: status === 'no' ? 0 : Math.max(0, Math.min(MAX_GUESTS, guests)), updated_at: new Date().toISOString(),
    }
    setRows((cur) => [...(cur ?? []).filter((r) => r.user_id !== me.id), row])
    const { data, error } = await supabase.from('rsvps')
      .upsert({ gathering_id: gathering.id, user_id: me.id, status: row.status, guests: row.guests, updated_at: row.updated_at },
        { onConflict: 'gathering_id,user_id' })
      .select().single()
    setErr(error?.message ?? null)
    if (data) setRows((cur) => [...(cur ?? []).filter((r) => r.user_id !== me.id), data as Rsvp])
  }

  return (
    <div className="rsvp-pick">
      <div className="seg rsvp-seg" role="group" aria-label={past ? 'Were you there?' : 'Are you coming?'}>
        {CHOICES.map((c) => (
          <button key={c.s} type="button" className={`${mine?.status === c.s ? 'on' : ''} ${c.s}`}
            aria-pressed={mine?.status === c.s} onClick={() => save(c.s, mine?.guests ?? 0)}>
            {past ? c.past : c.label}
          </button>
        ))}
      </div>
      {mine && mine.status !== 'no' && (
        <div className="guests" aria-label="People coming with you">
          <span className="muted small">{past ? 'Brought' : 'Bringing'}</span>
          <button type="button" className="btn ghost sm icon" aria-label="One fewer"
            disabled={mine.guests <= 0} onClick={() => save(mine.status, mine.guests - 1)}><Minus size={14} /></button>
          <span className="guests-n">{mine.guests ? `+${mine.guests}` : 'Just me'}</span>
          <button type="button" className="btn ghost sm icon" aria-label="One more"
            disabled={mine.guests >= MAX_GUESTS} onClick={() => save(mine.status, mine.guests + 1)}><Plus size={14} /></button>
        </div>
      )}
      {err && <p className="error small">{err}</p>}
    </div>
  )
}

/** Who's coming to a gathering: your answer, the headcount, and everyone's answers. */
export default function RsvpCard({ gathering }: { gathering: Gathering }) {
  const { profiles } = useAuth()
  const [rows, setRows] = useRsvps(gathering.id)
  const past = isPast(gathering)

  const groups = useMemo(() => {
    const list = rows ?? []
    const by = (s: RsvpStatus) => list.filter((r) => r.status === s)
      .sort((a, b) => nameOf(profiles[a.user_id]).localeCompare(nameOf(profiles[b.user_id])))
    const answered = new Set(list.map((r) => r.user_id))
    const quiet = (Object.values(profiles) as Profile[]).filter((p) => !answered.has(p.id))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    return { yes: by('yes'), maybe: by('maybe'), no: by('no'), quiet }
  }, [rows, profiles])

  if (!rows) return <section className="card rsvp-card"><div className="loading">Loading who's coming…</div></section>

  const total = headcount(rows)
  const guests = groups.yes.reduce((n, r) => n + r.guests, 0)
  return (
    <section className="card rsvp-card">
      <div className="panel-head">
        <h3 className="display"><Users size={20} aria-hidden="true" />{past ? 'Who came' : "Who's coming"}</h3>
        <span className="rsvp-total">
          <b>{total}</b> {past ? 'there' : 'coming'}
          {guests > 0 && <span className="muted small"> ({groups.yes.length} + {plural(guests, 'guest')})</span>}
          {groups.maybe.length > 0 && <span className="muted small"> · {groups.maybe.length} maybe</span>}
        </span>
      </div>
      <RsvpPicker gathering={gathering} rows={rows} setRows={setRows} />
      <WhoList label={past ? 'There' : 'Coming'} rows={groups.yes} profiles={profiles} tone="yes" />
      <WhoList label="Maybe" rows={groups.maybe} profiles={profiles} tone="maybe" />
      <WhoList label={past ? 'Missed it' : "Can't make it"} rows={groups.no} profiles={profiles} tone="no" />
      {!past && groups.quiet.length > 0 && (
        <p className="muted small rsvp-quiet">
          Haven't said yet: {groups.quiet.map((p) => nameOf(p)).join(', ')}
        </p>
      )}
    </section>
  )
}

function WhoList({ label, rows, profiles, tone }: { label: string; rows: Rsvp[]; profiles: Record<string, Profile>; tone: RsvpStatus }) {
  if (!rows.length) return null
  return (
    <div className={`rsvp-group ${tone}`}>
      <span className="rsvp-label">{label} · {rows.length}</span>
      <div className="rsvp-people">
        {rows.map((r) => (
          <span key={r.user_id} className="rsvp-person" title={r.guests ? `${nameOf(profiles[r.user_id])} + ${plural(r.guests, 'guest')}` : undefined}>
            <Avatar p={profiles[r.user_id]} size={24} />
            <span>{nameOf(profiles[r.user_id])}</span>
            {r.guests > 0 && <span className="rsvp-plus">+{r.guests}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
