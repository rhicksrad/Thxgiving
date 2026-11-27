// Generate one image with Codex's built-in image_gen tool (the same way Ryan's other art pipelines do).
//   node scripts/codex-image.mjs <out.png> <prompt-file.txt>
// The prompt goes in through stdin, so quotes and ampersands in it are safe. The job is done once out.png is
// saved and stops growing: codex can sit for minutes after that, so it's stopped then.
import { spawn, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const [out, promptFile] = process.argv.slice(2)
if (!out || !promptFile) { console.error('usage: node scripts/codex-image.mjs <out.png> <prompt-file.txt>'); process.exit(64) }
const request = readFileSync(promptFile, 'utf8').trim()
const work = mkdtempSync(join(tmpdir(), 'codex-image-'))
const ask = 'Use your built-in image_gen tool (imagegen skill) to generate exactly ONE image for this request, ' +
  'then copy the generated PNG into the current directory as out.png. Do nothing else. REQUEST: ' + request

const codex = process.platform === 'win32' ? join(process.env.APPDATA, 'npm', 'codex.cmd') : 'codex'
const child = spawn(codex, ['exec', '--skip-git-repo-check', '-C', work, '-c', 'model_reasoning_effort="low"', '-'],
  { cwd: work, shell: process.platform === 'win32', stdio: ['pipe', 'ignore', 'ignore'] })
child.stdin.end(ask)

const png = join(work, 'out.png')
const deadline = Date.now() + 15 * 60_000
let last = -1, exited = false
child.on('exit', () => { exited = true })
while (!exited && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 3000))
  const size = existsSync(png) ? statSync(png).size : -1
  if (size > 0 && size === last) break
  last = size
}
if (!exited) {
  try { execSync(process.platform === 'win32' ? `taskkill /PID ${child.pid} /T /F` : `kill -9 ${child.pid}`, { stdio: 'ignore' }) } catch {}
}
if (existsSync(png)) {
  mkdirSync(dirname(resolve(out)), { recursive: true })
  copyFileSync(png, out)
  console.log(`CODEX IMAGE OK ${out}`)
} else {
  console.log(`CODEX IMAGE FAIL (work dir ${work})`)
  process.exit(1)
}
