import './lib/install' // first, so the browser's one-time install offer isn't missed
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Lets phones install the site as an app (see public/sw.js). Skipped in dev so Vite's
// hot reload never fights a cache.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js') })
}
