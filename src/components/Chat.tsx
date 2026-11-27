import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Download, ImagePlus, Megaphone, SendHorizontal, X } from 'lucide-react'
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
import Spot from './Spot'

const PAGE = 100
const MAX_IMAGE_MB = 15
const MAX_PENDING = 10

/** A picture picked, pasted or dropped, waiting in the tray above the box until Send. */
type Pending = { id: string; file: File; url: string }

/** One chat room: a gathering's thread (gatheringId) or the family chat (gatheringId = null). */
export default function Chat({ gatheringId, placeholder, readOnlyNote }: { gatheringId: string | null; placeholder: string; readOnlyNote?: string }) {
  const { me, profiles } = useAuth()
  const [msgs, setMsgs] = useState<Message[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [viewing, setViewing] = useState<{ paths: string[]; index: number } | null>(null)
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

  // The tray's previews are object URLs: let them go when they leave the tray or the room closes.
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

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

  /** Pictures from the picker, a paste, a drop or a phone's GIF keyboard go into the tray to look over first. */
  const addPictures = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    setErr(null)
    const tooBig = images.filter((f) => f.size > MAX_IMAGE_MB * 1024 * 1024)
    if (tooBig.length) setErr(`${tooBig.length === 1 ? (tooBig[0].name || 'That picture') + ' is' : `${tooBig.length} pictures are`} over ${MAX_IMAGE_MB} MB.`)
    const ok = images.filter((f) => !tooBig.includes(f))
    setPending((cur) => {
      const room = MAX_PENDING - cur.length
      if (ok.length > room) setErr(`Up to ${MAX_PENDING} pictures at a time.`)
      return [...cur, ...ok.slice(0, Math.max(0, room)).map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]
    })
    if (fileInput.current) fileInput.current.value = ''
    requestAnimationFrame(() => input.current?.focus())
  }
  const unpend = (id: string) => setPending((cur) => {
    const gone = cur.find((p) => p.id === id)
    if (gone) URL.revokeObjectURL(gone.url)
    return cur.filter((p) => p.id !== id)
  })

  /** Sends what's in the box: the tray's pictures (the words ride along as the first one's caption), or just words. */
  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const typed = text.trim()
    if ((!typed && !pending.length) || sending || !me) return
    const body = encodeMentions(typed, Object.values(profiles))
    setErr(null)
    stickToBottom.current = true
    if (!pending.length) {
      setText('')
      const { data, error } = await api.post<Message>('/messages', { gathering_id: gatheringId, body })
      if (error || !data) { setErr(error?.message ?? 'Could not send'); setText(typed); return }
      setMsgs((cur) => (cur && !cur.some((x) => x.id === data.id) ? [...cur, data] : cur))
      return
    }
    setSending(true)
    const batch = pending
    let captioned = false
    for (const [i, pic] of batch.entries()) {
      const path = `${me.id}/chat/${crypto.randomUUID()}.${extOf(pic.file)}`
      try { await uploadFile(path, pic.file, pic.file.type) } catch (x) { setErr((x as Error).message); continue }
      const { data, error } = await api.post<Message>('/messages', { gathering_id: gatheringId, body: !captioned ? body : '', image_path: path })
      if (error || !data) { setErr(error?.message ?? 'Could not send'); continue }
      if (!captioned) { captioned = true; setText('') }
      unpend(pic.id)
      setMsgs((cur) => (cur && !cur.some((x) => x.id === data.id) ? [...cur, data] : cur))
      if (i === 0) scrollDown()
    }
    setSending(false)
  }

  // Stable, so typing in the composer doesn't re-render every message.
  const remove = useCallback(async (ms: Message[]) => {
    if (!confirm(ms.length > 1 ? `Delete these ${ms.length} pictures?` : 'Delete this message?')) return
    for (const m of ms) {
      const { error } = await api.del(`/messages/${seg(m.id)}`) // takes its picture with it
      if (!error) setMsgs((cur) => cur?.filter((x) => x.id !== m.id) ?? cur)
    }
  }, [])
  const onImageLoad = useCallback(() => { if (stickToBottom.current) scrollDown() }, [scrollDown])
  const onOpen = useCallback((paths: string[], index: number) => setViewing({ paths, index }), [])
  const msgIds = useMemo(() => msgs?.map((m) => m.id) ?? [], [msgs])
  const reactions = useReactions('message', msgIds)
  const canSend = Boolean(text.trim() || pending.length) && !sending

  return (
    <div
      className={`chat ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault(); setDragging(false); addPictures([...e.dataTransfer.files])
      }}
    >
      <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
        {msgs === null && <div className="loading">Loading chat…</div>}
        {hasMore && <button className="btn ghost sm older" onClick={loadOlder}>Load older messages</button>}
        {msgs?.length === 0 && <div className="chat-empty"><Spot name="chat" size={88} />No messages yet. Start it off.</div>}
        {msgs && <MessageList msgs={msgs} me={me} profiles={profiles} reactions={reactions} onRemove={remove} onImageLoad={onImageLoad} onOpen={onOpen} />}
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
        {pending.length > 0 && (
          <div className="chat-tray" aria-label="Pictures to send">
            {pending.map((p) => (
              <div key={p.id} className={`tray-pic ${sending ? 'sending' : ''}`}>
                <img src={p.url} alt="" />
                {!sending && (
                  <button type="button" className="tray-x" aria-label="Don't send this picture" onClick={() => unpend(p.id)}>
                    <X size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            {!sending && pending.length < MAX_PENDING && (
              <button type="button" className="tray-add" aria-label="Add another picture" onClick={() => fileInput.current?.click()}>
                <ImagePlus size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="chat-row">
          <button type="button" className="btn ghost icon gif-btn" title="Add a GIF or photo" aria-label="Add a GIF or photo"
            disabled={sending} onClick={() => fileInput.current?.click()}>
            <ImagePlus size={18} aria-hidden="true" />
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden
            onChange={(e) => addPictures([...(e.target.files ?? [])])} />
          <textarea
            ref={input}
            className="input"
            rows={1}
            placeholder={pending.length ? 'Add a caption (optional)' : placeholder}
            value={text}
            maxLength={2000}
            onChange={(e) => { setText(e.target.value); findTag(e.target.value, e.target.selectionStart) }}
            onSelect={(e) => findTag(e.currentTarget.value, e.currentTarget.selectionStart)}
            onBlur={() => setTag(null)}
            onPaste={(e) => {
              // Copied GIFs/pics and phone GIF keyboards arrive as pasted files.
              const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
              if (files.length) { e.preventDefault(); addPictures(files) }
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
          <button className="btn gold icon send-btn" disabled={!canSend} title="Send" aria-label="Send">
            <SendHorizontal size={18} className={sending ? 'pulse' : ''} aria-hidden="true" />
          </button>
        </div>
      </form>
      {err && <p className="error">{err}</p>}
      {viewing && <ChatViewer paths={viewing.paths} start={viewing.index} onClose={() => setViewing(null)} />}
    </div>
  )
}

/**
 * Messages in blocks. Pictures someone sends together (no words after the first, within two minutes) show as one
 * photo grid; a picture's caption sits under it in the same bubble.
 */
type Block = { msgs: Message[]; pics: string[] }

function toBlocks(msgs: Message[]): Block[] {
  const out: Block[] = []
  for (const m of msgs) {
    const last = out[out.length - 1]
    const lastMsg = last?.msgs[last.msgs.length - 1]
    const joins = last && m.image_path && !m.body && last.pics.length > 0 && lastMsg.author_id === m.author_id &&
      fullDay(lastMsg.created_at) === fullDay(m.created_at) &&
      new Date(m.created_at).getTime() - new Date(lastMsg.created_at).getTime() < 2 * 60_000
    if (joins) { last.msgs.push(m); last.pics.push(m.image_path!) }
    else out.push({ msgs: [m], pics: m.image_path ? [m.image_path] : [] })
  }
  return out
}

const MessageList = memo(function MessageList({ msgs, me, profiles, reactions, onRemove, onImageLoad, onOpen }: {
  msgs: Message[]; me: Profile | null; profiles: Record<string, Profile>; reactions: Reactions
  onRemove: (ms: Message[]) => void; onImageLoad: () => void; onOpen: (paths: string[], index: number) => void
}) {
  const blocks = useMemo(() => toBlocks(msgs), [msgs])
  return (
    <>
      {blocks.map((b, i) => {
        const m = b.msgs[0]
        const lastOfBlock = b.msgs[b.msgs.length - 1]
        const prev = blocks[i - 1]?.msgs[blocks[i - 1].msgs.length - 1]
        const next = blocks[i + 1]?.msgs[0]
        const day = fullDay(m.created_at)
        const newDay = !prev || fullDay(prev.created_at) !== day
        const near = (a?: Message, c?: Message) => Boolean(a && c && a.author_id === c.author_id && fullDay(a.created_at) === fullDay(c.created_at) &&
          Math.abs(new Date(c.created_at).getTime() - new Date(a.created_at).getTime()) < 5 * 60_000)
        const grouped = !newDay && near(prev, m)
        const continues = near(lastOfBlock, next)
        const mine = m.author_id === me?.id
        const p = profiles[m.author_id]
        const body = b.msgs.find((x) => x.body)?.body ?? ''
        const picOnly = b.pics.length > 0 && !body
        return (
          <Fragment key={m.id}>
            {newDay && <div className="day-sep"><span>{day}</span></div>}
            <div tabIndex={-1} className={`msg ${grouped ? 'grouped' : ''} ${continues ? 'continues' : ''} ${mine ? 'mine' : 'theirs'} ${picOnly ? 'pic-only' : ''} ${!mine && mentionsMe(body, me?.id) ? 'tagged' : ''}`}>
              {!mine && <div className="msg-avatar">{!continues && <Avatar p={p} size={30} />}</div>}
              <div className="msg-main">
                {!grouped && !mine && <div className="msg-name">{nameOf(p)}</div>}
                <div className="bubble">
                  {b.pics.length > 0 && <PhotoGrid paths={b.pics} onLoad={onImageLoad} onOpen={onOpen} />}
                  {body && <div className="msg-body"><RichText text={body} /></div>}
                  <span className="msg-time">{clock(lastOfBlock.created_at)}</span>
                </div>
                {reactions.ready && <ReactionBar list={reactions.of(m.id)} onToggle={(e) => reactions.toggle(m.id, e)} />}
              </div>
              <div className="msg-actions">
                {reactions.ready && <ReactButton className="msg-act" list={reactions.of(m.id)} onToggle={(e) => reactions.toggle(m.id, e)} />}
                {mine && <button className="msg-act del" title="Delete" aria-label="Delete" onClick={() => onRemove(b.msgs)}><X size={14} aria-hidden="true" /></button>}
              </div>
            </div>
          </Fragment>
        )
      })}
    </>
  )
})

/** One picture big, or a tidy grid of several (the fifth and up become "+N"). Tap to open the viewer. */
function PhotoGrid({ paths, onLoad, onOpen }: { paths: string[]; onLoad: () => void; onOpen: (paths: string[], index: number) => void }) {
  const url = useSignedUrls(paths)
  const shown = paths.slice(0, 4)
  const extra = paths.length - shown.length
  return (
    <div className={`msg-photos n${shown.length}`}>
      {shown.map((path, i) => {
        const src = url(path)
        return (
          <button key={path} type="button" className="msg-photo" onClick={() => onOpen(paths, i)} aria-label="Open picture">
            {src ? <img src={src} alt="" onLoad={onLoad} loading="lazy" /> : <span className="msg-photo-wait" />}
            {i === shown.length - 1 && extra > 0 && <span className="msg-photo-more">+{extra}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Full-screen look at chat pictures: swipe or arrow through them, save one, tap outside or Escape to close. */
function ChatViewer({ paths, start, onClose }: { paths: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const url = useSignedUrls(paths)
  const touch = useRef<number | null>(null)
  const go = useCallback((d: number) => setI((n) => Math.min(paths.length - 1, Math.max(0, n + d))), [paths.length])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [go, onClose])
  const src = url(paths[i])
  // On <body>, so it covers the tab bar and top bar too.
  return createPortal(
    <div className="chat-viewer" role="dialog" aria-modal="true" aria-label="Picture" onClick={onClose}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        touch.current = null
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
      }}>
      <div className="cv-bar" onClick={(e) => e.stopPropagation()}>
        <span className="cv-count">{paths.length > 1 ? `${i + 1} of ${paths.length}` : ''}</span>
        {src && <a className="btn ghost sm" href={src} download target="_blank" rel="noreferrer"><Download size={15} aria-hidden="true" />Save</a>}
        <button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X size={18} aria-hidden="true" /></button>
      </div>
      {src ? <img className="cv-img" src={src} alt="" onClick={(e) => e.stopPropagation()} /> : <div className="loading">Loading…</div>}
      {paths.length > 1 && (
        <>
          <button className="cv-nav prev" disabled={i === 0} onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="Previous picture"><ChevronLeft size={26} /></button>
          <button className="cv-nav next" disabled={i === paths.length - 1} onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="Next picture"><ChevronRight size={26} /></button>
        </>
      )}
    </div>,
    document.body,
  )
}

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
      {embed && <EmbedView embed={embed} fallback={urls.find((u) => embedFor(u)) ?? ''} />}
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
