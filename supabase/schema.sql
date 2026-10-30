-- ============================================================================
--  Family Thanksgiving — Supabase schema
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Phone numbers are stored as digits with the country code and no "+", the way Supabase Auth
-- keeps them in auth.users.phone: (317) 555-0123 → 13175550123.
-- ---------------------------------------------------------------------------
create or replace function public.clean_phone(p text)
returns text
language sql immutable set search_path = public
as $$
  select case
    when length(d) = 10 then '1' || d -- US number typed without the 1
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

-- ---------------------------------------------------------------------------
-- Family list. Only phone numbers in here can see or touch anything.
-- Anyone in the family can add another from the site (Family page).
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  phone      text primary key check (phone ~ '^[0-9]{8,15}$'),
  name       text check (char_length(name) <= 40), -- what to call them until they sign in and pick their own
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- However a number gets typed in, it's stored the one way sign-in looks it up.
create or replace function public.clean_member_phone()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.phone := public.clean_phone(new.phone);
  new.name := nullif(trim(new.name), '');
  return new;
end;
$$;

drop trigger if exists members_clean_phone on public.members;
create trigger members_clean_phone
  before insert or update on public.members
  for each row execute function public.clean_member_phone();

create or replace function public.my_phone()
returns text
language sql stable set search_path = public
as $$
  select public.clean_phone(auth.jwt() ->> 'phone');
$$;

create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.members where phone = public.my_phone() and phone <> '');
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per login). Created automatically on first sign-in.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  phone        text,
  display_name text not null default 'Family',
  emoji        text not null default 'turkey', -- avatar badge key
  avatar_path  text,                           -- profile photo: <user id>/avatar/<uuid>.jpg
  onboarded    boolean not null default false,
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (
    new.id,
    public.clean_phone(new.phone),
    coalesce(nullif(trim((select name from public.members where phone = public.clean_phone(new.phone))), ''), 'Family')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Gatherings. Thanksgiving 2026 is seeded below; more (Christmas, next year) can be added from the site.
-- ---------------------------------------------------------------------------
create table if not exists public.gatherings (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 80),
  starts_at  timestamptz not null,
  time_tbd   boolean not null default false,
  place      text check (char_length(place) <= 500), -- whose house / the address
  notes      text check (char_length(notes) <= 500), -- parking, bring a chair, anything else
  created_at timestamptz not null default now()
);
create index if not exists gatherings_starts_idx on public.gatherings (starts_at);

-- ---------------------------------------------------------------------------
-- The two-part list for each gathering: the food, and supplies & help.
-- New gatherings get seeded from list_template (edit it to change the defaults).
-- ---------------------------------------------------------------------------
create table if not exists public.list_template (
  id    serial primary key,
  kind  text not null check (kind in ('food', 'ask')),
  label text not null unique,
  sort  int  not null default 0
);

insert into public.list_template (kind, label, sort) values
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
  ('ask',  'Cleanup crew?',                        120)
on conflict (label) do nothing;

create table if not exists public.list_items (
  id           uuid primary key default gen_random_uuid(),
  gathering_id uuid not null references public.gatherings(id) on delete cascade,
  kind         text not null check (kind in ('food', 'ask')),
  label        text not null check (char_length(label) between 1 and 200),
  note         text check (char_length(note) <= 500),
  owner_id     uuid references public.profiles(id) on delete set null, -- food: who's bringing it · ask: who's on it
  -- Whoever runs the list can say who's bringing what, even for people who aren't on the site.
  -- owner_id = someone on the site · owner_name = anyone else ("Aunt Linda"). The site sets one and clears the other.
  owner_name   text check (char_length(owner_name) <= 40),
  status       text not null default 'open' check (status in ('open', 'yes', 'no')),
  sort         int  not null default 1000,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists list_items_gathering_idx on public.list_items (gathering_id);

create or replace function public.seed_gathering_list()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.list_items (gathering_id, kind, label, sort, created_by)
  select new.id, t.kind, t.label, t.sort, null
  from public.list_template t;
  return new;
end;
$$;

drop trigger if exists gatherings_seed_list on public.gatherings;
create trigger gatherings_seed_list
  after insert on public.gatherings
  for each row execute function public.seed_gathering_list();

-- Thanksgiving 2026: Thursday, November 26. Time to be decided (set it on the site).
insert into public.gatherings (title, starts_at, time_tbd)
select 'Thanksgiving 2026', '2026-11-26 14:00:00 America/Indiana/Indianapolis', true
where not exists (select 1 from public.gatherings where title = 'Thanksgiving 2026');

-- ---------------------------------------------------------------------------
-- Chat. gathering_id set = that gathering's thread · gathering_id null = the family chat.
-- GIFs / pics posted in chat are stored under <user id>/chat/ and aren't shown in the Gallery.
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  gathering_id uuid references public.gatherings(id) on delete cascade,
  author_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body         text not null,
  image_path   text,
  created_at   timestamptz not null default now(),
  constraint messages_body_check check (char_length(body) <= 2000 and (char_length(body) >= 1 or image_path is not null))
);
create index if not exists messages_gathering_idx on public.messages (gathering_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Gallery. Files live in Cloudflare R2 (worker/), or the "gallery" Supabase bucket until that's set up.
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  gathering_id uuid references public.gatherings(id) on delete set null,
  uploader_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  path         text not null unique,          -- original file
  thumb_path   text,                          -- small webp preview (images only)
  mime         text not null default 'image/jpeg',
  caption      text check (char_length(caption) <= 300),
  taken_at     timestamptz,                   -- when the photo or video was actually taken (EXIF / video header)
  content_hash text,                          -- MD5 from the R2 file service, so the same pic from two people stacks
  created_at   timestamptz not null default now()
);
create index if not exists photos_gathering_idx on public.photos (gathering_id, created_at desc);
create index if not exists photos_hash_idx on public.photos (content_hash);

-- ---------------------------------------------------------------------------
-- Password sign-in with a phone number (no texts are sent). Phone confirmation is off in the auth
-- settings, so these are what keep accounts to the family:
--   * only numbers on the family list can create an account
--   * the sign-in page asks phone_status() whether to show "password" or "pick a password"
--   * accounts with no password yet (or reset by someone in the family) pick one on next sign-in
-- ---------------------------------------------------------------------------
create or replace function public.only_family_signups()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.members where phone = public.clean_phone(new.phone) and phone <> '') then
    raise exception 'That phone number is not on the family list';
  end if;
  return new;
end;
$$;

drop trigger if exists only_family_signups on auth.users;
create trigger only_family_signups
  before insert on auth.users
  for each row execute function public.only_family_signups();

-- 'not_member' | 'new' (no account yet) | 'set_password' (account, no password) | 'password'
create or replace function public.phone_status(p_phone text)
returns text
language sql stable security definer set search_path = public, auth
as $$
  select case
    when not exists (select 1 from public.members where phone = public.clean_phone(p_phone)) then 'not_member'
    when not exists (select 1 from auth.users where phone = public.clean_phone(p_phone)) then 'new'
    when exists (select 1 from auth.users where phone = public.clean_phone(p_phone)
                 and coalesce(encrypted_password, '') <> '') then 'password'
    else 'set_password'
  end;
$$;

-- First password for an account that doesn't have one (reset by someone in the family).
create or replace function public.set_first_password(p_phone text, p_password text)
returns void
language plpgsql security definer set search_path = public, auth, extensions
as $$
begin
  if char_length(coalesce(p_password, '')) < 6 then
    raise exception 'Password needs at least 6 characters';
  end if;
  if not exists (select 1 from public.members where phone = public.clean_phone(p_phone)) then
    raise exception 'That phone number is not on the family list';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
         phone_confirmed_at = coalesce(phone_confirmed_at, now()),
         updated_at = now()
   where phone = public.clean_phone(p_phone)
     and coalesce(encrypted_password, '') = '';
  if not found then
    raise exception 'That account already has a password';
  end if;
end;
$$;

-- Forgot it? Anyone in the family can clear someone's password; they pick a new one next sign-in.
create or replace function public.reset_member_password(p_phone text)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_member() then
    raise exception 'Only family can reset passwords';
  end if;
  update auth.users set encrypted_password = '', updated_at = now()
   where phone = public.clean_phone(p_phone);
end;
$$;

revoke all on function public.phone_status(text) from public;
revoke all on function public.set_first_password(text, text) from public;
revoke all on function public.reset_member_password(text) from public;
grant execute on function public.phone_status(text) to anon, authenticated;
grant execute on function public.set_first_password(text, text) to anon, authenticated;
grant execute on function public.reset_member_password(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RSVPs: who's coming, and how many people they're bringing along.
-- One row per person per gathering; change it any time. 'no' stays a row, so "can't make it" shows too.
-- ---------------------------------------------------------------------------
create table if not exists public.rsvps (
  id           uuid primary key default gen_random_uuid(),
  gathering_id uuid not null references public.gatherings(id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  status       text not null check (status in ('yes', 'maybe', 'no')),
  guests       smallint not null default 0 check (guests between 0 and 20), -- people coming with them, not counting themselves
  updated_at   timestamptz not null default now(),
  unique (gathering_id, user_id)
);
create index if not exists rsvps_user_idx on public.rsvps (user_id);

-- ---------------------------------------------------------------------------
-- Per-gathering rollup for the cards.
-- ---------------------------------------------------------------------------
create or replace view public.gathering_stats
with (security_invoker = true) as
select
  g.id as gathering_id,
  (select count(*) from public.messages m where m.gathering_id = g.id)                                 as message_count,
  (select count(*) from public.photos p where p.gathering_id = g.id)                                   as photo_count,
  (select count(*) from public.list_items i where i.gathering_id = g.id and i.kind = 'food')           as food_total,
  (select count(*) from public.list_items i where i.gathering_id = g.id and i.kind = 'food'
     and (i.owner_id is not null or i.owner_name is not null))                                         as food_claimed,
  (select count(*) from public.list_items i where i.gathering_id = g.id and i.kind = 'ask' and i.status = 'open') as asks_open,
  -- Headcount: everyone who said yes plus the people they're bringing.
  (select coalesce(sum(1 + r.guests), 0) from public.rsvps r where r.gathering_id = g.id and r.status = 'yes')::int as coming,
  (select count(*) from public.rsvps r where r.gathering_id = g.id and r.status = 'maybe')             as maybe
from public.gatherings g;

-- ---------------------------------------------------------------------------
-- Food ratings, 1–10, anonymous. One rating per person per dish; change or clear it any time.
-- Nobody can read anyone else's rating, not even through the API: you only ever see your own row.
-- The total and count live on list_items (rating_sum / rating_count), kept up by a trigger, so the
-- average reaches everyone live with the list and never says who gave what.
-- ---------------------------------------------------------------------------
alter table public.list_items add column if not exists rating_sum   int not null default 0;
alter table public.list_items add column if not exists rating_count int not null default 0;

create table if not exists public.food_ratings (
  item_id uuid not null references public.list_items(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  score   smallint not null check (score between 1 and 10),
  primary key (item_id, user_id)
);

-- Adjust the totals by the change (not a recount), so two people rating at once can't lose a vote.
create or replace function public.sync_food_rating()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('tg.rating_sync', 'on', true);
  if tg_op in ('UPDATE', 'DELETE') then
    update public.list_items set rating_sum = rating_sum - old.score, rating_count = rating_count - 1
    where id = old.item_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.list_items set rating_sum = rating_sum + new.score, rating_count = rating_count + 1
    where id = new.item_id;
  end if;
  perform set_config('tg.rating_sync', 'off', true);
  return null;
end;
$$;

drop trigger if exists food_ratings_sync on public.food_ratings;
create trigger food_ratings_sync
  after insert or update or delete on public.food_ratings
  for each row execute function public.sync_food_rating();

-- Anyone can edit list items, so only the trigger above may touch the totals.
create or replace function public.guard_rating_totals()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.rating_sum := 0;
    new.rating_count := 0;
  elsif coalesce(current_setting('tg.rating_sync', true), '') <> 'on' then
    new.rating_sum := old.rating_sum;
    new.rating_count := old.rating_count;
  end if;
  return new;
end;
$$;

drop trigger if exists list_items_guard_ratings on public.list_items;
create trigger list_items_guard_ratings
  before insert or update on public.list_items
  for each row execute function public.guard_rating_totals();

-- ---------------------------------------------------------------------------
-- Photo comments: a thread under every photo and video.
-- ---------------------------------------------------------------------------
create table if not exists public.photo_comments (
  id         uuid primary key default gen_random_uuid(),
  photo_id   uuid not null references public.photos(id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists photo_comments_photo_idx on public.photo_comments (photo_id, created_at);

-- ---------------------------------------------------------------------------
-- Emoji reactions on photos, chat messages and photo comments. One row per person per emoji per thing.
-- owner_id is whose thing it is (filled in here, not by the site), so the bell can say "reacted to your photo".
-- ---------------------------------------------------------------------------
create table if not exists public.reactions (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('photo', 'message', 'comment')),
  target_id   uuid not null,
  owner_id    uuid references public.profiles(id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id, emoji)
);
create index if not exists reactions_target_idx on public.reactions (target_id);
create index if not exists reactions_owner_idx on public.reactions (owner_id, created_at desc);

create or replace function public.reaction_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.owner_id := case new.target_type
    when 'photo'   then (select uploader_id from public.photos where id = new.target_id)
    when 'message' then (select author_id from public.messages where id = new.target_id)
    when 'comment' then (select author_id from public.photo_comments where id = new.target_id)
  end;
  if new.owner_id is null then
    raise exception 'That is gone';
  end if;
  return new;
end;
$$;

drop trigger if exists reaction_owner on public.reactions;
create trigger reaction_owner
  before insert on public.reactions
  for each row execute function public.reaction_owner();

-- Deleting a photo, message or comment takes its reactions with it (whoever left them).
create or replace function public.drop_reactions()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.reactions where target_id = old.id;
  return old;
end;
$$;

drop trigger if exists photos_drop_reactions on public.photos;
create trigger photos_drop_reactions after delete on public.photos
  for each row execute function public.drop_reactions();
drop trigger if exists messages_drop_reactions on public.messages;
create trigger messages_drop_reactions after delete on public.messages
  for each row execute function public.drop_reactions();
drop trigger if exists photo_comments_drop_reactions on public.photo_comments;
create trigger photo_comments_drop_reactions after delete on public.photo_comments
  for each row execute function public.drop_reactions();

-- ---------------------------------------------------------------------------
-- Row-level security: family only.
-- The checks are wrapped in (select …) so Postgres runs them once per query instead of once per row.
-- ---------------------------------------------------------------------------
alter table public.members        enable row level security;
alter table public.profiles       enable row level security;
alter table public.gatherings     enable row level security;
alter table public.list_template  enable row level security;
alter table public.list_items     enable row level security;
alter table public.messages       enable row level security;
alter table public.photos         enable row level security;
alter table public.rsvps          enable row level security;
alter table public.food_ratings   enable row level security;
alter table public.photo_comments enable row level security;
alter table public.reactions      enable row level security;

-- members: family can see the list, add people and fix a name; remove anyone but yourself.
drop policy if exists members_select on public.members;
drop policy if exists members_insert on public.members;
drop policy if exists members_update on public.members;
drop policy if exists members_delete on public.members;
create policy members_select on public.members for select to authenticated using ((select public.is_member()));
create policy members_insert on public.members for insert to authenticated with check ((select public.is_member()));
revoke update on public.members from anon, authenticated;
grant update (name) on public.members to authenticated;
create policy members_update on public.members for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy members_delete on public.members for delete to authenticated
  using ((select public.is_member()) and phone <> (select public.my_phone()));

-- profiles: family can see everyone; you edit only yourself
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using ((select public.is_member()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_member())) with check (id = (select auth.uid()));

-- gatherings: family can read, add, and edit the details. Deleting one is done in SQL only
-- (it takes the lists, chat and photo tags with it).
drop policy if exists gatherings_select on public.gatherings;
drop policy if exists gatherings_insert on public.gatherings;
drop policy if exists gatherings_update on public.gatherings;
create policy gatherings_select on public.gatherings for select to authenticated using ((select public.is_member()));
create policy gatherings_insert on public.gatherings for insert to authenticated with check ((select public.is_member()));
create policy gatherings_update on public.gatherings for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
revoke delete on public.gatherings from anon, authenticated;

-- list template: readable (edit it in the SQL editor)
drop policy if exists list_template_select on public.list_template;
create policy list_template_select on public.list_template for select to authenticated using ((select public.is_member()));

-- list items: anyone in the family can add, claim, answer, edit, or remove
drop policy if exists list_items_select on public.list_items;
drop policy if exists list_items_insert on public.list_items;
drop policy if exists list_items_update on public.list_items;
drop policy if exists list_items_delete on public.list_items;
create policy list_items_select on public.list_items for select to authenticated using ((select public.is_member()));
create policy list_items_insert on public.list_items for insert to authenticated with check ((select public.is_member()));
create policy list_items_update on public.list_items for update to authenticated using ((select public.is_member())) with check ((select public.is_member()));
create policy list_items_delete on public.list_items for delete to authenticated using ((select public.is_member()));

-- food ratings: see, add, change and clear only your own, and only on food
drop policy if exists food_ratings_select on public.food_ratings;
drop policy if exists food_ratings_insert on public.food_ratings;
drop policy if exists food_ratings_update on public.food_ratings;
drop policy if exists food_ratings_delete on public.food_ratings;
create policy food_ratings_select on public.food_ratings for select to authenticated
  using ((select public.is_member()) and user_id = (select auth.uid()));
create policy food_ratings_insert on public.food_ratings for insert to authenticated
  with check ((select public.is_member()) and user_id = (select auth.uid())
              and exists (select 1 from public.list_items i where i.id = item_id and i.kind = 'food'));
create policy food_ratings_update on public.food_ratings for update to authenticated
  using ((select public.is_member()) and user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.list_items i where i.id = item_id and i.kind = 'food'));
create policy food_ratings_delete on public.food_ratings for delete to authenticated
  using ((select public.is_member()) and user_id = (select auth.uid()));
revoke all on public.food_ratings from anon;

-- rsvps: the family sees everyone's; you set, change and clear only your own
drop policy if exists rsvps_select on public.rsvps;
drop policy if exists rsvps_insert on public.rsvps;
drop policy if exists rsvps_update on public.rsvps;
drop policy if exists rsvps_delete on public.rsvps;
create policy rsvps_select on public.rsvps for select to authenticated using ((select public.is_member()));
create policy rsvps_insert on public.rsvps for insert to authenticated
  with check ((select public.is_member()) and user_id = (select auth.uid()));
create policy rsvps_update on public.rsvps for update to authenticated
  using ((select public.is_member()) and user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy rsvps_delete on public.rsvps for delete to authenticated
  using ((select public.is_member()) and user_id = (select auth.uid()));
revoke all on public.rsvps from anon;

-- messages: post as yourself; delete only your own
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_delete on public.messages;
create policy messages_select on public.messages for select to authenticated using ((select public.is_member()));
create policy messages_insert on public.messages for insert to authenticated
  with check ((select public.is_member()) and author_id = (select auth.uid()));
create policy messages_delete on public.messages for delete to authenticated
  using ((select public.is_member()) and author_id = (select auth.uid()));

-- photos: upload as yourself; edit caption / delete only your own
drop policy if exists photos_select on public.photos;
drop policy if exists photos_insert on public.photos;
drop policy if exists photos_update on public.photos;
drop policy if exists photos_delete on public.photos;
create policy photos_select on public.photos for select to authenticated using ((select public.is_member()));
create policy photos_insert on public.photos for insert to authenticated
  with check ((select public.is_member()) and uploader_id = (select auth.uid()));
create policy photos_update on public.photos for update to authenticated
  using ((select public.is_member()) and uploader_id = (select auth.uid())) with check (uploader_id = (select auth.uid()));
create policy photos_delete on public.photos for delete to authenticated
  using ((select public.is_member()) and uploader_id = (select auth.uid()));

-- photo comments: post as yourself; delete only your own
drop policy if exists photo_comments_select on public.photo_comments;
drop policy if exists photo_comments_insert on public.photo_comments;
drop policy if exists photo_comments_delete on public.photo_comments;
create policy photo_comments_select on public.photo_comments for select to authenticated using ((select public.is_member()));
create policy photo_comments_insert on public.photo_comments for insert to authenticated
  with check ((select public.is_member()) and author_id = (select auth.uid()));
create policy photo_comments_delete on public.photo_comments for delete to authenticated
  using ((select public.is_member()) and author_id = (select auth.uid()));
revoke update on public.photo_comments from anon, authenticated;

-- reactions: react as yourself; take back only your own; never edited
drop policy if exists reactions_select on public.reactions;
drop policy if exists reactions_insert on public.reactions;
drop policy if exists reactions_delete on public.reactions;
create policy reactions_select on public.reactions for select to authenticated using ((select public.is_member()));
create policy reactions_insert on public.reactions for insert to authenticated
  with check ((select public.is_member()) and user_id = (select auth.uid()));
create policy reactions_delete on public.reactions for delete to authenticated
  using ((select public.is_member()) and user_id = (select auth.uid()));
revoke update on public.reactions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fallback storage bucket (private; the site uses signed URLs). Only used until the Cloudflare R2
-- file service is set up (worker/README.md). Files go under "<your user id>/…".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gallery_select on storage.objects;
drop policy if exists gallery_insert on storage.objects;
drop policy if exists gallery_delete on storage.objects;
create policy gallery_select on storage.objects for select to authenticated
  using (bucket_id = 'gallery' and public.is_member());
create policy gallery_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and public.is_member()
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy gallery_delete on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.is_member()
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Function access (Supabase's security advisor).
-- Trigger functions run when their trigger fires no matter who holds EXECUTE, so nobody needs to call them
-- through the API. is_member backs the signed-in policies; reset is for signed-in family only.
-- phone_status and set_first_password stay open to signed-out visitors: the sign-in page needs them.
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user()       from public, anon, authenticated;
revoke execute on function public.clean_member_phone()    from public, anon, authenticated;
revoke execute on function public.seed_gathering_list()   from public, anon, authenticated;
revoke execute on function public.only_family_signups()   from public, anon, authenticated;
revoke execute on function public.sync_food_rating()      from public, anon, authenticated;
revoke execute on function public.guard_rating_totals()   from public, anon, authenticated;
revoke execute on function public.reaction_owner()        from public, anon, authenticated;
revoke execute on function public.drop_reactions()        from public, anon, authenticated;
revoke execute on function public.is_member()             from public, anon;
revoke execute on function public.my_phone()              from public, anon;
revoke execute on function public.reset_member_password(text) from anon;
grant  execute on function public.is_member() to authenticated;
grant  execute on function public.my_phone()  to authenticated;

-- Indexes on the "who" columns, so removing someone (and these lookups) don't scan whole tables.
create index if not exists food_ratings_user_idx     on public.food_ratings (user_id);
create index if not exists list_items_owner_idx      on public.list_items (owner_id);
create index if not exists list_items_created_by_idx on public.list_items (created_by);
create index if not exists members_invited_by_idx    on public.members (invited_by);
create index if not exists messages_author_idx       on public.messages (author_id);
create index if not exists photo_comments_author_idx on public.photo_comments (author_id);
create index if not exists photos_uploader_idx       on public.photos (uploader_id);
create index if not exists reactions_user_idx        on public.reactions (user_id);

-- ---------------------------------------------------------------------------
-- Realtime: push changes to everyone's screen live.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['messages', 'list_items', 'photos', 'gatherings', 'profiles', 'photo_comments', 'reactions', 'rsvps'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- FIRST RUN: add yourself so you can get in, then add the rest of the family from the site.
--   insert into public.members (phone, name) values (public.clean_phone('(317) 555-0123'), 'Your Name');
-- ---------------------------------------------------------------------------
