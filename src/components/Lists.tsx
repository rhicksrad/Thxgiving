import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, HandHelping, Plus, Star, Trash2, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { api, seg } from '../lib/api'
import { useLiveTable, upsertById } from '../lib/realtime'
import type { ListItem, ListKind } from '../lib/types'
import { useAuth } from '../auth'
import { Avatar, nameOf } from './Avatar'

const bySort = (a: ListItem, b: ListItem) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)

/**
 * One of a gathering's lists: who's bringing what (food), or supplies & help (ask).
 * Each row shows just the thing, who has it and one clear button; the rest (put someone else on it, a note,
 * removing it) opens under the row. Food ratings come forward once the day is over (`past`).
 */
export default function List({ gatheringId, kind, past = false }: { gatheringId: string; kind: ListKind; past?: boolean }) {
  const [items, setItems] = useState<ListItem[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [myScores, setMyScores] = useState<Record<string, number>>({}) // food item id → my rating (only mine is readable)

  const load = useCallback(() => {
    api.get<ListItem[]>(`/gatherings/${seg(gatheringId)}/items?kind=${kind}`).then(({ data, error }) => {
      setErr(error?.message ?? null)
      if (data) setItems(data)
      else setItems((cur) => cur ?? [])
    })
    if (kind === 'food') {
      api.get<{ item_id: string; score: number }[]>(`/gatherings/${seg(gatheringId)}/my-ratings`)
        .then(({ data }) => { if (data) setMyScores(Object.fromEntries(data.map((r) => [r.item_id, r.score]))) })
    }
  }, [gatheringId, kind])

  useEffect(() => { setItems(null); load() }, [load])

  // Realtime takes one filter, so the other list's rows come through too; skip them here.
  useLiveTable<ListItem>('list_items', `gathering_id=eq.${gatheringId}`, {
    onUpsert: (row) => row.kind === kind && setItems((cur) => (cur ? upsertById(cur, row) : cur)),
    onDelete: (id) => setItems((cur) => cur?.filter((x) => x.id !== id) ?? cur),
    onResync: load,
  })

  // Optimistic: update the screen now, then the database; realtime keeps everyone else in sync.
  const patch = async (id: string, changes: Partial<ListItem>) => {
    setItems((cur) => cur?.map((x) => (x.id === id ? { ...x, ...changes } : x)) ?? cur)
    const { error } = await api.patch(`/items/${seg(id)}`, changes)
    setErr(error?.message ?? null)
  }
  const add = async (label: string) => {
    const { data, error } = await api.post<ListItem>('/items', { gathering_id: gatheringId, kind, label })
    if (error || !data) return setErr(error?.message ?? 'Could not add that')
    setItems((cur) => (cur ? upsertById(cur, data) : cur))
  }
  // Anonymous 1–10 rating; null clears mine. The totals on the item are kept by the database and
  // arrive for everyone over realtime; adjust them here too so the change shows straight away.
  const rate = async (id: string, score: number | null) => {
    const prev = myScores[id] as number | undefined
    if (score === (prev ?? null)) return
    setMyScores((cur) => {
      const next = { ...cur }
      if (score === null) delete next[id]
      else next[id] = score
      return next
    })
    setItems((cur) => cur?.map((x) => x.id !== id ? x : {
      ...x,
      rating_sum: (x.rating_sum ?? 0) - (prev ?? 0) + (score ?? 0),
      rating_count: (x.rating_count ?? 0) - (prev === undefined ? 0 : 1) + (score === null ? 0 : 1),
    }) ?? cur)
    const { error } = await api.put(`/items/${seg(id)}/rating`, { score })
    setErr(error?.message ?? null)
    if (error) load()
  }
  const remove = async (id: string) => {
    setItems((cur) => cur?.filter((x) => x.id !== id) ?? cur)
    const { error } = await api.del(`/items/${seg(id)}`)
    setErr(error?.message ?? null)
  }

  if (!items) return <section className="panel card"><div className="loading">Loading the list…</div></section>
  const sorted = items.slice().sort(bySort)
  const ops = { patch, remove }

  if (kind === 'food') {
    const covered = sorted.filter((x) => x.owner_id || x.owner_name).length
    return (
      <Panel title="The Food" Icon={UtensilsCrossed} empty="Nothing on the menu yet. Add the first dish."
        done={covered} total={sorted.length} doneLabel="covered" addPlaceholder="Add a dish or drink…" onAdd={add} err={err}>
        {sorted.map((item) => <FoodRow key={item.id} item={item} {...ops} past={past} myScore={myScores[item.id]} rate={rate} />)}
      </Panel>
    )
  }
  const answered = sorted.filter((x) => x.status !== 'open').length
  return (
    <Panel title="Supplies & Help" Icon={HandHelping} empty="Nothing here yet. Chairs? Who's carving? Ask away."
      done={answered} total={sorted.length} doneLabel="sorted" addPlaceholder="Ask the family something…" onAdd={add} err={err}>
      {sorted.map((item) => <AskRow key={item.id} item={item} {...ops} />)}
    </Panel>
  )
}

function Panel({ title, Icon, empty, done, total, doneLabel, addPlaceholder, onAdd, err, children }: {
  title: string; Icon: LucideIcon; empty: string; done: number; total: number; doneLabel: string
  addPlaceholder: string; onAdd: (label: string) => void; err: string | null; children: React.ReactNode
}) {
  const [label, setLabel] = useState('')
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <section className="panel card">
      <header className="panel-head">
        <h3 className="display"><Icon size={20} aria-hidden="true" />{title}</h3>
        <span className={`chip ${total && done === total ? 'all-done' : ''}`}>{done}/{total} {doneLabel}</span>
      </header>
      {total > 0 && (
        <div className="list-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
          aria-label={`${done} of ${total} ${doneLabel}`}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      {err && <p className="error">{err}</p>}
      {Array.isArray(children) && children.length === 0
        ? <div className="empty"><Icon size={22} aria-hidden="true" />{empty}</div>
        : <ul className="items">{children}</ul>}
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (label.trim()) { onAdd(label.trim().slice(0, 200)); setLabel('') }
        }}
      >
        <input className="input" placeholder={addPlaceholder} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn ghost" disabled={!label.trim()}><Plus size={16} aria-hidden="true" />Add</button>
      </form>
    </section>
  )
}

type RowProps = { item: ListItem; patch: (id: string, c: Partial<ListItem>) => void; remove: (id: string) => void }

/** Who has it, as words: "You", "Aunt Linda", or nobody yet. */
function useOwner(item: ListItem) {
  const { me, profiles } = useAuth()
  const owner = item.owner_id ? profiles[item.owner_id] : null
  const mine = Boolean(me && item.owner_id === me.id)
  const name = mine ? 'You' : owner ? nameOf(owner) : item.owner_name
  return { me, owner, mine, name, taken: Boolean(item.owner_id || item.owner_name) }
}

function FoodRow({ item, patch, remove, past, myScore, rate }: RowProps & {
  past: boolean; myScore?: number; rate: (id: string, score: number | null) => void
}) {
  const { me, owner, mine, name, taken } = useOwner(item)
  const [open, setOpen] = useState(false)
  return (
    <li className={`item ${taken ? 'done' : 'open'} ${mine ? 'mine' : ''} ${open ? 'expanded' : ''}`}>
      <div className="item-row">
        <span className="item-who" aria-hidden="true">
          {owner ? <Avatar p={owner} size={34} /> : taken ? <Check size={16} strokeWidth={2.5} /> : null}
        </span>
        <div className="item-main">
          <div className="item-label">{item.label}</div>
          <div className="item-meta">
            {taken ? <span className="item-owner">{mine ? "You're bringing it" : `${name} has it`}</span> : <span className="item-open">Still needed</span>}
            {item.note && <span className="item-note">“{item.note}”</span>}
            {(item.rating_count ?? 0) > 0 && <Average item={item} />}
          </div>
        </div>
        {!taken && <button className="btn sm claim-btn" onClick={() => patch(item.id, { owner_id: me!.id, owner_name: null })}>I'll bring it</button>}
        {past && <Rating item={item} myScore={myScore} rate={rate} compact />}
        <More open={open} onToggle={() => setOpen((v) => !v)} label={item.label} />
      </div>
      {open && (
        <div className="item-more">
          <WhoPicker item={item} patch={patch} unset="Who's bringing it?" />
          <Note item={item} patch={patch} placeholder="Details: homemade, store-bought, how much…" />
          {!past && <Rating item={item} myScore={myScore} rate={rate} />}
          {mine && <button className="link-btn faint" onClick={() => patch(item.id, { owner_id: null })}>I can't bring it after all</button>}
          <RemoveButton onDelete={() => remove(item.id)} />
        </div>
      )}
    </li>
  )
}

function Average({ item }: { item: ListItem }) {
  const count = item.rating_count ?? 0
  return (
    <span className="rating-avg" title={`Average of ${count} anonymous rating${count === 1 ? '' : 's'}`}>
      <Star size={13} aria-hidden="true" />{((item.rating_sum ?? 0) / count).toFixed(1)}<span className="rating-count">({count})</span>
    </span>
  )
}

/** Your own anonymous 1–10 (everyone else only sees the average), which you can change or clear. */
function Rating({ item, myScore, rate, compact = false }: { item: ListItem; myScore?: number; rate: (id: string, score: number | null) => void; compact?: boolean }) {
  return (
    <select
      className={`who-pick rate-pick ${myScore ? 'set' : ''} ${compact ? 'compact' : ''}`}
      value={myScore ?? ''}
      title="Your rating is anonymous: everyone only sees the average"
      aria-label={`Rate ${item.label}, 1 to 10`}
      onChange={(e) => rate(item.id, e.target.value === 'clear' || e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">{compact ? 'Rate' : 'Rate it'}</option>
      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{myScore === n ? `You: ${n}/10` : `${n}/10`}</option>)}
      {myScore && <option value="clear">Clear my rating</option>}
    </select>
  )
}

function AskRow({ item, patch, remove }: RowProps) {
  const { name, taken } = useOwner(item)
  const [open, setOpen] = useState(false)
  const set = (status: ListItem['status']) => patch(item.id, { status: item.status === status ? 'open' : status })
  return (
    <li className={`item ask ${item.status} ${open ? 'expanded' : ''}`}>
      <div className="item-row">
        <span className={`ask-dot ${item.status}`} aria-hidden="true" />
        <div className="item-main">
          <div className="item-label">{item.label}</div>
          <div className="item-meta">
            {taken && <span className="item-owner">{name === 'You' ? "You're on it" : `${name}'s on it`}</span>}
            {item.note && <span className="item-note">“{item.note}”</span>}
            {!taken && !item.note && item.status === 'open' && <span className="item-open">Not sorted yet</span>}
          </div>
        </div>
        <div className="seg">
          <button className={item.status === 'yes' ? 'on yes' : ''} aria-pressed={item.status === 'yes'} onClick={() => set('yes')}>Yes</button>
          <button className={item.status === 'no' ? 'on no' : ''} aria-pressed={item.status === 'no'} onClick={() => set('no')}>No</button>
        </div>
        <More open={open} onToggle={() => setOpen((v) => !v)} label={item.label} />
      </div>
      {open && (
        <div className="item-more">
          <WhoPicker item={item} patch={patch} unset="Who's on it?" />
          <Note item={item} patch={patch} placeholder="The answer, or details" />
          <RemoveButton onDelete={() => remove(item.id)} />
        </div>
      )}
    </li>
  )
}

function More({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button className={`row-more ${open ? 'on' : ''}`} onClick={onToggle} aria-expanded={open} aria-label={`More for ${label}`} title="Who, notes, remove">
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  )
}

/**
 * Anyone can say who's got an item, not just claim it themselves, so whoever runs the list
 * can fill it in for everybody. "Someone else…" covers people who aren't on the site.
 */
function WhoPicker({ item, patch, unset }: { item: ListItem; patch: RowProps['patch']; unset: string }) {
  const { me, profiles } = useAuth()
  const family = Object.values(profiles)
    .filter((p) => p.id !== me?.id)
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
  const value = item.owner_id ?? (item.owner_name ? 'name' : '')
  return (
    <select
      className={`who-pick ${value ? 'set' : ''}`}
      value={value}
      title={unset}
      aria-label={unset}
      onChange={(e) => {
        const v = e.target.value
        if (v === 'name') return
        if (v === 'other') {
          const n = prompt("Who's got it? (someone who isn't on the site)", item.owner_name ?? '')?.trim()
          if (n) patch(item.id, { owner_id: null, owner_name: n.slice(0, 40) })
          return
        }
        patch(item.id, { owner_id: v || null, owner_name: null })
      }}
    >
      <option value="">{unset}</option>
      {me && <option value={me.id}>Me ({me.display_name})</option>}
      {family.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
      {item.owner_name && <option value="name">{item.owner_name}</option>}
      <option value="other">+ Someone else…</option>
    </select>
  )
}

/** Tap-to-edit note; saves on blur or Enter. */
function Note({ item, patch, placeholder }: { item: ListItem; patch: RowProps['patch']; placeholder: string }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(item.note ?? '')
  useEffect(() => { if (!editing) setVal(item.note ?? '') }, [item.note, editing])
  const save = () => {
    setEditing(false)
    const v = val.trim()
    if (v !== (item.note ?? '')) patch(item.id, { note: v || null })
  }
  if (editing) {
    return (
      <input className="input note-input" autoFocus value={val} maxLength={500} placeholder={placeholder}
        onChange={(e) => setVal(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
    )
  }
  return (
    <button className="link-btn faint" onClick={() => setEditing(true)}>
      <Plus size={13} aria-hidden="true" />{item.note ? 'Edit note' : 'Add a note'}
    </button>
  )
}

function RemoveButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button className="link-btn faint danger-link" onClick={() => confirm('Remove this from the list?') && onDelete()}>
      <Trash2 size={13} aria-hidden="true" />Remove
    </button>
  )
}
