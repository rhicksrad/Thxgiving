import { lazy, Suspense, type ComponentType } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from './auth'
import { isConfigured } from './lib/api'
import Layout from './components/Layout'
import Logo from './components/Logo'
import Home from './pages/Home'
import GatheringPage from './pages/GatheringPage'
import { formatPhone } from './lib/phone'

// Home (and the board it shows) is where nearly everyone lands, so it ships in the main bundle; the rest load when first opened.
// If the app was left open across a deploy, the old page's files are gone from the server: reload once
// to pick up the new version instead of showing a blank screen.
const RELOADED_KEY = 'tg:reloaded-for-update'
const page = (load: () => Promise<{ default: ComponentType }>) => lazy(async () => {
  try {
    const m = await load()
    try { sessionStorage.removeItem(RELOADED_KEY) } catch { /* private mode */ }
    return m
  } catch (err) {
    let reloaded = true // if we can't remember, don't risk a reload loop
    try { reloaded = sessionStorage.getItem(RELOADED_KEY) === '1'; sessionStorage.setItem(RELOADED_KEY, '1') } catch { /* private mode */ }
    if (reloaded) throw err
    window.location.reload()
    return new Promise<never>(() => {}) // keep showing the loading state until the reload lands
  }
})
const Login = page(() => import('./pages/Login'))
const FamilyChat = page(() => import('./pages/FamilyChat'))
const Gallery = page(() => import('./pages/Gallery'))
const Family = page(() => import('./pages/Family'))

export default function App() {
  if (!isConfigured) return <SetupNeeded />
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  )
}

function Gate() {
  const { signedIn, loading, member, me } = useAuth()
  if (loading || (signedIn && member === null)) return <Splash />
  if (!signedIn) return <Suspense fallback={<Splash />}><Login /></Suspense>
  if (!member) return <NotOnList phone={me?.phone ?? ''} />
  return (
    <Layout>
      <Suspense fallback={<div className="loading">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/g/:id" element={<GatheringPage />} />
          <Route path="/chat" element={<FamilyChat />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/family" element={<Family />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

function Splash() {
  return (
    <div className="center-screen">
      <Logo size={72} className="pulse" />
    </div>
  )
}

function NotOnList({ phone }: { phone: string }) {
  const { refreshMember, signOut } = useAuth()
  return (
    <div className="center-screen">
      <div className="card narrow stack">
        <Logo size={56} />
        <h1 className="display">Not on the list</h1>
        <p>
          <b>{formatPhone(phone)}</b> isn't on the family list yet. Ask anyone in the family to add you from the{' '}
          <b>Family</b> page, then hit the button below.
        </p>
        <div className="row">
          <button className="btn gold" onClick={refreshMember}>I've been added</button>
          <button className="btn ghost" onClick={signOut}>Use a different number</button>
        </div>
      </div>
    </div>
  )
}

function SetupNeeded() {
  return (
    <div className="center-screen">
      <div className="card narrow stack">
        <Logo size={56} />
        <h1 className="display">Almost there</h1>
        <p>
          The site isn't connected to its server yet. Put the Worker's address in <code>apiUrl</code> in{' '}
          <code>public/config.js</code> and redeploy. The README walks through it.
        </p>
      </div>
    </div>
  )
}
