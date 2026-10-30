# File service (Cloudflare R2)

Stores the site's photos, videos, chat pics and avatars in Cloudflare R2 instead of Supabase storage.
R2 has 10 GB free, then $0.015/GB a month, and downloads are always free (Supabase's free tier stops at 1 GB).
Only family gets in, you can only upload or delete your own files, and the site gets short-lived signed links.
It also pings Supabase every other day so the free project never pauses for inactivity.

Until `filesUrl` is set in `public/config.js`, the site uses the Supabase `gallery` bucket instead.

## Set it up

1. **Cloudflare:** turn on R2 (sidebar → R2 Object Storage). Copy your **Account ID**. Create an API token from the
   **Edit Cloudflare Workers** template and check it includes **Workers R2 Storage: Edit**.
2. **Point it at Supabase:** put the project URL and publishable key in `[vars]` in `worker/wrangler.toml`
   (the same two values as `public/config.js`).
3. **GitHub** (repo → Settings → Secrets and variables → Actions → New repository secret), add:
   - `CLOUDFLARE_API_TOKEN`: the token
   - `CLOUDFLARE_ACCOUNT_ID`: the Account ID
   - `FILES_SIGNING_SECRET`: any long random string (it signs the photo links), e.g. from `openssl rand -hex 32`
4. **Deploy:** Actions → **Deploy file service to Cloudflare** → Run workflow. It creates the `thxgiving-files`
   bucket and deploys to `https://thxgiving-files.<your subdomain>.workers.dev`. After that it redeploys on its own
   whenever `worker/` changes on `main`.
5. **Switch the site over:** set `filesUrl: 'https://thxgiving-files.<your subdomain>.workers.dev'` in
   `public/config.js` and push. Do this before anyone uploads photos: files already in Supabase storage aren't
   copied over.

## Routes

| Route | Who | What |
|---|---|---|
| `POST /sign` `{ paths, ttl?, download? }` | family | Signed links, like Supabase's `createSignedUrls` |
| `PUT /o/<path>` | family, own folder | Upload (photos and videos only, up to 100 MB); returns the file's MD5 |
| `POST /delete` `{ paths }` | family, own folder | Delete |
| `GET /usage` | family | Total bytes and files in the bucket (shown on the Photos page) |
| `POST /hashes` `{ paths }` | family | Each file's MD5 (its R2 etag), so the site can stack duplicate uploads |
| `GET /f/<path>?e=…&s=…` | anyone with the link | The file, with range requests for video |

"Family" means a valid Supabase session whose phone number passes `public.is_member()`.
