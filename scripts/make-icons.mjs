// Draws the app icons in public/icons/ from the turkey in src/components/Logo.tsx.
// Run after changing the logo: node scripts/make-icons.mjs (uses the Playwright Chromium that's installed).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Playwright is installed globally here, not in this project, so load it the CommonJS way (which honors NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright')

const src = readFileSync(new URL('../src/components/Logo.tsx', import.meta.url), 'utf8')
const feathers = JSON.parse(src.match(/const FEATHERS = (\[.*?\])/)[1].replace(/'/g, '"'))
const body = src.match(/\)\)\}\n([\s\S]*?)\n\s*<\/g>/)[1]
  .replace(/strokeWidth/g, 'stroke-width').replace(/strokeLinecap/g, 'stroke-linecap')
const tail = feathers.map((c, i) =>
  `<ellipse cx="32" cy="16" rx="6.2" ry="15" fill="${c}" transform="rotate(${(i - 4) * 21} 32 38)"/>`).join('')
const mark = `<g>${tail}${body}</g>`

const BG = '#1a120c'
// pad: how much of the icon the turkey fills (maskable icons get cropped to a circle, so they need more room).
const icons = [
  { file: 'favicon-32.png', size: 32, bg: false, fill: 1 },
  { file: 'favicon-48.png', size: 48, bg: false, fill: 1 },
  { file: 'icon-192.png', size: 192, bg: true, fill: 0.84 },
  { file: 'icon-512.png', size: 512, bg: true, fill: 0.84 },
  { file: 'icon-maskable-512.png', size: 512, bg: true, fill: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, bg: true, fill: 0.8 },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const icon of icons) {
  const s = icon.size, m = s * icon.fill, off = (s - m) / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    ${icon.bg ? `<rect width="${s}" height="${s}" fill="${BG}"/>` : ''}
    <g transform="translate(${off} ${off}) scale(${m / 64})">${mark}</g></svg>`
  await page.setViewportSize({ width: s, height: s })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
  await page.locator('svg').screenshot({ path: new URL(`../public/icons/${icon.file}`, import.meta.url).pathname, omitBackground: !icon.bg })
  console.log('wrote', icon.file)
}
await browser.close()
