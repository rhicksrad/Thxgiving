// Private messages. Everything here is already locked when it arrives: the browser seals each message with a
// fresh key and wraps that key for each person in the conversation (src/lib/dmcrypto.ts). This file only checks
// who may see what, stores the sealed text, and tells the people in a conversation when something changes.
// It can't read a word, and nothing about private messages goes out to anyone outside the conversation.
import { fail, json } from './http.js'

const now = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const B64 = /^[A-Za-z0-9_-]+$/
const ID = /^[A-Za-z0-9-]{8,64}$/
const MAX_PEOPLE = 12

async function body(req) {
  try { return (await req.json()) ?? {} } catch { return fail('Bad request') }
}

const parseKeys = (s) => { try { return JSON.parse(s) } catch { return {} } }
const message = (r) => r && ({ ...r, keys: parseKeys(r.keys) })

/** The newest key for each person who has one. */
const CURRENT_KEYS = `select k.* from dm_keys k where k.created_at = (select max(created_at) from dm_keys x where x.user_id = k.user_id)`

/**
 * Handles /dm/... and /me/key... Returns a Response, or null when the path isn't one of these.
 * `send(userIds, table, op, row)` tells only those people's screens.
 */
export async function route(req, { db, uid, parts, url, send }) {
  const m = req.method
  const at = (method, ...shape) => m === method && parts.length === shape.length &&
    shape.every((s, i) => s === '*' || s === parts[i])

  // Your sealed private key, to open on this device with your password.
  if (at('GET', 'me', 'key')) {
    return json(await db.one(`select l.key_id, l.sealed, l.salt, l.iv, l.rounds, k.public_key
                              from dm_locks l join dm_keys k on k.id = l.key_id where l.user_id = ?`, uid))
  }
  // A new key pair (first time, or starting fresh after a password reset).
  if (at('PUT', 'me', 'key')) {
    const p = await body(req)
    const lock = checkLock(p)
    const pub = str(p.public_key)
    if (!pub || pub.length > 1000) fail('Bad key')
    try { const j = JSON.parse(pub); if (j.kty !== 'EC' || j.crv !== 'P-256' || j.d) fail('Bad key') } catch (e) { if (e instanceof Response) throw e; fail('Bad key') }
    const keyId = str(p.key_id) // the browser picks it: the sealed copy names it
    if (!ID.test(keyId)) fail('Bad key')
    const key = { id: keyId, user_id: uid, public_key: pub, created_at: now() }
    await db.batch([
      ['insert into dm_keys (id, user_id, public_key, created_at) values (?, ?, ?, ?)', key.id, key.user_id, key.public_key, key.created_at],
      [`insert into dm_locks (user_id, key_id, sealed, salt, iv, rounds, updated_at) values (?, ?, ?, ?, ?, ?, ?)
        on conflict (user_id) do update set key_id = excluded.key_id, sealed = excluded.sealed, salt = excluded.salt,
        iv = excluded.iv, rounds = excluded.rounds, updated_at = excluded.updated_at`,
        uid, key.id, lock.sealed, lock.salt, lock.iv, lock.rounds, now()],
    ])
    send(await everyone(db), 'dm_keys', 'insert', key)
    return json(key)
  }

  // Everyone's public keys, old ones too (older messages name the key they were sealed with).
  if (at('GET', 'dm', 'keys')) return json(await db.all('select id, user_id, public_key, created_at from dm_keys order by created_at'))

  // Your conversations, newest first, each with its last message (still sealed) and how many you haven't read.
  if (at('GET', 'dm')) {
    const convs = await db.all(`
      select c.id, c.created_by, c.created_at, c.member_key, me.last_read_at,
        (select max(created_at) from dm_messages x where x.conversation_id = c.id) as last_at,
        (select count(*) from dm_messages x where x.conversation_id = c.id and x.sender_id <> ?1
           and x.created_at > coalesce(me.last_read_at, '')) as unread
      from dm_conversations c join dm_members me on me.conversation_id = c.id and me.user_id = ?1
      order by coalesce(last_at, c.created_at) desc`, uid)
    const last = convs.length ? await db.all(`
      select m.* from dm_messages m join dm_members me on me.conversation_id = m.conversation_id and me.user_id = ?
      where m.created_at = (select max(created_at) from dm_messages x where x.conversation_id = m.conversation_id)`, uid) : []
    const byConv = Object.fromEntries(last.map((r) => [r.conversation_id, message(r)]))
    return json(convs.map(({ member_key, ...c }) => ({ ...c, members: member_key.split(','), last: byConv[c.id] ?? null })))
  }
  if (at('GET', 'dm', 'unread')) {
    const row = await db.one(`select count(*) as n from dm_messages x join dm_members me
      on me.conversation_id = x.conversation_id and me.user_id = ?1
      where x.sender_id <> ?1 and x.created_at > coalesce(me.last_read_at, '')`, uid)
    return json({ unread: row?.n ?? 0 })
  }

  // Start (or find) the conversation with these people.
  if (at('POST', 'dm')) {
    const p = await body(req)
    const ids = [...new Set([uid, ...(Array.isArray(p.members) ? p.members.map(str) : [])])].sort()
    if (ids.length < 2) fail('Pick someone to message')
    if (ids.length > MAX_PEOPLE) fail(`Up to ${MAX_PEOPLE} people in one conversation`)
    const found = await db.all(`select id from users where id in (${ids.map(() => '?').join(', ')})`, ...ids)
    if (found.length !== ids.length) fail('Who\'s that?')
    const member_key = ids.join(',')
    let conv = await db.one('select * from dm_conversations where member_key = ?', member_key)
    if (!conv) {
      conv = { id: uuid(), member_key, created_by: uid, created_at: now() }
      try {
        await db.batch([
          ['insert into dm_conversations (id, member_key, created_by, created_at) values (?, ?, ?, ?)', conv.id, member_key, uid, conv.created_at],
          ...ids.map((id) => ['insert into dm_members (conversation_id, user_id) values (?, ?)', conv.id, id]),
        ])
      } catch (e) {
        if (!/unique/i.test(e.message)) throw e
        conv = await db.one('select * from dm_conversations where member_key = ?', member_key) // two taps at once
      }
    }
    const { member_key: mk, ...rest } = conv
    return json({ ...rest, members: mk.split(','), last_read_at: null, last_at: null, unread: 0, last: null })
  }

  if (parts[0] !== 'dm') return null
  const convId = parts[1]

  // One message: yours to delete.
  if (at('DELETE', 'dm', 'messages', '*')) {
    const row = await db.one('select * from dm_messages where id = ?', parts[2])
    if (!row) fail('That is gone', 404)
    if (row.sender_id !== uid) fail('That isn\'t yours', 403)
    const members = await membersOf(db, row.conversation_id)
    await db.run('delete from dm_messages where id = ?', row.id)
    send(members, 'dm_messages', 'delete', { id: row.id })
    return json({ ok: true })
  }

  // Everything below is one conversation, and only for the people in it.
  const members = await membersOf(db, convId)
  if (!members.includes(uid)) fail('That conversation isn\'t yours', 404)

  if (at('GET', 'dm', '*', 'messages')) {
    const before = url.searchParams.get('before') || '9999'
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200)
    const rows = await db.all(`select * from dm_messages where conversation_id = ? and created_at < ?
                               order by created_at desc limit ?`, convId, before, limit)
    return json(rows.map(message))
  }

  if (at('POST', 'dm', '*', 'messages')) {
    const p = await body(req)
    const id = str(p.id)
    if (!ID.test(id)) fail('Bad request')
    const iv = str(p.iv), sealed = str(p.body)
    if (!B64.test(iv) || iv.length > 40 || !B64.test(sealed) || sealed.length > 12000) fail('That message is too long')
    // The sealed key has to be there for every person in the conversation, wrapped for their current key;
    // otherwise someone would be left unable to read it.
    const current = Object.fromEntries((await db.all(CURRENT_KEYS)).map((k) => [k.user_id, k.id]))
    if (str(p.sender_key) !== current[uid]) fail('Your lock changed. Reload and try again.', 409)
    const keys = p.keys && typeof p.keys === 'object' ? p.keys : {}
    const clean = {}
    for (const who of members) {
      const k = keys[who]
      if (!k || str(k.k) !== current[who] || !B64.test(str(k.w)) || str(k.w).length > 100) {
        fail(current[who] ? 'Someone\'s lock changed. Reload and try again.' : 'Someone here hasn\'t turned on private messages yet.', 409)
      }
      clean[who] = { k: str(k.k), w: str(k.w) }
    }
    const row = { id, conversation_id: convId, sender_id: uid, sender_key: current[uid], iv, body: sealed,
      keys: JSON.stringify(clean), created_at: now() }
    try {
      await db.batch([
        ['insert into dm_messages (id, conversation_id, sender_id, sender_key, iv, body, keys, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
          row.id, row.conversation_id, row.sender_id, row.sender_key, row.iv, row.body, row.keys, row.created_at],
        ['update dm_members set last_read_at = ? where conversation_id = ? and user_id = ?', row.created_at, convId, uid],
      ])
    } catch (e) {
      if (/unique|primary key/i.test(e.message)) fail('Already sent', 409)
      throw e
    }
    send(members, 'dm_messages', 'insert', message(row))
    return json(message(row))
  }

  // You've read up to now.
  if (at('POST', 'dm', '*', 'read')) {
    const t = now()
    await db.run('update dm_members set last_read_at = ? where conversation_id = ? and user_id = ?', t, convId, uid)
    send([uid], 'dm_reads', 'update', { id: convId, last_read_at: t })
    return json({ ok: true, last_read_at: t })
  }

  return null
}

async function membersOf(db, convId) {
  return (await db.all('select user_id from dm_members where conversation_id = ?', convId)).map((r) => r.user_id)
}

async function everyone(db) {
  return (await db.all('select id from users')).map((r) => r.id)
}

/** A sealed private key from the browser: base64url pieces and a round count. */
export function checkLock(p) {
  const lock = { sealed: str(p.sealed), salt: str(p.salt), iv: str(p.iv), rounds: Number(p.rounds) }
  if (!B64.test(lock.sealed) || lock.sealed.length > 2000 || !B64.test(lock.salt) || lock.salt.length > 64 ||
      !B64.test(lock.iv) || lock.iv.length > 40 || !Number.isInteger(lock.rounds) || lock.rounds < 100_000 || lock.rounds > 10_000_000) {
    fail('Bad key')
  }
  return lock
}
