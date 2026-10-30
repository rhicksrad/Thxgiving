/**
 * The element the app scrolls. Signed-in pages scroll inside `.app-scroll` instead of the document, so the
 * phone tab bar can sit under it as an ordinary block (iOS Safari drifts `position: fixed` bars up the screen
 * after the keyboard closes or the toolbar resizes). Signed-out screens still scroll the document.
 */
export const scroller = (): HTMLElement =>
  document.querySelector<HTMLElement>('.app-scroll') ?? (document.scrollingElement as HTMLElement) ?? document.documentElement
