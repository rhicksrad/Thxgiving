import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, SendHorizontal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLiveTable } from '../lib/realtime'
import { useReactions } from '../lib/reactions'
import { when } from '../lib/format'
import type { PhotoComment } from '../lib/types'
import { useAuth } from '../auth'
import { Avatar, nameOf } from './Avatar'
import { RichText } from './Chat'
import { ReactButton, ReactionBar } from './Reactions'

/** Comments on one photo or video, plus every copy of it in its stack, so nobody's comments go missing. */
export function usePhotoComments(photoIds: string[]) {
  const [rows, setRows] = useState<PhotoComment[] | null>(null)
  const [ready, setReady] = useState(true) // false: the table isn't in the database yet
  const key = photoIds.join(',')

  const load = useCallback(async () => {
    if (!key) return setRows([])
    const { data, error } = await supabase.from('photo_comments').select('*').in('photo_id', key.split(',')).order('created_at')
    if (error) { setReady(false); setRows([]); return }
    setReady(true)
    setRows((data ?? []) as PhotoComment[])
  }, [key])
  useEffect(() => { setRows(null); load() }, [load])

  useLiveTable<PhotoComment>('photo_comments', key ? `photo_id=in.(${key})` : undefined, {
    onInsert: (c) => setRows((cur) => (cur && !cur.some((x) => x.id === c.id) ? [...cur, c] : cur)),
    onDelete: (id) => setRows((cur) => cur?.filter((c) => c.id !== id) ?? cur),
    onResync: load,
  }, Boolean(key) && ready)

  return { rows, setRows, ready }
}

/** The thread in the photo viewer: everyone's comments, each one reactable, and a box to add yours. */
export function PhotoComments({ photoId, comments, onClose }: {
  photoId: string; comments: ReturnType<typeof usePhotoComments>; onClose: () => void
}) {
  const { me, profiles } = useAuth()
  const { rows, setRows } = comments
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const ids = useMemo(() => rows?.map((c) => c.id) ?? [], [rows])
  const reactions = useReactions('comment', ids)

  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [rows?.length])

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    setErr(null)
    const { data, error } = await supabase.from('photo_comments').insert({ photo_id: photoId, body }).select().single()
    if (error) { setErr(error.message); setText(body); return }
    setRows((cur) => (cur && !cur.some((x) => x.id === data.id) ? [...cur, data as PhotoComment] : cur))
  }
  const remove = async (c: PhotoComment) => {
    if (!confirm('Delete this comment?')) return
    const { error } = await supabase.from('photo_comments').delete().eq('id', c.id)
    if (!error) setRows((cur) => cur?.filter((x) => x.id !== c.id) ?? cur)
  }

  return (
    <aside className="lb-comments" aria-label="Comments">
      <div className="lb-comments-head">
        <span className="bell-title">Comments{rows?.length ? ` (${rows.length})` : ''}</span>
        <button type="button" className="btn ghost icon sm" aria-label="Hide comments" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="lb-comments-list" ref={scroller}>
        {rows === null && <div className="loading">Loading…</div>}
        {rows?.length === 0 && <div className="chat-empty"><MessageSquare size={22} aria-hidden="true" />No comments yet. Say something.</div>}
        {rows?.map((c) => {
          const p = profiles[c.author_id]
          const mine = c.author_id === me?.id
          return (
            <div key={c.id} className={`msg ${mine ? 'mine' : ''}`}>
              <div className="msg-avatar"><Avatar p={p} size={30} /></div>
              <div className="msg-main">
                <div className="msg-head">
                  <span className="msg-name">{nameOf(p)}</span>
                  <span className="msg-time">{when(c.created_at)}</span>
                </div>
                <div className="msg-body"><RichText text={c.body} /></div>
                {reactions.ready && <ReactionBar list={reactions.of(c.id)} onToggle={(e) => reactions.toggle(c.id, e)} />}
              </div>
              <div className="msg-actions">
                {reactions.ready && <ReactButton className="msg-act" list={reactions.of(c.id)} onToggle={(e) => reactions.toggle(c.id, e)} />}
                {mine && <button className="msg-act del" title="Delete" aria-label="Delete comment" onClick={() => remove(c)}><X size={14} aria-hidden="true" /></button>}
              </div>
            </div>
          )
        })}
      </div>
      <form className="chat-input" onSubmit={send}>
        <textarea className="input" rows={1} placeholder="Add a comment…" value={text} maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} />
        <button className="btn gold icon" disabled={!text.trim()} title="Send" aria-label="Send">
          <SendHorizontal size={18} aria-hidden="true" />
        </button>
      </form>
      {err && <p className="error">{err}</p>}
    </aside>
  )
}

/** How many comments each photo has, kept live, for the badges on the grid. */
export function useCommentCounts() {
  const [rows, setRows] = useState<Record<string, string>>({}) // comment id → photo id
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('photo_comments').select('id, photo_id')
    if (!error) setRows(Object.fromEntries((data ?? []).map((c) => [c.id as string, c.photo_id as string])))
  }, [])
  useEffect(() => { load() }, [load])
  useLiveTable<PhotoComment>('photo_comments', undefined, {
    onInsert: (c) => setRows((cur) => ({ ...cur, [c.id]: c.photo_id })),
    onDelete: (id) => setRows((cur) => {
      if (!(id in cur)) return cur
      const next = { ...cur }
      delete next[id]
      return next
    }),
    onResync: load,
  })
  return useMemo(() => {
    const n: Record<string, number> = {}
    for (const photoId of Object.values(rows)) n[photoId] = (n[photoId] ?? 0) + 1
    return n
  }, [rows])
}
