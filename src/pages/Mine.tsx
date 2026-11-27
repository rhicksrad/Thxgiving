import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import Spot from '../components/Spot'

// Everyone's own private page. It starts blank: you type what you want it to be, and the next time the site is
// updated, your page gets built from that (see `npm run pages` in worker/). Only you can open it.
type PageRow = { wish: string; wish_at: string | null; page: string; page_at: string | null; data: string | null }

const parseData = (raw: string | null): unknown => {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

/** A value as a <script> literal: JSON, with "<" escaped so nothing in it can close the script tag. */
const literal = (v: unknown) => JSON.stringify(v ?? null).replace(/</g, '\\u003c')

/** The season's colors, so a built page can look like the rest of the site (var(--bg), var(--gold)…). */
function themeVars() {
  const cs = getComputedStyle(document.documentElement)
  return ['bg', 'card', 'card-2', 'line', 'text', 'text-2', 'muted', 'gold', 'gold-hi', 'ink', 'ok', 'bad', 'rush', 'aged']
    .map((k) => `--${k}: ${cs.getPropertyValue(`--${k}`).trim() || 'initial'};`).join(' ')
}

// What every built page gets before its own HTML: the theme, sensible defaults, and `window.page`:
//   page.name          your name
//   page.data          what the page saved last time (null at first)
//   page.save(value)   keep any JSON-able value for next time (up to 100 KB)
function frameDoc(html: string, data: unknown, name: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>:root { ${themeVars()} color-scheme: dark; }
html, body { margin: 0; background: transparent; color: var(--text); font: 15px/1.5 Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; }
a { color: var(--gold); }</style>
<script>(() => {
  let data = ${literal(data)};
  const send = (m) => parent.postMessage(m, '*');
  window.page = {
    name: ${literal(name)},
    get data() { return data },
    load: () => Promise.resolve(data),
    save: (value) => { data = value; send({ type: 'page:save', data: value }); return Promise.resolve() },
  };
  const report = () => send({ type: 'page:height', height: Math.ceil(document.documentElement.scrollHeight) });
  addEventListener('load', () => { report(); new ResizeObserver(report).observe(document.body); });
})();</script>
</head><body>${html}</body></html>`
}

export default function Mine() {
  const { me } = useAuth()
  const [row, setRow] = useState<PageRow | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [wish, setWish] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<PageRow>('/me/page').then(({ data, error }) => {
      if (data) { setRow(data); setWish(data.wish) } else setLoadErr(error?.message ?? 'Could not load your page')
    })
  }, [])

  const saveWish = async () => {
    setSaving(true); setErr(null); setNote(null)
    const text = wish.trim()
    const { error } = await api.put('/me/page/wish', { wish: text })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setRow((r) => r && { ...r, wish: text, wish_at: new Date().toISOString() })
    setNote(text ? "Saved. Your page gets made the next time the site is updated." : 'Cleared.')
  }

  if (loadErr) return <div className="card"><p className="error">{loadErr}</p></div>
  if (!row) return <div className="loading">Loading…</div>

  const built = Boolean(row.page)
  const waiting = Boolean(row.wish) && (!row.page_at || (row.wish_at ?? '') > row.page_at)
  const changed = wish.trim() !== row.wish

  const form = (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); saveWish() }}>
      <textarea className="input mine-wish" rows={built ? 4 : 7} maxLength={4000} value={wish}
        placeholder="Anything you like. A countdown to your birthday, a recipe box, a to-do list, a page about your dog, a journal, a game…"
        onChange={(e) => { setWish(e.target.value); setNote(null) }} aria-label="What you want your page to be" />
      <div className="row">
        <button className="btn gold" disabled={saving || !changed}>{saving ? 'Saving…' : 'Save'}</button>
        {note && <span className="muted small">{note}</span>}
        {!note && waiting && !changed && <span className="muted small">Waiting for the next site update.</span>}
      </div>
      {err && <p className="error">{err}</p>}
    </form>
  )

  return (
    <div className="stack-lg">
      {built ? (
        <>
          <BuiltPage html={row.page} data={parseData(row.data)} name={me?.display_name ?? ''} />
          <details className="card stack mine-change">
            <summary><b>Change your page</b> <span className="muted small">· only you can see this</span></summary>
            <p className="muted small">Say what you'd like different. It changes the next time the site is updated.</p>
            {form}
          </details>
        </>
      ) : (
        <section className="card stack">
          <div className="page-head with-spot">
            <h1 className="display">Your page</h1>
            <Spot name="mine" className="page-spot" />
          </div>
          <p className="mine-private muted small"><LockKeyhole size={14} aria-hidden="true" />
            Only you can see this page. Nobody else in the family can open it.</p>
          <p>It's blank for now. Type what you want it to be, and the next time the site gets updated, it'll be made
            for you.</p>
          {form}
          <p className="muted small">Whoever updates the site reads what you type here, so they can build it.</p>
        </section>
      )}
    </div>
  )
}

/** The built page, in a sandboxed frame: its scripts run, but it can't see the site, your sign-in, or anyone's data. */
function BuiltPage({ html, data, name }: { html: string; data: unknown; name: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(320)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  // Only built once: a new srcdoc would reload the page and lose whatever is on screen.
  const doc = useMemo(() => frameDoc(html, data, name), [html]) // eslint-disable-line react-hooks/exhaustive-deps

  const pending = useRef<{ data: unknown } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flush = useCallback(async () => {
    const next = pending.current
    if (!next) return
    pending.current = null
    const { error } = await api.put('/me/page/data', { data: next.data })
    setSaveErr(error ? `Couldn't save: ${error.message}` : null)
  }, [])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const m = e.data as { type?: string; height?: number; data?: unknown }
      if (m?.type === 'page:height' && typeof m.height === 'number') setHeight(Math.max(120, Math.min(m.height, 20000)))
      if (m?.type === 'page:save') {
        pending.current = { data: m.data }
        clearTimeout(timer.current)
        timer.current = setTimeout(flush, 700)
      }
    }
    window.addEventListener('message', onMessage)
    return () => { window.removeEventListener('message', onMessage); clearTimeout(timer.current); flush() }
  }, [flush])

  return (
    <section className="mine-page">
      <iframe ref={frame} title="Your page" srcDoc={doc} style={{ height }}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox" />
      {saveErr && <p className="error">{saveErr}</p>}
    </section>
  )
}
