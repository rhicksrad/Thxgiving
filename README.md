# Hicks Family 🏡

The Hicks family's site, all year round: get-togethers (who's coming, who's bringing what), the family chat, and all
the pictures. It dresses up for the season with a new look every month.

**Live:** https://hicksfamily.app

- **Home** is the family's front page:
  - A welcome in this month's theme (see **Seasons** below), with what's going on this month.
  - **Coming up:** the next get-together with its countdown, and a button into its sign-up board.
  - Shortcuts to the chat, photos and family list, then every other get-together: what's still ahead, and
    **Looking back** for the ones that are done.
- **Each get-together has its own page**, like **Thanksgiving 2026** (Thursday, November 26):
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
- **Plan a get-together** (bottom of Home): Christmas, a birthday, a cookout, Thanksgiving 2027. Each one gets its own
  page with lists, chat and photos. Home always shows the next one coming up; the rest are listed below it.
- **Chat:** the family group chat, any day. Type **@** to tag someone (**@family** tags everybody). GIFs and photos work.
- **Photos:** everyone's pics and videos, filterable by get-together and by who added them, in the order they were
  taken. The same pic added by two people shows once. Originals stay full-size; download one or zip a whole day.
- **Reactions & comments** on any photo, video or message, and a bell in the top bar for what's new.
- **Family:** your name and avatar (upload a photo or pick a badge), and the family list: add people by name and
  cell number.

- **Calendar:** the family calendar, a month at a time. Anyone can put something on it (a birthday, a trip, a
  ballgame): a name, the day, a time or all day, a last day for trips, and notes. Anyone can change or remove it.
  Every get-together shows on it too (tap it for its sign-up board), and so do the big six holidays: New Year's Day,
  Memorial Day, Independence Day, Labor Day, Thanksgiving and Christmas. Tap a day to see everything on it.
- **Mine:** everyone's own private page. Only they can open it. It starts blank with one box: type what you want
  your page to be (a birthday countdown, a recipe box, a to-do list, a journal, a game…). The next time the site is
  updated, it gets made for you. Change your mind any time under **Change your page**.

Everything updates live for everyone (except **Mine**, which only ever goes to its owner).

## Making everyone's private pages

Each time the site gets updated, check what people asked for and build their pages. From `worker/` (signed in to
Cloudflare with `npx wrangler login`):

```sh
npm run pages                  # who asked for what: NEW, CHANGE ASKED, up to date, or blank
npm run pages -- pull          # copies each request into private-pages/<name>/wish.md (plus their live page)
# write private-pages/<name>/page.html
npm run pages -- push <name>   # puts it live for that person
```

`private-pages/` is git-ignored on purpose: the pages and requests are private, and this repo is public. They live
only in the D1 table `private_pages`, and only their owner can read them through the API.

`page.html` is what goes inside `<body>`: HTML with any `<style>` and `<script>` it needs, up to 90 KB. It runs in a
sandboxed frame, so its scripts can't touch the rest of the site, the person's sign-in, or anyone else's data. It gets:

- the month's colors as CSS variables: `var(--bg)`, `var(--card)`, `var(--line)`, `var(--text)`, `var(--muted)`,
  `var(--gold)`, `var(--ink)`…
- `page.name`: the person's name
- `page.data`: whatever the page saved last time (`null` at first)
- `page.save(value)`: keeps any JSON-able value (up to 100 KB) for next time, like their to-do list

Add `--local` to any of these to work against the `wrangler dev` database instead.

## Seasons

The site picks one of 12 looks from the month on each visitor's own phone or computer, and switches over on its own
when the month changes. Each month has its own colors, emblem in the top bar, striped trim, little things drifting
down the background, and a set of "question of the day" prompts for the family chat.

| Month | Theme | Emblem | Drifting |
|---|---|---|---|
| January | Fresh snow | Snowflake | Snow |
| February | Sweethearts | Heart | Hearts |
| March | Lucky green | Shamrock | Clovers |
| April | Spring showers | Tulip | Raindrops |
| May | In bloom | Flower | Petals |
| June | Sunshine | Sun | Sparkles |
| July | Stars & stripes | Firework | Stars |
| August | Beach days | Watermelon | Bubbles |
| September | Apple picking | Apple | Leaves |
| October | Spooky season | Jack-o'-lantern | Bats |
| November | Harvest | Turkey | Leaves |
| December | Merry & bright | Christmas tree | Snow |

To peek at another month, pick it under **Family → Season theme** (that device only; everyone else still sees the
current month), or add `?month=7` to the address before the `#`. People who've asked their phone to reduce motion
get the decorations without the movement.

## Signing in

Sign in with your **cell phone number** and a password. **No texts are sent**, so there's no SMS service to pay for.

- **On the family list, first time:** pick a password and you're in.
- **Been here before:** enter your password. Ten wrong tries in 15 minutes locks that number out for a bit.
- **Not on the list:** you're told to ask the family.

**Adding people:** **Family → Add** (name and cell number), then text them the site link.

**Forgot a password:** anyone in the family hits **Reset** next to that person on the Family page. The next time they
sign in, they pick a new one. You can also change your own password on the Family page.

The trade-off: whoever first signs in with a family number picks that account's password. That's fine for a family
site. If it ever goes wrong, hit Reset.

## Put it on your phone

It installs like an app: its own icon, full screen, no browser bar. The site offers it itself (a banner on Home and a
button on the Family page).

- **iPhone:** open the site in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open it in Chrome, tap **⋮**, then **Add to Home screen** (or **Install app**).

## How it's built

Everything runs free: the site on GitHub Pages, everything else on Cloudflare's free plan. Nothing ever pauses.

- **The site:** React + Vite in `src/`, deployed to GitHub Pages on every push to `main`
  ([`deploy-pages.yml`](.github/workflows/deploy-pages.yml)). Installable as an app
  ([`public/manifest.webmanifest`](public/manifest.webmanifest), a service worker in [`public/sw.js`](public/sw.js),
  icons drawn from the house in `src/lib/marks.ts` by `node scripts/make-icons.mjs`).
- **Seasons:** the 12 themes (colors, taglines, chat questions) are in [`src/lib/theme.ts`](src/lib/theme.ts), and their
  emblems and background shapes in [`src/lib/marks.ts`](src/lib/marks.ts). `styles.css` mixes every other color
  from the few each theme sets.
- **The server:** one Cloudflare Worker in [`worker/`](worker/README.md):
  - the API, with sign-in (passwords are salted and hashed; devices keep a random sign-in token) and the family-only
    rules for every request
  - **D1** (SQLite) for the data ([`worker/schema.sql`](worker/schema.sql))
  - **R2** for photos and videos, served through short-lived signed links
  - a **Durable Object** that pushes every change to everyone's screen as it happens
- [`public/config.js`](public/config.js) tells the site where the Worker is.

## Setting it up

The D1 database (`thxgiving`) and R2 bucket (`thxgiving-files`) already exist, and the database is set up with
Thanksgiving 2026 and its lists. What's left:

1. **GitHub secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
   - `CLOUDFLARE_API_TOKEN`: Cloudflare → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers**
     template, then **+ Add more** → Account → **D1** → **Edit**
   - `CLOUDFLARE_ACCOUNT_ID`: on the right side of the Cloudflare dashboard's Workers & Pages page
   - `FILES_SIGNING_SECRET`: any long random string (it signs photo links), e.g. from `openssl rand -hex 32`
2. **Deploy the server:** Actions → **Deploy the server to Cloudflare** → Run workflow. It redeploys on its own whenever
   `worker/` changes on `main`, and brings the database up to date each time.
3. **Check the address:** the Worker answers at `https://api.hicksfamily.app` (and its workers.dev address). If that
   isn't what `apiUrl` in [`public/config.js`](public/config.js) says, fix it there and push.
4. **GitHub Pages:** repo → Settings → Pages → Source: **GitHub Actions**.
5. **Add yourself** so you can sign in (then add everyone else from the Family page). In Cloudflare: Storage & Databases →
   D1 → `thxgiving` → Console:

   ```sql
   insert into members (phone, name, created_at) values ('13175550123', 'Your Name', datetime('now'));
   ```

   The number is digits only, with the 1 in front.

## The address: hicksfamily.app

The domain is registered on Cloudflare.

- **The site** is served by GitHub Pages at `hicksfamily.app` (`public/CNAME`). In Cloudflare DNS for hicksfamily.app,
  a `CNAME` named `@` points to `rhicksrad.github.io`, and a `CNAME` named `www` does too. Both are set to
  **DNS only** (grey cloud), so GitHub can issue the HTTPS certificate. In the repo, Settings → Pages →
  Custom domain is `hicksfamily.app`, with **Enforce HTTPS** on. The old `rhicksrad.github.io/Thxgiving/` address
  redirects there.
- **The server** answers at `api.hicksfamily.app`. `worker/wrangler.toml` claims it on deploy, and Cloudflare
  makes that DNS record and certificate itself. It still answers at its `workers.dev` address too.

## Changing things

| Want to… | Do this |
|---|---|
| Change the starter food or help list for new get-togethers | Edit `list_template` (D1 console), or the insert in `worker/schema.sql` |
| Change the database | Edit `worker/schema.sql` (keep it safe to re-run) and push; the deploy runs it |
| Change a month's look | Edit its entry in `src/lib/theme.ts` (colors, tagline, chat questions) or its emblem in `src/lib/marks.ts` |
| Change the time zone | `TZ` in `src/lib/format.ts` |
| Delete a get-together | D1 console: `delete from gatherings where title = '…'` (takes its lists, chat and RSVPs with it) |
| Run it locally | `cd worker && npm install && npm run schema:local && npm run dev`, then in another terminal `VITE_API_URL=http://localhost:8787 npm run dev` and open http://localhost:5173 |
