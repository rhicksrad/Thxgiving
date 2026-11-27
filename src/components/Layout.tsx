import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { CalendarDays, Gift, House, Images, LockKeyhole, Menu, MessagesSquare, Trophy, Users, X } from 'lucide-react'
import { useAuth } from '../auth'
import Logo from './Logo'
import { Avatar, badgeFor, DEFAULT_BADGE } from './Avatar'
import AvatarPicker from './AvatarPicker'
import ActivityBell from './ActivityBell'
import PullToRefresh from './PullToRefresh'
import { scroller } from '../lib/scroller'
import { applyTheme, useTheme } from '../lib/theme'
import { loadBirthdays } from '../lib/birthdays'
import { loadGames } from '../lib/games'
import SeasonSky from './SeasonSky'

const NAV = [
  { to: '/', label: 'Home', Icon: House, end: true },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/chat', label: 'Chat', Icon: MessagesSquare },
  { to: '/gallery', label: 'Photos', Icon: Images },
  { to: '/gifts', label: 'Gift lists', Icon: Gift },
  { to: '/pickem', label: "Pick'em", Icon: Trophy },
  { to: '/family', label: 'Family', Icon: Users },
  { to: '/mine', label: 'My page', Icon: LockKeyhole },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const theme = useTheme()
  // A new page starts at the top, like an app, instead of keeping the last page's scroll.
  const { pathname } = useLocation()
  useEffect(() => { scroller().scrollTo(0, 0) }, [pathname])
  // Whose birthday is when: fetched once signed in, so the site can dress up on the day.
  const myId = me?.id
  useEffect(() => {
    if (!myId) return
    loadBirthdays().then((changed) => { if (changed) applyTheme() })
    loadGames().then((changed) => { if (changed) applyTheme() }) // Purdue's schedules, for game days
  }, [myId])
  // iOS pans the whole document up to show the keyboard and can leave it there once the keyboard closes.
  useEffect(() => {
    const settle = () => setTimeout(() => { if (window.scrollY) window.scrollTo(0, 0) }, 100)
    window.addEventListener('focusout', settle)
    return () => window.removeEventListener('focusout', settle)
  }, [])
  return (
    <div className="app">
      <SeasonSky />
      <div className="app-scroll">
        <header className="topbar">
          <NavLink to="/" className="brand">
            <Logo size={36} />
            <span>
              <span className="brand-name">Hicks Family</span>
              <span className="brand-tag">{theme.tagline}</span>
            </span>
          </NavLink>
          <ActivityBell />
          {me && (
            <NavLink to="/family" className="me-chip" title="Your profile">
              <Avatar p={me} size={30} />
              <span className="me-name">{me.display_name}</span>
            </NavLink>
          )}
          <SiteMenu />
        </header>
        <PullToRefresh />
        <main className="page">{children}</main>
      </div>
      {me && !me.onboarded && <Onboard />}
    </div>
  )
}

/** Every page of the site, behind one button. Closes when you pick one, tap outside, or press Escape. */
function SiteMenu() {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="menu-wrap" ref={wrap}>
      <button className="bell menu-btn" aria-label="Menu" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
        {open ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
      </button>
      {open && (
        <nav id="site-menu" className="card menu-pop">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}>
              <n.Icon size={19} strokeWidth={1.9} aria-hidden="true" />{n.label}
            </NavLink>
          ))}
        </nav>
      )}
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
        <h2 className="display">Welcome home</h2>
        <p className="muted">What should the family call you? Pick a badge too, or upload a photo.</p>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Your name" />
        <AvatarPicker badge={badge} onPick={setBadge} />
        {err && <p className="error">{err}</p>}
        <button className="btn gold">Let's go</button>
      </form>
    </div>
  )
}
