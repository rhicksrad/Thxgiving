export type Profile = {
  id: string
  phone: string | null
  display_name: string
  emoji: string               // avatar badge key (Avatar.tsx)
  avatar_path?: string | null // profile photo, under <user id>/avatar/
  onboarded: boolean
  created_at?: string         // when they signed up
}

export type Gathering = {
  id: string
  title: string             // "Thanksgiving 2026"
  starts_at: string
  time_tbd: boolean         // date set, time not yet
  archived: boolean         // moved to Home's Archive
  ends_on?: string | null   // a trip's last day ('YYYY-MM-DD'); unset for a one-day get-together
  place: string | null      // whose house / the address
  notes: string | null      // parking, bring a chair, anything else
  created_at?: string
}

export type GatheringStats = {
  gathering_id: string
  message_count: number
  photo_count: number
  food_total: number
  food_claimed: number
  asks_open: number
  coming: number // headcount: yeses plus who they're bringing
  maybe: number
}

export type RsvpStatus = 'yes' | 'maybe' | 'no'

export type Rsvp = {
  id: string
  gathering_id: string
  user_id: string
  status: RsvpStatus
  guests: number // people coming with them, not counting themselves
  updated_at: string
}

export type ListKind = 'food' | 'ask'

export type ListItem = {
  id: string
  gathering_id: string
  kind: ListKind
  label: string
  note: string | null
  owner_id: string | null
  owner_name: string | null // someone not on the site
  status: 'open' | 'yes' | 'no'
  sort: number
  created_by: string | null
  created_at: string
  // Food ratings, anonymous: just the total and how many rated.
  rating_sum: number
  rating_count: number
}

export type Message = {
  id: string
  gathering_id: string | null
  author_id: string
  body: string
  image_path: string | null
  created_at: string
}

export type Photo = {
  id: string
  gathering_id: string | null
  uploader_id: string
  path: string
  thumb_path: string | null
  mime: string
  caption: string | null
  taken_at: string | null // when the shot was taken (from the file), if it said
  content_hash?: string | null // MD5 of the file, so the same pic uploaded twice shows once
  created_at: string
}

export type PhotoComment = {
  id: string
  photo_id: string
  author_id: string
  body: string
  created_at: string
}

export type ReactionTarget = 'photo' | 'message' | 'comment'

export type Reaction = {
  id: string
  target_type: ReactionTarget
  target_id: string
  owner_id: string | null // whose photo / message / comment it is
  user_id: string         // who reacted
  emoji: string
  created_at: string
}

export type FamilyEvent = {
  id: string
  title: string
  day: string          // YYYY-MM-DD, the family's local day
  time: string | null  // HH:MM, or null for all day
  yearly: boolean      // repeats every year (birthdays, anniversaries)
  end_day: string | null      // last day of a multi-day event (trips), or null
  note: string | null
  created_by: string
  created_at: string
}

/** One thing on someone's gift list. On your own you get `viewers` and never who's getting it; on other people's, the reverse. */
export type Gift = {
  id: string
  owner_id: string
  title: string
  url: string | null
  note: string | null
  price: string | null
  everyone: boolean          // the whole family can see it
  viewers: string[] | null   // when not everyone: who can (your own list only)
  claimed_by: string | null  // who said they're getting it (never sent for your own list)
  created_at: string
}
