// iPhone home-screen apps (status bar "black-translucent") can lay the page out shorter than the screen, by
// about the status bar's height, which leaves a blank strip under the tab bar. When that happens, size the app
// to the whole screen instead (--app-h in styles.css). Only in the installed app; Safari tabs are left alone.
export function fitInstalledApp() {
  const installed = matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (!installed) return
  const root = document.documentElement
  const fit = () => {
    const portrait = matchMedia('(orientation: portrait)').matches
    const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    const short = full - window.innerHeight
    // A small shortfall is the bug. A big one is the keyboard (or something else): leave the layout alone.
    if (short > 0 && short <= 80) root.style.setProperty('--app-h', `${full}px`)
    else root.style.removeProperty('--app-h')
  }
  fit()
  window.addEventListener('resize', fit)
  window.addEventListener('orientationchange', () => setTimeout(fit, 300))
}
