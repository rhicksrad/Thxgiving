-- ============================================================================
--  Family Thanksgiving — Cloudflare D1 (SQLite) schema
--  Safe to re-run: every statement is idempotent. The deploy workflow runs it on every deploy.
--  By hand: npx wrangler d1 execute thxgiving --remote --file worker/schema.sql   (from the repo root)
--
--  Ids are random UUIDs and times are ISO strings (2026-11-26T19:00:00.000Z), both made by the Worker.
--  Who can do what is enforced in worker/index.js: every route checks the session and the family list.
-- ============================================================================

-- Family list. Only phone numbers in here can sign in. Digits with the country code, no "+": 13175550123.
create table if not exists members (
  phone      text primary key check (phone glob '[0-9]*' and length(phone) between 8 and 15),
  name       text check (length(name) <= 40), -- what to call them until they sign in and pick their own
  invited_by text,
  created_at text not null
);

-- One per person who has signed in: their login and their profile.
create table if not exists users (
  id            text primary key,
  phone         text not null unique,
  password_hash text not null default '',        -- '' = picks a new one at next sign-in (first time, or reset)
  display_name  text not null default 'Family',
  emoji         text not null default 'turkey',  -- avatar badge key
  avatar_path   text,                            -- profile photo in R2: <user id>/avatar/<uuid>.jpg
  onboarded     integer not null default 0,
  created_at    text not null
);

-- Signed-in devices. The token itself is only on the device; this keeps its SHA-256.
create table if not exists sessions (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  created_at text not null,
  last_seen  text not null
);
create index if not exists sessions_user_idx on sessions (user_id);

-- Wrong passwords, so nobody can guess one by trying thousands.
create table if not exists login_failures (
  phone text not null,
  at    text not null
);
create index if not exists login_failures_idx on login_failures (phone, at);

-- Gatherings. Thanksgiving 2026 is seeded below; more can be added from the site.
create table if not exists gatherings (
  id         text primary key,
  title      text not null check (length(title) between 1 and 80),
  starts_at  text not null,
  time_tbd   integer not null default 0,
  place      text check (length(place) <= 500),
  notes      text check (length(notes) <= 500),
  created_at text not null
);
create index if not exists gatherings_starts_idx on gatherings (starts_at);

-- New gatherings start blank. (They used to be given a starter food and help list; that table is gone.)
drop table if exists list_template;

-- Each gathering's two lists: the food (kind 'food') and supplies & help (kind 'ask').
create table if not exists list_items (
  id           text primary key,
  gathering_id text not null references gatherings(id) on delete cascade,
  kind         text not null check (kind in ('food', 'ask')),
  label        text not null check (length(label) between 1 and 200),
  note         text check (length(note) <= 500),
  owner_id     text references users(id) on delete set null, -- food: who's bringing it · ask: who's on it
  owner_name   text check (length(owner_name) <= 40),        -- or someone who isn't on the site ("Aunt Linda")
  status       text not null default 'open' check (status in ('open', 'yes', 'no')),
  sort         integer not null default 1000,
  created_by   text references users(id) on delete set null, -- null = the starter list
  created_at   text not null,
  rating_sum   integer not null default 0,                    -- anonymous food ratings: the total…
  rating_count integer not null default 0                     -- …and how many, never who gave what
);
create index if not exists list_items_gathering_idx on list_items (gathering_id);

-- Food ratings, 1–10. Only the Worker reads these; the site only ever gets your own and the totals.
create table if not exists food_ratings (
  item_id text not null references list_items(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  score   integer not null check (score between 1 and 10),
  primary key (item_id, user_id)
);

-- Who's coming. One row per person per gathering; 'no' stays a row, so "can't make it" shows too.
create table if not exists rsvps (
  id           text primary key,
  gathering_id text not null references gatherings(id) on delete cascade,
  user_id      text not null references users(id) on delete cascade,
  status       text not null check (status in ('yes', 'maybe', 'no')),
  guests       integer not null default 0 check (guests between 0 and 20), -- not counting themselves
  updated_at   text not null,
  unique (gathering_id, user_id)
);

-- Chat. gathering_id set = that gathering's thread · null = the family chat.
create table if not exists messages (
  id           text primary key,
  gathering_id text references gatherings(id) on delete cascade,
  author_id    text not null references users(id) on delete cascade,
  body         text not null check (length(body) <= 2000),
  image_path   text,
  created_at   text not null,
  check (length(body) >= 1 or image_path is not null)
);
create index if not exists messages_gathering_idx on messages (gathering_id, created_at);

-- Photos and videos. The files are in R2; this is what the site lists.
create table if not exists photos (
  id           text primary key,
  gathering_id text references gatherings(id) on delete set null,
  uploader_id  text not null references users(id) on delete cascade,
  path         text not null unique,   -- original file
  thumb_path   text,                   -- small preview (images only)
  mime         text not null default 'image/jpeg',
  caption      text check (length(caption) <= 300),
  taken_at     text,                   -- when it was taken (EXIF / video header)
  content_hash text,                   -- MD5 from R2, so the same pic from two people stacks
  created_at   text not null
);
create index if not exists photos_gathering_idx on photos (gathering_id, created_at);

create table if not exists photo_comments (
  id         text primary key,
  photo_id   text not null references photos(id) on delete cascade,
  author_id  text not null references users(id) on delete cascade,
  body       text not null check (length(body) between 1 and 1000),
  created_at text not null
);
create index if not exists photo_comments_photo_idx on photo_comments (photo_id, created_at);

-- Emoji reactions on photos, messages and photo comments. owner_id = whose thing it is (for the bell).
create table if not exists reactions (
  id          text primary key,
  target_type text not null check (target_type in ('photo', 'message', 'comment')),
  target_id   text not null,
  owner_id    text references users(id) on delete cascade,
  user_id     text not null references users(id) on delete cascade,
  emoji       text not null check (length(emoji) between 1 and 16),
  created_at  text not null,
  unique (target_type, target_id, user_id, emoji)
);
create index if not exists reactions_target_idx on reactions (target_id);
create index if not exists reactions_owner_idx on reactions (owner_id, created_at);

-- Everyone's own private page ("Mine"). Only its owner can read it through the API, and it is never sent live
-- to anyone else. wish = what they typed they want the page to be. page = the page built for them (HTML, run in a
-- sandboxed frame on the site), written by whoever updates the site with `npm run pages` in worker/.
-- data = whatever that page saves for itself (a to-do list, notes…), as JSON.
create table if not exists private_pages (
  user_id  text primary key references users(id) on delete cascade,
  wish     text not null default '' check (length(wish) <= 4000),
  wish_at  text,
  page     text not null default '' check (length(page) <= 90000),
  page_at  text,
  data     text check (length(data) <= 100000),
  data_at  text
);

-- An earlier version kept requests in page_wishes and page data in private_data: carry any requests over, then
-- drop both (safe to re-run: on later runs the empty old table is made and dropped again).
create table if not exists page_wishes (user_id text primary key, wish text not null, updated_at text not null);
insert or ignore into private_pages (user_id, wish, wish_at)
select w.user_id, w.wish, w.updated_at from page_wishes w where exists (select 1 from users u where u.id = w.user_id);
drop table if exists page_wishes;
drop table if exists private_data;

-- The family calendar: anything anyone adds (birthdays, games, trips). Get-togethers and the big holidays show
-- on it too, but those come from gatherings and the site itself. Dates are the family's local day, YYYY-MM-DD.
create table if not exists events (
  id         text primary key,
  title      text not null check (length(title) between 1 and 80),
  day        text not null check (day glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  time       text check (time is null or time glob '[0-9][0-9]:[0-9][0-9]'), -- null = all day
  yearly     integer not null default 0,                                     -- 1 = every year (birthdays)
  note       text check (length(note) <= 500),
  created_by text not null,
  created_at text not null
);
create index if not exists events_day_idx on events (day);

-- The last day of a multi-day event (trips). A separate table, not a column, so this file stays safe to re-run.
create table if not exists event_ends (
  event_id text primary key references events(id) on delete cascade,
  end_day  text not null check (end_day glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

-- Hilton Head, July 17-24, 2027 (asked for by Ryan). It began as a calendar entry and is now a get-together
-- with its own page (see the end of this file), so the calendar entry goes.
delete from event_ends where event_id = 'hilton-head-2027';
delete from events where id = 'hilton-head-2027';

-- Thanksgiving 2026: Thursday, November 26, time to be decided (noon Eastern until someone sets it).
insert or ignore into gatherings (id, title, starts_at, time_tbd, created_at)
values ('thanksgiving-2026', 'Thanksgiving 2026', '2026-11-26T17:00:00.000Z', 1, '2026-10-30T00:00:00.000Z');

-- The archive: get-togethers moved off Home's "Coming up" into its Archive section.
-- (A separate table, not a column, so this file stays safe to re-run.)
create table if not exists archived_gatherings (
  gathering_id text primary key references gatherings(id) on delete cascade,
  archived_at  text not null
);
insert or ignore into archived_gatherings (gathering_id, archived_at)
values ('thanksgiving-2026', '2026-11-26T23:45:00.000Z');

-- Family Christmas: Saturday, January 2, 2027, time to be decided.
insert or ignore into gatherings (id, title, starts_at, time_tbd, created_at)
values ('christmas-2026', 'Family Christmas', '2027-01-02T17:00:00.000Z', 1, '2026-11-26T23:45:00.000Z');

-- FIRST RUN: add yourself so you can sign in, then add everyone else from the Family page:
--   npx wrangler d1 execute thxgiving --remote --command "insert into members (phone, name, created_at) values ('13175550123', 'Your Name', datetime('now'))"

-- Birthdays: who a birthday on the calendar belongs to, and the look the site wears on their day. The rows are
-- personal, so they are written straight to the live database and never listed here. `theme` is JSON
-- (see BirthdayTheme in src/lib/birthdays.ts); null means the party look.
create table if not exists birthday_people (
  event_id text primary key references events(id) on delete cascade,
  user_id  text,          -- their account, once they have one (so the site can say "happy birthday" to them)
  name     text not null, -- what the family calls them
  theme    text
);

-- Private messages, end-to-end encrypted in the browser. The server only ever holds locked text: the words are
-- sealed with a key only the people in the conversation can open, so nobody with the database (whoever runs the
-- site included) can read them. What the server can see: who talks to whom, when, and roughly how long.
--
-- dm_keys: everyone's public "lock" (an ECDH P-256 public key, JWK). A new row each time someone starts fresh
-- (a password reset), so older messages still name the key they were sealed with.
create table if not exists dm_keys (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  public_key text not null check (length(public_key) <= 1000),
  created_at text not null
);
create index if not exists dm_keys_user_idx on dm_keys (user_id, created_at);

-- dm_locks: each person's private key, sealed in their browser with their password (PBKDF2 → AES-GCM). Only the
-- sealed copy is here; signing in on a new phone opens it with the password, which never leaves that check.
create table if not exists dm_locks (
  user_id    text primary key references users(id) on delete cascade,
  key_id     text not null references dm_keys(id) on delete cascade,
  sealed     text not null check (length(sealed) <= 2000),
  salt       text not null,
  iv         text not null,
  rounds     integer not null,
  updated_at text not null
);

-- A conversation: two or more people, fixed when it starts. member_key = their ids, sorted, comma-joined,
-- so the same people always land in the same conversation.
create table if not exists dm_conversations (
  id         text primary key,
  member_key text not null unique,
  created_by text not null,
  created_at text not null
);
create table if not exists dm_members (
  conversation_id text not null references dm_conversations(id) on delete cascade,
  user_id         text not null references users(id) on delete cascade,
  last_read_at    text,
  primary key (conversation_id, user_id)
);
create index if not exists dm_members_user_idx on dm_members (user_id);

-- One message. body = AES-GCM ciphertext; keys = JSON { user id: { k: their key id, w: the message key wrapped
-- for them } }; sender_key = the sender's key id, so readers know whose lock to use.
create table if not exists dm_messages (
  id              text primary key,
  conversation_id text not null references dm_conversations(id) on delete cascade,
  sender_id       text not null references users(id) on delete cascade,
  sender_key      text not null,
  iv              text not null check (length(iv) <= 40),
  body            text not null check (length(body) between 1 and 12000),
  keys            text not null check (length(keys) <= 4000),
  created_at      text not null
);
create index if not exists dm_messages_conv_idx on dm_messages (conversation_id, created_at);

-- Gift lists. Everyone has one. Each thing on it is shown to the whole family, or only to the people its owner
-- picks (gift_viewers). A claim ("I'm getting this") is never sent to the list's owner, so surprises stay surprises.
create table if not exists gifts (
  id         text primary key,
  owner_id   text not null references users(id) on delete cascade,
  title      text not null check (length(title) between 1 and 120),
  url        text check (length(url) <= 500),
  note       text check (length(note) <= 500),
  price      text check (length(price) <= 40),
  everyone   integer not null default 1,   -- 0 = only the people in gift_viewers
  created_at text not null
);
create index if not exists gifts_owner_idx on gifts (owner_id, created_at);
create table if not exists gift_viewers (
  gift_id text not null references gifts(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  primary key (gift_id, user_id)
);
create table if not exists gift_claims (
  gift_id    text primary key references gifts(id) on delete cascade,
  user_id    text not null references users(id) on delete cascade,
  created_at text not null
);
-- ============================================================================
-- Pick'em against the spread (worker/pickem.js). Games, lines and finals come from ESPN through the Worker.
-- ============================================================================
create table if not exists pickem_games (
  id              text primary key,   -- ESPN event id
  team            text not null,      -- fb | bb | bears | colts | chiefs
  starts_at       text not null,
  home            text not null,
  away            text not null,
  home_abbr       text,
  away_abbr       text,
  home_line       real,               -- the spread from the home side (-3 = home gives 3); null until posted
  line_at         text,
  line_checked_at text,
  status          text not null default 'pre' check (status in ('pre', 'in', 'final', 'off')),
  home_score      integer,
  away_score      integer,
  checked_at      text
);
create index if not exists pickem_games_starts_idx on pickem_games (starts_at);

-- One pick per person per game. `line` is the home line when the pick was made: it never moves after.
create table if not exists pickem_picks (
  game_id   text not null references pickem_games(id) on delete cascade,
  user_id   text not null references users(id) on delete cascade,
  side      text not null check (side in ('home', 'away')),
  line      real not null,
  picked_at text not null,
  primary key (game_id, user_id)
);

create table if not exists pickem_meta (
  key   text primary key,
  value text not null
);

-- ============================================================================
-- Trips: a get-together that runs over several days, and where each person is staying for it.
-- ============================================================================
create table if not exists gathering_trips (
  gathering_id text primary key references gatherings(id) on delete cascade,
  end_day      text not null -- last day, 'YYYY-MM-DD'
);
create table if not exists stays (
  gathering_id text not null references gatherings(id) on delete cascade,
  user_id      text not null references users(id) on delete cascade,
  place        text not null check (length(place) between 1 and 120), -- "Condo 214", "Sea Pines, unit B"
  updated_at   text not null,
  primary key (gathering_id, user_id)
);

-- Hilton Head, July 17-24, 2027.
insert or ignore into gatherings (id, title, starts_at, time_tbd, created_at)
values ('hilton-head-2027', 'Hilton Head', '2027-07-17T16:00:00.000Z', 1, '2026-11-27T18:00:00.000Z');
insert or ignore into gathering_trips (gathering_id, end_day) values ('hilton-head-2027', '2027-07-24');
