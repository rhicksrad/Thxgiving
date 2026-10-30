// Where the site's server lives: the Cloudflare Worker in worker/ (see worker/README.md).
// Safe to publish: the Worker only lets in people who sign in with a number on the family list.
window.TG_CONFIG = {
  apiUrl: 'https://thxgiving.hicksrch.workers.dev',
}
