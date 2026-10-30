import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, seg } from './api'
import { useLiveTable } from './realtime'
import type { Reaction, ReactionTarget } from './types'
import { useAuth } from '../auth'

const CHUNK = 100 // ids per request, so the URL stays short

export type Reactions = {
  ready: boolean // false until the table answers (or if it isn't in the database yet): hide the UI
  of: (targetId: string) => Reaction[]
  toggle: (targetId: string, emoji: string) => void
}

/**
 * Emoji reactions for a set of photos, messages or comments, kept live. Ids already loaded aren't asked for
 * again, so a chat growing one message at a time only fetches the new one.
 */
export function useReactions(type: ReactionTarget, ids: string[]): Reactions {
  const { me } = useAuth()
  const [rows, setRows] = useState<Record<string, Reaction>>({})
  const [ready, setReady] = useState(false)
  const fetched = useRef(new Set<string>())
  const wanted = useRef(new Set<string>())
  wanted.current = new Set(ids)
  const key = ids.join(',')

  const load = useCallback(async (todo: string[]) => {
    for (let i = 0; i < todo.length; i += CHUNK) {
      const part = todo.slice(i, i + CHUNK)
      const { data, error } = await api.get<Reaction[]>(`/reactions?type=${type}&ids=${seg(part.join(','))}`)
      if (error || !data) { part.forEach((id) => fetched.current.delete(id)); return }
      setReady(true)
      const got = new Set(part)
      setRows((cur) => {
        const next: Record<string, Reaction> = {}
        for (const r of Object.values(cur)) if (!got.has(r.target_id)) next[r.id] = r
        for (const r of data) next[r.id] = r
        return next
      })
    }
  }, [type])

  useEffect(() => {
    const todo = ids.filter((id) => !fetched.current.has(id))
    if (!todo.length) return
    todo.forEach((id) => fetched.current.add(id))
    load(todo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load])

  useLiveTable<Reaction>('reactions', `target_type=eq.${type}`, {
    onInsert: (r) => { if (wanted.current.has(r.target_id)) setRows((cur) => ({ ...dropTemp(cur, r), [r.id]: r })) },
    onDelete: (id) => setRows((cur) => {
      if (!cur[id]) return cur
      const next = { ...cur }
      delete next[id]
      return next
    }),
    onResync: () => load([...fetched.current]),
  })

  const byTarget = useMemo(() => {
    const m = new Map<string, Reaction[]>()
    for (const r of Object.values(rows).sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      m.set(r.target_id, [...(m.get(r.target_id) ?? []), r])
    }
    return m
  }, [rows])

  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const myId = me?.id
  const toggle = useCallback(async (targetId: string, emoji: string) => {
    if (!myId) return
    const mine = Object.values(rowsRef.current).find((r) => r.target_id === targetId && r.user_id === myId && r.emoji === emoji)
    if (mine) {
      setRows((cur) => { const next = { ...cur }; delete next[mine.id]; return next })
      if (mine.id.startsWith('tmp:')) return
      const { error } = await api.del(`/reactions/${seg(mine.id)}`)
      if (error) setRows((cur) => ({ ...cur, [mine.id]: mine }))
      return
    }
    const temp: Reaction = {
      id: `tmp:${crypto.randomUUID()}`, target_type: type, target_id: targetId, owner_id: null,
      user_id: myId, emoji, created_at: new Date().toISOString(),
    }
    setRows((cur) => ({ ...cur, [temp.id]: temp }))
    const { data, error } = await api.post<Reaction>('/reactions', { target_type: type, target_id: targetId, emoji })
    setRows((cur) => {
      const next = { ...cur }
      delete next[temp.id]
      if (!error && data) next[data.id] = data
      return next
    })
  }, [myId, type])

  const of = useCallback((id: string) => byTarget.get(id) ?? NONE, [byTarget])
  return useMemo(() => ({ ready, of, toggle }), [ready, of, toggle])
}

const NONE: Reaction[] = []

/** The live copy of a reaction we added ourselves replaces its placeholder. */
function dropTemp(cur: Record<string, Reaction>, r: Reaction) {
  const temp = Object.values(cur).find((x) => x.id.startsWith('tmp:') && x.target_id === r.target_id && x.user_id === r.user_id && x.emoji === r.emoji)
  if (!temp) return cur
  const next = { ...cur }
  delete next[temp.id]
  return next
}
