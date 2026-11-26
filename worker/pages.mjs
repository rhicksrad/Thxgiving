// Everyone's private page ("Mine" on the site), for whoever updates the site. Run from worker/:
//
//   npm run pages                 who asked for what, and whose page needs making or changing
//   npm run pages -- pull         copy everyone's request (and their current page) into ../private-pages/<name>/
//   npm run pages -- push <name>  put ../private-pages/<name>/page.html live as that person's page
//
// ../private-pages/ is git-ignored on purpose: these pages are private, and the repo is not.
// page.html is the inside of <body>: plain HTML with any <style> and <script> it needs. It runs in a sandboxed frame
// on the site, with the month's colors as CSS variables (var(--bg), var(--text), var(--gold), var(--card)…) and:
//   page.name          the person's name
//   page.data          what the page saved last time (null at first)
//   page.save(value)   keep any JSON-able value for next time, up to 100 KB
// It can't reach the rest of the site, the person's sign-in, or anyone else's data. Keep it under 90 KB.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DIR = join(here, '..', 'private-pages')
const MAX_PAGE = 90000
const WHERE = process.argv.includes('--local') ? '--local' : '--remote' // --local: the wrangler dev database

function wrangler(args) {
  const bin = join(here, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  if (!existsSync(bin)) throw new Error('Run npm install in worker/ first')
  return execFileSync(process.execPath, [bin, 'd1', 'execute', 'thxgiving', WHERE, ...args],
    { cwd: here, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] })
}

function query(sql) {
  const out = wrangler(['--json', '--command', sql.replace(/\s+/g, ' ')])
  return JSON.parse(out.slice(out.indexOf('[')))[0].results
}

const people = () => query(`select u.id, u.display_name, p.wish, p.wish_at, p.page, p.page_at,
  length(p.data) as data_size from users u left join private_pages p on p.user_id = u.id order by u.created_at`)

const slug = (p) => `${p.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'family'}-${p.id.slice(0, 6)}`

function state(p) {
  if (!p.wish && !p.page) return 'blank'
  if (p.wish && (!p.page_at || p.wish_at > p.page_at)) return p.page ? 'CHANGE ASKED' : 'NEW'
  return 'up to date'
}

const [cmd = 'list', arg] = process.argv.slice(2).filter((a) => a !== '--local')

if (cmd === 'list') {
  for (const p of people()) {
    console.log(`\n${p.display_name}  [${slug(p)}]  ${state(p)}`)
    if (p.wish) console.log(`  asked (${p.wish_at}):\n    ${p.wish.replace(/\n/g, '\n    ')}`)
    if (p.page) console.log(`  page made ${p.page_at}, ${p.page.length} chars; page data ${p.data_size ?? 0} bytes`)
  }
} else if (cmd === 'pull') {
  for (const p of people()) {
    const dir = join(DIR, slug(p))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'user.json'), JSON.stringify({ id: p.id, name: p.display_name }, null, 2))
    writeFileSync(join(dir, 'wish.md'), `# ${p.display_name}: ${state(p)}\nAsked ${p.wish_at ?? 'never'}\n\n${p.wish ?? ''}\n`)
    if (p.page) writeFileSync(join(dir, 'live.html'), p.page) // what's up now; edit page.html, not this
    if (p.page && !existsSync(join(dir, 'page.html'))) writeFileSync(join(dir, 'page.html'), p.page)
    console.log(`${slug(p).padEnd(30)} ${state(p)}`)
  }
  console.log(`\nIn ${DIR}`)
} else if (cmd === 'push') {
  const name = arg
  if (!name) throw new Error(`Which one? ${existsSync(DIR) ? readdirSync(DIR).join(', ') : 'Run pull first.'}`)
  const dir = join(DIR, name)
  const { id, name: who } = JSON.parse(readFileSync(join(dir, 'user.json'), 'utf8'))
  const html = readFileSync(join(dir, 'page.html'), 'utf8').replace(/^﻿/, '') // Windows editors may add a BOM
  if (html.length > MAX_PAGE) throw new Error(`page.html is ${html.length} chars; the limit is ${MAX_PAGE}`)
  const q = (s) => `'${s.replace(/'/g, "''")}'`
  const at = new Date().toISOString()
  const tmp = mkdtempSync(join(tmpdir(), 'pages-'))
  try {
    const file = join(tmp, 'push.sql')
    writeFileSync(file, `insert into private_pages (user_id, page, page_at) values (${q(id)}, ${q(html)}, ${q(at)})
on conflict (user_id) do update set page = excluded.page, page_at = excluded.page_at;\n`)
    wrangler(['--file', file, '--yes'])
  } finally { rmSync(tmp, { recursive: true, force: true }) }
  console.log(`${who}'s page is live (${html.length} chars).`)
} else {
  throw new Error('npm run pages [-- pull | -- push <name>]')
}
