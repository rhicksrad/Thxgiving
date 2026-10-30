import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { scroller } from '../lib/scroller'

const TRIGGER = 72 // px of pull (after resistance) that counts as "refresh"
const MAX = 110

// Browsers have their own pull-to-refresh, but it's gone once the site is installed to the home screen.
// Dev builds turn it on for touch devices so it can be tried in a phone-sized preview.
const installed = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
const enabled = () => installed() || (import.meta.env.DEV && navigator.maxTouchPoints > 0)

// Touches that start in these scroll or swipe on their own, so they never pull the page.
const OWN_GESTURES = '.chat-scroll, .temp-strip, .lightbox, .modal-backdrop, .bell-pop, .tag-pop, input, textarea, select'

/** Pull down from the top of the page to reload the app (fresh data, and the newest version if one shipped). */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const start = useRef<{ y: number; x: number } | null>(null)
  const pullRef = useRef(0)

  useEffect(() => {
    if (!enabled()) return
    const set = (v: number) => { pullRef.current = v; setPull(v) }

    const onStart = (e: TouchEvent) => {
      const t = e.target as Element
      if (scroller().scrollTop > 0 || e.touches.length > 1 || t.closest?.(OWN_GESTURES)) { start.current = null; return }
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX }
    }
    const onMove = (e: TouchEvent) => {
      if (!start.current) return
      const dy = e.touches[0].clientY - start.current.y
      const dx = e.touches[0].clientX - start.current.x
      if (scroller().scrollTop > 0 || dy <= 0 || Math.abs(dx) > Math.abs(dy)) { if (pullRef.current) set(0); return }
      set(Math.min(MAX, dy * 0.5)) // resistance: the indicator moves half as far as the finger
    }
    const onEnd = () => {
      if (!start.current) return
      start.current = null
      if (pullRef.current >= TRIGGER) {
        setRefreshing(true)
        set(TRIGGER)
        setTimeout(() => window.location.reload(), 150)
      } else {
        set(0)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (!pull && !refreshing) return null
  const ready = pull >= TRIGGER
  return (
    <div className={`ptr ${ready ? 'ready' : ''} ${refreshing ? 'spinning' : ''} ${start.current ? 'dragging' : ''}`}
      style={{ transform: `translate(-50%, ${pull - 44}px)`, opacity: Math.min(1, pull / 40) }}
      role="status" aria-live="polite">
      <RefreshCw size={18} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }} aria-hidden="true" />
      <span className="sr-only">{refreshing ? 'Refreshing' : ready ? 'Release to refresh' : 'Pull to refresh'}</span>
    </div>
  )
}
