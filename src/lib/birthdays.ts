import { useSyncExternalStore } from 'react'
import { api } from './api'
import type { ParticleKind } from './marks'

/**
 * Birthdays. On someone's day the whole site wears their own look, they get a happy birthday in the bell,
 * and everyone else is told whose day it is. Who and when live on the server only (this code is public);
 * the last answer is kept on the device so the look is there before the first paint.
 */
export type BirthdayTheme = {
  key: string
  name: string               // "In the garden"
  greeting?: string          // the line under the Home headline
  colors: { bg: string; text: string; gold: string; goldHi: string; rush: string; aged: string; dust: string }
  stripe?: string[]
  particle?: ParticleKind
  motion?: 'fall' | 'rise' | 'twinkle' | 'sway'
  art?: string               // public/art/bg-bday-<art>.webp and hero-bday-<art>.webp, once painted
}
export type Birthday = { event_id: string; md: string; user_id: string | null; name: string; theme: BirthdayTheme | null }

/** The look for anyone without one of their own. */
export const PARTY: BirthdayTheme = {
  key: 'party', name: 'Party time', greeting: 'Cake, candles and the whole family singing off-key.',
  colors: { bg: '#170f24', text: '#fbf3ff', gold: '#ffc94a', goldHi: '#ffdc80', rush: '#ff7eb6', aged: '#5fd0e0', dust: '#f3e3ff' },
  stripe: ['#ff7eb6', '#ffc94a', '#5fd0e0', '#b98cff'], particle: 'confetti', motion: 'fall',
}

const KEY = 'family:birthdays'
let all: Birthday[] = read()
const listeners = new Set<() => void>()

function read(): Birthday[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

/** Fetches the list (signed-in family only). Resolves true when it changed. */
export async function loadBirthdays() {
  const { data } = await api.get<Birthday[]>('/birthdays')
  if (!data) return false
  const next = JSON.stringify(data)
  if (next === JSON.stringify(all)) return false
  all = data
  try { localStorage.setItem(KEY, next) } catch { /* private mode */ }
  listeners.forEach((l) => l())
  return true
}

const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Whose birthday it is today, on the visitor's own clock. */
export const birthdaysOn = (d = new Date()) => all.filter((b) => b.md === md(d))

/** ?bday=nick in the address shows that person's birthday look for one visit, any day of the year. */
export function previewBirthday(): Birthday | null {
  const want = new URLSearchParams(window.location.search).get('bday')?.toLowerCase()
  if (!want) return null
  if (want === 'party') return { event_id: 'preview', md: md(new Date()), user_id: null, name: 'Somebody', theme: null }
  return all.find((b) => b.name.toLowerCase() === want || b.event_id === want || b.event_id === `bday-${want}`) ?? null
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useBirthdays = () => useSyncExternalStore(subscribe, () => all)
