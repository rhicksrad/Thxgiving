import { BUCKET, supabase } from './supabase'

// Where photos, videos, chat pics and avatars live. With TG_CONFIG.filesUrl set (public/config.js), that's the
// Cloudflare R2 file service in worker/; without it, the Supabase "gallery" bucket. Same paths either way.
const filesUrl = (window.TG_CONFIG?.filesUrl || import.meta.env.VITE_FILES_URL || '').replace(/\/$/, '')

async function call(route: string, init: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`${filesUrl}/${route}`, {
    ...init, headers: { ...init.headers, authorization: `Bearer ${data.session?.access_token ?? ''}` },
  })
  if (!res.ok) throw new Error((await res.text()) || `Upload failed (${res.status})`)
  return res.json()
}

/** Uploads a file. Returns its content hash (MD5) when the R2 file service gives one, for spotting duplicates. */
export async function uploadFile(path: string, file: Blob, contentType?: string): Promise<string | null> {
  if (!filesUrl) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType })
    if (error) throw error
    return null
  }
  const route = `o/${path.split('/').map(encodeURIComponent).join('/')}`
  const res = await call(route, { method: 'PUT', body: file, headers: { 'content-type': contentType || file.type || 'application/octet-stream' } })
  return typeof res?.hash === 'string' ? res.hash : null
}

/** Content hashes (MD5) of stored files, by path. Files the R2 service doesn't have yet are left out. */
export async function fileHashes(paths: string[]): Promise<Record<string, string>> {
  if (!filesUrl || !paths.length) return {}
  const { hashes } = await call('hashes', { method: 'POST', body: JSON.stringify({ paths }), headers: { 'content-type': 'application/json' } })
  return hashes ?? {}
}

export async function removeFiles(paths: string[]) {
  if (!paths.length) return
  if (!filesUrl) { await supabase.storage.from(BUCKET).remove(paths); return }
  await call('delete', { method: 'POST', body: JSON.stringify({ paths }), headers: { 'content-type': 'application/json' } })
}

/** Signed links for a set of paths. `download` makes the link save the file under that name. */
export async function signFiles(paths: string[], ttl: number, download?: string): Promise<{ path: string; url: string }[]> {
  if (!paths.length) return []
  if (!filesUrl) {
    if (download) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(paths[0], ttl, { download })
      return data ? [{ path: paths[0], url: data.signedUrl }] : []
    }
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, ttl)
    return (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [{ path: d.path, url: d.signedUrl }] : []))
  }
  // The file service takes up to 1000 paths a call; a big gallery goes out in a few calls side by side.
  const chunks: string[][] = []
  for (let i = 0; i < paths.length; i += 500) chunks.push(paths.slice(i, i + 500))
  const results = await Promise.all(chunks.map((chunk) => call('sign', {
    method: 'POST', body: JSON.stringify({ paths: chunk, ttl, download }), headers: { 'content-type': 'application/json' },
  })))
  return results.flatMap((r) => r.urls ?? [])
}

export type Usage = { bytes: number; files: number; limit: number }

/** How much the R2 file service holds, against its free tier. Null when files are still in Supabase. */
export async function storageUsage(): Promise<Usage | null> {
  if (!filesUrl) return null
  return call('usage', { method: 'GET' })
}
