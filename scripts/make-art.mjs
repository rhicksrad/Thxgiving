// Makes the seasonal art: generates each picture in art/prompts.mjs with Codex (scripts/codex-image.mjs), a few
// at a time, into art-src/ (full-size PNGs, git-ignored). Pictures already there are skipped, so delete one to
// redo it. Then run: python scripts/art-webp.py   (shrinks them into public/art/*.webp)
//   node scripts/make-art.mjs [name ...]    e.g. node scripts/make-art.mjs bg-july hero-july
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { JOBS } from '../art/prompts.mjs'

const SRC = 'art-src'
const PARALLEL = Number(process.env.ART_PARALLEL ?? 3)
mkdirSync(join(SRC, 'prompts'), { recursive: true })

const only = process.argv.slice(2)
const todo = JOBS.filter((j) => (only.length ? only.includes(j.name) : !existsSync(join(SRC, `${j.name}.png`))))
console.log(`${todo.length} to make, ${PARALLEL} at a time`)

const run = (job) => new Promise((done) => {
  const promptFile = join(SRC, 'prompts', `${job.name}.txt`)
  writeFileSync(promptFile, job.prompt)
  const p = spawn(process.execPath, ['scripts/codex-image.mjs', join(SRC, `${job.name}.png`), promptFile], { stdio: ['ignore', 'pipe', 'ignore'] })
  let out = ''
  p.stdout.on('data', (d) => { out += d })
  p.on('exit', (code) => { console.log(`${code === 0 ? 'ok  ' : 'FAIL'} ${job.name} ${code === 0 ? '' : out.trim()}`); done() })
})

const queue = [...todo]
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (queue.length) await run(queue.shift())
}))
