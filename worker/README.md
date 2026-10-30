# The server (Cloudflare Worker)

Everything behind the site, on Cloudflare's free plan:

| File | What |
|---|---|
| [`index.js`](index.js) | The API: sign-in, the family list, gatherings, lists, RSVPs, chat, photos, comments, reactions |
| [`schema.sql`](schema.sql) | The D1 (SQLite) database. Safe to re-run; the deploy workflow runs it every time |
| [`files.js`](files.js) | Photos and videos in R2: uploads, signed links, deletes |
| [`live.js`](live.js) | The Durable Object that sends every change to everyone's screen over a WebSocket |
| [`wrangler.toml`](wrangler.toml) | Which D1 database, R2 bucket and Durable Object it uses |

**Who gets in:** every route except sign-in and signed file links needs a sign-in token whose phone number is still on
the family list (`members`). You can only upload, delete or edit your own photos, messages, comments and reactions, and
only upload into your own `<user id>/` folder. Food ratings never leave the Worker except as totals.

**Sign-in:** passwords are PBKDF2-SHA256 (100,000 rounds, salted). A sign-in gets a random token; the database keeps
only its SHA-256. A device that hasn't opened the site in six months signs in again. Ten wrong passwords for one
number in 15 minutes locks it out until the window passes.

## Free-plan room

D1 allows millions of reads and around 100,000 writes a day; R2 has 10 GB of storage free (then $0.015/GB a month)
and downloads are always free; the Durable Object sleeps between messages. A family Thanksgiving uses a tiny slice
of all of it.

## Deploying

The GitHub workflow [`deploy-worker.yml`](../.github/workflows/deploy-worker.yml) does it: set up the repo secrets
listed there, then Actions → **Deploy the server to Cloudflare** → Run workflow. By hand, from this folder:

```sh
npm install
npx wrangler secret put SIGNING_SECRET     # once: any long random string
npm run schema                             # bring the database up to date
npm run deploy
```

## Running it locally

```sh
npm install
echo "SIGNING_SECRET=local" > .dev.vars
npm run schema:local
npx wrangler d1 execute thxgiving --local --command "insert into members (phone, name, created_at) values ('13175550100', 'Me', datetime('now'))"
npm run dev                                # http://localhost:8787
```

Then run the site against it from the repo root: `VITE_API_URL=http://localhost:8787 npm run dev`.

## Routes

All JSON. "Family" = signed in, and the number is on the family list.

| Route | Who | What |
|---|---|---|
| `POST /auth/status` `{ phone }` | anyone | `not_member`, `new`, `set_password` or `password` |
| `POST /auth/signup` `{ phone, password }` | on the list, no password yet | Pick a password; returns `{ token, user }` |
| `POST /auth/login` `{ phone, password }` | anyone | `{ token, user }` |
| `POST /auth/logout`, `GET /me` | signed in | Sign out; who you are and whether you're on the list |
| `PATCH /me`, `POST /me/password` | family | Your name, badge and photo; your password |
| `GET /profiles`, `GET/POST /members`, `DELETE /members/:phone`, `POST /members/:phone/reset` | family | The family |
| `GET/POST /gatherings`, `GET/PATCH /gatherings/:id`, `GET /stats[/:id]` | family | Get-togethers and their counts |
| `GET /gatherings/:id/items`, `POST /items`, `PATCH/DELETE /items/:id`, `PUT /items/:id/rating` | family | The food and help lists |
| `GET /gatherings/:id/my-ratings`, `GET /gatherings/:id/rsvps`, `PUT /gatherings/:id/rsvp` | family | Your ratings; who's coming |
| `GET/POST /messages`, `GET/DELETE /messages/:id` | family (delete: yours) | Chat |
| `GET/POST /photos`, `PATCH/DELETE /photos/:id` | family (edit, delete: yours) | Photos and videos |
| `GET/POST /comments`, `GET/DELETE /comments/:id` | family (delete: yours) | Photo comments |
| `GET/POST /reactions`, `DELETE /reactions/:id` | family (delete: yours) | Emoji reactions |
| `GET /activity` | family | The latest from everyone else, for the bell |
| `GET /live?token=…` | family | WebSocket of every change: `{ table, op: insert/update/delete, row }` |
| `POST /sign`, `PUT /o/<path>`, `POST /delete`, `POST /hashes`, `GET /usage` | family (uploads, deletes: your folder) | Files in R2 |
| `GET /f/<path>?e=…&s=…` | anyone with the link | The file, with range requests for video |
