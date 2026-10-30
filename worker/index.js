// File service for photos, videos, chat pics and avatars, stored in Cloudflare R2.
// It stands in for the Supabase "gallery" bucket with the same rules:
// - Only signed-in family (public.is_member() in Supabase) can sign links, upload or delete.
// - You can only upload or delete under your own "<user id>/" folder.
// - Files are private; the site gets short-lived signed links, like Supabase's createSignedUrls.
//
// Routes:
//   POST   /sign        { paths, ttl?, download? }  -> { urls: [{ path, url }] }    (family only)
//   PUT    /o/<path>    body = the file                                            (family only, own folder)
//   POST   /delete      { paths }                                                  (family only, own folder)
//   GET    /usage       -> { bytes, files, limit }  total stored in R2                (family only)
//   POST   /hashes      { paths }  -> { hashes: { <path>: <md5> } }  to spot duplicates (family only)
//   GET    /f/<path>?e=<expires>&s=<signature>[&d=<download name>]                 (signed link)
// It also pings Supabase on a schedule so the free project never pauses (see wrangler.toml).

const MAX_BYTES = 100 * 1024 * 1024 // Workers' request body cap on the free plan
const MAX_TTL = 24 * 3600
const AUTH_TTL_MS = 60_000
const FREE_BYTES = 10 * 1024 ** 3 // R2 free tier: 10 GB-month of storage

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, PUT, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, range',
  'access-control-expose-headers': 'content-length, content-range, content-disposition, etag',
  'access-control-max-age': '86400',
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    try {
      const url = new URL(req.url)
      const route = url.pathname.split('/')[1]
      const path = decodeURIComponent(url.pathname.slice(route.length + 2))
      if (route === 'f' && (req.method === 'GET' || req.method === 'HEAD')) return await serve(req, env, url, path)
      if (route === 'sign' && req.method === 'POST') return await sign(req, env, url)
      if (route === 'o' && req.method === 'PUT') return await upload(req, env, path)
      if (route === 'delete' && req.method === 'POST') return await remove(req, env)
      if (route === 'usage' && req.method === 'GET') return await usage(req, env)
      if (route === 'hashes' && req.method === 'POST') return await hashes(req, env)
      return text('Not found', 404)
    } catch (e) {
      if (e instanceof Response) return e
      return text(`Server error: ${e.message}`, 500)
    }
  },

  // Keep the free Supabase project awake: it pauses after a week with no activity.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(fetch(`${env.SUPABASE_URL}/rest/v1/gatherings?select=id&limit=1`, { headers: { apikey: env.SUPABASE_KEY } }))
  },
}

const text = (body, status = 200) => new Response(body, { status, headers: { ...CORS, 'content-type': 'text/plain' } })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

const validPath = (p) => typeof p === 'string' && p.length > 0 && p.length < 512 && !p.startsWith('/') && !p.split('/').includes('..')

// ---------------------------------------------------------------------------
// Who's asking: the Supabase session token the site already has, checked against Supabase itself.
// ---------------------------------------------------------------------------
const authCache = new Map()

const tokenOf = (req) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')

async function familyMember(req, env) {
  const token = tokenOf(req)
  if (!token) throw text('Sign in first', 401)
  const hit = authCache.get(token)
  if (hit && hit.until > Date.now()) return hit.uid

  const headers = { apikey: env.SUPABASE_KEY, authorization: `Bearer ${token}` }
  const user = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers })
  if (!user.ok) throw text('Sign in first', 401)
  const { id } = await user.json()
  const member = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_member`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}',
  })
  if (!member.ok || (await member.json()) !== true) throw text('Family only', 403)

  if (authCache.size > 500) authCache.clear()
  authCache.set(token, { uid: id, until: Date.now() + AUTH_TTL_MS })
  return id
}

const ownedBy = (uid, p) => validPath(p) && p.startsWith(`${uid}/`)

// ---------------------------------------------------------------------------
// Signed links
// ---------------------------------------------------------------------------
// The signing key, imported once per instance instead of once per link (a gallery signs hundreds at a time).
let signingKey = null
async function hmac(env, message) {
  signingKey ??= crypto.subtle.importKey('raw', new TextEncoder().encode(env.SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const key = await signingKey
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function same(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b)
  return x.length === y.length && crypto.subtle.timingSafeEqual(x, y)
}

async function sign(req, env, url) {
  await familyMember(req, env)
  const { paths, ttl = 3600, download } = await req.json()
  if (!Array.isArray(paths) || paths.length > 1000) return text('Bad request', 400)
  // Round the expiry up to the hour, so the same file gets the same link for a while and the browser can cache it.
  const life = Math.min(Math.max(Number(ttl) || 3600, 60), MAX_TTL)
  const e = Math.ceil((Date.now() / 1000 + life) / 3600) * 3600
  const d = typeof download === 'string' ? download : ''
  const urls = await Promise.all(paths.filter(validPath).map(async (p) => {
    const s = await hmac(env, `${p}\n${e}\n${d}`)
    const q = new URLSearchParams({ e: String(e), s, ...(d ? { d } : {}) })
    return { path: p, url: `${url.origin}/f/${p.split('/').map(encodeURIComponent).join('/')}?${q}` }
  }))
  return json({ urls })
}

async function serve(req, env, url, path) {
  const e = Number(url.searchParams.get('e'))
  const s = url.searchParams.get('s') || ''
  const d = url.searchParams.get('d') || ''
  if (!validPath(path) || !e || e < Date.now() / 1000) return text('Link expired', 403)
  if (!same(s, await hmac(env, `${path}\n${e}\n${d}`))) return text('Bad link', 403)

  const obj = await env.FILES.get(path, { range: req.headers, onlyIf: req.headers })
  if (!obj) return text('Not found', 404)
  const headers = new Headers(CORS)
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('accept-ranges', 'bytes')
  // A path never gets new contents (every upload is a new name), so the browser needn't re-check it while the link lives.
  headers.set('cache-control', `private, max-age=${Math.max(0, Math.floor(e - Date.now() / 1000))}, immutable`)
  if (d) headers.set('content-disposition', `attachment; filename="${d.replace(/["\\\r\n]/g, '')}"`)
  if (!('body' in obj)) return new Response(null, { status: 304, headers })

  let status = 200
  if (req.headers.has('range') && obj.range) {
    const r = obj.range
    const offset = r.suffix != null ? obj.size - r.suffix : (r.offset ?? 0)
    const length = r.suffix != null ? r.suffix : (r.length ?? obj.size - offset)
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`)
    status = 206
  }
  return new Response(req.method === 'HEAD' ? null : obj.body, { status, headers })
}

// ---------------------------------------------------------------------------
// Upload and delete
// ---------------------------------------------------------------------------
async function putFile(req, env, path) {
  const type = req.headers.get('content-type') || ''
  if (!/^(image|video)\//.test(type)) return text('Only photos and videos', 415)
  const size = Number(req.headers.get('content-length'))
  if (!size) return text('Missing file', 411)
  if (size > MAX_BYTES) return text(`Files can be up to ${MAX_BYTES / 1024 / 1024} MB`, 413)
  const obj = await env.FILES.put(path, req.body, { httpMetadata: { contentType: type } })
  dropIndex()
  return json({ path, hash: obj?.etag ?? null })
}

async function upload(req, env, path) {
  const uid = await familyMember(req, env)
  if (!ownedBy(uid, path)) return text('You can only upload to your own folder', 403)
  return putFile(req, env, path)
}

async function remove(req, env) {
  const uid = await familyMember(req, env)
  const { paths } = await req.json()
  if (!Array.isArray(paths)) return text('Bad request', 400)
  const mine = paths.filter((p) => ownedBy(uid, p))
  if (mine.length) {
    await env.FILES.delete(mine)
    dropIndex()
  }
  return json({ deleted: mine })
}

// ---------------------------------------------------------------------------
// Content hashes, so the same file uploaded by two people shows once. R2's etag for a single-part upload (all of
// ours) is the MD5 of the file, so this reads nothing but each file's metadata.
// ---------------------------------------------------------------------------
async function hashes(req, env) {
  await familyMember(req, env)
  const { paths } = await req.json()
  if (!Array.isArray(paths) || paths.length > 1000) return text('Bad request', 400)
  const valid = paths.filter(validPath)
  const { etags } = await bucketIndex(env)
  const objs = await Promise.all(valid.map((p) => (etags.has(p) ? null : env.FILES.head(p))))
  return json({ hashes: Object.fromEntries(valid.flatMap((p, i) => {
    const h = etags.get(p) ?? objs[i]?.etag
    return h ? [[p, h]] : []
  })) })
}

// ---------------------------------------------------------------------------
// What's in the bucket: every file's MD5 (etag) and the total size, from listing it 1000 at a time. Cached for a
// few minutes and dropped whenever this instance uploads or deletes something. Finding duplicates reads
// from it instead of looking up every file one by one.
// ---------------------------------------------------------------------------
const INDEX_TTL_MS = 5 * 60_000
let indexCache = null

async function bucketIndex(env) {
  if (!indexCache || indexCache.until < Date.now()) {
    indexCache = (async () => {
      const etags = new Map()
      let bytes = 0, cursor
      do {
        const page = await env.FILES.list({ cursor, limit: 1000 })
        for (const o of page.objects) { bytes += o.size; etags.set(o.key, o.etag) }
        cursor = page.truncated ? page.cursor : undefined
      } while (cursor)
      return { etags, bytes }
    })()
    indexCache.until = Date.now() + INDEX_TTL_MS
    indexCache.catch(() => { indexCache = null })
  }
  return indexCache
}
const dropIndex = () => { indexCache = null }


// Storage used, for the meter on the Gallery page.
async function usage(req, env) {
  await familyMember(req, env)
  const { etags, bytes } = await bucketIndex(env)
  return json({ bytes, files: etags.size, limit: FREE_BYTES })
}
