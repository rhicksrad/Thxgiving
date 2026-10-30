// The whole backend for the Thanksgiving site, on Cloudflare's free plan:
// - D1 (SQLite) holds the data (schema.sql)
// - R2 holds the photos and videos (files.js)
// - a Durable Object pushes every change to everyone's screen as it happens (live.js)
//
// Sign-in is a phone number on the family list plus a password; no texts are sent. A successful sign-in gets a
// random token the site keeps and sends as "Authorization: Bearer <token>". Every route below except the
// sign-in ones and signed file links checks that token and that the number is still on the family list.
import { CORS, fail, json, text } from './http.js'
import * as files from './files.js'

export { Live } from './live.js'

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    try {
      const url = new URL(req.url)
      return await route(req, env, ctx, url)
    } catch (e) {
      if (e instanceof Response) return e
      console.error(e)
      if (/constraint/i.test(e?.message)) return text('That doesn\'t fit (too long, or missing something)', 400)
      return text(`Server error: ${e?.message}`, 500)
    }
  },
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
async function route(req, env, ctx, url) {
  const m = req.method
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const [a, b] = parts
  const at = (method, ...shape) => m === method && parts.length === shape.length &&
    shape.every((s, i) => s === '*' || s === parts[i])
  const db = new Db(env.DB)
  const live = (table, op, row) => ctx.waitUntil(broadcast(env, table, op, row))

  // Signed file links and sign-in don't need a session.
  if (a === 'f' && (m === 'GET' || m === 'HEAD')) return files.serve(req, env, url, url.pathname.slice(3).split('/').map(decodeURIComponent).join('/'))
  if (at('POST', 'auth', 'status')) return authStatus(req, db)
  if (at('POST', 'auth', 'login')) return login(req, db)
  if (at('POST', 'auth', 'signup')) return signup(req, db, live)
  if (at('POST', 'auth', 'logout')) return logout(req, db)
  if (at('GET', 'me')) {
    const s = await session(req, db, ctx)
    return json({ user: profile(s.user), member: s.member })
  }
  if (m === 'GET' && !parts.length) return text('Thanksgiving API')

  // Browsers can't put a header on a WebSocket, so the live connection alone may send its token in the URL.
  const me = await familyOnly(req, db, ctx, a === 'live' ? url : null)
  const uid = me.id

  // Live updates
  if (at('GET', 'live')) {
    if (req.headers.get('upgrade') !== 'websocket') return text('Expected a WebSocket', 426)
    const fwd = new Request(req)
    fwd.headers.set('x-user-id', uid)
    return env.LIVE.get(env.LIVE.idFromName('family')).fetch(fwd)
  }

  // Files
  if (at('POST', 'sign')) return files.sign(req, env, url)
  if (a === 'o' && m === 'PUT') return files.upload(req, env, uid, url.pathname.slice(3).split('/').map(decodeURIComponent).join('/'))
  if (at('POST', 'delete')) return files.remove(req, env, uid)
  if (at('POST', 'hashes')) return files.hashes(req, env)
  if (at('GET', 'usage')) return files.usage(env)

  // You
  if (at('PATCH', 'me')) return updateMe(req, db, me, live)
  if (at('POST', 'me', 'password')) {
    const { password } = await body(req)
    await db.run('update users set password_hash = ? where id = ?', await hashPassword(checkNewPassword(password)), uid)
    return json({ ok: true })
  }

  // The family
  if (at('GET', 'profiles')) return json((await db.all('select * from users order by created_at')).map(profile))
  if (at('GET', 'members')) return json(await db.all('select phone, name, created_at from members order by created_at'))
  if (at('POST', 'members')) return addMember(req, db, uid)
  if (at('DELETE', 'members', '*')) return removeMember(env, db, me, b, ctx)
  if (at('POST', 'members', '*', 'reset')) {
    await db.run('update users set password_hash = \'\' where phone = ?', cleanPhone(b))
    return json({ ok: true })
  }

  // Gatherings
  if (at('GET', 'gatherings')) return json((await db.all('select * from gatherings order by starts_at')).map(gathering))
  if (at('GET', 'gatherings', '*')) return json(gathering(await db.one('select * from gatherings where id = ?', b)))
  if (at('POST', 'gatherings')) return addGathering(req, db, live)
  if (at('PATCH', 'gatherings', '*')) return updateGathering(req, db, b, live)
  if (at('GET', 'stats')) return json(await db.all(STATS))
  if (at('GET', 'stats', '*')) return json(await db.one(`${STATS} where g.id = ?`, b))

  // Food and help lists
  if (at('GET', 'gatherings', '*', 'items')) {
    const kind = url.searchParams.get('kind')
    return json(kind
      ? await db.all('select * from list_items where gathering_id = ? and kind = ?', b, kind)
      : await db.all('select * from list_items where gathering_id = ?', b))
  }
  if (at('GET', 'gatherings', '*', 'my-ratings')) {
    return json(await db.all(`select r.item_id, r.score from food_ratings r join list_items i on i.id = r.item_id
                              where i.gathering_id = ? and r.user_id = ?`, b, uid))
  }
  if (at('POST', 'items')) return addItem(req, db, uid, live)
  if (at('PATCH', 'items', '*')) return updateItem(req, db, b, live)
  if (at('DELETE', 'items', '*')) {
    await db.run('delete from list_items where id = ?', b)
    live('list_items', 'delete', { id: b })
    return json({ ok: true })
  }
  if (at('PUT', 'items', '*', 'rating')) return rate(req, db, uid, b, live)

  // Who's coming
  if (at('GET', 'gatherings', '*', 'rsvps')) return json(await db.all('select * from rsvps where gathering_id = ?', b))
  if (at('PUT', 'gatherings', '*', 'rsvp')) return rsvp(req, db, uid, b, live)

  // Chat
  if (at('GET', 'messages')) {
    const g = url.searchParams.get('gathering') || null
    const before = url.searchParams.get('before') || '9999'
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200)
    return json(await db.all(`select * from messages where gathering_id is ? and created_at < ?
                              order by created_at desc limit ?`, g, before, limit))
  }
  if (at('GET', 'messages', '*')) return json(await db.one('select * from messages where id = ?', b))
  if (at('POST', 'messages')) return postMessage(req, db, uid, live)
  if (at('DELETE', 'messages', '*')) {
    const msg = await own(db, 'messages', 'author_id', b, uid)
    await db.batch([['delete from reactions where target_id = ?', b], ['delete from messages where id = ?', b]])
    if (msg.image_path) ctx.waitUntil(files.removeOwn(env, uid, [msg.image_path]))
    live('messages', 'delete', { id: b })
    return json({ ok: true })
  }

  // Photos
  if (at('GET', 'photos')) {
    const g = url.searchParams.get('gathering')
    return json(g
      ? await db.all('select * from photos where gathering_id = ? order by created_at desc', g)
      : await db.all('select * from photos order by created_at desc'))
  }
  if (at('POST', 'photos')) return addPhoto(req, db, uid, live)
  if (at('PATCH', 'photos', '*')) return updatePhoto(req, db, uid, b, live)
  if (at('DELETE', 'photos', '*')) return deletePhoto(env, db, uid, b, ctx, live)

  // Photo comments
  if (at('GET', 'comments')) {
    const ids = (url.searchParams.get('photos') || '').split(',').filter(Boolean).slice(0, 200)
    if (!ids.length) return json(await db.all('select id, photo_id from photo_comments'))
    return json(await db.all(`select * from photo_comments where photo_id in (${marks(ids)}) order by created_at`, ...ids))
  }
  if (at('GET', 'comments', '*')) return json(await db.one('select * from photo_comments where id = ?', b))
  if (at('POST', 'comments')) {
    const { photo_id, body: words } = await body(req)
    const row = { id: uuid(), photo_id: str(photo_id), author_id: uid, body: str(words).trim(), created_at: now() }
    if (!row.body) fail('Say something first')
    await db.insert('photo_comments', row)
    live('photo_comments', 'insert', row)
    return json(row)
  }
  if (at('DELETE', 'comments', '*')) {
    await own(db, 'photo_comments', 'author_id', b, uid)
    await db.batch([['delete from reactions where target_id = ?', b], ['delete from photo_comments where id = ?', b]])
    live('photo_comments', 'delete', { id: b })
    return json({ ok: true })
  }

  // Reactions
  if (at('GET', 'reactions')) {
    const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 200)
    if (!ids.length) return json([])
    return json(await db.all(`select * from reactions where target_type = ? and target_id in (${marks(ids)})`,
      url.searchParams.get('type'), ...ids))
  }
  if (at('POST', 'reactions')) return react(req, db, uid, live)
  if (at('DELETE', 'reactions', '*')) {
    await own(db, 'reactions', 'user_id', b, uid)
    await db.run('delete from reactions where id = ?', b)
    live('reactions', 'delete', { id: b })
    return json({ ok: true })
  }

  // What's new (the bell): the latest from everyone else.
  if (at('GET', 'activity')) {
    const [posts, added, pics, reacts, comments] = await Promise.all([
      db.all('select id, gathering_id, author_id, body, created_at from messages where author_id <> ? order by created_at desc limit 30', uid),
      // Rows with no creator are the starter list every new gathering gets, not something a person added.
      db.all(`select id, gathering_id, kind, label, created_by, created_at from list_items
              where created_by is not null and created_by <> ? order by created_at desc limit 30`, uid),
      db.all('select id, gathering_id, uploader_id, created_at from photos where uploader_id <> ? order by created_at desc limit 30', uid),
      db.all(`select id, target_type, target_id, user_id, emoji, created_at from reactions
              where owner_id = ? and user_id <> ? order by created_at desc limit 30`, uid, uid),
      db.all('select id, photo_id, author_id, body, created_at from photo_comments where author_id <> ? order by created_at desc limit 30', uid),
    ])
    return json({ posts, added, pics, reacts, comments })
  }

  return text('Not found', 404)
}

// ---------------------------------------------------------------------------
// D1 helpers
// ---------------------------------------------------------------------------
class Db {
  constructor(d1) { this.d1 = d1 }
  stmt(sql, args) { return this.d1.prepare(sql).bind(...args.map((v) => (v === undefined ? null : v))) }
  one(sql, ...args) { return this.stmt(sql, args).first() }
  async all(sql, ...args) { return (await this.stmt(sql, args).all()).results }
  run(sql, ...args) { return this.stmt(sql, args).run() }
  /** Several statements as one transaction: all of them happen, or none. */
  batch(list) { return this.d1.batch(list.map(([sql, ...args]) => this.stmt(sql, args))) }
  insertStmt(table, row) {
    const cols = Object.keys(row)
    return [`insert into ${table} (${cols.join(', ')}) values (${marks(cols)})`, ...Object.values(row)]
  }
  insert(table, row) { const [sql, ...args] = this.insertStmt(table, row); return this.run(sql, ...args) }
}

const marks = (list) => list.map(() => '?').join(', ')
const now = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v))
/** Optional text: trimmed, cut to max, '' → null. */
const opt = (v, max) => { const s = str(v).trim().slice(0, max); return s || null }

async function body(req) {
  try { return (await req.json()) ?? {} } catch { return fail('Bad request') }
}

/** The row, if it's yours; otherwise the request stops here. */
async function own(db, table, col, id, uid) {
  const row = await db.one(`select * from ${table} where id = ?`, id)
  if (!row) fail('That is gone', 404)
  if (row[col] !== uid) fail('That isn\'t yours', 403)
  return row
}

// What goes out to the site: users without their password hash, true/false instead of 1/0.
const profile = (u) => u && ({
  id: u.id, phone: u.phone, display_name: u.display_name, emoji: u.emoji, avatar_path: u.avatar_path,
  onboarded: Boolean(u.onboarded), created_at: u.created_at,
})
const gathering = (g) => g && ({ ...g, time_tbd: Boolean(g.time_tbd) })

async function broadcast(env, table, op, row) {
  try {
    await env.LIVE.get(env.LIVE.idFromName('family')).broadcast(JSON.stringify({ table, op, row }))
  } catch (e) { console.error('broadcast failed', e) }
}

// ---------------------------------------------------------------------------
// Phone numbers: digits with the country code and no "+". (317) 555-0123 → 13175550123.
// ---------------------------------------------------------------------------
export function cleanPhone(raw) {
  const d = str(raw).replace(/\D/g, '')
  const full = d.length === 10 ? `1${d}` : d
  return /^[0-9]{11,15}$/.test(full) ? full : ''
}

// ---------------------------------------------------------------------------
// Passwords (PBKDF2-SHA256, the most rounds Workers allow) and session tokens (random, stored as SHA-256)
// ---------------------------------------------------------------------------
const ROUNDS = 100_000
const enc = (s) => new TextEncoder().encode(s)
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0))

async function pbkdf2(password, salt, rounds) {
  const key = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256)
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ROUNDS}$${b64(salt)}$${b64(await pbkdf2(password, salt, ROUNDS))}`
}

async function passwordMatches(password, stored) {
  const [kind, rounds, salt, hash] = str(stored).split('$')
  if (kind !== 'pbkdf2' || !hash) return false
  const got = new Uint8Array(await pbkdf2(password, unb64(salt), Number(rounds)))
  const want = unb64(hash)
  return got.length === want.length && crypto.subtle.timingSafeEqual(got, want)
}

function checkNewPassword(password) {
  if (str(password).length < 6) fail('Password needs at least 6 characters.')
  if (str(password).length > 200) fail('That password is too long.')
  return str(password)
}

const sha256 = async (s) => b64(await crypto.subtle.digest('SHA-256', enc(s)))

async function newSession(db, userId) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32)))
  await db.insert('sessions', { token_hash: await sha256(token), user_id: userId, created_at: now(), last_seen: now() })
  return token
}

// A device that hasn't opened the site in six months has to sign in again.
const SESSION_IDLE_MS = 180 * 86400_000

async function session(req, db, ctx, url) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || url?.searchParams.get('token') || ''
  if (!token) fail('Sign in first', 401)
  const hash = await sha256(token)
  const row = await db.one(`select u.*, s.last_seen as session_seen,
                              exists (select 1 from members m where m.phone = u.phone) as member
                            from sessions s join users u on u.id = s.user_id where s.token_hash = ?`, hash)
  if (!row) fail('Sign in first', 401)
  const idle = Date.now() - Date.parse(row.session_seen)
  if (idle > SESSION_IDLE_MS) {
    await db.run('delete from sessions where token_hash = ?', hash)
    fail('Sign in first', 401)
  }
  if (idle > 86400_000) ctx.waitUntil(db.run('update sessions set last_seen = ? where token_hash = ?', now(), hash))
  return { user: row, member: Boolean(row.member) }
}

async function familyOnly(req, db, ctx, url) {
  const s = await session(req, db, ctx, url)
  if (!s.member) fail('That number isn\'t on the family list', 403)
  return s.user
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------
/** 'not_member' | 'new' (no account yet) | 'set_password' (account, no password) | 'password' */
async function phoneStatus(db, phone) {
  if (!phone || !(await db.one('select 1 from members where phone = ?', phone))) return 'not_member'
  const user = await db.one('select password_hash from users where phone = ?', phone)
  if (!user) return 'new'
  return user.password_hash ? 'password' : 'set_password'
}

async function authStatus(req, db) {
  const { phone } = await body(req)
  return json({ status: await phoneStatus(db, cleanPhone(phone)) })
}

const MAX_FAILURES = 10
const FAILURE_WINDOW_MS = 15 * 60_000

async function login(req, db) {
  const { phone: raw, password } = await body(req)
  const phone = cleanPhone(raw)
  const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString()
  const { n } = await db.one('select count(*) as n from login_failures where phone = ? and at > ?', phone, since)
  if (n >= MAX_FAILURES) fail('Too many wrong tries. Wait 15 minutes and try again.', 429)
  const user = await db.one(`select u.* from users u join members m on m.phone = u.phone where u.phone = ?`, phone)
  if (!user || !(await passwordMatches(str(password), user.password_hash))) {
    await db.batch([
      ['insert into login_failures (phone, at) values (?, ?)', phone, now()],
      ['delete from login_failures where at < ?', new Date(Date.now() - 86400_000).toISOString()],
    ])
    fail('Wrong password.', 401)
  }
  return json({ token: await newSession(db, user.id), user: profile(user) })
}

/** First time (or after a reset): pick a password. Only numbers on the family list get an account. */
async function signup(req, db, live) {
  const { phone: raw, password } = await body(req)
  const phone = cleanPhone(raw)
  const hash = await hashPassword(checkNewPassword(password))
  const status = await phoneStatus(db, phone)
  if (status === 'not_member') fail('That number isn\'t on the family list.', 403)
  if (status === 'password') fail('That account already has a password.', 409)
  let user
  if (status === 'new') {
    const member = await db.one('select name from members where phone = ?', phone)
    user = { id: uuid(), phone, password_hash: hash, display_name: member?.name || 'Family', emoji: 'turkey', onboarded: 0, created_at: now() }
    await db.insert('users', user)
    live('profiles', 'insert', profile(user))
  } else {
    // Only an account with no password can be claimed this way, checked in the same statement.
    const done = await db.run('update users set password_hash = ? where phone = ? and password_hash = \'\'', hash, phone)
    if (!done.meta.changes) fail('That account already has a password.', 409)
    user = await db.one('select * from users where phone = ?', phone)
  }
  return json({ token: await newSession(db, user.id), user: profile(user) })
}

async function logout(req, db) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (token) await db.run('delete from sessions where token_hash = ?', await sha256(token))
  return json({ ok: true })
}

// ---------------------------------------------------------------------------
// Profiles and the family list
// ---------------------------------------------------------------------------
async function updateMe(req, db, me, live) {
  const patch = await body(req)
  const next = { ...me }
  if ('display_name' in patch) {
    next.display_name = opt(patch.display_name, 30) ?? 'Family'
    next.onboarded = 1 // saving a name finishes the welcome form
  }
  if ('emoji' in patch) next.emoji = opt(patch.emoji, 32) ?? 'turkey'
  if ('avatar_path' in patch) {
    const p = opt(patch.avatar_path, 300)
    if (p && !p.startsWith(`${me.id}/avatar/`)) fail('That photo isn\'t yours')
    next.avatar_path = p
  }
  await db.run('update users set display_name = ?, emoji = ?, avatar_path = ?, onboarded = ? where id = ?',
    next.display_name, next.emoji, next.avatar_path, next.onboarded, me.id)
  live('profiles', 'update', profile(next))
  return json(profile(next))
}

async function addMember(req, db, uid) {
  const { phone: raw, name } = await body(req)
  const phone = cleanPhone(raw)
  if (!phone) fail('That doesn\'t look like a phone number. Include the area code.')
  const row = { phone, name: opt(name, 40), invited_by: uid, created_at: now() }
  try {
    await db.insert('members', row)
  } catch (e) {
    if (/unique|primary key/i.test(e.message)) fail('That number is already on the list.', 409)
    throw e
  }
  return json(row)
}

async function removeMember(env, db, me, raw, ctx) {
  const phone = cleanPhone(raw)
  if (phone === me.phone) fail('You can\'t take yourself off the list.')
  const user = await db.one('select id from users where phone = ?', phone)
  await db.batch([
    ['delete from members where phone = ?', phone],
    ['delete from sessions where user_id = (select id from users where phone = ?)', phone],
  ])
  if (user) ctx.waitUntil(env.LIVE.get(env.LIVE.idFromName('family')).kick(user.id).catch(() => {}))
  return json({ ok: true })
}

// ---------------------------------------------------------------------------
// Gatherings
// ---------------------------------------------------------------------------
const STATS = `select g.id as gathering_id,
  (select count(*) from messages m where m.gathering_id = g.id) as message_count,
  (select count(*) from photos p where p.gathering_id = g.id) as photo_count,
  (select count(*) from list_items i where i.gathering_id = g.id and i.kind = 'food') as food_total,
  (select count(*) from list_items i where i.gathering_id = g.id and i.kind = 'food'
     and (i.owner_id is not null or i.owner_name is not null)) as food_claimed,
  (select count(*) from list_items i where i.gathering_id = g.id and i.kind = 'ask' and i.status = 'open') as asks_open,
  (select coalesce(sum(1 + r.guests), 0) from rsvps r where r.gathering_id = g.id and r.status = 'yes') as coming,
  (select count(*) from rsvps r where r.gathering_id = g.id and r.status = 'maybe') as maybe
from gatherings g`

const isTime = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))

async function addGathering(req, db, live) {
  const p = await body(req)
  const title = opt(p.title, 80)
  if (!title) fail('Give it a name')
  if (!isTime(p.starts_at)) fail('Pick a date')
  const row = { id: uuid(), title, starts_at: new Date(p.starts_at).toISOString(), time_tbd: p.time_tbd ? 1 : 0, created_at: now() }
  // The new gathering and its starter lists, together.
  await db.batch([
    db.insertStmt('gatherings', row),
    [`insert into list_items (id, gathering_id, kind, label, sort, created_at)
      select lower(hex(randomblob(16))), ?, kind, label, sort, ? from list_template`, row.id, row.created_at],
  ])
  live('gatherings', 'insert', gathering(row))
  return json(gathering(row))
}

async function updateGathering(req, db, id, live) {
  const p = await body(req)
  const cur = await db.one('select * from gatherings where id = ?', id)
  if (!cur) fail('That is gone', 404)
  if ('title' in p) cur.title = opt(p.title, 80) ?? cur.title
  if ('starts_at' in p) { if (!isTime(p.starts_at)) fail('Pick a date'); cur.starts_at = new Date(p.starts_at).toISOString() }
  if ('time_tbd' in p) cur.time_tbd = p.time_tbd ? 1 : 0
  if ('place' in p) cur.place = opt(p.place, 500)
  if ('notes' in p) cur.notes = opt(p.notes, 500)
  await db.run('update gatherings set title = ?, starts_at = ?, time_tbd = ?, place = ?, notes = ? where id = ?',
    cur.title, cur.starts_at, cur.time_tbd, cur.place, cur.notes, id)
  live('gatherings', 'update', gathering(cur))
  return json(gathering(cur))
}

// ---------------------------------------------------------------------------
// Lists: anyone in the family can add, claim, answer, edit or remove
// ---------------------------------------------------------------------------
async function addItem(req, db, uid, live) {
  const p = await body(req)
  if (!['food', 'ask'].includes(p.kind)) fail('Bad request')
  const label = opt(p.label, 200)
  if (!label) fail('Type something first')
  const row = {
    id: uuid(), gathering_id: str(p.gathering_id), kind: p.kind, label, note: null, owner_id: null, owner_name: null,
    status: 'open', sort: 1000, created_by: uid, created_at: now(), rating_sum: 0, rating_count: 0,
  }
  await db.insert('list_items', row)
  live('list_items', 'insert', row)
  return json(row)
}

async function updateItem(req, db, id, live) {
  const p = await body(req)
  const cur = await db.one('select * from list_items where id = ?', id)
  if (!cur) fail('That is gone', 404)
  if ('label' in p) cur.label = opt(p.label, 200) ?? cur.label
  if ('note' in p) cur.note = opt(p.note, 500)
  if ('owner_id' in p) {
    cur.owner_id = p.owner_id ? str(p.owner_id) : null
    if (cur.owner_id && !(await db.one('select 1 from users where id = ?', cur.owner_id))) fail('Who\'s that?')
  }
  if ('owner_name' in p) cur.owner_name = opt(p.owner_name, 40)
  if ('status' in p) { if (!['open', 'yes', 'no'].includes(p.status)) fail('Bad request'); cur.status = p.status }
  await db.run('update list_items set label = ?, note = ?, owner_id = ?, owner_name = ?, status = ? where id = ?',
    cur.label, cur.note, cur.owner_id, cur.owner_name, cur.status, id)
  live('list_items', 'update', cur)
  return json(cur)
}

/** Your 1–10 for a dish (null clears it). Only the totals ever leave here, never who gave what. */
async function rate(req, db, uid, id, live) {
  const { score } = await body(req)
  const item = await db.one('select kind from list_items where id = ?', id)
  if (!item) fail('That is gone', 404)
  if (item.kind !== 'food') fail('Only food gets rated')
  const n = score === null ? null : Number(score)
  if (n !== null && !(Number.isInteger(n) && n >= 1 && n <= 10)) fail('Pick 1 to 10')
  await db.batch([
    n === null
      ? ['delete from food_ratings where item_id = ? and user_id = ?', id, uid]
      : [`insert into food_ratings (item_id, user_id, score) values (?, ?, ?)
          on conflict (item_id, user_id) do update set score = excluded.score`, id, uid, n],
    [`update list_items set rating_sum = (select coalesce(sum(score), 0) from food_ratings where item_id = ?1),
                            rating_count = (select count(*) from food_ratings where item_id = ?1) where id = ?1`, id],
  ])
  const row = await db.one('select * from list_items where id = ?', id)
  live('list_items', 'update', row)
  return json(row)
}

async function rsvp(req, db, uid, gatheringId, live) {
  const p = await body(req)
  if (!['yes', 'maybe', 'no'].includes(p.status)) fail('Bad request')
  const guests = p.status === 'no' ? 0 : Math.max(0, Math.min(20, Math.floor(Number(p.guests) || 0)))
  await db.run(`insert into rsvps (id, gathering_id, user_id, status, guests, updated_at) values (?, ?, ?, ?, ?, ?)
                on conflict (gathering_id, user_id) do update set status = excluded.status, guests = excluded.guests,
                updated_at = excluded.updated_at`, uuid(), gatheringId, uid, p.status, guests, now())
  const row = await db.one('select * from rsvps where gathering_id = ? and user_id = ?', gatheringId, uid)
  live('rsvps', 'update', row)
  return json(row)
}

// ---------------------------------------------------------------------------
// Chat, photos, reactions
// ---------------------------------------------------------------------------
async function postMessage(req, db, uid, live) {
  const p = await body(req)
  const image = opt(p.image_path, 300)
  if (image && !files.ownedBy(uid, image)) fail('That picture isn\'t yours')
  const row = { id: uuid(), gathering_id: p.gathering_id ? str(p.gathering_id) : null, author_id: uid,
    body: str(p.body).trim().slice(0, 2000), image_path: image, created_at: now() }
  if (!row.body && !row.image_path) fail('Say something first')
  await db.insert('messages', row)
  live('messages', 'insert', row)
  return json(row)
}

async function addPhoto(req, db, uid, live) {
  const p = await body(req)
  const path = str(p.path)
  const thumb = opt(p.thumb_path, 300)
  if (!files.ownedBy(uid, path) || (thumb && !files.ownedBy(uid, thumb))) fail('That file isn\'t yours')
  const row = {
    id: uuid(), gathering_id: p.gathering_id ? str(p.gathering_id) : null, uploader_id: uid, path, thumb_path: thumb,
    mime: opt(p.mime, 100) ?? 'image/jpeg', caption: opt(p.caption, 300),
    taken_at: isTime(p.taken_at) ? new Date(p.taken_at).toISOString() : null, content_hash: opt(p.content_hash, 64),
    created_at: now(),
  }
  await db.insert('photos', row)
  live('photos', 'insert', row)
  return json(row)
}

async function updatePhoto(req, db, uid, id, live) {
  const p = await body(req)
  const cur = await own(db, 'photos', 'uploader_id', id, uid)
  if ('caption' in p) cur.caption = opt(p.caption, 300)
  if ('content_hash' in p) cur.content_hash = opt(p.content_hash, 64)
  if ('taken_at' in p) cur.taken_at = isTime(p.taken_at) ? new Date(p.taken_at).toISOString() : null
  await db.run('update photos set caption = ?, content_hash = ?, taken_at = ? where id = ?', cur.caption, cur.content_hash, cur.taken_at, id)
  live('photos', 'update', cur)
  return json(cur)
}

/** Your photo goes, with its comments, everyone's reactions on it, and the files. */
async function deletePhoto(env, db, uid, id, ctx, live) {
  const photo = await own(db, 'photos', 'uploader_id', id, uid)
  const comments = await db.all('select id from photo_comments where photo_id = ?', id)
  await db.batch([
    [`delete from reactions where target_id = ? or target_id in (select id from photo_comments where photo_id = ?)`, id, id],
    ['delete from photos where id = ?', id], // its comments go with it
  ])
  ctx.waitUntil(files.removeOwn(env, uid, [photo.path, photo.thumb_path]))
  live('photos', 'delete', { id })
  for (const c of comments) live('photo_comments', 'delete', { id: c.id })
  return json({ ok: true })
}

const OWNER_OF = {
  photo: 'select uploader_id as owner from photos where id = ?',
  message: 'select author_id as owner from messages where id = ?',
  comment: 'select author_id as owner from photo_comments where id = ?',
}

async function react(req, db, uid, live) {
  const p = await body(req)
  if (!(p.target_type in OWNER_OF)) fail('Bad request')
  const emoji = str(p.emoji).trim()
  if (!emoji || emoji.length > 16) fail('Pick an emoji')
  const target = await db.one(OWNER_OF[p.target_type], str(p.target_id))
  if (!target) fail('That is gone', 404)
  const row = { id: uuid(), target_type: p.target_type, target_id: str(p.target_id), owner_id: target.owner, user_id: uid, emoji, created_at: now() }
  try {
    await db.insert('reactions', row)
  } catch (e) {
    if (!/unique/i.test(e.message)) throw e
    // Already there (a double tap): hand back the one we have.
    return json(await db.one('select * from reactions where target_type = ? and target_id = ? and user_id = ? and emoji = ?',
      row.target_type, row.target_id, uid, emoji))
  }
  live('reactions', 'insert', row)
  return json(row)
}
