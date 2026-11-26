import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * Each person's built private page, by their user id (see the README's "Private pages"). Someone with no entry
 * here sees a blank page with a box to say what they want it to be.
 *
 * To build one: add src/private/<name>.tsx with a default-exported component, import { lazy } from 'react'
 * above, and list it here, e.g.
 *   'f759da0f-332f-4cb2-aba7-a59d1f9fa615': lazy(() => import('./ryan')),
 * Each page loads only for its owner. The site's code is public, though, so anything personal a page shows
 * belongs in usePrivateData (saved on the server for that person only), never typed into the code.
 */
export const PRIVATE_PAGES: Record<string, LazyExoticComponent<ComponentType>> = {
}

