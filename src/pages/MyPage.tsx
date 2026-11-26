import { Suspense, useEffect, useState } from 'react'
import { Lock, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { when } from '../lib/format'
import { useAuth } from '../auth'
import { PRIVATE_PAGES } from '../private'

type Wish = { wish: string; updated_at: string }

/**
 * Your own page. Nobody else in the family can see it. It starts blank: you say what you want it to be, and it
 * gets built for you in the next site update. Once it's built, it shows here, with the box below it for changes.
 */
export default function MyPage() {
  const { me } = useAuth()
  const Built = me ? PRIVATE_PAGES[me.id] : undefined
  return (
    <div className="stack-lg">
      {Built ? (
        <Suspense fallback={<div className="loading">Loading…</div>}><Built /></Suspense>
      ) : (
        <header className="page-head my-blank">
          <span className="badge"><Lock size={12} aria-hidden="true" />Only you can see this</span>
          <h1 className="display">Your page</h1>
          <p className="muted">
            This page is yours alone. Right now it's blank. Tell us what you'd like it to be, and it'll be built for you in
            the next update to the site: a recipe box, a to-do list, a countdown, a journal, a wish list, a scoreboard,
            anything.
          </p>
        </header>
      )}
      <WishBox built={Boolean(Built)} />
    </div>
  )
}

function WishBox({ built }: { built: boolean }) {
  const [saved, setSaved] = useState<Wish | null | undefined>(undefined)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.get<Wish | null>('/me/page').then(({ data, error }) => {
      if (error) return setErr(error.message)
      setSaved(data); setText(data?.wish ?? '')
    })
  }, [])

  const dirty = text.trim() !== (saved?.wish ?? '')
  return (
    <form className="card stack wish-box" onSubmit={async (e) => {
      e.preventDefault()
      setBusy(true); setErr(null)
      const { data, error } = await api.put<Wish | null>('/me/page', { wish: text })
      setBusy(false)
      if (error) return setErr(error.message)
      setSaved(data); setText(data?.wish ?? '')
    }}>
      <h2 className="display"><Sparkles size={20} aria-hidden="true" />{built ? 'Want something changed?' : 'What should your page be?'}</h2>
      <p className="muted small">
        {built
          ? 'Describe what to add or change. It happens in the next update to the site.'
          : 'Describe it in your own words, as much or as little as you like. You can change it any time before the next update.'}
      </p>
      <textarea className="input" rows={6} maxLength={4000} value={text} disabled={saved === undefined}
        placeholder="e.g. A list of books I want to read, with a spot to rate the ones I've finished"
        onChange={(e) => setText(e.target.value)} aria-label="What you want your page to be" />
      <div className="row wrap">
        <button className="btn gold" disabled={busy || !dirty}>{busy ? 'Saving…' : saved ? 'Update my request' : 'Save my request'}</button>
        {saved && !dirty && <span className="muted small">Saved {when(saved.updated_at)}. It'll be built in the next update.</span>}
      </div>
      {err && <p className="error">{err}</p>}
    </form>
  )
}
