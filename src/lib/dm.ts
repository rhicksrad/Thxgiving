// Private messages on this device: your opened key, everyone's public keys, and the unread count.
// The crypto itself is in dmcrypto.ts; the screens are in pages/Messages.tsx.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from './api'
import { useLiveTable } from './realtime'
import {
  clearDeviceKeys, loadDeviceKey, newKeyPair, saveDeviceKey, seal, unseal,
  type DmMessage, type Lock, type MyKey, type PublicKey,
} from './dmcrypto'

export type Conversation = {
  id: string; created_by: string; created_at: string; members: string[]
  last_read_at: string | null; last_at: string | null; unread: number; last: DmMessage | null
}

/** 'loading' · 'ready' (key open on this device) · 'locked' (a key exists; needs the password) · 'none' (never set up) */
export type KeyState = 'loading' | 'ready' | 'locked' | 'none'

// A tiny store the hooks below subscribe to.
type State = { userId: string | null; state: KeyState; key: MyKey | null; keys: PublicKey[]; unread: number }
let st: State = { userId: null, state: 'loading', key: null, keys: [], unread: 0 }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => { st = { ...st, ...patch }; listeners.forEach((l) => l()) }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useDm = () => useSyncExternalStore(subscribe, () => st)

let loadingFor: string | null = null

/** Work out where this device stands, once per signed-in person. */
export async function startDm(userId: string) {
  if (loadingFor === userId) return
  loadingFor = userId
  if (st.userId !== userId) set({ userId, state: 'loading', key: null, keys: [], unread: 0 })
  const [{ data: lock, error }, local] = await Promise.all([api.get<Lock | null>('/me/key'), loadDeviceKey(userId)])
  if (error) { loadingFor = null; if (local) set({ state: 'ready', key: local }); return }
  if (local && lock && local.keyId === lock.key_id) set({ state: 'ready', key: local })
  else set({ state: lock ? 'locked' : 'none', key: null })
  refreshKeys()
  refreshUnread()
}

export async function refreshKeys() {
  const { data } = await api.get<PublicKey[]>('/dm/keys')
  if (data) set({ keys: data })
}
export async function refreshUnread() {
  const { data } = await api.get<{ unread: number }>('/dm/unread')
  if (data) set({ unread: data.unread })
}
export const setUnread = (n: number) => set({ unread: Math.max(0, n) })

/** Open your key with your password. Sets it up the first time. Returns an error message, or null. */
export async function unlock(userId: string, password: string): Promise<string | null> {
  const { data: lock, error } = await api.get<Lock | null>('/me/key')
  if (error) return error.message
  if (!lock) return createKey(userId, password)
  const privateKey = await unseal(lock, password)
  if (!privateKey) return 'wrong'
  const key = { userId, keyId: lock.key_id, privateKey, publicJwk: JSON.parse(lock.public_key) }
  await saveDeviceKey(key)
  set({ userId, state: 'ready', key })
  return null
}

/** A brand-new key (first time, or starting over after a password reset: older messages stay locked for good). */
export async function createKey(userId: string, password: string): Promise<string | null> {
  const { privateKey, publicJwk } = await newKeyPair()
  const keyId = crypto.randomUUID() // ours to pick, since the seal names it
  const lock = await seal(privateKey, password, keyId)
  const { error } = await api.put<PublicKey>('/me/key', { public_key: JSON.stringify(publicJwk), key_id: keyId, ...lock })
  if (error) return error.message
  const key = { userId, keyId, privateKey, publicJwk }
  await saveDeviceKey(key)
  set({ userId, state: 'ready', key })
  refreshKeys()
  return null
}

/** After signing in with a password: open (or set up) private messages on this device without asking again. */
export async function unlockQuietly(userId: string, password: string) {
  try {
    const local = await loadDeviceKey(userId)
    if (local) return
    await unlock(userId, password) // a wrong answer here (password was reset) is handled on the Messages screen
  } catch { /* the Messages screen will ask */ }
}

/** Your key re-sealed with a new password, to send along with the password change. Null if it isn't open here. */
export async function resealFor(password: string) {
  const k = st.key
  if (!k) return null
  return { key_id: k.keyId, ...(await seal(k.privateKey, password, k.keyId)) }
}

export function signOutDm() {
  loadingFor = null
  set({ userId: null, state: 'loading', key: null, keys: [], unread: 0 })
  return clearDeviceKeys()
}

/** The unread private-message count, kept live. For a badge on the Chat menu item. */
export function useDmUnread(userId: string | undefined) {
  const { unread } = useDm()
  useEffect(() => { if (userId) startDm(userId) }, [userId])
  useLiveTable<DmMessage>('dm_messages', undefined, {
    onInsert: (m) => { if (m.sender_id !== userId && !openConversations.has(m.conversation_id)) set({ unread: st.unread + 1 }) },
    onResync: refreshUnread,
  }, Boolean(userId))
  useLiveTable<{ id: string }>('dm_reads', undefined, { onUpsert: refreshUnread }, Boolean(userId))
  useLiveTable<PublicKey>('dm_keys', undefined, { onUpsert: refreshKeys }, Boolean(userId))
  return unread
}

/** Conversations on screen right now (new messages in them are read as they land). */
export const openConversations = new Set<string>()

/** Everyone's current key, by user id; every key ever, by key id. */
export function useKeyIndex() {
  const { keys } = useDm()
  const [index, setIndex] = useState(() => indexKeys(keys))
  useEffect(() => setIndex(indexKeys(keys)), [keys])
  return index
}
function indexKeys(keys: PublicKey[]) {
  const byId: Record<string, PublicKey> = {}
  const current: Record<string, PublicKey> = {}
  for (const k of keys) { // oldest first, so the last one per person wins
    byId[k.id] = k
    current[k.user_id] = k
  }
  return { byId, current }
}
