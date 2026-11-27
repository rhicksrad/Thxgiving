import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft, KeyRound, LockKeyhole, Plus, SendHorizontal, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { api, seg } from '../lib/api'
import { useAuth } from '../auth'
import { useLiveTable } from '../lib/realtime'
import { clock, fullDay, when } from '../lib/format'
import { Avatar, nameOf } from '../components/Avatar'
import { RichText } from '../components/Chat'
import ChatSwitch from '../components/ChatSwitch'
import type { Profile } from '../lib/types'
import {
  createKey, openConversations, refreshKeys, refreshUnread, setUnread, startDm, unlock, useDm, useKeyIndex,
  type Conversation,
} from '../lib/dm'
import { decrypt, encrypt, fingerprint, type DmMessage, type MyKey, type PublicKey } from '../lib/dmcrypto'

const PAGE = 100

const others = (c: { members: string[] }, myId?: string) => c.members.filter((id) => id !== myId)
const titleOf = (ids: string[], profiles: Record<string, Profile>) =>
  ids.map((id) => nameOf(profiles[id])).join(', ') || 'Just you'

/** Seen fingerprints of everyone's key, on this device, to point out when one changes. */
const SEEN = 'tg:dm-seen'
const readSeen = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(SEEN) ?? '{}') } catch { return {} } }
const writeSeen = (v: Record<string, string>) => { try { localStorage.setItem(SEEN, JSON.stringify(v)) } catch { /* private mode */ } }

/** The decrypted text of each message, by id ('' while working, null when it can't be opened here). */
function useOpened(key: MyKey | null, msgs: DmMessage[], byId: Record<string, PublicKey>) {
  const [opened, setOpened] = useState<Record<string, string | null>>({})
  useEffect(() => {
    if (!key) return
    let live = true
    const todo = msgs.filter((m) => !(m.id in opened))
    if (!todo.length) return
    Promise.all(todo.map(async (m) => [m.id, (await decrypt(key, m, byId))?.t ?? null] as const)).then((pairs) => {
      if (live) setOpened((cur) => ({ ...cur, ...Object.fromEntries(pairs) }))
    })
    return () => { live = false }
  }, [key, msgs, byId, opened])
  return opened
}

// ---------------------------------------------------------------------------
// The list of your conversations
// ---------------------------------------------------------------------------
export default function Messages() {
  const { id } = useParams()
  const { me } = useAuth()
  const dm = useDm()
  useEffect(() => { if (me) startDm(me.id) }, [me])
  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="display">{id ? 'Private chat' : 'Private messages'}</h1>
        <ChatSwitch />
      </header>
      {dm.state === 'loading' && <div className="loading">Loading…</div>}
      {(dm.state === 'locked' || dm.state === 'none') && <Unlock fresh={dm.state === 'none'} />}
      {dm.state === 'ready' && dm.key && (id ? <Thread key={id} convId={id} myKey={dm.key} /> : <List myKey={dm.key} />)}
    </div>
  )
}

function Unlock({ fresh }: { fresh: boolean }) {
  const { me } = useAuth()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [wrong, setWrong] = useState(0)
  if (!me) return null
  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true); setErr(null)
    const res = await unlock(me.id, pw)
    setBusy(false)
    if (res === 'wrong') { setWrong((n) => n + 1); setErr("That password doesn't open your private messages.") }
    else if (res) setErr(res)
  }
  const startOver = async () => {
    if (!pw) { setErr('Type your current password first.'); return }
    if (!confirm('Start fresh? Private messages sent to you before now will stay locked for good. Only do this if your password was reset.')) return
    setBusy(true)
    const res = await createKey(me.id, pw)
    setBusy(false)
    if (res) setErr(res)
  }
  return (
    <form className="card narrow stack" onSubmit={go}>
      <h2 className="display"><KeyRound size={20} aria-hidden="true" /> {fresh ? 'Turn on private messages' : 'Unlock private messages'}</h2>
      <p>
        Private messages are locked on your phone before they're sent, and only the people in the conversation can
        unlock them. Not even whoever runs the site can read them.
      </p>
      <p className="muted small">
        {fresh ? 'Type your site password once to set it up on this device.' : 'Type your site password once to unlock them on this device.'}
      </p>
      <input className="input" type="password" autoComplete="current-password" placeholder="Your password" value={pw}
        onChange={(e) => setPw(e.target.value)} autoFocus />
      {err && <p className="error">{err}</p>}
      <button className="btn gold" disabled={busy || !pw}>{busy ? 'Unlocking…' : fresh ? 'Turn on' : 'Unlock'}</button>
      {wrong > 0 && (
        <div className="stack muted small">
          <p>
            If your password was reset, type the password you used <b>before</b> the reset to get your old messages
            back. If you don't remember it, you can start fresh with your current password. Old messages stay locked.
          </p>
          <button type="button" className="btn ghost sm" onClick={startOver} disabled={busy}>Start fresh</button>
        </div>
      )}
    </form>
  )
}

function List({ myKey }: { myKey: MyKey }) {
  const { me, profiles } = useAuth()
  const { byId, current } = useKeyIndex()
  const [convs, setConvs] = useState<Conversation[] | null>(null)
  const [picking, setPicking] = useState(false)
  const load = useCallback(() => {
    api.get<Conversation[]>('/dm').then(({ data }) => {
      if (!data) return
      setConvs(data)
      setUnread(data.reduce((n, c) => n + c.unread, 0))
    })
  }, [])
  useEffect(() => { load() }, [load])
  useLiveTable<DmMessage>('dm_messages', undefined, { onUpsert: load, onDelete: load, onResync: load })
  const lasts = useMemo(() => (convs ?? []).flatMap((c) => (c.last ? [c.last] : [])), [convs])
  const opened = useOpened(myKey, lasts, byId)

  return (
    <div className="stack">
      <div className="row dm-bar">
        <p className="muted small dm-note"><ShieldCheck size={15} aria-hidden="true" /> Only the people in a conversation can read it.</p>
        <button className="btn gold sm" onClick={() => setPicking(true)}><Plus size={16} aria-hidden="true" />New message</button>
      </div>
      {picking && <Picker current={current} onClose={() => setPicking(false)} />}
      {convs === null && <div className="loading">Loading…</div>}
      {convs?.length === 0 && !picking && (
        <div className="card chat-empty dm-empty">No private messages yet. Tap <b>New message</b> to start one.</div>
      )}
      {convs && convs.length > 0 && (
        <ul className="card dm-list">
          {convs.map((c) => {
            const ids = others(c, me?.id)
            const last = c.last
            const preview = last ? opened[last.id] : undefined
            return (
              <li key={c.id}>
                <Link to={`/chat/private/${seg(c.id)}`} className={`dm-row ${c.unread ? 'unread' : ''}`}>
                  <span className="dm-avs">{ids.slice(0, 3).map((id) => <Avatar key={id} p={profiles[id]} size={ids.length > 1 ? 28 : 40} />)}</span>
                  <span className="dm-main">
                    <span className="dm-name">{titleOf(ids, profiles)}</span>
                    <span className="dm-preview muted">
                      {!last ? 'No messages yet'
                        : preview === undefined ? '…'
                          : preview === null ? 'Locked message'
                            : `${last.sender_id === me?.id ? 'You: ' : ids.length > 1 ? `${nameOf(profiles[last.sender_id])}: ` : ''}${preview}`}
                    </span>
                  </span>
                  <span className="dm-side">
                    {c.last_at && <span className="muted small">{when(c.last_at)}</span>}
                    {c.unread > 0 && <span className="dm-count">{c.unread}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Picker({ current, onClose }: { current: Record<string, PublicKey>; onClose: () => void }) {
  const { me, profiles } = useAuth()
  const navigate = useNavigate()
  const [chosen, setChosen] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { refreshKeys() }, [])
  const people = Object.values(profiles).filter((p) => p.id !== me?.id).sort((a, b) => a.display_name.localeCompare(b.display_name))
  const start = async () => {
    setBusy(true)
    const { data, error } = await api.post<Conversation>('/dm', { members: chosen })
    setBusy(false)
    if (error || !data) { setErr(error?.message ?? 'Could not start it'); return }
    navigate(`/chat/private/${seg(data.id)}`)
  }
  const waiting = people.filter((p) => !current[p.id])
  return (
    <div className="card stack dm-picker">
      <div className="row dm-bar">
        <h2 className="display">Who's it for?</h2>
        <button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X size={16} aria-hidden="true" /></button>
      </div>
      <p className="muted small">Pick one person, or a few for a small group.</p>
      <ul className="dm-people">
        {people.filter((p) => current[p.id]).map((p) => {
          const on = chosen.includes(p.id)
          return (
            <li key={p.id}>
              <button type="button" className={`dm-person ${on ? 'on' : ''}`} aria-pressed={on}
                onClick={() => setChosen((c) => (on ? c.filter((x) => x !== p.id) : [...c, p.id]))}>
                <Avatar p={p} size={30} /><span>{p.display_name}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {waiting.length > 0 && (
        <p className="muted small">
          Not set up yet: {waiting.map((p) => p.display_name).join(', ')}. They can be messaged once they open Chat →
          Private once (or sign in again).
        </p>
      )}
      {err && <p className="error">{err}</p>}
      <button className="btn gold" disabled={!chosen.length || busy} onClick={start}>
        {chosen.length > 1 ? `Start a group with ${chosen.length}` : 'Start'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One conversation
// ---------------------------------------------------------------------------
function Thread({ convId, myKey }: { convId: string; myKey: MyKey }) {
  const { me, profiles } = useAuth()
  const { byId, current } = useKeyIndex()
  const [conv, setConv] = useState<Conversation | null | undefined>(undefined)
  const [msgs, setMsgs] = useState<DmMessage[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [changed, setChanged] = useState<string[]>([])
  const [codes, setCodes] = useState<Record<string, string> | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const keepOffset = useRef<number | null>(null)

  const query = useCallback((before?: string) =>
    api.get<DmMessage[]>(`/dm/${seg(convId)}/messages?limit=${PAGE}${before ? `&before=${seg(before)}` : ''}`), [convId])
  const markRead = useCallback(() => {
    api.post(`/dm/${seg(convId)}/read`).then(() => refreshUnread())
  }, [convId])

  const load = useCallback(async () => {
    const [{ data: list }, { data: page, error }] = await Promise.all([api.get<Conversation[]>('/dm'), query()])
    setConv(list?.find((c) => c.id === convId) ?? (error ? undefined : null))
    if (page) { setHasMore(page.length === PAGE); setMsgs(page.reverse()); stick.current = true }
    markRead()
  }, [convId, query, markRead])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    openConversations.add(convId)
    return () => { openConversations.delete(convId) }
  }, [convId])

  useLiveTable<DmMessage>('dm_messages', `conversation_id=eq.${convId}`, {
    onInsert: (m) => {
      setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? [...cur, m] : cur))
      if (m.sender_id !== me?.id && document.visibilityState === 'visible') markRead()
    },
    onDelete: (id) => setMsgs((cur) => cur?.filter((m) => m.id !== id) ?? cur),
    onResync: load,
  })

  // Point out a changed lock: someone reset their password, or (unlikely) the server swapped a key.
  const members = conv?.members
  useEffect(() => {
    if (!members) return
    let live = true
    ;(async () => {
      const seen = readSeen()
      const now: Record<string, string> = {}
      const diff: string[] = []
      for (const id of members) {
        const k = current[id]
        if (!k) continue
        now[id] = await fingerprint(k.public_key)
        if (id !== me?.id && seen[id] && seen[id] !== now[id]) diff.push(id)
      }
      if (!live) return
      setCodes(now)
      setChanged(diff)
    })()
    return () => { live = false }
  }, [members, current, me?.id])
  const okChanged = () => {
    writeSeen({ ...readSeen(), ...(codes ?? {}) })
    setChanged([])
  }
  useEffect(() => { // first time seeing someone's key: remember it
    if (!codes) return
    const seen = readSeen()
    const add = Object.fromEntries(Object.entries(codes).filter(([id]) => !seen[id]))
    if (Object.keys(add).length) writeSeen({ ...seen, ...add })
  }, [codes])

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (keepOffset.current != null) { el.scrollTop = el.scrollHeight - keepOffset.current; keepOffset.current = null }
    else if (stick.current) el.scrollTop = el.scrollHeight
  })

  const opened = useOpened(myKey, msgs ?? [], byId)

  const loadOlder = async () => {
    if (!msgs?.length) return
    const { data } = await query(msgs[0].created_at)
    const rows = (data ?? []).reverse()
    setHasMore(rows.length === PAGE)
    const el = scroller.current
    keepOffset.current = el ? el.scrollHeight - el.scrollTop : null
    setMsgs((cur) => [...rows, ...(cur ?? [])])
  }

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const typed = text.trim()
    if (!typed || sending || !conv) return
    setSending(true); setErr(null)
    stick.current = true
    const attempt = async (keys: Record<string, PublicKey>) => {
      const sealed = await encrypt(myKey, conv.id, conv.members, keys, { t: typed.slice(0, 2000) })
      return api.post<DmMessage>(`/dm/${seg(conv.id)}/messages`, sealed)
    }
    try {
      let res = await attempt(current)
      if (res.error?.status === 409) { // someone's key changed since we loaded: get the new ones and try once more
        await refreshKeys()
        const { data } = await api.get<PublicKey[]>('/dm/keys')
        const fresh: Record<string, PublicKey> = {}
        for (const k of data ?? []) fresh[k.user_id] = k
        res = await attempt(fresh)
      }
      if (res.error || !res.data) setErr(res.error?.message ?? 'Could not send')
      else {
        const sent = res.data
        setText('')
        setMsgs((cur) => (cur && !cur.some((x) => x.id === sent.id) ? [...cur, sent] : cur))
      }
    } catch {
      const missing = conv.members.filter((id) => !current[id]).map((id) => nameOf(profiles[id]))
      setErr(missing.length ? `${missing.join(', ')} hasn't turned on private messages yet.` : 'Could not lock that message.')
    }
    setSending(false)
  }

  const remove = async (m: DmMessage) => {
    if (!confirm('Delete this message for everyone?')) return
    const { error } = await api.del(`/dm/messages/${seg(m.id)}`)
    if (!error) setMsgs((cur) => cur?.filter((x) => x.id !== m.id) ?? cur)
  }

  if (conv === null) return <div className="card narrow stack"><p>That conversation isn't here.</p><Link to="/chat/private" className="btn ghost">Back</Link></div>
  const ids = conv ? others(conv, me?.id) : []

  return (
    <section className="card gp-chat tall dm-thread">
      <div className="dm-head">
        <Link to="/chat/private" className="btn ghost sm icon" aria-label="All private messages"><ChevronLeft size={18} aria-hidden="true" /></Link>
        <span className="dm-avs">{ids.slice(0, 3).map((id) => <Avatar key={id} p={profiles[id]} size={28} />)}</span>
        <b className="dm-name">{conv ? titleOf(ids, profiles) : '…'}</b>
        <details className="dm-codes">
          <summary className="muted small"><ShieldCheck size={14} aria-hidden="true" /> Locked</summary>
          <div className="small stack">
            <p>Only the people here can read these messages. To be extra sure nobody is listening in, compare these codes in person; they should match on each other's phones.</p>
            {conv?.members.map((id) => (
              <div key={id} className="dm-code"><span>{id === me?.id ? 'You' : nameOf(profiles[id])}</span><code>{codes?.[id] ?? 'not set up'}</code></div>
            ))}
          </div>
        </details>
      </div>
      {changed.length > 0 && (
        <div className="dm-warn small">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            {changed.map((id) => nameOf(profiles[id])).join(', ')} got a new lock (usually a password reset or a fresh start).
            If that's a surprise, check with them in person before sending anything private.
          </span>
          <button className="btn ghost sm" onClick={okChanged}>OK</button>
        </div>
      )}
      <div className="chat">
        <div className="chat-scroll" ref={scroller}
          onScroll={() => { const el = scroller.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
          {msgs === null && <div className="loading">Loading…</div>}
          {hasMore && <button className="btn ghost sm older" onClick={loadOlder}>Load older messages</button>}
          {msgs?.length === 0 && <div className="chat-empty"><LockKeyhole size={28} aria-hidden="true" />Say hi. Only {conv ? titleOf(ids, profiles) : 'they'} will see it.</div>}
          {msgs?.map((m, i) => {
            const prev = msgs[i - 1]
            const day = fullDay(m.created_at)
            const newDay = !prev || fullDay(prev.created_at) !== day
            const grouped = !newDay && prev?.sender_id === m.sender_id
            const mine = m.sender_id === me?.id
            const t = opened[m.id]
            return (
              <Fragment key={m.id}>
                {newDay && <div className="day-sep"><span>{day}</span></div>}
                <div className={`msg ${grouped ? 'grouped' : ''} ${mine ? 'mine' : 'theirs'}`}>
                  {!mine && <div className="msg-avatar">{!grouped && <Avatar p={profiles[m.sender_id]} size={30} />}</div>}
                  <div className="msg-main">
                    {!grouped && !mine && ids.length > 1 && <div className="msg-name">{nameOf(profiles[m.sender_id])}</div>}
                    <div className="bubble">
                      <div className="msg-body">
                        {t === undefined ? '…' : t === null
                          ? <span className="muted"><LockKeyhole size={13} aria-hidden="true" /> Locked to an older key. Can't be opened here.</span>
                          : <RichText text={t} />}
                      </div>
                      <span className="msg-time">{clock(m.created_at)}</span>
                    </div>
                  </div>
                  <div className="msg-actions">
                    {mine && <button className="msg-act del" title="Delete" aria-label="Delete" onClick={() => remove(m)}><X size={14} aria-hidden="true" /></button>}
                  </div>
                </div>
              </Fragment>
            )
          })}
        </div>
        <form className="chat-input" onSubmit={send}>
          <div className="chat-row">
            <textarea className="input" rows={1} placeholder="Private message…" value={text} maxLength={2000} disabled={!conv}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} />
            <button className="btn gold icon send-btn" disabled={!text.trim() || sending || !conv} title="Send" aria-label="Send">
              <SendHorizontal size={18} className={sending ? 'pulse' : ''} aria-hidden="true" />
            </button>
          </div>
        </form>
        {err && <p className="error">{err}</p>}
      </div>
    </section>
  )
}
