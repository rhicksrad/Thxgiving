import { API, getToken } from './api'

// Photos, videos, chat pics and avatars live in Cloudflare R2, through the Worker (worker/files.js).

async function call(route: string, init: RequestInit) {
  const res = await fetch(`${API}/${route}`, {
    ...init, headers: { ...init.headers, authorization: `Bearer ${getToken() ?? ''}` },
  })
  if (!res.ok) throw new Error((await res.text()) || `Upload failed (${res.status})`)
  return res.json()
}

/** Uploads a file. Returns its content hash (MD5), for spotting the same pic uploaded twice. */
export async function uploadFile(path: string, file: Blob, contentType?: string): Promise<string | null> {
  const route = `o/${path.split('/').map(encodeURIComponent).join('/')}`
  const res = await call(route, { method: 'PUT', body: file, headers: { 'content-type': contentType || file.type || 'application/octet-stream' } })
  return typeof res?.hash === 'string' ? res.hash : null
}

/** Content hashes (MD5) of stored files, by path. */
export async function fileHashes(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { hashes } = await call('hashes', { method: 'POST', body: JSON.stringify({ paths }), headers: { 'content-type': 'application/json' } })
  return hashes ?? {}
}

/** Deletes your own files (others' are left alone). */
export async function removeFiles(paths: string[]) {
  if (!paths.length) return
  await call('delete', { method: 'POST', body: JSON.stringify({ paths }), headers: { 'content-type': 'application/json' } })
}

/** Signed links for a set of paths. `download` makes the link save the file under that name. */
export async function signFiles(paths: string[], ttl: number, download?: string): Promise<{ path: string; url: string }[]> {
  if (!paths.length) return []
  // The Worker takes up to 1000 paths a call; a big gallery goes out in a few calls side by side.
  const chunks: string[][] = []
  for (let i = 0; i < paths.length; i += 500) chunks.push(paths.slice(i, i + 500))
  const results = await Promise.all(chunks.map((chunk) => call('sign', {
    method: 'POST', body: JSON.stringify({ paths: chunk, ttl, download }), headers: { 'content-type': 'application/json' },
  })))
  return results.flatMap((r) => r.urls ?? [])
}

export type Usage = { bytes: number; files: number; limit: number }

/** How much is stored in R2, against its free tier. */
export async function storageUsage(): Promise<Usage | null> {
  return call('usage', { method: 'GET' })
}
