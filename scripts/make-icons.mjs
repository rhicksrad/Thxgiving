// Draws the app icons in public/icons/ from the house in src/lib/marks.ts (the icons stay the same all year;
// the monthly emblems only show inside the site). Run after changing it: node scripts/make-icons.mjs
// (needs Node 22.18+ to load the .ts file, and the Playwright Chromium that's installed).
import { createRequire } from 'node:module'
import { HOME_MARK } from '../src/lib/marks.ts'

// Playwright is installed globally here, not in this project, so load it the CommonJS way (which honors NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright')

const mark = `<g>${HOME_MARK}</g>`
const BG = '#1a120c'
// fill: how much of the icon the mark fills (maskable icons get cropped to a circle, so they need more room).
const icons = [
  { file: 'favicon-32.png', size: 32, bg: false, fill: 1 },
  { file: 'favicon-48.png', size: 48, bg: false, fill: 1 },
  { file: 'icon-192.png', size: 192, bg: true, fill: 0.78 },
  { file: 'icon-512.png', size: 512, bg: true, fill: 0.78 },
  { file: 'icon-maskable-512.png', size: 512, bg: true, fill: 0.6 },
  { file: 'apple-touch-icon.png', size: 180, bg: true, fill: 0.74 },
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
