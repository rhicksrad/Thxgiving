import { useEffect, useRef } from 'react'
import { API, getToken } from './api'

type Row = { id: string } & Record<string, unknown>
type Handlers<T extends Row> = {
  onInsert?: (row: T) => void // new rows only; falls back to onUpsert when not given
  onUpsert?: (row: T) => void
  onDelete?: (id: string) => void
  onResync?: () => void // the connection dropped and came back (phone slept, signal blipped): changes may have been missed
}
type Change = { table: string; op: 'insert' | 'update' | 'delete'; row: Row }
type Sub = { table: string; match: (row: Row) => boolean; handlers: { current: Handlers<Row> } }

// One WebSocket to the Worker's live room (worker/live.js) carries every table's changes; each hook below
// picks out its own. It pings to stay up, and reconnects on its own after a drop.
const subs = new Set<Sub>()
let ws: WebSocket | null = null
let joinedBefore = false
let lastHeard = 0
let attempts = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined
let pingTimer: ReturnType<typeof setInterval> | undefined

const PING_MS = 25_000
const DEAD_MS = 60_000 // nothing heard for this long (not even a pong): the connection is gone

function connect() {
  clearTimeout(retryTimer)
  const token = getToken()
  if (ws || !token || !subs.size || !API) return
  const sock = new WebSocket(`${API.replace(/^http/, 'ws')}/live?token=${encodeURIComponent(token)}`)
  ws = sock
  sock.onopen = () => {
    attempts = 0
    lastHeard = Date.now()
    if (joinedBefore) subs.forEach((s) => s.handlers.current.onResync?.())
    joinedBefore = true
  }
  sock.onmessage = (e) => {
    lastHeard = Date.now()
    if (e.data === 'pong') return
    let c: Change
    try { c = JSON.parse(e.data) } catch { return }
    for (const s of subs) {
      if (s.table !== c.table) continue
      const h = s.handlers.current
      if (c.op === 'delete') h.onDelete?.(c.row.id) // like before: deletes aren't filtered; ids you don't have are ignored
      else if (s.match(c.row)) (c.op === 'insert' ? h.onInsert ?? h.onUpsert : h.onUpsert)?.(c.row)
    }
  }
  sock.onclose = (e) => {
    if (ws === sock) ws = null
    if (e.code === 4003) return // taken off the family list: don't keep knocking
    attempts++
    retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)))
  }
}

function ensurePinging() {
  if (pingTimer) return
  pingTimer = setInterval(() => {
    if (!ws) return
    if (ws.readyState === WebSocket.OPEN) {
      if (Date.now() - lastHeard > DEAD_MS) { ws.close(); return }
      ws.send('ping')
    }
  }, PING_MS)
  // Back from the background or back online: check right away instead of waiting for the next ping.
  const wake = () => {
    if (document.visibilityState === 'hidden') return
    if (!ws) { attempts = 0; connect() } else if (ws.readyState === WebSocket.OPEN) ws.send('ping')
  }
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('online', wake)
}

/** Drop the connection (signing out) or start over with a new token (signing in). */
export function resetLive() {
  joinedBefore = false
  const old = ws
  ws = null
  old?.close()
  connect()
}

/** "gathering_id=eq.123" or "photo_id=in.(a,b)" → a test for a row. No filter: every row. */
function matcher(filter?: string) {
  if (!filter) return () => true
  const m = filter.match(/^(\w+)=(eq|in)\.(.*)$/)
  if (!m) return () => true
  const [, col, op, val] = m
  if (op === 'eq') return (r: Row) => String(r[col] ?? '') === val
  const set = new Set(val.replace(/^\(|\)$/g, '').split(','))
  return (r: Row) => set.has(String(r[col] ?? ''))
}

/**
 * Live inserts/updates (optionally filtered, e.g. "gathering_id=eq.123") and deletes for one table.
 * Deletes can't be filtered, so callers just ignore ids they don't have.
 * Nothing is replayed after a reconnect, so `onResync` is the cue to reload.
 */
export function useLiveTable<T extends Row>(table: string, filter: string | undefined, h: Handlers<T>, enabled = true) {
  const handlers = useRef(h)
  handlers.current = h
  useEffect(() => {
    if (!enabled) return
    const sub: Sub = { table, match: matcher(filter), handlers: handlers as unknown as Sub['handlers'] }
    subs.add(sub)
    ensurePinging()
    connect()
    return () => { subs.delete(sub) }
  }, [table, filter, enabled])
}

/** Insert-or-replace by id, keeping order stable. */
export function upsertById<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id)
  if (i === -1) return [...list, row]
  const next = list.slice()
  next[i] = { ...next[i], ...row }
  return next
}
