import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AtSign, Bell, Camera, HandHelping, Image, MessageCircle, MessageSquare, SmilePlus, UserPlus, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLiveTable } from '../lib/realtime'
import { mentionsMe, plainMentions } from '../lib/mentions'
import { plural, when } from '../lib/format'
import type { ListItem, Message, Photo, PhotoComment, Profile, Reaction } from '../lib/types'
import { useAuth } from '../auth'
import { Avatar, nameOf } from './Avatar'

type Post = Pick<Message, 'id' | 'gathering_id' | 'author_id' | 'body' | 'created_at'>
type Added = Pick<ListItem, 'id' | 'gathering_id' | 'kind' | 'label' | 'created_by' | 'created_at'>
type Pic = Pick<Photo, 'id' | 'gathering_id' | 'uploader_id' | 'created_at'>
type Reacted = Pick<Reaction, 'id' | 'target_type' | 'target_id' | 'user_id' | 'emoji' | 'created_at'>
type Comment = Pick<PhotoComment, 'id' | 'photo_id' | 'author_id' | 'body' | 'created_at'>

type Kind = 'join' | 'tag' | 'chat' | 'food' | 'ask' | 'photo' | 'react' | 'comment'
type Activity = {
  key: string; kind: Kind; at: string; who: string; gatheringId: string | null; text: string
  target?: { type: Reaction['target_type']; id: string } // reactions and comments: the thing to open
}

const KEEP = 30 // per source, and the most the bell lists
const PHOTO_BURST = 10 * 60_000 // photos one person adds to one place within 10 minutes show as one line

const ICONS: Record<Kind, LucideIcon> = {
  join: UserPlus, tag: AtSign, chat: MessageCircle, food: UtensilsCrossed, ask: HandHelping, photo: Camera,
  react: SmilePlus, comment: MessageSquare,
}
const THING: Record<Reaction['target_type'], string> = { photo: 'your pic', message: 'your message', comment: 'your comment' }

// "Seen up to" lives on this device only; it's just for the unread count. A new device starts from now
// instead of lighting up with old news.
const seenKey = (id: string) => `tg:activity-seen:${id}`
const readSeen = (id: string) => {
  try { return localStorage.getItem(seenKey(id)) ?? new Date().toISOString() } catch { return '' }
}
const writeSeen = (id: string, iso: string) => { try { localStorage.setItem(seenKey(id), iso) } catch { /* private mode */ } }

const newestFirst = <T extends { created_at: string }>(rows: T[]) =>
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, KEEP)
const addRow = <T extends { id: string; created_at: string }>(row: T) => (cur: T[]) =>
  cur.some((x) => x.id === row.id) ? cur : newestFirst([row, ...cur])
const patchRow = <T extends { id: string }>(row: T) => (cur: T[]) =>
  cur.map((x) => (x.id === row.id ? { ...x, ...row } : x))
const dropRow = (id: string) => <T extends { id: string }>(cur: T[]) => cur.filter((x) => x.id !== id)

/**
 * Top-bar bell: what's new on the site from everyone else, newest first, with an unread count.
 * New family members, chat posts (tags called out), food and help people add, photos, reactions and comments.
 * Edits don't make new lines: a name change just updates the name shown.
 */
export default function ActivityBell() {
  const { me, profiles } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [added, setAdded] = useState<Added[]>([])
  const [pics, setPics] = useState<Pic[]>([])
  const [reacts, setReacts] = useState<Reacted[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [gatherings, setGatherings] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const myId = me?.id

  useEffect(() => {
    if (!myId) return
    setSeen(readSeen(myId))
    const recent = <T,>(q: PromiseLike<{ data: unknown }>, set: (rows: T[]) => void) => q.then(({ data }) => set((data ?? []) as T[]))
    recent(supabase.from('messages').select('id, gathering_id, author_id, body, created_at')
      .neq('author_id', myId).order('created_at', { ascending: false }).limit(KEEP), setPosts)
    // Rows with no creator are the starter list every new gathering gets, not something a person added.
    recent(supabase.from('list_items').select('id, gathering_id, kind, label, created_by, created_at')
      .not('created_by', 'is', null).neq('created_by', myId).order('created_at', { ascending: false }).limit(KEEP), setAdded)
    recent(supabase.from('photos').select('id, gathering_id, uploader_id, created_at')
      .neq('uploader_id', myId).order('created_at', { ascending: false }).limit(KEEP), setPics)
    // Reactions to your things (owner_id is filled in by the database) and comments on anyone's pics.
    recent(supabase.from('reactions').select('id, target_type, target_id, user_id, emoji, created_at')
      .eq('owner_id', myId).neq('user_id', myId).order('created_at', { ascending: false }).limit(KEEP), setReacts)
    recent(supabase.from('photo_comments').select('id, photo_id, author_id, body, created_at')
      .neq('author_id', myId).order('created_at', { ascending: false }).limit(KEEP), setComments)
    supabase.from('gatherings').select('id, title')
      .then(({ data }) => setGatherings(Object.fromEntries((data ?? []).map((g) => [g.id, g.title as string]))))
  }, [myId])

  const live = Boolean(myId)
  useLiveTable<Message>('messages', undefined, {
    onInsert: (m) => { if (m.author_id !== myId) setPosts(addRow<Post>(m)) },
    onDelete: (id) => setPosts(dropRow(id)),
  }, live)
  useLiveTable<ListItem>('list_items', undefined, {
    onInsert: (i) => { if (i.created_by && i.created_by !== myId) setAdded(addRow<Added>(i)) },
    onUpsert: (i) => setAdded(patchRow<Added>(i)), // a renamed item keeps its line
    onDelete: (id) => setAdded(dropRow(id)),
  }, live)
  useLiveTable<Photo>('photos', undefined, {
    onInsert: (p) => { if (p.uploader_id !== myId) setPics(addRow<Pic>(p)) },
    onDelete: (id) => setPics(dropRow(id)),
  }, live)
  useLiveTable<Reaction>('reactions', myId ? `owner_id=eq.${myId}` : undefined, {
    onInsert: (r) => { if (r.user_id !== myId) setReacts(addRow<Reacted>(r)) },
    onDelete: (id) => setReacts(dropRow(id)), // taken back: the line goes too
  }, live)
  useLiveTable<PhotoComment>('photo_comments', undefined, {
    onInsert: (c) => { if (c.author_id !== myId) setComments(addRow<Comment>(c)) },
    onDelete: (id) => setComments(dropRow(id)),
  }, live)
  useLiveTable<{ id: string; title: string }>('gatherings', undefined, {
    onUpsert: (g) => setGatherings((cur) => ({ ...cur, [g.id]: g.title })),
  }, live)

  const feed = useMemo(() => {
    const out: Activity[] = []
    // Profiles come from the family list everyone already loads; signing up is what makes the row.
    for (const p of Object.values(profiles) as Profile[]) {
      if (p.id !== myId && p.created_at) out.push({ key: `join:${p.id}`, kind: 'join', at: p.created_at, who: p.id, gatheringId: null, text: 'joined' })
    }
    for (const m of posts) {
      const tag = mentionsMe(m.body, myId)
      out.push({
        key: `chat:${m.id}`, kind: tag ? 'tag' : 'chat', at: m.created_at, who: m.author_id, gatheringId: m.gathering_id,
        text: plainMentions(m.body, profiles),
      })
    }
    for (const i of added) {
      out.push({
        key: `list:${i.id}`, kind: i.kind, at: i.created_at, who: i.created_by!, gatheringId: i.gathering_id,
        text: `${i.kind === 'food' ? 'Added to the food list' : 'Asked'}: ${i.label}`,
      })
    }
    // Photos arrive one row per file, so a batch upload folds into one line.
    let burst: { a: Activity; n: number; first: number } | null = null
    for (const p of [...pics].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const t = new Date(p.created_at).getTime()
      if (burst && burst.a.who === p.uploader_id && burst.a.gatheringId === p.gathering_id && burst.first - t < PHOTO_BURST) {
        burst.n++
        burst.a.text = `Added ${plural(burst.n, 'photo')}`
        continue
      }
      burst = { a: { key: `photo:${p.id}`, kind: 'photo', at: p.created_at, who: p.uploader_id, gatheringId: p.gathering_id, text: 'Added a photo' }, n: 1, first: t }
      out.push(burst.a)
    }
    for (const r of reacts) {
      out.push({
        key: `react:${r.id}`, kind: 'react', at: r.created_at, who: r.user_id, gatheringId: null,
        text: `Reacted ${r.emoji} to ${THING[r.target_type]}`, target: { type: r.target_type, id: r.target_id },
      })
    }
    for (const c of comments) {
      out.push({
        key: `comment:${c.id}`, kind: 'comment', at: c.created_at, who: c.author_id, gatheringId: null,
        text: `Commented on a pic: ${c.body}`, target: { type: 'photo', id: c.photo_id },
      })
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, KEEP)
  }, [profiles, posts, added, pics, reacts, comments, myId])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!myId) return null
  const unread = feed.filter((a) => a.at > seen).length

  const toggle = () => {
    setOpen((o) => !o)
    if (!open && feed[0]) { writeSeen(myId, feed[0].at); setTimeout(() => setSeen(feed[0].at), 1500) }
  }
  const go = async (a: Activity) => {
    setOpen(false)
    if (a.target) {
      // Open the pic itself, or the chat the message is in.
      let { type, id } = a.target
      if (type === 'comment') {
        const { data } = await supabase.from('photo_comments').select('photo_id').eq('id', id).maybeSingle()
        if (!data) return
        ;[type, id] = ['photo', data.photo_id as string]
      }
      if (type === 'photo') return navigate(`/gallery?photo=${id}`)
      const { data } = await supabase.from('messages').select('gathering_id').eq('id', id).maybeSingle()
      if (!data) return
      return navigate(data.gathering_id ? `/g/${data.gathering_id}?tab=chat` : '/chat')
    }
    if (a.kind === 'join') return navigate('/family')
    if (a.kind === 'photo') return navigate(a.gatheringId ? `/g/${a.gatheringId}?tab=pics` : '/gallery')
    const tab = a.kind === 'tag' ? 'chat' : a.kind === 'ask' ? 'asks' : a.kind
    navigate(a.gatheringId ? `/g/${a.gatheringId}?tab=${tab}` : '/chat')
  }
  const where = (a: Activity) =>
    a.kind === 'join' || a.kind === 'react' ? '' : a.kind === 'comment' ? ' · Gallery' : a.gatheringId ? ` · ${gatherings[a.gatheringId] ?? 'a get-together'}` : a.kind === 'photo' ? ' · Gallery' : ' · Family chat'

  return (
    <div className="bell-wrap" ref={box}>
      <button className="bell" onClick={toggle} title="What's new" aria-label={`What's new, ${unread} new`}>
        <Bell size={18} strokeWidth={1.9} aria-hidden="true" />{unread > 0 && <span className="bell-n">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-pop card">
          <div className="bell-title">What's new</div>
          {feed.length === 0 && (
            <div className="empty"><Bell size={22} aria-hidden="true" />Nothing new yet. Posts, food, photos and new family show up here.</div>
          )}
          <ul>
            {feed.map((a) => {
              const who = profiles[a.who]
              const Icon = ICONS[a.kind]
              return (
                <li key={a.key}>
                  <button className={a.at > seen ? 'new' : ''} onClick={() => go(a)}>
                    <span className="bell-head">
                      <Avatar p={who} size={18} className="inline" /><b>{nameOf(who)}</b>
                      <span className="muted">{where(a)} · {when(a.at)}</span>
                    </span>
                    <span className="bell-body">
                      <Icon size={13} className="bell-kind" aria-hidden="true" />
                      {a.kind === 'tag' && <b>Tagged you: </b>}
                      {a.text || <><Image size={13} className="bell-kind" aria-hidden="true" />Photo</>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
