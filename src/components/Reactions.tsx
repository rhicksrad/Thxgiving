import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SmilePlus, X } from 'lucide-react'
import type { Reaction } from '../lib/types'
import { useAuth } from '../auth'
import { Avatar, nameOf } from './Avatar'

const QUICK = ['👍', '❤️', '😂', '🔥', '😮', '😢', '🍺', '🚂']
const MORE = [
  '🙌', '👏', '💯', '🎉', '🥳', '😎', '🤣', '😍', '🤘', '💪', '🤝', '🫡',
  '👀', '🤔', '😬', '🙈', '💀', '😴', '🤮', '🥶', '🥵', '🐐', '🏆', '🏈',
  '🍻', '🥃', '🍔', '🌭', '🍗', '🍕', '🔨', '⚙️', '🎯', '🎶', '📸', '💛',
  '🖤', '☀️', '🌧️', '🥇', '🤡', '😤', '😇', '🫠',
]
// One emoji (flags, skin tones and joined ones like 👨‍👩‍👧 included), nothing else.
const ONE_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:[\u{FE0F}\u{200D}\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u{20E3}])*$/u

type Group = { emoji: string; users: string[]; mine: boolean }

const groupOf = (list: Reaction[], myId?: string): Group[] => {
  const m = new Map<string, Group>()
  for (const r of list) {
    const g = m.get(r.emoji) ?? { emoji: r.emoji, users: [], mine: false }
    g.users.push(r.user_id)
    if (r.user_id === myId) g.mine = true
    m.set(r.emoji, g)
  }
  return [...m.values()]
}

/**
 * Emoji chips under a photo, message or comment: tap one to add or take back yours. The smiley opens the
 * picker, which also lists who reacted with what.
 */
export function ReactionBar({ list, onToggle, always = false }: {
  list: Reaction[]; onToggle: (emoji: string) => void; always?: boolean // always: show the smiley even with none yet
}) {
  const { me, profiles } = useAuth()
  const [picking, setPicking] = useState(false)
  const groups = groupOf(list, me?.id)
  if (!groups.length && !always && !picking) return null
  const names = (g: Group) => g.users.map((id) => (id === me?.id ? 'You' : nameOf(profiles[id]))).join(', ')
  return (
    <div className="reactions">
      {groups.map((g) => (
        <button key={g.emoji} type="button" className={`react-chip ${g.mine ? 'on' : ''}`} title={names(g)}
          aria-label={`${g.emoji} ${g.users.length}: ${names(g)}${g.mine ? '. Tap to take yours back' : '. Tap to add yours'}`}
          aria-pressed={g.mine} onClick={() => onToggle(g.emoji)}>
          <span className="react-emoji">{g.emoji}</span>{g.users.length}
        </button>
      ))}
      <button type="button" className="react-add" title="React" aria-label="Add a reaction" onClick={() => setPicking(true)}>
        <SmilePlus size={15} aria-hidden="true" />
      </button>
      {picking && <ReactionPicker list={list} onPick={(e) => { onToggle(e); setPicking(false) }} onClose={() => setPicking(false)} />}
    </div>
  )
}

/** Just the smiley, for things with no reactions yet (the chips show up once there's one). */
export function ReactButton({ list, onToggle, className = '' }: { list: Reaction[]; onToggle: (emoji: string) => void; className?: string }) {
  const [picking, setPicking] = useState(false)
  return (
    <>
      <button type="button" className={className} title="React" aria-label="Add a reaction" onClick={() => setPicking(true)}>
        <SmilePlus size={14} aria-hidden="true" />
      </button>
      {picking && <ReactionPicker list={list} onPick={(e) => { onToggle(e); setPicking(false) }} onClose={() => setPicking(false)} />}
    </>
  )
}

/** Quick picks, a bigger set, a box for any emoji off the keyboard, and who reacted with what. */
export function ReactionPicker({ list, onPick, onClose }: { list: Reaction[]; onPick: (emoji: string) => void; onClose: () => void }) {
  const { me, profiles } = useAuth()
  const [typed, setTyped] = useState('')
  const groups = groupOf(list, me?.id)
  const mine = new Set(groups.filter((g) => g.mine).map((g) => g.emoji))
  const custom = typed.trim()
  const customOk = ONE_EMOJI.test(custom)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const pick = (emoji: string) => (
    <button key={emoji} type="button" className={`pick ${mine.has(emoji) ? 'on' : ''}`} onClick={() => onPick(emoji)}
      aria-label={mine.has(emoji) ? `Take back ${emoji}` : `React ${emoji}`}>{emoji}</button>
  )

  // Portaled so a scrolling chat or the photo viewer can't clip it. React still bubbles events up to whatever
  // opened it, so they stop here (a tap shouldn't also close the photo viewer or swipe to the next pic).
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return createPortal(
    <div className="react-sheet-wrap" onClick={(e) => { stop(e); onClose() }} onTouchStart={stop} onTouchEnd={stop} onKeyDown={stop}>
      <div className="react-sheet card" role="dialog" aria-label="React" onClick={stop}>
        <div className="react-sheet-head">
          <span className="bell-title">React</span>
          <button type="button" className="btn ghost icon sm" aria-label="Close" onClick={onClose}><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="pick-row">{QUICK.map(pick)}</div>
        <div className="pick-grid">{MORE.map(pick)}</div>
        <form className="pick-custom" onSubmit={(e) => { e.preventDefault(); if (customOk) onPick(custom) }}>
          <input className="input" value={typed} maxLength={16} placeholder="Or type any emoji" aria-label="Any emoji"
            onChange={(e) => setTyped(e.target.value)} />
          <button className="btn gold sm" disabled={!customOk}>Add</button>
        </form>
        {groups.length > 0 && (
          <div className="react-who">
            {groups.map((g) => (
              <div key={g.emoji} className="react-who-row">
                <span className="react-emoji">{g.emoji}</span>
                <span className="react-who-names">
                  {g.users.map((id) => (
                    <span key={id} className="icon-text"><Avatar p={profiles[id]} size={18} />{id === me?.id ? 'You' : nameOf(profiles[id])}</span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
