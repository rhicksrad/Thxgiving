import { useEffect, useState } from 'react'
import { KeyRound, LogOut, UserMinus, UserPlus } from 'lucide-react'
import { api, seg } from '../lib/api'
import { cleanPhone, formatPhone } from '../lib/phone'
import { useAuth } from '../auth'
import { Avatar, badgeFor, DEFAULT_BADGE } from '../components/Avatar'
import AvatarPicker from '../components/AvatarPicker'
import { InstallButton } from '../components/Install'
import { useInstall } from '../lib/install'

type Member = { phone: string; name: string | null; created_at: string }

// Where the site lives, for the "text them the link" note.
const SITE = 'https://rhicksrad.github.io/Thxgiving/'

export default function Family() {
  const { me, profiles, saveProfile, signOut } = useAuth()
  const { mode: installMode } = useInstall()
  const [name, setName] = useState(me?.display_name ?? '')
  const [badge, setBadge] = useState(badgeFor(me?.emoji)?.key ?? DEFAULT_BADGE)
  const [saved, setSaved] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteName, setInviteName] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [pwNote, setPwNote] = useState<string | null>(null)

  // Fill the form once the profile loads; don't overwrite edits when a photo upload refreshes it.
  const myId = me?.id
  useEffect(() => {
    if (me) { setName(me.display_name); setBadge(badgeFor(me.emoji)?.key ?? DEFAULT_BADGE) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId])

  const loadMembers = () =>
    api.get<Member[]>('/members').then(({ data }) => { if (data) setMembers(data) })
  useEffect(() => { loadMembers() }, [])

  const addMember = async () => {
    const phone = cleanPhone(invitePhone)
    const who = inviteName.trim().slice(0, 40)
    setErr(null); setNote(null)
    if (!phone) { setErr("That doesn't look like a phone number. Include the area code."); return false }
    const { error } = await api.post('/members', { phone, name: who || null })
    if (error) { setErr(error.message); return false }
    setNote(`${who || formatPhone(phone)} is in. Text them ${SITE} and they'll pick a password the first time they sign in.`)
    loadMembers()
    return true
  }

  const resetPassword = async (m: Member) => {
    const label = m.name ?? formatPhone(m.phone)
    if (!confirm(`Reset the password for ${label}? They'll pick a new one next time they sign in.`)) return
    setErr(null); setNote(null)
    const { error } = await api.post(`/members/${seg(m.phone)}/reset`)
    if (error) setErr(error.message)
    else setNote(`Done. ${label} can sign in and pick a new password.`)
  }

  const byPhone = Object.fromEntries(Object.values(profiles).map((p) => [p.phone, p]))
  const myPhone = cleanPhone(me?.phone ?? '')

  return (
    <div className="stack-lg">
      <section className="card stack">
        <h1 className="display">Your profile</h1>
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault()
          const r = await saveProfile({ display_name: name.trim().slice(0, 30) || 'Family', emoji: badge })
          setSaved(r ?? 'Saved.')
        }}>
          <label className="field">
            <span className="label">Name</span>
            <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
          </label>
          <AvatarPicker badge={badge} onPick={(k) => { setBadge(k); setSaved(null) }} />
          <div className="row">
            <button className="btn gold">Save</button>
            {saved && <span className="muted small">{saved}</span>}
          </div>
        </form>
      </section>

      <section className="card stack">
        <h2 className="display">The family</h2>
        <p className="muted small">
          Add someone's name and cell number, then text them the link. They sign in with that number and pick a password
          the first time. No texts are sent by the site. If someone forgets their password, reset it here and they'll
          choose a new one.
        </p>
        <form className="invite-row" onSubmit={async (e) => {
          e.preventDefault()
          if (await addMember()) { setInviteName(''); setInvitePhone('') }
        }}>
          <input className="input" placeholder="Name (Aunt Linda)" maxLength={40} value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          <input className="input" type="tel" inputMode="tel" required placeholder="(317) 555-0123" value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)} />
          <button className="btn gold"><UserPlus size={16} aria-hidden="true" />Add</button>
        </form>
        {note && <p className="muted small">{note}</p>}
        {err && <p className="error">{err}</p>}
        <ul className="family-list">
          {members.map((m) => {
            const p = byPhone[m.phone]
            const label = m.name ?? formatPhone(m.phone)
            return (
              <li key={m.phone}>
                <Avatar p={p} size={36} />
                <div className="grow">
                  <div className="family-name">{p?.display_name ?? <>{m.name ?? ''} <span className="muted small">hasn't signed in yet</span></>}</div>
                  <div className="muted small">{formatPhone(m.phone)}</div>
                </div>
                <div className="family-actions">
                  {p && m.phone !== myPhone && (
                    <button className="btn ghost sm" title="Reset password" aria-label={`Reset password for ${label}`}
                      onClick={() => resetPassword(m)}>
                      <KeyRound size={14} aria-hidden="true" /><span className="btn-label">Reset</span>
                    </button>
                  )}
                  {m.phone !== myPhone && (
                    <button className="btn ghost sm danger" title="Remove from the family list" aria-label={`Remove ${label}`} onClick={async () => {
                      if (!confirm(`Take ${label} off the family list? They'll lose access.`)) return
                      setErr(null); setNote(null)
                      const { error } = await api.del(`/members/${seg(m.phone)}`)
                      if (error) setErr(error.message)
                      loadMembers()
                    }}>
                      <UserMinus size={14} aria-hidden="true" /><span className="btn-label">Remove</span>
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card stack">
        <h2 className="display">Your password</h2>
        <form className="row" onSubmit={async (e) => {
          e.preventDefault()
          if (newPw.length < 6) return setPwNote('At least 6 characters.')
          const { error } = await api.post('/me/password', { password: newPw })
          setPwNote(error ? error.message : 'Password changed.')
          if (!error) setNewPw('')
        }}>
          <input type="tel" autoComplete="username" value={formatPhone(myPhone)} readOnly hidden />
          <input className="input" type="password" autoComplete="new-password" minLength={6} placeholder="New password"
            value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <button className="btn ghost" disabled={!newPw}>Change</button>
        </form>
        {pwNote && <p className="muted small">{pwNote}</p>}
      </section>

      {installMode && (
        <section className="card stack">
          <h2 className="display">Get the app</h2>
          <p className="muted small">Put it on your home screen so it opens full screen, like any other app.</p>
          <InstallButton className="btn gold" />
        </section>
      )}

      <button className="btn ghost" onClick={signOut}><LogOut size={16} aria-hidden="true" />Sign out</button>
    </div>
  )
}
