// Photos, videos, chat pics and avatars, stored in Cloudflare R2.
// - Only signed-in family can sign links, upload or delete (index.js checks that before calling these).
// - You can only upload or delete under your own "<user id>/" folder.
// - Files are private; the site gets short-lived signed links.
import { CORS, json, text } from './http.js'

const MAX_BYTES = 100 * 1024 * 1024 // Workers' request body cap on the free plan
const MAX_TTL = 24 * 3600
const FREE_BYTES = 10 * 1024 ** 3 // R2 free tier: 10 GB-month of storage

export const validPath = (p) => typeof p === 'string' && p.length > 0 && p.length < 512 && !p.startsWith('/') && !p.split('/').includes('..')
export const ownedBy = (uid, p) => validPath(p) && p.startsWith(`${uid}/`)

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

/** POST /sign { paths, ttl?, download? } → { urls: [{ path, url }] } */
export async function sign(req, env, url) {
  if (!env.SIGNING_SECRET) return text('The file service has no SIGNING_SECRET set', 500)
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

/** GET /f/<path>?e=…&s=…[&d=…] — anyone holding a signed link, until it expires. */
export async function serve(req, env, url, path) {
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
/** PUT /o/<path> — returns the file's MD5, for spotting the same pic uploaded twice. */
export async function upload(req, env, uid, path) {
  if (!ownedBy(uid, path)) return text('You can only upload to your own folder', 403)
  const type = req.headers.get('content-type') || ''
  if (!/^(image|video)\//.test(type)) return text('Only photos and videos', 415)
  const size = Number(req.headers.get('content-length'))
  if (!size) return text('Missing file', 411)
  if (size > MAX_BYTES) return text(`Files can be up to ${MAX_BYTES / 1024 / 1024} MB`, 413)
  const obj = await env.FILES.put(path, req.body, { httpMetadata: { contentType: type } })
  dropIndex()
  return json({ path, hash: obj?.etag ?? null })
}

/** POST /delete { paths } — only your own files go. */
export async function remove(req, env, uid) {
  const { paths } = await req.json()
  if (!Array.isArray(paths)) return text('Bad request', 400)
  const mine = await removeOwn(env, uid, paths)
  return json({ deleted: mine })
}

/** Deletes the paths in uid's own folder; used by the route above and when a photo or message is deleted. */
export async function removeOwn(env, uid, paths) {
  const mine = paths.filter((p) => p && ownedBy(uid, p))
  if (mine.length) {
    await env.FILES.delete(mine)
    dropIndex()
  }
  return mine
}

// ---------------------------------------------------------------------------
// Content hashes, so the same file uploaded by two people shows once. R2's etag for a single-part upload (all of
// ours) is the MD5 of the file, so this reads nothing but each file's metadata.
// ---------------------------------------------------------------------------
/** POST /hashes { paths } → { hashes: { <path>: <md5> } } */
export async function hashes(req, env) {
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
// few minutes and dropped whenever this instance uploads or deletes something.
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

/** GET /usage → { bytes, files, limit }, for the meter on the Photos page. */
export async function usage(env) {
  const { etags, bytes } = await bucketIndex(env)
  return json({ bytes, files: etags.size, limit: FREE_BYTES })
}
