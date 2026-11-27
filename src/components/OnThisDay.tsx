import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react'
import { api } from '../lib/api'
import { useSignedUrls } from '../lib/signedUrls'
import type { Photo } from '../lib/types'
import { useAuth } from '../auth'
import { nameOf } from './Avatar'

const TURN = 6000 // each picture's turn on screen
const MOST = 12
const DAY = 86400_000

/** A steady shuffle: the same order all day, a new one tomorrow. */
function shuffled<T>(list: T[], seed: number) {
  const out = [...list]
  let s = seed || 1
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Home's memory card. Pictures taken on today's date in years past take turns on screen; on a day with none,
 * it turns through older pictures from the family album instead, a different handful each day. Anyone can add
 * an old picture and say when it was taken.
 */
export default function OnThisDay() {
  const { profiles } = useAuth()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  useEffect(() => { api.get<Photo[]>('/photos').then(({ data }) => setPhotos(data ?? [])) }, [])

  const { list, today } = useMemo(() => {
    const now = new Date()
    const pics = (photos ?? []).filter((p) => !p.mime.startsWith('video/'))
    const when = (p: Photo) => new Date(p.taken_at ?? p.created_at)
    const seed = now.getFullYear() * 1000 + Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / DAY)
    const sameDay = pics.filter((p) => {
      const d = when(p)
      return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getFullYear() < now.getFullYear()
    })
    if (sameDay.length) return { list: shuffled(sameDay, seed).slice(0, MOST), today: true }
    // Nothing from this date: older pictures (a month back or more), the oldest years favored by going first.
    const older = pics.filter((p) => now.getTime() - when(p).getTime() > 30 * DAY)
    return { list: shuffled(older, seed).slice(0, MOST), today: false }
  }, [photos])

  useEffect(() => { setAt(0) }, [list])
  useEffect(() => {
    if (held || list.length < 2) return
    const t = setInterval(() => setAt((i) => (i + 1) % list.length), TURN)
    return () => clearInterval(t)
  }, [held, list.length])

  const url = useSignedUrls(list.map((p) => p.path))
  if (photos === null) return null
  const add = <Link to="/gallery?old=1" className="btn ghost sm"><ImagePlus size={15} aria-hidden="true" />Add an old picture</Link>
  if (!list.length) {
    return (
      <section className="card otd otd-empty">
        <div>
          <h2 className="display">On this day</h2>
          <p className="muted small">Old pictures show up here on the day they were taken, and take turns the rest of the year. Dig one out and add it.</p>
        </div>
        {add}
      </section>
    )
  }
  const p = list[Math.min(at, list.length - 1)]
  const taken = new Date(p.taken_at ?? p.created_at)
  const years = new Date().getFullYear() - taken.getFullYear()
  const step = (n: number) => setAt((i) => (i + n + list.length) % list.length)
  return (
    <section className="card otd" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}>
      <div className="otd-head">
        <h2 className="display">{today ? 'On this day' : 'From the family album'}</h2>
        {add}
      </div>
      <div className="otd-stage">
        {list.map((x, i) => {
          const src = url(x.path)
          return src && Math.abs(i - at) <= 1 || i === at ? (
            <Link key={x.id} to={`/gallery?photo=${x.id}`} className={`otd-pic${i === at ? ' on' : ''}`} tabIndex={i === at ? 0 : -1} aria-hidden={i !== at}>
              {src && <img src={src} alt={x.caption ?? 'A family picture'} loading="lazy" decoding="async" />}
            </Link>
          ) : null
        })}
        {list.length > 1 && (
          <>
            <button className="otd-nav prev" onClick={() => step(-1)} aria-label="Previous picture"><ChevronLeft size={20} /></button>
            <button className="otd-nav next" onClick={() => step(1)} aria-label="Next picture"><ChevronRight size={20} /></button>
          </>
        )}
      </div>
      <div className="otd-foot">
        <span>
          <b>{today ? (years === 1 ? 'A year ago today' : `${years} years ago today`) : taken.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
          {p.caption ? ` · ${p.caption}` : ''}
          <span className="muted small"> · added by {nameOf(profiles[p.uploader_id])}</span>
        </span>
        {list.length > 1 && <span className="otd-dots" aria-hidden="true">{list.map((x, i) => <i key={x.id} className={i === at ? 'on' : ''} />)}</span>}
      </div>
    </section>
  )
}
