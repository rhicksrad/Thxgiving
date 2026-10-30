import { useState } from 'react'
import { Download, Ellipsis, Share, SquarePlus, X } from 'lucide-react'
import { useInstall } from '../lib/install'
import Logo from './Logo'

/** "Add to Home Screen" button: one tap where the browser allows it, step-by-step on iPhone. Hidden once installed. */
export function InstallButton({ className = 'btn gold' }: { className?: string }) {
  const { mode, prompt } = useInstall()
  const [guide, setGuide] = useState(false)
  if (!mode) return null
  return (
    <>
      <button className={className} onClick={() => (mode === 'prompt' ? prompt() : setGuide(true))}>
        <Download size={16} aria-hidden="true" />Add to Home Screen
      </button>
      {guide && <IosGuide onClose={() => setGuide(false)} />}
    </>
  )
}

const DISMISS_KEY = 'tg:install-banner-dismissed'

/** Home-page banner for people who haven't installed yet. "Not now" hides it on this device; Family keeps the button. */
export function InstallBanner() {
  const { mode } = useInstall()
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false } })
  if (!mode || hidden) return null
  const dismiss = () => {
    setHidden(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode: it just comes back next visit */ }
  }
  return (
    <section className="install-banner card">
      <Logo size={44} />
      <div className="grow">
        <div className="install-title">Get the app</div>
        <div className="muted small">Add it to your home screen: full screen, one tap away.</div>
      </div>
      <div className="install-actions">
        <InstallButton className="btn gold sm" />
        <button className="btn ghost sm icon" onClick={dismiss} title="Not now" aria-label="Not now">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

function IosGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop sheet" onClick={onClose}>
      <div className="card modal install-guide" role="dialog" aria-modal="true" aria-labelledby="install-guide-title"
        onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 id="install-guide-title" className="display grow">Add to Home Screen</h2>
          <button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X size={16} aria-hidden="true" /></button>
        </div>
        <p className="muted small">iPhone doesn't let websites install themselves, so it's three quick taps in Safari:</p>
        <ol className="install-steps">
          <li>
            <span className="step-ic"><Share size={18} aria-hidden="true" /></span>
            <span>Tap <b>Share</b> in Safari's toolbar. If you don't see it, tap <Ellipsis size={15} className="inline-ic" aria-label="the ••• button" /> first.</span>
          </li>
          <li>
            <span className="step-ic"><SquarePlus size={18} aria-hidden="true" /></span>
            <span>Scroll down and tap <b>Add to Home Screen</b>.</span>
          </li>
          <li>
            <span className="step-ic"><Logo size={22} /></span>
            <span>Tap <b>Add</b>. Open Thanksgiving from your home screen from now on.</span>
          </li>
        </ol>
        <button className="btn gold" onClick={onClose}>Got it</button>
      </div>
    </div>
  )
}
