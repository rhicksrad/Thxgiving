import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Lock, Minus, Trophy, X } from 'lucide-react'
import { api, seg } from '../lib/api'
import { useAuth } from '../auth'
import { Avatar, nameOf } from '../components/Avatar'
import Spot from '../components/Spot'
import { TEAMS, type Sport } from '../lib/games'
import { TZ } from '../lib/format'

// Pick'em against the spread. The Worker (worker/pickem.js) keeps the games, lines and finals from ESPN; a pick
// keeps the line it was made against, picks lock at kickoff, and everyone else's stay hidden until then.

type Result = 'win' | 'loss' | 'push' | null
type Side = 'home' | 'away'
type PGame = {
  id: string; team: Sport; starts_at: string
  home: string; away: string; home_abbr: string | null; away_abbr: string | null
  home_line: number | null; status: 'pre' | 'in' | 'final'
  home_score: number | null; away_score: number | null
  locked: boolean; count: number
  mine: { side: Side; line: number; result: Result } | null
  picks: { user_id: string; side: Side; line: number; result: Result }[]
}
type Standing = { user_id: string; win: number; loss: number; push: number }
type Board = { season: number; now: string; games: PGame[]; standings: Standing[] }

const fmt = (n: number) => (n === 0 ? 'PK' : n > 0 ? `+${n}` : `${n}`)
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const dayOf = (iso: string) => dayFmt.format(new Date(iso))
const record = (s?: Standing) => (s ? `${s.win}-${s.loss}${s.push ? `-${s.push}` : ''}` : '0-0')
const pct = (s: Standing) => { const n = s.win + s.loss + s.push; return n ? Math.round(((s.win + s.push / 2) / n) * 100) : 0 }

export default function Pickem() {
  const { me, profiles } = useAuth()
  const [board, setBoard] = useState<Board | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'upcoming' | 'results' | 'standings'>('upcoming')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await api.get<Board>('/pickem')
    if (data) { setBoard(data); setErr(null) } else setErr(error?.message ?? 'Could not load the games')
  }, [])
  useEffect(() => { load() }, [load])
  // Lines move and games start: check again every couple of minutes while the page is open.
  useEffect(() => { const t = setInterval(load, 120_000); return () => clearInterval(t) }, [load])

  const choose = async (g: PGame, side: Side | null) => {
    setBusy(g.id); setErr(null)
    const { data, error } = await api.put<{ side: Side; line: number }>(`/pickem/${seg(g.id)}/pick`, { side })
    setBusy(null)
    if (error) { setErr(error.message); load(); return }
    setBoard((b) => b && {
      ...b, games: b.games.map((x) => x.id !== g.id ? x : {
        ...x, mine: data && side ? { side: data.side, line: data.line, result: null } : null,
        count: x.count + (x.mine ? 0 : 1) - (side ? 0 : 1),
      }),
    })
  }

  const { upcoming, results } = useMemo(() => {
    const games = board?.games ?? []
    const soon = Date.now() + 21 * 86400_000
    return {
      upcoming: games.filter((g) => g.status !== 'final' && Date.parse(g.starts_at) < soon),
      results: games.filter((g) => g.status === 'final').reverse(),
    }
  }, [board])
  const mine = board?.standings.find((s) => s.user_id === me?.id)
  const open = upcoming.filter((g) => !g.locked && g.home_line != null && !g.mine).length

  return (
    <div className="stack-lg pickem">
      <header className="page-head with-spot">
        <div>
          <h1 className="display">Pick'em</h1>
          <p className="muted">Pick every Purdue, Bears, Colts and Chiefs game against the spread. Your pick keeps the line you
            picked it at. Picks lock at kickoff, and nobody sees anyone else's until then.</p>
        </div>
        <Spot name="pickem" className="page-spot" />
      </header>

      <div className="pk-summary">
        <span className="chip"><Trophy size={14} aria-hidden="true" />Your record: <b>{record(mine)}</b></span>
        {open > 0 && <span className="chip pk-open">{open} game{open === 1 ? '' : 's'} to pick</span>}
      </div>

      <div className="seg pk-tabs" role="tablist">
        {(['upcoming', 'results', 'standings'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'upcoming' ? 'Upcoming' : t === 'results' ? 'Results' : 'Standings'}
          </button>
        ))}
      </div>

      {err && <p className="error">{err}</p>}
      {!board && !err && <div className="loading">Loading the games…</div>}

      {board && tab === 'upcoming' && (
        upcoming.length ? <GameList games={upcoming} profiles={profiles} busy={busy} onPick={choose} />
          : <div className="card empty"><Spot name="pickem" size={96} />No games in the next three weeks.</div>
      )}
      {board && tab === 'results' && (
        results.length ? <GameList games={results} profiles={profiles} busy={busy} onPick={choose} />
          : <div className="card empty"><Spot name="pickem" size={96} />No finished games yet this season.</div>
      )}
      {board && tab === 'standings' && <Standings rows={board.standings} profiles={profiles} meId={me?.id} />}
    </div>
  )
}

function GameList({ games, profiles, busy, onPick }: {
  games: PGame[]; profiles: ReturnType<typeof useAuth>['profiles']; busy: string | null; onPick: (g: PGame, s: Side | null) => void
}) {
  let last = ''
  return (
    <div className="stack">
      {games.map((g) => {
        const day = dayOf(g.starts_at)
        const head = day !== last ? <h2 className="section-title pk-day">{day}</h2> : null
        last = day
        return <div key={g.id} className="stack">{head}<GameCard g={g} profiles={profiles} busy={busy === g.id} onPick={onPick} /></div>
      })}
    </div>
  )
}

function GameCard({ g, profiles, busy, onPick }: {
  g: PGame; profiles: ReturnType<typeof useAuth>['profiles']; busy: boolean; onPick: (g: PGame, s: Side | null) => void
}) {
  const team = TEAMS[g.team]
  const line = g.mine?.line ?? g.home_line
  const final = g.status === 'final'
  const side = (s: Side) => {
    const abbr = (s === 'home' ? g.home_abbr : g.away_abbr) ?? (s === 'home' ? g.home : g.away)
    const l = line == null ? null : s === 'home' ? line : -line
    const picked = g.mine?.side === s
    const who = g.picks.filter((p) => p.side === s)
    return (
      <button type="button" className={`pk-side ${picked ? 'on' : ''}`} disabled={g.locked || g.home_line == null || busy}
        aria-pressed={picked} onClick={() => onPick(g, picked ? null : s)}>
        <span className="pk-where">{s === 'home' ? 'Home' : 'Away'}</span>
        <span className="pk-team">{abbr}</span>
        <span className="pk-line">{l == null ? '—' : fmt(l)}</span>
        <span className="pk-name">{s === 'home' ? g.home : g.away}</span>
        {final && <span className="pk-score">{s === 'home' ? g.home_score : g.away_score}</span>}
        {picked && <span className="pk-check"><Check size={14} aria-hidden="true" /></span>}
        {g.locked && who.length > 0 && (
          <span className="pk-who" aria-label={`Picked by ${who.map((p) => nameOf(profiles[p.user_id])).join(', ')}`}>
            {who.slice(0, 8).map((p) => <Avatar key={p.user_id} p={profiles[p.user_id]} size={22} />)}
            {who.length > 8 && <span className="muted small">+{who.length - 8}</span>}
          </span>
        )}
      </button>
    )
  }
  const result = g.mine?.result
  return (
    <section className="card pk-game" style={{ ['--team' as string]: team.colors.gold, ['--team-bg' as string]: team.colors.bg }}>
      <div className="pk-top">
        <span className="pk-tag"><i />{team.what}</span>
        <span className="muted small">
          {g.status === 'in' ? 'In progress' : final ? 'Final' : timeFmt.format(new Date(g.starts_at))}
          {g.locked && !final && <><Lock size={12} aria-hidden="true" /> locked</>}
        </span>
      </div>
      <div className="pk-sides">{side('away')}{side('home')}</div>
      <div className="pk-foot small">
        {g.home_line == null && !g.mine ? <span className="muted">Line not posted yet</span>
          : g.mine && g.home_line != null && g.mine.line !== g.home_line && !g.locked
            ? <span className="muted">Your pick keeps {fmt(g.mine.side === 'home' ? g.mine.line : -g.mine.line)}. The line is now {fmt(g.mine.side === 'home' ? g.home_line : -g.home_line)}.</span>
            : !g.locked ? <span className="muted">{g.count} picked so far. Picks show at kickoff.</span>
              : <span className="muted">{g.picks.length} pick{g.picks.length === 1 ? '' : 's'}</span>}
        {result && (
          <span className={`pk-result ${result}`}>
            {result === 'win' ? <Check size={13} aria-hidden="true" /> : result === 'loss' ? <X size={13} aria-hidden="true" /> : <Minus size={13} aria-hidden="true" />}
            {result === 'win' ? 'You covered' : result === 'loss' ? 'Missed it' : 'Push'}
          </span>
        )}
        {!g.mine && g.locked && g.home_line != null && <span className="muted">You didn't pick this one</span>}
      </div>
    </section>
  )
}

function Standings({ rows, profiles, meId }: { rows: Standing[]; profiles: ReturnType<typeof useAuth>['profiles']; meId?: string }) {
  if (!rows.length) return <div className="card empty"><Spot name="pickem" size={96} />No picks graded yet. Standings start after the first game you pick.</div>
  return (
    <section className="card pk-standings">
      <ol>
        {rows.map((r, i) => (
          <li key={r.user_id} className={r.user_id === meId ? 'me' : ''}>
            <span className="pk-rank">{i + 1}</span>
            <Avatar p={profiles[r.user_id]} size={32} />
            <span className="grow pk-who-name">{nameOf(profiles[r.user_id])}</span>
            <span className="pk-rec">{record(r)}</span>
            <span className="pk-pct muted small">{pct(r)}%</span>
          </li>
        ))}
      </ol>
      <p className="muted small">Win = 1, push = half. Every pick is graded against the line it was made at.</p>
    </section>
  )
}
