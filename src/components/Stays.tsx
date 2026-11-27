import { useCallback, useEffect, useState } from 'react'
import { Building2, Pencil } from 'lucide-react'
import { api, seg } from '../lib/api'
import { useAuth } from '../auth'
import { Avatar, nameOf } from './Avatar'

type Stay = { gathering_id: string; user_id: string; place: string | null }

/** On a trip: which condo (or house, or room) each person is in. Everyone sets their own. */
export default function Stays({ gatheringId }: { gatheringId: string }) {
  const { me, profiles } = useAuth()
  const [rows, setRows] = useState<Stay[] | null>(null)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get<Stay[]>(`/gatherings/${seg(gatheringId)}/stays`).then(({ data }) => { if (data) setRows(data) })
  }, [gatheringId])
  useEffect(() => { setRows(null); setEditing(false); load() }, [load])

  const mine = rows?.find((r) => r.user_id === me?.id)
  const others = (rows ?? []).filter((r) => r.user_id !== me?.id)
    .sort((a, b) => (a.place ?? '').localeCompare(b.place ?? '', undefined, { numeric: true }) || nameOf(profiles[a.user_id]).localeCompare(nameOf(profiles[b.user_id])))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await api.put<Stay>(`/gatherings/${seg(gatheringId)}/stay`, { place: text.trim() })
    if (error) { setErr(error.message); return }
    setErr(null); setEditing(false); load()
  }

  return (
    <section className="card stays">
      <h3 className="display panel-title"><Building2 size={20} aria-hidden="true" />Who's in which condo</h3>
      {rows === null ? <div className="loading">Loading…</div> : (
        <>
          {mine && !editing ? (
            <div className="stay me">
              {me && <Avatar p={me} size={30} />}
              <span className="grow"><b>You</b><span className="muted"> · {mine.place}</span></span>
              <button className="btn ghost sm" onClick={() => { setText(mine.place ?? ''); setEditing(true) }}><Pencil size={14} aria-hidden="true" />Change</button>
            </div>
          ) : (
            <form className="add-row" onSubmit={save}>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={120}
                placeholder="Which condo are you in? Building, number…" aria-label="Which condo are you in?" />
              <button className="btn gold">Save</button>
              {editing && <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>}
            </form>
          )}
          {err && <p className="error">{err}</p>}
          {others.map((r) => (
            <div key={r.user_id} className="stay">
              <Avatar p={profiles[r.user_id]} size={30} />
              <span className="grow"><b>{nameOf(profiles[r.user_id])}</b><span className="muted"> · {r.place}</span></span>
            </div>
          ))}
          {!others.length && !mine && <p className="muted small">Nobody has said yet. Add yours so everyone knows where to find you.</p>}
        </>
      )}
    </section>
  )
}
