import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Megaphone, MessageCircle, SendHorizontal, X } from 'lucide-react'
import { api, seg } from '../lib/api'
import { uploadFile } from '../lib/storage'
import { useLiveTable } from '../lib/realtime'
import { extOf } from '../lib/images'
import { clock, fullDay } from '../lib/format'
import { EVERYONE, encodeMentions, mentionsMe, TOKEN_RE } from '../lib/mentions'
import type { Message, Profile } from '../lib/types'
import { useAuth } from '../auth'
import { Avatar, nameOf } from './Avatar'
import { useSignedUrls } from '../lib/signedUrls'
import { useReactions, type Reactions } from '../lib/reactions'
import { ReactButton, ReactionBar } from './Reactions'

const PAGE = 100
const MAX_IMAGE_MB = 15

/** One chat room: a gathering's thread (gatheringId) or the family chat (gatheringId = null). */
export default function Chat({ gatheringId, placeholder, readOnlyNote }: { gatheringId: string | null; placeholder: string; readOnlyNote?: string }) {
  const { me, profiles } = useAuth()
  const [msgs, setMsgs] = useState<Message[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const [tag, setTag] = useState<{ start: number; end: number; query: string } | null>(null)
  const [tagSel, setTagSel] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const keepOffset = useRef<number | null>(null)
  const loadingOlder = useRef(false)

  // Newest first, a page at a time; `before` gets the page older than that.
  const query = useCallback((before?: string) => api.get<Message[]>(
    `/messages?gathering=${seg(gatheringId ?? '')}&limit=${PAGE}${before ? `&before=${seg(before)}` : ''}`,
  ), [gatheringId])

  useEffect(() => {
    let live = true // a slow answer for the last room mustn't land in this one
    setMsgs(null)
    query().then(({ data }) => {
      if (!live) return
      const rows = (data ?? []) as Message[]
      setHasMore(rows.length === PAGE)
      setMsgs(rows.reverse())
      stickToBottom.current = true
    })
    return () => { live = false }
  }, [query])

  const loadOlder = async () => {
    if (!msgs?.length || loadingOlder.current) return // a double tap would load the same page twice
    loadingOlder.current = true
    try {
      const { data } = await query(msgs[0].created_at)
      const rows = ((data ?? []) as Message[]).reverse()
      setHasMore(rows.length === PAGE)
      const el = scroller.current
      keepOffset.current = el ? el.scrollHeight - el.scrollTop : null
      setMsgs((cur) => [...rows, ...(cur ?? [])])
    } finally {
      loadingOlder.current = false
    }
  }

  // Back from a dropped connection: swap in the newest page so anything posted or deleted meanwhile shows up,
  // keeping older pages already loaded.
  const resync = async () => {
    const { data, error } = await query()
    if (error) return
    const rows = ((data ?? []) as Message[]).reverse()
    setMsgs((cur) => {
      if (!cur) return cur
      const from = rows.length === PAGE ? rows[0].created_at : ''
      return [...cur.filter((m) => m.created_at < from), ...rows]
    })
  }

  useLiveTable<Message>('messages', gatheringId ? `gathering_id=eq.${gatheringId}` : undefined, {
    onUpsert: (m) => {
      if ((m.gathering_id ?? null) !== gatheringId) return
      setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? [...cur, m] : cur))
    },
    onDelete: (id) => setMsgs((cur) => cur?.filter((m) => m.id !== id) ?? cur),
    onResync: resync,
  })

  // Stay pinned to the newest message unless the reader scrolled up; keep position when loading older ones.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (keepOffset.current != null) {
      el.scrollTop = el.scrollHeight - keepOffset.current
      keepOffset.current = null
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [msgs])

  const scrollDown = useCallback(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const onScroll = () => {
    const el = scroller.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  // @ tagging: while the word at the cursor starts with @, offer matching family (and @family for everybody).
  const findTag = (value: string, caret: number | null) => {
    const m = caret == null ? null : value.slice(0, caret).match(/(?:^|\s)@([^\s@<>]{0,24})$/)
    setTag(m ? { start: caret! - m[1].length - 1, end: caret!, query: m[1].toLowerCase() } : null)
    setTagSel(0)
  }
  const tagOptions: Profile[] = []
  if (tag) {
    const q = tag.query
    const starts = (p: Profile) => (p.display_name.toLowerCase().startsWith(q) ? 0 : 1)
    tagOptions.push(...Object.values(profiles)
      .filter((p) => p.id !== me?.id && p.display_name.toLowerCase().includes(q))
      .sort((a, b) => starts(a) - starts(b) || a.display_name.localeCompare(b.display_name))
      .slice(0, 6))
    if (EVERYONE.startsWith(q)) tagOptions.push({ id: EVERYONE, phone: null, emoji: '', display_name: EVERYONE, onboarded: true })
  }
  const pickTag = (p: { display_name: string }) => {
    if (!tag) return
    const ins = `@${p.display_name} `
    setText(text.slice(0, tag.start) + ins + text.slice(tag.end))
    setTag(null)
    const caret = tag.start + ins.length
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(caret, caret) })
  }

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const typed = text.trim()
    if (!typed) return
    const body = encodeMentions(typed, Object.values(profiles))
    setText('')
    setErr(null)
    stickToBottom.current = true
    const { data, error } = await api.post<Message>('/messages', { gathering_id: gatheringId, body })
    if (error || !data) { setErr(error?.message ?? 'Could not send'); setText(typed); return }
    setMsgs((cur) => (cur && !cur.some((x) => x.id === data.id) ? [...cur, data] : cur))
  }

  /** Upload a GIF/pic (from the picker, a paste, a drop, or a phone's GIF keyboard) and post it. */
  const sendImages = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length || !me) return
    setErr(null)
    setUploading(true)
    stickToBottom.current = true
    const caption = encodeMentions(text.trim(), Object.values(profiles))
    for (const [i, file] of images.entries()) {
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setErr(`${file.name || 'That image'} is over ${MAX_IMAGE_MB} MB.`); continue }
      const path = `${me.id}/chat/${crypto.randomUUID()}.${extOf(file)}`
      try { await uploadFile(path, file, file.type) } catch (e) { setErr((e as Error).message); continue }
      const { data, error } = await api.post<Message>('/messages', { gathering_id: gatheringId, body: i === 0 ? caption : '', image_path: path })
      if (error || !data) { setErr(error?.message ?? 'Could not send'); continue }
      if (i === 0 && caption) setText('')
      setMsgs((cur) => (cur && !cur.some((x) => x.id === data.id) ? [...cur, data] : cur))
    }
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  // Stable, so typing in the composer doesn't re-render every message.
  const remove = useCallback(async (m: Message) => {
    if (!confirm('Delete this message?')) return
    const { error } = await api.del(`/messages/${seg(m.id)}`) // takes its picture with it
    if (error) return
    setMsgs((cur) => cur?.filter((x) => x.id !== m.id) ?? cur)
  }, [])
  const onImageLoad = useCallback(() => { if (stickToBottom.current) scrollDown() }, [])
  const msgIds = useMemo(() => msgs?.map((m) => m.id) ?? [], [msgs])
  const reactions = useReactions('message', msgIds)

  return (
    <div
      className={`chat ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault(); setDragging(false); sendImages([...e.dataTransfer.files])
      }}
    >
      <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
        {msgs === null && <div className="loading">Loading chat…</div>}
        {hasMore && <button className="btn ghost sm older" onClick={loadOlder}>Load older messages</button>}
        {msgs?.length === 0 && <div className="chat-empty"><MessageCircle size={26} aria-hidden="true" />No messages yet. Start it off.</div>}
        {msgs && <MessageList msgs={msgs} me={me} profiles={profiles} reactions={reactions} onRemove={remove} onImageLoad={onImageLoad} />}
      </div>
      {readOnlyNote && <div className="chat-note muted small">{readOnlyNote}</div>}
      <form className="chat-input" onSubmit={send}>
        {tagOptions.length > 0 && (
          <ul className="tag-pop" role="listbox" aria-label="Tag someone">
            {tagOptions.map((p, i) => (
              <li key={p.id}>
                <button type="button" role="option" aria-selected={i === tagSel} className={i === tagSel ? 'on' : ''}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => pickTag(p)}>
                  <span className="tag-emoji">{p.id === EVERYONE ? <Megaphone size={16} aria-hidden="true" /> : <Avatar p={p} size={22} />}</span>{p.display_name}
                  {p.id === EVERYONE && <span className="muted small"> · tags everybody</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn ghost icon gif-btn" title="Post a GIF or photo" aria-label="Post a GIF or photo"
          disabled={uploading} onClick={() => fileInput.current?.click()}>
          <ImagePlus size={18} className={uploading ? 'pulse' : ''} aria-hidden="true" />
        </button>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden
          onChange={(e) => sendImages([...(e.target.files ?? [])])} />
        <textarea
          ref={input}
          className="input"
          rows={1}
          placeholder={placeholder}
          value={text}
          maxLength={2000}
          onChange={(e) => { setText(e.target.value); findTag(e.target.value, e.target.selectionStart) }}
          onSelect={(e) => findTag(e.currentTarget.value, e.currentTarget.selectionStart)}
          onBlur={() => setTag(null)}
          onPaste={(e) => {
            // Copied GIFs/pics and phone GIF keyboards arrive as pasted files.
            const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
            if (files.length) { e.preventDefault(); sendImages(files) }
          }}
          onKeyDown={(e) => {
            if (tagOptions.length) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const n = tagOptions.length
                setTagSel((i) => (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
                return
              }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickTag(tagOptions[tagSel] ?? tagOptions[0]); return }
              if (e.key === 'Escape') { setTag(null); return }
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
          }}
        />
        <button className="btn gold icon" disabled={!text.trim()} title="Send" aria-label="Send">
          <SendHorizontal size={18} aria-hidden="true" />
        </button>
      </form>
      {err && <p className="error">{err}</p>}
    </div>
  )
}

const MessageList = memo(function MessageList({ msgs, me, profiles, reactions, onRemove, onImageLoad }: {
  msgs: Message[]; me: Profile | null; profiles: Record<string, Profile>; reactions: Reactions
  onRemove: (m: Message) => void; onImageLoad: () => void
}) {
  return (
    <>
      {msgs.map((m, i) => {
        const prev = msgs[i - 1]
        const day = fullDay(m.created_at)
        const newDay = !prev || fullDay(prev.created_at) !== day
        const grouped = !newDay && prev?.author_id === m.author_id &&
          new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000
        const mine = m.author_id === me?.id
        const p = profiles[m.author_id]
        return (
          <Fragment key={m.id}>
            {newDay && <div className="day-sep"><span>{day}</span></div>}
            <div className={`msg ${grouped ? 'grouped' : ''} ${mine ? 'mine' : ''} ${!mine && mentionsMe(m.body, me?.id) ? 'tagged' : ''}`}>
              <div className="msg-avatar">{!grouped && <Avatar p={p} size={34} />}</div>
              <div className="msg-main">
                {!grouped && (
                  <div className="msg-head">
                    <span className="msg-name">{nameOf(p)}</span>
                    <span className="msg-time">{clock(m.created_at)}</span>
                  </div>
                )}
                {m.body && <div className="msg-body"><RichText text={m.body} /></div>}
                {m.image_path && <ChatImage path={m.image_path} onLoad={onImageLoad} />}
                {reactions.ready && <ReactionBar list={reactions.of(m.id)} onToggle={(e) => reactions.toggle(m.id, e)} />}
              </div>
              <div className="msg-actions">
                {reactions.ready && <ReactButton className="msg-act" list={reactions.of(m.id)} onToggle={(e) => reactions.toggle(m.id, e)} />}
                {mine && <button className="msg-act del" title="Delete" aria-label="Delete message" onClick={() => onRemove(m)}><X size={14} aria-hidden="true" /></button>}
              </div>
            </div>
          </Fragment>
        )
      })}
    </>
  )
})

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g
const IMG_RE = /\.(gif|png|jpe?g|webp|avif)(\?.*)?$/i

type Embed = { kind: 'img' | 'iframe'; src: string }

/** Turns GIF-ish links (direct images, Giphy pages, Tenor pages) into something we can show inline. */
function embedFor(url: string): Embed | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^www\./, '')
  if (host.endsWith('giphy.com')) {
    // giphy.com/gifs/some-slug-ID, giphy.com/embed/ID, media*.giphy.com/media/ID/…
    const m = u.pathname.match(/^\/(?:gifs|stickers|clips|embed)\/(?:[^/]*-)?([A-Za-z0-9]+)\/?$/) ??
      u.pathname.match(/\/media\/(?:v1\.[^/]+\/)?([A-Za-z0-9]+)\//)
    if (m) return { kind: 'img', src: `https://media.giphy.com/media/${m[1]}/giphy.gif` }
    if (host === 'i.giphy.com' && IMG_RE.test(u.pathname)) return { kind: 'img', src: url }
    return null
  }
  if (host === 'tenor.com') {
    // tenor.com/view/some-slug-gif-12345 → Tenor's own embed player
    const m = u.pathname.match(/\/view\/.*?(\d+)\/?$/)
    return m ? { kind: 'iframe', src: `https://tenor.com/embed/${m[1]}` } : null
  }
  return IMG_RE.test(u.pathname) ? { kind: 'img', src: url } : null
}

/** Plain text with clickable links, plus an inline preview of the first GIF/image link. */
export function RichText({ text }: { text: string }) {
  const urls: string[] = [...(text.match(URL_RE) ?? [])]
  const embed = urls.map(embedFor).find(Boolean) ?? null
  const justTheLink = embed && urls.length === 1 && text.trim() === urls[0]
  const parts = text.split(URL_RE)
  return (
    <>
      {!justTheLink && parts.map((part, i) =>
        i % 2 === 1 ? <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a> : <Tags key={i} text={part} />,
      )}
      {embed && <EmbedView embed={embed} fallback={urls.find((u) => embedFor(u)) ?? ""} />}
    </>
  )
}

/** <@id> tokens → highlighted @Names (yours stands out). */
function Tags({ text }: { text: string }) {
  const { me, profiles } = useAuth()
  const parts = text.split(TOKEN_RE) // odd entries are the ids
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>
        const name = part === EVERYONE ? EVERYONE : profiles[part]?.display_name ?? 'someone'
        const isMe = part === me?.id || part === EVERYONE
        return <span key={i} className={`tag ${isMe ? 'me' : ''}`}>@{name}</span>
      })}
    </>
  )
}

function EmbedView({ embed, fallback }: { embed: Embed; fallback: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <a href={fallback} target="_blank" rel="noreferrer">{fallback}</a>
  if (embed.kind === 'iframe') {
    return <iframe className="msg-embed" src={embed.src} title="GIF" loading="lazy" allowFullScreen />
  }
  return (
    <a href={fallback} target="_blank" rel="noreferrer">
      <img className="msg-img" src={embed.src} alt="" loading="lazy" onError={() => setBroken(true)} />
    </a>
  )
}

/** A GIF/pic someone posted straight into chat (private storage → signed URL). */
function ChatImage({ path, onLoad }: { path: string; onLoad: () => void }) {
  const url = useSignedUrls([path])(path)
  if (!url) return <div className="msg-img placeholder" />
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img className="msg-img" src={url} alt="" onLoad={onLoad} />
    </a>
  )
}
