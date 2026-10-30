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

-- The starter lists every new gathering gets. Edit these to change the defaults.
create table if not exists list_template (
  kind  text not null check (kind in ('food', 'ask')),
  label text not null unique,
  sort  integer not null default 0
);

insert or ignore into list_template (kind, label, sort) values
  ('food', 'Turkey',                                10),
  ('food', 'Ham',                                   20),
  ('food', 'Stuffing / dressing',                   30),
  ('food', 'Mashed potatoes',                       40),
  ('food', 'Gravy',                                 50),
  ('food', 'Sweet potato casserole',                60),
  ('food', 'Green bean casserole',                  70),
  ('food', 'Mac & cheese',                          80),
  ('food', 'Corn',                                  90),
  ('food', 'Cranberry sauce',                      100),
  ('food', 'Rolls & butter',                       110),
  ('food', 'Salad',                                120),
  ('food', 'Deviled eggs',                         130),
  ('food', 'Appetizers / veggie tray',             140),
  ('food', 'Pumpkin pie',                          150),
  ('food', 'Pecan pie',                            160),
  ('food', 'Another dessert',                      170),
  ('food', 'Whipped cream',                        180),
  ('food', 'Drinks (pop, juice, tea)',             190),
  ('food', 'Wine / beer',                          200),
  ('food', 'Coffee & creamer',                     210),
  ('ask',  'Who''s hosting?',                       10),
  ('ask',  'Who''s carving the turkey?',            20),
  ('ask',  'Enough tables & chairs?',               30),
  ('ask',  'Kids'' table set up?',                  40),
  ('ask',  'Plates, cups, napkins, silverware?',    50),
  ('ask',  'Serving spoons & dishes?',              60),
  ('ask',  'Ice & coolers?',                        70),
  ('ask',  'Leftover containers / foil?',           80),
  ('ask',  'Football on the TV?',                   90),
  ('ask',  'Who''s saying grace?',                 100),
  ('ask',  'Family photo: who''s taking it?',      110),
  ('ask',  'Cleanup crew?',                        120);

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

-- Thanksgiving 2026: Thursday, November 26, time to be decided (noon Eastern until someone sets it).
-- Its starter lists are copied from list_template, once.
insert or ignore into gatherings (id, title, starts_at, time_tbd, created_at)
values ('thanksgiving-2026', 'Thanksgiving 2026', '2026-11-26T17:00:00.000Z', 1, '2026-10-30T00:00:00.000Z');

insert into list_items (id, gathering_id, kind, label, sort, created_at)
select lower(hex(randomblob(16))), 'thanksgiving-2026', t.kind, t.label, t.sort, '2026-10-30T00:00:00.000Z'
from list_template t
where not exists (select 1 from list_items where gathering_id = 'thanksgiving-2026');

-- FIRST RUN: add yourself so you can sign in, then add everyone else from the Family page:
--   npx wrangler d1 execute thxgiving --remote --command "insert into members (phone, name, created_at) values ('13175550123', 'Your Name', datetime('now'))"
