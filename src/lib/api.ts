// Talking to the Worker (worker/index.js). Every call answers { data, error } and never throws, so a dropped
// connection shows as a message instead of a crash.

declare global {
  interface Window {
    TG_CONFIG?: { apiUrl?: string }
  }
}

// public/config.js is what the GitHub Pages build ships. VITE_API_URL (.env.local) overrides it for local dev.
export const API = (import.meta.env.VITE_API_URL || window.TG_CONFIG?.apiUrl || '').replace(/\/$/, '')
export const isConfigured = Boolean(API)

// The sign-in token lives on this device. Private mode can refuse storage; then it lasts until the tab closes.
const TOKEN_KEY = 'tg:token'
let memToken: string | null = null
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) ?? memToken } catch { return memToken }
}
export function setToken(token: string | null) {
  memToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* private mode: memToken has it */ }
}

// Told when the server says the token is no good any more (signed out elsewhere, or taken off the list).
let onSignedOut: (() => void) | null = null
export const whenSignedOut = (f: (() => void) | null) => { onSignedOut = f }

export type ApiError = { message: string; status: number }
export type Result<T> = { data: T | null; error: ApiError | null }

async function call<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    return { data: null, error: { message: "Can't reach the server. Check your signal and try again.", status: 0 } }
  }
  if (!res.ok) {
    if (res.status === 401 && token) onSignedOut?.()
    return { data: null, error: { message: (await res.text().catch(() => '')) || `Something went wrong (${res.status})`, status: res.status } }
  }
  return { data: (await res.json()) as T, error: null }
}

export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => call<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => call<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => call<T>('PATCH', path, body),
  del: <T = { ok: true }>(path: string) => call<T>('DELETE', path),
}

/** Path piece, escaped. */
export const seg = (s: string) => encodeURIComponent(s)
