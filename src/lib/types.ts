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
