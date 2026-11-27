import { useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, Eye, Gift as GiftIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import type { Gift, Profile } from '../lib/types'

// Everyone has a gift list. Each thing on yours is shown to the whole family or only to the people you pick,
// and you can always see which. What someone says they're getting you is never sent to your phone at all.
export default function Gifts() {
  const { me, profiles } = useAuth()
  const [gifts, setGifts] = useState<Gift[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [who, setWho] = useState<string | null>(null) // whose list is open; null is your own
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  useEffect(() => {
    api.get<Gift[]>('/gifts').then(({ data, error }) => { if (data) setGifts(data); else setErr(error?.message ?? 'Could not load the lists') })
  }, [])

  const others = useMemo(
    () => Object.values(profiles).filter((p) => p.id !== me?.id).sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [profiles, me?.id],
  )
  const put = (g: Gift) => setGifts((all) => (all ?? []).some((x) => x.id === g.id) ? (all ?? []).map((x) => (x.id === g.id ? g : x)) : [...(all ?? []), g])
  const name = (id: string) => profiles[id]?.display_name ?? 'Someone'
  const owner = who ?? me?.id ?? ''
  const shown = (gifts ?? []).filter((g) => g.owner_id === owner)
  const count = (id: string) => (gifts ?? []).filter((g) => g.owner_id === id).length

  const claim = async (g: Gift, on: boolean) => {
    setErr(null)
    const { data, error } = on ? await api.post<Gift>(`/gifts/${g.id}/claim`) : await api.del<Gift>(`/gifts/${g.id}/claim`)
    if (data) put(data); else setErr(error?.message ?? 'That did not work')
  }
  const remove = async (g: Gift) => {
    if (!window.confirm(`Take "${g.title}" off your list?`)) return
    const { error } = await api.del(`/gifts/${g.id}`)
    if (error) setErr(error.message); else setGifts((all) => (all ?? []).filter((x) => x.id !== g.id))
  }

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="display"><GiftIcon size={30} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 10, color: 'var(--gold)' }} />Gift lists</h1>
        <p className="muted">Put what you'd like on your list and choose who can see each thing. Tap someone to see theirs and call what you're getting.</p>
      </header>

      <div className="gift-people">
        <button className={`chip ${who === null ? 'on' : ''}`} onClick={() => { setWho(null); setEditing(null) }}>My list <span>{count(me?.id ?? '')}</span></button>
        {others.map((p) => (
          <button key={p.id} className={`chip ${who === p.id ? 'on' : ''}`} onClick={() => { setWho(p.id); setEditing(null) }}>
            {p.display_name} <span>{count(p.id)}</span>
          </button>
        ))}
      </div>

      {err && <p className="error">{err}</p>}
      {gifts === null && !err && <div className="loading">Loading…</div>}

      {gifts !== null && who === null && (
        <section className="gift-list">
          {editing === 'new'
            ? <GiftForm others={others} onDone={(g) => { if (g) put(g); setEditing(null) }} />
            : <button className="btn gold" onClick={() => setEditing('new')}><Plus size={18} aria-hidden="true" />Add to my list</button>}
          {shown.length === 0 && editing !== 'new' && <p className="muted">Nothing on your list yet. Add a few things so nobody has to guess.</p>}
          {shown.map((g) => editing === g.id
            ? <GiftForm key={g.id} gift={g} others={others} onDone={(n) => { if (n) put(n); setEditing(null) }} />
            : (
              <article key={g.id} className="card gift">
                <GiftBody g={g} />
                <div className="gift-foot">
                  <span className="gift-sees"><Eye size={15} aria-hidden="true" />
                    {g.everyone ? 'Everyone can see this' : `Only ${list((g.viewers ?? []).map(name))} can see this`}
                  </span>
                  <span className="row">
                    <button className="btn ghost sm" onClick={() => setEditing(g.id)}><Pencil size={14} aria-hidden="true" />Change</button>
                    <button className="btn ghost sm danger icon" aria-label={`Remove ${g.title}`} onClick={() => remove(g)}><Trash2 size={14} aria-hidden="true" /></button>
                  </span>
                </div>
              </article>
            ))}
          {shown.length > 0 && <p className="muted small">You can't see who's getting what on your own list, so it stays a surprise.</p>}
        </section>
      )}

      {gifts !== null && who !== null && (
        <section className="gift-list">
          {shown.length === 0 && <p className="muted">{name(who)} hasn't put anything you can see on their list yet.</p>}
          {shown.map((g) => {
            const mine = g.claimed_by === me?.id
            return (
              <article key={g.id} className={`card gift ${g.claimed_by ? 'taken' : ''}`}>
                <GiftBody g={g} />
                <div className="gift-foot">
                  {g.claimed_by
                    ? <span className="gift-taken"><Check size={16} aria-hidden="true" />{mine ? "You're getting this" : `${name(g.claimed_by)} is getting this`}</span>
                    : <span className="gift-sees">Nobody has called this one yet</span>}
                  {mine && <button className="btn ghost sm" onClick={() => claim(g, false)}>Never mind</button>}
                  {!g.claimed_by && <button className="btn gold sm" onClick={() => claim(g, true)}>I'll get this</button>}
                </div>
              </article>
            )
          })}
          {shown.length > 0 && <p className="muted small">{name(who)} can't see who is getting what.</p>}
        </section>
      )}
    </div>
  )
}

/** "A", "A and B", "A, B and C". */
const list = (names: string[]) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'Link' } }

function GiftBody({ g }: { g: Gift }) {
  return (
    <>
      <div className="gift-top"><b>{g.title}</b>{g.price && <span className="gift-price">{g.price}</span>}</div>
      {g.note && <p className="gift-note">{g.note}</p>}
      {g.url && <a className="gift-link" href={g.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" />{host(g.url)}</a>}
    </>
  )
}

function GiftForm({ gift, others, onDone }: { gift?: Gift; others: Profile[]; onDone: (saved: Gift | null) => void }) {
  const [title, setTitle] = useState(gift?.title ?? '')
  const [url, setUrl] = useState(gift?.url ?? '')
  const [price, setPrice] = useState(gift?.price ?? '')
  const [note, setNote] = useState(gift?.note ?? '')
  const [everyone, setEveryone] = useState(gift?.everyone ?? true)
  const [viewers, setViewers] = useState<string[]>(gift?.viewers ?? [])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toggle = (id: string) => setViewers((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setErr('What is it? Give it a name.'); return }
    if (!everyone && viewers.length === 0) { setErr('Pick at least one person who can see it, or show it to everyone.'); return }
    const link = url.trim() && !/^https?:\/\//i.test(url.trim()) ? `https://${url.trim()}` : url.trim()
    const body = { title: title.trim(), url: link || null, price: price.trim() || null, note: note.trim() || null, everyone, viewers: everyone ? [] : viewers }
    setBusy(true); setErr(null)
    const { data, error } = gift ? await api.patch<Gift>(`/gifts/${gift.id}`, body) : await api.post<Gift>('/gifts', body)
    setBusy(false)
    if (data) onDone(data); else setErr(error?.message ?? 'Could not save that')
  }

  return (
    <form className="card gift-form" onSubmit={save}>
      <div className="row2">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="What would you like?" aria-label="What would you like?" autoFocus={!gift} />
        <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} maxLength={40} placeholder="About $" aria-label="About how much" />
      </div>
      <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} inputMode="url" placeholder="Link, if there is one" aria-label="Link" />
      <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Size, color, anything else" aria-label="Notes" />
      <label className="small">Who can see this?</label>
      <div className="gift-who">
        <button type="button" className={`chip ${everyone ? 'on' : ''}`} aria-pressed={everyone} onClick={() => setEveryone(true)}>Everyone</button>
        <button type="button" className={`chip ${everyone ? '' : 'on'}`} aria-pressed={!everyone} onClick={() => setEveryone(false)}>Only people I pick</button>
      </div>
      {!everyone && (
        <div className="gift-who">
          {others.map((p) => (
            <button type="button" key={p.id} className={`chip ${viewers.includes(p.id) ? 'on' : ''}`} aria-pressed={viewers.includes(p.id)} onClick={() => toggle(p.id)}>
              {viewers.includes(p.id) && <Check size={14} aria-hidden="true" />}{p.display_name}
            </button>
          ))}
        </div>
      )}
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button className="btn gold" disabled={busy}>{gift ? 'Save' : 'Add it'}</button>
        <button type="button" className="btn ghost" onClick={() => onDone(null)}>Cancel</button>
      </div>
    </form>
  )
}
