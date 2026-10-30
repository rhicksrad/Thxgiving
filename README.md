# Thanksgiving 2026 🦃

Our family Thanksgiving sign-up: who's coming, who's bringing what, and all the pictures.

**Live:** https://rhicksrad.github.io/Thxgiving/

- **Home** is the Thanksgiving 2026 board (Thursday, November 26):
  - A countdown, plus the date and time (tap the pencil to change them; leave the time blank until it's decided).
  - **Where** and **Notes:** whose house, the address, parking, bring a chair…
  - **Who's coming:** everyone says **I'll be there**, **Maybe** or **Can't make it**, and how many people they're
    bringing. The headcount (yeses plus their guests) shows at the top, along with who hasn't answered yet.
  - **The Food:** who's bringing what. It starts with the classics (turkey, stuffing, mashed potatoes, pies…). Tap the
    circle to claim a dish yourself, or use **Who's bringing it?** to put anyone on it, so whoever runs the list can fill
    it in for everybody. **Someone else…** covers people who aren't on the site. Add a note like "homemade, serves 12".
    Afterwards, everyone can rate each dish 1 to 10, anonymously: the family only sees the average.
  - **Supplies & Help:** who's hosting, who's carving, enough chairs, leftover containers, who's saying grace…
    Mark each Yes or No, pick who's on it, and add the answer.
  - **Chat** and **Photos** for the day.
- **Plan another get-together** (bottom of Home): Christmas, a birthday, Thanksgiving 2027. Each one gets its own lists,
  chat and photos. Home always shows the next one coming up; the rest are listed below it.
- **Chat:** the family group chat, any day. Type **@** to tag someone (**@family** tags everybody). GIFs and photos work.
- **Photos:** everyone's pics and videos, filterable by get-together and by who added them, in the order they were
  taken. The same pic added by two people shows once. Originals stay full-size; download one or zip a whole day.
- **Reactions & comments** on any photo, video or message, and a bell in the top bar for what's new.
- **Family:** your name and avatar (upload a photo or pick a badge), and the family list: add people by name and
  cell number.

Everything updates live for everyone.

## Signing in

Sign in with your **cell phone number** and a password. **No texts are sent**, so there's no SMS service to pay for.

- **On the family list, first time:** pick a password and you're in.
- **Been here before:** enter your password.
- **Not on the list:** you're told to ask the family.

**Adding people:** **Family → Add** (name and cell number), then text them the site link.

**Forgot a password:** anyone in the family hits **Reset** next to that person on the Family page. The next time they
sign in, they pick a new one. You can also change your own password on the Family page.

How it's enforced (all in [`supabase/schema.sql`](supabase/schema.sql)):

- Phone numbers are stored as digits with the country code (`13175550123`); `clean_phone()` turns however they're
  typed into that, and the site does the same.
- A trigger on `auth.users` refuses accounts for numbers that aren't on the family list.
- `phone_status()` tells the sign-in page which screen to show.
- `set_first_password()` and `reset_member_password()` handle first and forgotten passwords.

The trade-off: whoever first signs in with a family number picks that account's password. That's fine for a family
site. If it ever goes wrong, hit Reset.

## Put it on your phone

It installs like an app: its own icon, full screen, no browser bar. The site offers it itself (a banner on Home and a
button on the Family page).

- **iPhone:** open the site in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open it in Chrome, tap **⋮**, then **Add to Home screen** (or **Install app**).

## Setting it up

1. **Supabase** (free tier): create a project, then SQL Editor → New query → paste all of
   [`supabase/schema.sql`](supabase/schema.sql) → Run. It's safe to re-run whenever it changes.
2. **Turn on phone sign-in without texts.** Either push the auth settings in
   [`supabase/config.toml`](supabase/config.toml) with the CLI:

   ```sh
   supabase link --project-ref <ref>
   supabase config push
   ```

   or in the dashboard: Authentication → Sign In / Providers → **Phone**: enable it and turn **Confirm phone** off.
   (If the dashboard insists on an SMS provider, pick Twilio and type anything in its fields: with confirmation off,
   nothing is ever sent.) While you're there, turn **Email** sign-ups off. Under Authentication → URL Configuration,
   set the Site URL to `https://rhicksrad.github.io/Thxgiving/`.
3. **Add yourself** so you can get in (then add everyone else from the Family page):

   ```sql
   insert into public.members (phone, name) values ('(317) 555-0123', 'Your Name');
   ```

4. **Connect the site:** put the project URL and **publishable** key (Project Settings → API Keys) in
   [`public/config.js`](public/config.js). Both are meant to be public; row-level security is what keeps the data
   private.
5. **GitHub Pages:** repo → Settings → Pages → Source: **GitHub Actions**. Every push to `main` deploys.
6. **Photos on Cloudflare R2:** see [`worker/README.md`](worker/README.md). Until it's set up, photos go to Supabase
   storage (1 GB free).

## Stack

- React + Vite, hosted free on GitHub Pages ([`deploy-pages.yml`](.github/workflows/deploy-pages.yml)).
- Supabase (free tier): phone + password sign-in, Postgres, realtime.
- Cloudflare R2 for photos and videos, through a small Worker ([`worker/`](worker/README.md)).
- [`keep-awake.yml`](.github/workflows/keep-awake.yml) (and the Worker, on its own schedule) pings Supabase every few
  days so the free project never pauses.
- Installable as an app: [`public/manifest.webmanifest`](public/manifest.webmanifest), icons in `public/icons/`
  (drawn from the turkey in `src/components/Logo.tsx` by `node scripts/make-icons.mjs`), and a service worker
  ([`public/sw.js`](public/sw.js)) that caches only the app itself.

## Changing things

| Want to… | Do this |
|---|---|
| Change the starter food or help list for new get-togethers | Edit `list_template` in Supabase (Table Editor), or the insert in `schema.sql` |
| Change the database | Edit `supabase/schema.sql` (safe to re-run), then run it in the SQL Editor |
| Change the time zone | `TZ` in `src/lib/format.ts` (and the Thanksgiving insert in `schema.sql`) |
| Delete a get-together | SQL only: `delete from gatherings where title = '…'` (takes its lists and chat with it) |
| Run it locally | `npm install`, then `npm run dev`, then open http://localhost:5173 |
