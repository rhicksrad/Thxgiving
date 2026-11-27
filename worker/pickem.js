// Pick'em against the spread: every family member picks each Purdue football, Purdue men's basketball, Bears,
// Colts and Chiefs game. The Worker, not the browser, reads ESPN for the games, the lines and the finals, so
// nobody can hand it a friendlier line. A pick keeps the line it was made against; picks lock at kickoff;
// everyone else's picks stay hidden until then.
//
// ESPN (public, no key):
//   team schedule  /apis/site/v2/sports/<sport>/teams/<id>/schedule   games, kickoff, status and final scores
//   game summary   /apis/site/v2/sports/<sport>/summary?event=<id>    pickcenter[0].spread: the line, always from
//                  the home team's side (CHI -3 at home → -3; Purdue +4.5 at home → +4.5). NFL lines are up a week
//                  or more ahead; college lines often only a day or two before. The summary keeps the closing line.
import { fail, json } from './http.js'

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports'
export const PICKEM_TEAMS = {
  fb: { sport: 'football/college-football', id: '2509' },
  bb: { sport: 'basketball/mens-college-basketball', id: '2509' },
  bears: { sport: 'football/nfl', id: '3' },
  colts: { sport: 'football/nfl', id: '11' },
  chiefs: { sport: 'football/nfl', id: '12' },
}
const SCHEDULE_EVERY_MS = 30 * 60_000 // schedules and finals
const LINE_EVERY_MS = 20 * 60_000     // lines, for games coming up
const LINE_WINDOW_MS = 10 * 86400_000 // only ask for lines this close to the game

const now = () => new Date().toISOString()

async function espn(path) {
  const res = await fetch(`${ESPN}/${path}`, { cf: { cacheTtl: 300 }, headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`ESPN ${res.status}`)
  return res.json()
}

const nameOf = (c) => c?.team?.shortDisplayName || c?.team?.displayName || c?.team?.name || 'TBD'
const scoreOf = (c) => {
  const s = c?.score
  const v = typeof s === 'object' && s !== null ? s.value ?? s.displayValue : s
  const n = Number(v)
  return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : n
}

/** One schedule event as a row (no line: that comes from the summary). */
function gameRow(team, e) {
  const comp = e.competitions?.[0] ?? {}
  const home = comp.competitors?.find((c) => c.homeAway === 'home')
  const away = comp.competitors?.find((c) => c.homeAway === 'away')
  const type = comp.status?.type ?? e.status?.type ?? {}
  const status = type.completed ? 'final' : type.state === 'in' ? 'in' : type.name === 'STATUS_POSTPONED' || type.name === 'STATUS_CANCELED' ? 'off' : 'pre'
  return {
    id: String(e.id), team, starts_at: new Date(e.date).toISOString(),
    home: nameOf(home), away: nameOf(away),
    home_abbr: home?.team?.abbreviation ?? null, away_abbr: away?.team?.abbreviation ?? null,
    status, home_score: status === 'final' ? scoreOf(home) : null, away_score: status === 'final' ? scoreOf(away) : null,
  }
}

/** Brings the games, lines and finals up to date, at most every so often. Safe to call on every request. */
export async function syncPickem(env) {
  const DB = env.DB
  const meta = await DB.prepare("select value from pickem_meta where key = 'schedules_at'").first()
  const stale = !meta || Date.now() - Date.parse(meta.value) > SCHEDULE_EVERY_MS
  if (stale) {
    await DB.prepare("insert into pickem_meta (key, value) values ('schedules_at', ?) on conflict (key) do update set value = excluded.value").bind(now()).run()
    for (const [team, t] of Object.entries(PICKEM_TEAMS)) {
      for (const seasontype of [2, 3]) {
        let data
        try { data = await espn(`${t.sport}/teams/${t.id}/schedule?seasontype=${seasontype}`) } catch { continue }
        const rows = (data.events ?? []).map((e) => gameRow(team, e))
        if (!rows.length) continue
        await DB.batch(rows.map((r) => DB.prepare(`insert into pickem_games
            (id, team, starts_at, home, away, home_abbr, away_abbr, status, home_score, away_score, checked_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict (id) do update set starts_at = excluded.starts_at, home = excluded.home, away = excluded.away,
            home_abbr = excluded.home_abbr, away_abbr = excluded.away_abbr, status = excluded.status,
            home_score = coalesce(excluded.home_score, pickem_games.home_score),
            away_score = coalesce(excluded.away_score, pickem_games.away_score), checked_at = excluded.checked_at`)
          .bind(r.id, r.team, r.starts_at, r.home, r.away, r.home_abbr, r.away_abbr, r.status, r.home_score, r.away_score, now())))
      }
    }
  }
  // Lines for what's coming up (and the closing line for anything that started without one on file).
  const soon = new Date(Date.now() + LINE_WINDOW_MS).toISOString()
  const since = new Date(Date.now() - LINE_EVERY_MS).toISOString()
  const need = (await DB.prepare(`select id, team from pickem_games
      where starts_at <= ? and status <> 'off' and (line_checked_at is null or line_checked_at < ?)
        and (status = 'pre' or home_line is null) and starts_at > ?
      order by starts_at limit 12`)
    .bind(soon, since, new Date(Date.now() - 3 * 86400_000).toISOString()).all()).results
  for (const g of need) {
    let line = null
    try {
      const s = await espn(`${PICKEM_TEAMS[g.team].sport}/summary?event=${g.id}`)
      const pc = (s.pickcenter ?? []).find((p) => typeof p.spread === 'number') ?? null
      line = pc ? pc.spread : null
    } catch { continue }
    // Once a game has started its line no longer moves here: picks already carry their own.
    await DB.prepare(`update pickem_games set line_checked_at = ?,
        home_line = case when status = 'pre' or home_line is null then coalesce(?, home_line) else home_line end,
        line_at = case when ? is not null and (status = 'pre' or home_line is null) then ? else line_at end
      where id = ?`).bind(now(), line, line, now(), g.id).run()
  }
}

/** Did the home side cover a frozen home line? 1 = home, -1 = away, 0 = push. */
export function cover(homeScore, awayScore, homeLine) {
  const m = homeScore - awayScore + homeLine
  return m > 0 ? 1 : m < 0 ? -1 : 0
}

/** The season a game belongs to: football and basketball both run August through July. */
const seasonOf = (iso) => { const d = new Date(iso); return d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1 }

/** Everything the page needs: this stretch's games, your picks, others' picks once locked, and the standings. */
async function board(env, uid, url) {
  const DB = env.DB
  const season = Number(url.searchParams.get('season')) || seasonOf(now())
  const from = new Date(Date.UTC(season, 7, 1)).toISOString(), to = new Date(Date.UTC(season + 1, 7, 1)).toISOString()
  const games = (await DB.prepare(`select * from pickem_games where starts_at >= ? and starts_at < ? and status <> 'off' order by starts_at`)
    .bind(from, to).all()).results
  const ids = games.map((g) => g.id)
  const picks = ids.length
    ? (await DB.prepare(`select p.* from pickem_picks p join pickem_games g on g.id = p.game_id
        where g.starts_at >= ? and g.starts_at < ?`).bind(from, to).all()).results
    : []
  const t = now()
  const out = games.map((g) => {
    const locked = g.starts_at <= t || g.status !== 'pre'
    const mine = picks.find((p) => p.game_id === g.id && p.user_id === uid) ?? null
    const all = picks.filter((p) => p.game_id === g.id)
    const graded = (p) => (g.status === 'final' && g.home_score != null && g.away_score != null
      ? (() => { const c = cover(g.home_score, g.away_score, p.line); return c === 0 ? 'push' : (c === 1) === (p.side === 'home') ? 'win' : 'loss' })()
      : null)
    return {
      ...g, locked,
      mine: mine && { side: mine.side, line: mine.line, picked_at: mine.picked_at, result: graded(mine) },
      count: all.length,
      // Everyone else's picks only once nobody can change theirs.
      picks: locked ? all.map((p) => ({ user_id: p.user_id, side: p.side, line: p.line, result: graded(p) })) : [],
    }
  })
  // Standings: wins, losses and pushes on finished games, from each pick's own line.
  const table = {}
  for (const g of out) for (const p of (g.locked ? g.picks : [])) {
    if (!p.result) continue
    const r = (table[p.user_id] ??= { user_id: p.user_id, win: 0, loss: 0, push: 0 })
    r[p.result]++
  }
  const standings = Object.values(table).sort((a, b) =>
    (b.win + b.push / 2) / Math.max(1, b.win + b.loss + b.push) - (a.win + a.push / 2) / Math.max(1, a.win + a.loss + a.push) ||
    b.win - a.win || a.loss - b.loss)
  return { season, now: t, games: out, standings }
}

async function pick(req, env, uid, gameId) {
  let side
  try { side = (await req.json())?.side } catch { fail('Bad request') }
  const DB = env.DB
  const g = await DB.prepare('select * from pickem_games where id = ?').bind(gameId).first()
  if (!g) fail('That game is gone', 404)
  if (g.starts_at <= now() || g.status !== 'pre') fail('Picks for that game are locked', 409)
  if (side === null) {
    await DB.prepare('delete from pickem_picks where game_id = ? and user_id = ?').bind(gameId, uid).run()
    return json({ ok: true })
  }
  if (side !== 'home' && side !== 'away') fail('Pick a side')
  if (g.home_line == null) fail('The line isn\'t posted yet', 409)
  // The line as it stands right now is the one this pick is graded against.
  await DB.prepare(`insert into pickem_picks (game_id, user_id, side, line, picked_at) values (?, ?, ?, ?, ?)
    on conflict (game_id, user_id) do update set side = excluded.side, line = excluded.line, picked_at = excluded.picked_at`)
    .bind(gameId, uid, side, g.home_line, now()).run()
  return json({ side, line: g.home_line })
}

/** Routes under /pickem (already signed in and on the family list). */
export async function routePickem(req, env, ctx, uid, parts, url) {
  const m = req.method
  if (m === 'GET' && parts.length === 1) {
    // Bring things up to date. The first visit waits for it; after that it runs in the background.
    const any = await env.DB.prepare('select 1 from pickem_games limit 1').first()
    if (any) ctx.waitUntil(syncPickem(env).catch((e) => console.error('pickem sync', e)))
    else await syncPickem(env).catch((e) => console.error('pickem sync', e))
    return json(await board(env, uid, url))
  }
  if (m === 'PUT' && parts.length === 3 && parts[2] === 'pick') return pick(req, env, uid, parts[1])
  fail('Not found', 404)
}
