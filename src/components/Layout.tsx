import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { House, Images, MessagesSquare, Users } from 'lucide-react'
import { useAuth } from '../auth'
import Logo from './Logo'
import { Avatar, badgeFor, DEFAULT_BADGE } from './Avatar'
import AvatarPicker from './AvatarPicker'
import ActivityBell from './ActivityBell'
import PullToRefresh from './PullToRefresh'
import { scroller } from '../lib/scroller'

const NAV = [
  { to: '/', label: 'Thanksgiving', Icon: House, end: true },
  { to: '/chat', label: 'Chat', Icon: MessagesSquare },
  { to: '/gallery', label: 'Photos', Icon: Images },
  { to: '/family', label: 'Family', Icon: Users },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  // A new page starts at the top, like an app, instead of keeping the last page's scroll.
  const { pathname } = useLocation()
  useEffect(() => { scroller().scrollTo(0, 0) }, [pathname])
  // iOS pans the whole document up to show the keyboard and can leave it there once the keyboard closes.
  useEffect(() => {
    const settle = () => setTimeout(() => { if (window.scrollY) window.scrollTo(0, 0) }, 100)
    window.addEventListener('focusout', settle)
    return () => window.removeEventListener('focusout', settle)
  }, [])
  return (
    <div className="app">
      <div className="app-scroll">
        <header className="topbar">
          <NavLink to="/" className="brand">
            <Logo size={36} />
            <span>
              <span className="brand-name">Thanksgiving 2026</span>
              <span className="brand-tag">Gather 'round</span>
            </span>
          </NavLink>
          <nav className="topnav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}><n.Icon size={17} strokeWidth={1.9} aria-hidden="true" />{n.label}</NavLink>
            ))}
          </nav>
          <ActivityBell />
          {me && (
            <NavLink to="/family" className="me-chip" title="Your profile">
              <Avatar p={me} size={30} />
              <span className="me-name">{me.display_name}</span>
            </NavLink>
          )}
        </header>
        <PullToRefresh />
        <main className="page">{children}</main>
      </div>
      <nav className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <n.Icon size={22} strokeWidth={1.8} aria-hidden="true" />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      {me && !me.onboarded && <Onboard />}
    </div>
  )
}

function Onboard() {
  const { me, saveProfile } = useAuth()
  const [name, setName] = useState(me?.display_name ?? '')
  const [badge, setBadge] = useState(badgeFor(me?.emoji)?.key ?? DEFAULT_BADGE)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="modal-backdrop">
      <form
        className="card modal stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          setErr(await saveProfile({ display_name: name.trim().slice(0, 30), emoji: badge }))
        }}
      >
        <h2 className="display">Welcome to the table</h2>
        <p className="muted">What should the family call you? Pick a badge too, or upload a photo.</p>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Your name" />
        <AvatarPicker badge={badge} onPick={setBadge} />
        {err && <p className="error">{err}</p>}
        <button className="btn gold">Let's go</button>
      </form>
    </div>
  )
}
