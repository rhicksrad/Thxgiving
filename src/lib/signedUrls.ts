import { useEffect, useState } from 'react'
import { signFiles } from './storage'

const URL_TTL = 6 * 3600
// Treat a URL as gone a little before it really expires, so an image never starts loading on a dead link.
const REFRESH_MARGIN_MS = 10 * 60_000

// Signed URLs for private storage, cached until they expire. Paths asked for in the same tick go out in one
// request, and a path already on its way isn't asked for twice (a chat full of avatars is one call, not fifty).
const urlCache = new Map<string, { url: string; expires: number }>()
const inFlight = new Map<string, Promise<void>>()
let queued = new Set<string>()
let flush: Promise<void> | null = null

const cached = (path: string) => {
  const hit = urlCache.get(path)
  if (!hit) return undefined
  if (hit.expires - REFRESH_MARGIN_MS > Date.now()) return hit.url
  urlCache.delete(path) // an installed app can stay open longer than a link lives
  return undefined
}

function fetchUrls(paths: string[]): Promise<void> {
  const waits = paths.filter((p) => inFlight.has(p)).map((p) => inFlight.get(p)!)
  const fresh = paths.filter((p) => !cached(p) && !inFlight.has(p))
  if (fresh.length) {
    fresh.forEach((p) => queued.add(p))
    flush ??= Promise.resolve().then(async () => {
      const batch = [...queued]
      queued = new Set()
      flush = null
      try {
        const expires = Date.now() + URL_TTL * 1000
        const urls = await signFiles(batch, URL_TTL)
        urls.forEach((d) => urlCache.set(d.path, { url: d.url, expires }))
      } finally {
        batch.forEach((p) => inFlight.delete(p)) // a failed batch can be asked for again
      }
    })
    fresh.forEach((p) => inFlight.set(p, flush!))
    waits.push(flush)
  }
  return Promise.all(waits).then(() => undefined)
}

/** Signed URLs for a set of storage paths. Returns a lookup; re-renders once they arrive or need renewing. */
export function useSignedUrls(paths: string[]) {
  const [, bump] = useState(0)
  const key = paths.join('|')
  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => {
      const missing = paths.filter((p) => !cached(p))
      const ready = missing.length ? fetchUrls(missing).then(() => live && bump((n) => n + 1)) : Promise.resolve()
      // Renew before the soonest link in view runs out.
      ready.then(() => {
        if (!live) return
        const soonest = Math.min(...paths.map((p) => urlCache.get(p)?.expires ?? Infinity))
        if (Number.isFinite(soonest)) timer = setTimeout(load, Math.max(60_000, soonest - REFRESH_MARGIN_MS - Date.now()))
      })
    }
    if (paths.length) load()
    return () => { live = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (path: string | null | undefined) => (path ? cached(path) : undefined)
}
