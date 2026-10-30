import { useEffect, useState } from 'react'

// Chrome/Edge/Android fire `beforeinstallprompt` once, often before React has mounted, so it's caught here at
// import time (main.tsx imports this first) and handed to whichever button asks. Safari never fires it.
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((f) => f())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // we show our own button instead of the browser's mini-bar
  deferred = e as InstallPromptEvent
  notify()
})
window.addEventListener('appinstalled', () => { deferred = null; notify() })

export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

// iPhone/iPad (iPadOS reports itself as a Mac, so check for touch too).
const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * How this device can install the app:
 * - 'prompt': one tap, the browser's own install dialog (Android Chrome, desktop Chrome/Edge)
 * - 'ios': Apple has no install API, so we show the Share → Add to Home Screen steps
 * - null: already installed, or a browser that can't install it
 */
export type InstallMode = 'prompt' | 'ios' | null
const modeNow = (): InstallMode => (isInstalled() ? null : deferred ? 'prompt' : isIOS() ? 'ios' : null)

export function useInstall() {
  const [mode, setMode] = useState<InstallMode>(modeNow)
  useEffect(() => {
    const update = () => setMode(modeNow())
    listeners.add(update)
    update()
    return () => { listeners.delete(update) }
  }, [])
  /** Opens the browser's install dialog. True if they installed. */
  const prompt = async () => {
    if (!deferred) return false
    const e = deferred
    await e.prompt()
    const { outcome } = await e.userChoice
    deferred = null // each event can only be used once
    notify()
    return outcome === 'accepted'
  }
  return { mode, prompt }
}
