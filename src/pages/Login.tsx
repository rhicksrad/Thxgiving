import { useState } from 'react'
import { api } from '../lib/api'
import { cleanPhone, formatPhone } from '../lib/phone'
import type { Profile } from '../lib/types'
import { useAuth } from '../auth'
import Logo from '../components/Logo'

// What phone_status() says about a number.
type Status = 'not_member' | 'new' | 'set_password' | 'password'
type Step = 'phone' | 'password' | 'create'
type Session = { token: string; user: Profile }

export default function Login() {
  const { signIn: startSession } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState<Step>('phone')
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const digits = cleanPhone(phone)
  const shown = formatPhone(digits)

  const checkPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!digits) return setErr('That doesn\'t look like a phone number. Include the area code, like (317) 555-0123.')
    setBusy(true); setErr(null)
    const { data, error } = await api.post<{ status: Status }>('/auth/status', { phone: digits })
    setBusy(false)
    if (error || !data) return setErr(error?.message ?? 'Something went wrong')
    const s = data.status
    setStatus(s)
    if (s === 'not_member') return setErr(`${shown} isn't on the family list. Check for a typo, or ask anyone in the family to add you on the Family page.`)
    setPassword(''); setConfirm('')
    setStep(s === 'password' ? 'password' : 'create')
  }

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { data, error } = await api.post<Session>('/auth/login', { phone: digits, password })
    setBusy(false)
    if (data) return startSession(data.token, data.user)
    setErr(error?.status === 401
      ? 'Wrong password. Forgot it? Anyone in the family can hit Reset next to your name on the Family page.'
      : error?.message ?? 'Something went wrong')
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return setErr('Password needs at least 6 characters.')
    if (password !== confirm) return setErr("Passwords don't match.")
    setBusy(true); setErr(null)
    const { data, error } = await api.post<Session>('/auth/signup', { phone: digits, password })
    setBusy(false)
    if (data) return startSession(data.token, data.user)
    setErr(error?.message ?? 'Something went wrong')
  }

  const back = () => { setStep('phone'); setErr(null); setPassword(''); setConfirm('') }

  return (
    <div className="login">
      <div className="login-hero">
        <Logo size={96} />
        <h1 className="display huge">Thanksgiving<br />2026</h1>
        <p className="tagline">Gather 'round. Who's coming, who's bringing what, and all the pictures.</p>
      </div>
      <div className="card narrow login-card">
        {step === 'phone' && (
          <form className="stack" onSubmit={checkPhone}>
            <label className="label" htmlFor="phone">Sign in with your cell number</label>
            <input id="phone" className="input big-input" type="tel" inputMode="tel" required autoComplete="tel" placeholder="(317) 555-0123"
              value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
            <button className="btn gold" disabled={busy || !phone.trim()}>{busy ? 'Checking…' : 'Continue'}</button>
          </form>
        )}

        {step === 'password' && (
          <form className="stack" onSubmit={signIn}>
            <label className="label" htmlFor="password">Welcome back</label>
            <p className="muted small">{shown}</p>
            {/* Hidden username keeps password managers happy. */}
            <input type="tel" autoComplete="username" value={shown} readOnly hidden />
            <input id="password" className="input big-input" type="password" required autoComplete="current-password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <button className="btn gold" disabled={busy || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className="btn ghost" onClick={back}>Different number</button>
          </form>
        )}

        {step === 'create' && (
          <form className="stack" onSubmit={create}>
            <label className="label" htmlFor="new-password">{status === 'new' ? "You're on the list! Pick a password" : 'Pick a new password'}</label>
            <p className="muted small">
              {shown} · {status === 'new' ? 'first time here' : 'no password set yet'}. At least 6 characters.
            </p>
            <input type="tel" autoComplete="username" value={shown} readOnly hidden />
            <input id="new-password" className="input big-input" type="password" required minLength={6} autoComplete="new-password"
              placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <input className="input big-input" type="password" required minLength={6} autoComplete="new-password"
              placeholder="Same password again" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button className="btn gold" disabled={busy || !password || !confirm}>{busy ? 'Setting up…' : "Let's eat"}</button>
            <button type="button" className="btn ghost" onClick={back}>Different number</button>
          </form>
        )}

        {err && <p className="error">{err}</p>}
      </div>
      <p className="login-foot">Family only. No texts are sent. Not on the list? Ask anyone in the family to add you.</p>
    </div>
  )
}
