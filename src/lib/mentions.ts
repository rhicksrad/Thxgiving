import type { Profile } from './types'

// Tags are stored in the message body as <@user-id> (or <@family> for everybody), so they keep
// pointing at the right person when someone changes their name. The composer shows plain @Name.
export const EVERYONE = 'family'
export const TOKEN_RE = /<@([0-9a-f-]{36}|family)>/g

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "@Aunt Sue who's bringing pie @family" → "<@id> who's bringing pie <@family>". Longest names first so "@Aunt Sue" beats "@Aunt". */
export function encodeMentions(text: string, profiles: Profile[]) {
  const named = [...profiles, { id: EVERYONE, display_name: EVERYONE } as Profile]
    .filter((p) => p.display_name.trim())
    .sort((a, b) => b.display_name.length - a.display_name.length)
  let out = text
  for (const p of named) {
    out = out.replace(new RegExp(`@${escape(p.display_name.trim())}(?![\\p{L}\\p{N}_])`, 'giu'), `<@${p.id}>`)
  }
  return out
}

export const mentionsMe = (body: string, myId?: string) =>
  Boolean(myId) && (body.includes(`<@${myId}>`) || body.includes(`<@${EVERYONE}>`))

/** Body as plain text with tags turned back into @Names (for previews). */
export const plainMentions = (body: string, profiles: Record<string, Profile>) =>
  body.replace(TOKEN_RE, (_, id: string) => `@${id === EVERYONE ? EVERYONE : profiles[id]?.display_name ?? 'someone'}`)
