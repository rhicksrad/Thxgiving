// Responses. The site is on a different origin (GitHub Pages) and signs in with a bearer token, not cookies,
// so any origin may call; the token is what gets you in.
export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, range',
  'access-control-expose-headers': 'content-length, content-range, content-disposition, etag',
  'access-control-max-age': '86400',
}

export const text = (body, status = 200) => new Response(body, { status, headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8' } })
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

/** Stop handling the request with this error (caught in index.js and sent as the response). */
export const fail = (message, status = 400) => { throw text(message, status) }
