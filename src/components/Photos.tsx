import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { downloadZip } from 'client-zip'
import { ChevronLeft, ChevronRight, Download, ImagePlus, Layers, MessageSquare, Play, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fileHashes, removeFiles, signFiles, uploadFile } from '../lib/storage'
import { useSignedUrls } from '../lib/signedUrls'
import { extOf, makeThumb, saveAs } from '../lib/images'
import { fileReader, takenAt, urlReader } from '../lib/takenAt'
import { when } from '../lib/format'
import type { Gathering, Photo } from '../lib/types'
import { useAuth } from '../auth'
import { Avatar, nameOf } from './Avatar'
import { useReactions } from '../lib/reactions'
import { ReactionBar } from './Reactions'
import { PhotoComments, useCommentCounts, usePhotoComments } from './PhotoComments'

export const isVideo = (p: Photo) => p.mime.startsWith('video/')
const DAY = 86400_000
/**
 * When a pic was taken. A pic tagged to a gathering whose file says it was made more than a day after it started was
 * re-saved later (texted, AirDropped, exported), so its file date is when it was shared: use the start instead.
 */
export const shotAt = (p: Photo, gathering?: Gathering) => {
  const t = p.taken_at ?? p.created_at
  if (gathering && new Date(t).getTime() > new Date(gathering.starts_at).getTime() + DAY) return gathering.starts_at
  return t
}
/** In the order they were taken: oldest first (the day as it happened), or newest first. */
export const byShot = (photos: Photo[], gatherings: Record<string, Gathering>, newestFirst = false) => {
  const at = new Map(photos.map((p) => [p.id, new Date(shotAt(p, p.gathering_id ? gatherings[p.gathering_id] : undefined)).getTime()]))
  return [...photos].sort((a, b) => (at.get(a.id)! - at.get(b.id)!) * (newestFirst ? -1 : 1))
}

/** A tile: one pic, plus every copy of the same file anyone uploaded (itself included, first-uploaded first). */
export type Shot = Photo & { copies: Photo[] }

/**
 * Folds identical files into one tile, by content hash. The first upload is the one shown; the rest ride along
 * so the lightbox can list everyone who added it. Keeps the order it's given.
 */
export const stackDupes = (photos: Photo[], hashOf: (p: Photo) => string | null | undefined): Shot[] => {
  const groups = new Map<string, Photo[]>()
  for (const p of photos) {
    const k = hashOf(p) ?? p.id
    const g = groups.get(k)
    if (g) g.push(p)
    else groups.set(k, [p])
  }
  const shots: Shot[] = []
  for (const p of photos) {
    const g = groups.get(hashOf(p) ?? p.id)!
    const copies = [...g].sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (copies[0].id === p.id) shots.push({ ...p, copies })
  }
  return shots
}

/**
 * Each pic's content hash: saved with the row at upload, else asked of the file service (it already knows every
 * file's MD5) for older pics. Your own older pics get theirs saved, so it's only asked once.
 */
const knownHashes = new Map<string, string | null>()
export function useContentHashes(photos: Photo[] | null) {
  const { me } = useAuth()
  const [seen, bump] = useState(0)
  useEffect(() => {
    const todo = (photos ?? []).filter((p) => !p.content_hash && !knownHashes.has(p.path))
    if (!todo.length) return
    todo.forEach((p) => knownHashes.set(p.path, null))
    ;(async () => {
      try {
        for (let i = 0; i < todo.length; i += 1000) {
          const found = await fileHashes(todo.slice(i, i + 1000).map((p) => p.path))
          Object.entries(found).forEach(([path, h]) => knownHashes.set(path, h))
        }
      } catch { todo.forEach((p) => knownHashes.delete(p.path)); return } // try again next visit
      bump((n) => n + 1) // even if the list changed meanwhile: these are cached, so no later run would show them
      for (const p of todo) {
        const h = knownHashes.get(p.path)
        if (h && p.uploader_id === me?.id) await supabase.from('photos').update({ content_hash: h }).eq('id', p.id)
      }
    })()
  }, [photos, me?.id])
  // A new function once more hashes are in, so stacks built from it are redone.
  return useCallback((p: Photo) => p.content_hash ?? knownHashes.get(p.path) ?? null, [seen])
}

/**
 * Near-duplicates: a pic re-shared by text or AirDrop (re-saved, so a different hash) or a quick run of
 * near-identical shots of the same moment. Pics whose camera times are within a few seconds and whose previews
 * look alike (a tiny 64-bit fingerprint) stack, whoever added them. Every copy can still be opened from the
 * lightbox. Tuned on real phone pics: re-shared copies differ by 0 bits, a run of the same shot by up to 15,
 * different shots seconds apart by 22 or more.
 */
const NEAR_MS = 3000
const LOOK_ALIKE = 16 // of 64 bits that may differ
const SAME_SECOND_LOOK_ALIKE = 20 // two people, camera times to the same second: almost surely one pic re-shared
const looks = new Map<string, Uint8Array | null>() // preview path -> 64-bit difference hash

async function lookOf(url: string) {
  const res = await fetch(url)
  if (!res.ok) return null
  const bmp = await createImageBitmap(await res.blob())
  // Shrink to 72x64, then average each 8x8 block down to 9x8: a straight shrink to 9x8 samples only a few
  // pixels, which makes the fingerprint jumpy.
  const canvas = document.createElement('canvas')
  canvas.width = 72; canvas.height = 64
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, 72, 64)
  bmp.close()
  const px = ctx.getImageData(0, 0, 72, 64).data
  const gray = (x: number, y: number) => {
    let sum = 0
    for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
      const i = ((y * 8 + dy) * 72 + x * 8 + dx) * 4
      sum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
    }
    return sum
  }
  const bits = new Uint8Array(64)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits[y * 8 + x] = gray(x, y) < gray(x + 1, y) ? 1 : 0
  return bits
}

const realTime = (p: Photo) => (p.taken_at && p.taken_at !== p.created_at ? new Date(p.taken_at).getTime() : null)

/** Pairs of pics taken within NEAR_MS of each other: the ones worth comparing by look. */
function nearPairs(photos: Photo[]) {
  const timed = photos.filter((p) => p.thumb_path && realTime(p) !== null).sort((a, b) => realTime(a)! - realTime(b)!)
  const pairs: [Photo, Photo][] = []
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length && realTime(timed[j])! - realTime(timed[i])! <= NEAR_MS; j++) {
      const a = timed[i], b = timed[j]
      if (isVideo(a) === isVideo(b)) pairs.push([a, b])
    }
  }
  return pairs
}

/** What to stack pics by: same file, or the same shot re-shared by someone else. */
export function useStackKeys(photos: Photo[] | null) {
  const hashOf = useContentHashes(photos)
  const [seen, bump] = useState(0)
  const pairs = useMemo(() => nearPairs(photos ?? []), [photos])
  useEffect(() => {
    const todo = [...new Set(pairs.flat().map((p) => p.thumb_path!))].filter((t) => !looks.has(t))
    if (!todo.length) return
    todo.forEach((t) => looks.set(t, null))
    // Always re-render when done, even if the list changed meanwhile (saving hashes does that): the results are
    // cached by path, so a later run skips them and nothing else would show them.
    ;(async () => {
      try {
        const links = await signFiles(todo, 600)
        await Promise.all(links.map(async (l) => { try { looks.set(l.path, await lookOf(l.url)) } catch { looks.delete(l.path) } }))
      } catch { todo.forEach((t) => looks.delete(t)); return }
      bump((n) => n + 1)
    })()
  }, [pairs])

  return useMemo(() => {
    const parent = new Map<string, string>()
    const find = (k: string): string => { const up = parent.get(k); if (!up || up === k) return k; const r = find(up); parent.set(k, r); return r }
    const join = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra) }
    const own = (p: Photo) => hashOf(p) ?? p.id
    for (const [a, b] of pairs) {
      const la = looks.get(a.thumb_path!), lb = looks.get(b.thumb_path!)
      if (!la || !lb) continue
      let diff = 0
      for (let i = 0; i < 64; i++) diff += la[i] ^ lb[i]
      const sameSecond = a.uploader_id !== b.uploader_id && Math.abs(realTime(a)! - realTime(b)!) < 1000
      if (diff <= (sameSecond ? SAME_SECOND_LOOK_ALIKE : LOOK_ALIKE)) join(own(a), own(b))
    }
    return (p: Photo) => find(own(p))
  }, [pairs, hashOf, seen]) // eslint-disable-line react-hooks/exhaustive-deps
}

const fileName = (p: Photo, gathering?: Gathering) => {
  const ext = p.path.split('.').pop()
  const stamp = new Date(shotAt(p, gathering)).toISOString().slice(0, 19).replace(/[T:]/g, '-')
  return `${gathering ? gathering.title.toLowerCase().replace(/\W+/g, '-') : 'family'}-${stamp}-${p.id.slice(0, 4)}.${ext}`
}

export function PhotoGrid({ photos, gatherings, onOpen }: { photos: Shot[]; gatherings: Record<string, Gathering>; onOpen: (i: number) => void }) {
  const url = useSignedUrls(photos.map((p) => p.thumb_path ?? p.path))
  const commentCounts = useCommentCounts()
  return (
    <div className="photo-grid">
      {photos.map((p, i) => {
        const src = url(p.thumb_path ?? p.path)
        const talk = p.copies.reduce((n, c) => n + (commentCounts[c.id] ?? 0), 0) // the stack shares one thread
        return (
          <button key={p.id} className="photo-tile" onClick={() => onOpen(i)} title={p.caption ?? ''}>
            {src && (isVideo(p) && !p.thumb_path
              ? <LazyVideo src={`${src}#t=0.1`} />
              : <img src={src} alt={p.caption ?? ''} loading="lazy" decoding="async" />)}
            {isVideo(p) && <span className="play"><span><Play size={18} fill="currentColor" aria-hidden="true" /></span></span>}
            {p.gathering_id && gatherings[p.gathering_id] && <span className="tile-tag">{gatherings[p.gathering_id].title}</span>}
            {p.copies.length > 1 && (
              <span className="tile-stack" title={`${p.copies.length} copies of this pic`}>
                <Layers size={11} aria-hidden="true" />{p.copies.length}
              </span>
            )}
            {talk > 0 && (
              <span className="tile-talk" title={`${talk} comment${talk === 1 ? '' : 's'}`}>
                <MessageSquare size={11} aria-hidden="true" />{talk}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A video tile with no preview picture (older uploads): a <video> starts fetching as soon as it's on the page,
 * so it only goes in once the tile scrolls near the screen.
 */
function LazyVideo({ src }: { src: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setNear(true) }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  return near ? <video src={src} muted preload="metadata" playsInline /> : <span ref={ref} className="tile-fill" />
}

/** Everyone who added this pic, first uploader first (once each, however many copies they added). */
const uploaders = (p: Shot) => [...new Set(p.copies.map((c) => c.uploader_id))]

export function Lightbox({ photos, index, gatherings, onClose, onIndex, onDeleted }: {
  photos: Shot[]; index: number; gatherings: Record<string, Gathering>
  onClose: () => void; onIndex: (i: number) => void; onDeleted: (id: string) => void
}) {
  const { me, profiles } = useAuth()
  const shot = photos[index]
  // Which copy of a stacked pic is on screen: the first upload, unless you tap someone else's.
  const [pick, setPick] = useState<string | null>(null)
  useEffect(() => { setPick(null) }, [shot?.id])
  const p = shot && (shot.copies.find((c) => c.id === pick) ?? shot)
  // This one, its preview (already loaded by the grid, so it shows at once), and the ones either side, so a
  // swipe lands on a photo that's already on its way.
  const near = photos.length > 1 ? [photos[(index + 1) % photos.length], photos[(index - 1 + photos.length) % photos.length]] : []
  const url = useSignedUrls(p ? [p.path, ...(p.thumb_path ? [p.thumb_path] : []), ...near.map((n) => n.path)] : [])
  const [shown, setShown] = useState<string | null>(null) // the full-size link that has finished loading
  const [broken, setBroken] = useState<string | null>(null) // one this browser can't show (e.g. HEIC outside Safari)
  const nearKey = near.map((n) => (isVideo(n) ? '' : url(n.path) ?? '')).join('|')
  useEffect(() => {
    nearKey.split('|').filter(Boolean).forEach((u) => { const img = new Image(); img.decoding = 'async'; img.src = u })
  }, [nearKey])
  // A swipe is one finger moving sideways at normal zoom. A pinch, or panning around a
  // pinched-in photo, also moves fingers sideways, so those never change the photo.
  const swipe = useRef<{ x: number; y: number; pinched: boolean } | null>(null)
  const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.01
  // Reactions and comments belong to the whole stack, whichever copy is on screen.
  const reactions = useReactions('photo', shot ? [shot.id] : [])
  const comments = usePhotoComments(shot ? shot.copies.map((c) => c.id) : [])
  const [talking, setTalking] = useState(false) // the comments panel stays open from one pic to the next

  const go = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return // typing a comment
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  if (!p) return null
  const src = url(p.path)
  const thumb = url(p.thumb_path)
  const gathering = p.gathering_id ? gatherings[p.gathering_id] : undefined

  const download = async () => {
    const [link] = await signFiles([p.path], 600, fileName(p, gathering))
    if (link) saveAs(link.url, fileName(p, gathering))
  }
  // Your copies of it. Others who added the same file keep theirs, so it stays up until the last one goes.
  const mine = shot.copies.filter((c) => c.uploader_id === me?.id)
  const others = shot.copies.length > mine.length
  const del = async () => {
    if (!confirm(others ? 'Remove your copy? Others added this too, so it stays up for them.' : 'Delete this for everyone?')) return
    for (const c of mine) {
      await removeFiles([c.path, ...(c.thumb_path ? [c.thumb_path] : [])])
      const { error } = await supabase.from('photos').delete().eq('id', c.id)
      if (!error) onDeleted(c.id)
    }
  }
  const who = uploaders(shot)
  // Re-shared copies aren't the exact same file, so each can be looked at (and saved) on its own.
  const switchable = new Set(shot.copies.map((c) => c.content_hash ?? c.path)).size > 1

  return (
    <div className={`lightbox ${talking ? 'talking' : ''}`} onClick={onClose}
      onTouchStart={(e) => {
        if (e.touches.length > 1) { if (swipe.current) swipe.current.pinched = true; return }
        swipe.current = zoomed() ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY, pinched: false }
      }}
      onTouchEnd={(e) => {
        const s = swipe.current
        if (e.touches.length > 0) return // wait for the last finger to lift
        swipe.current = null
        if (!s || s.pinched || zoomed()) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
      }}
      onTouchCancel={() => { swipe.current = null }}>
      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        {isVideo(p) ? (src ? <video key={src} src={src} poster={thumb} controls autoPlay playsInline /> : <div className="loading">Loading…</div>)
          : <>
            {thumb && shown !== src && <img className="lb-preview" src={thumb} alt="" aria-hidden="true" />}
            {src && broken !== src && <img key={src} src={src} alt={p.caption ?? ''} decoding="async"
              onLoad={() => setShown(src)} onError={() => setBroken(src)} />}
            {!src && !thumb && <div className="loading">Loading…</div>}
          </>}
      </div>
      <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
        <div>
          {p.caption && <div className="lb-caption">{p.caption}</div>}
          <div className="muted small icon-text">
            {switchable ? <>
              {who.length > 1 ? 'Added by' : 'Copies'}
              {shot.copies.map((c) => (
                <button key={c.id} className={`lb-copy ${c.id === p.id ? 'on' : ''}`} onClick={() => setPick(c.id)}
                  aria-pressed={c.id === p.id} title={`Show ${nameOf(profiles[c.uploader_id])}'s copy`}>
                  <Avatar p={profiles[c.uploader_id]} size={18} />{nameOf(profiles[c.uploader_id])}
                  {shot.copies.filter((o) => o.uploader_id === c.uploader_id).length > 1 &&
                    ` ${shot.copies.filter((o) => o.uploader_id === c.uploader_id).indexOf(c) + 1}`}
                </button>
              ))}
            </> : <>
              {who.map((id) => <Avatar key={id} p={profiles[id]} size={18} />)}
              {who.length > 1 ? `Added by ${who.map((id) => nameOf(profiles[id])).join(', ')}` : nameOf(profiles[p.uploader_id])}
            </>}
            {' · '}{when(shotAt(p, gathering))}
            {gathering && <> · {gathering.title}</>}
          </div>
          {reactions.ready && <ReactionBar always list={reactions.of(shot.id)} onToggle={(e) => reactions.toggle(shot.id, e)} />}
        </div>
        <div className="row">
          {comments.ready && (
            <button className={`btn ghost sm ${talking ? 'on' : ''}`} aria-pressed={talking} onClick={() => setTalking((t) => !t)}>
              <MessageSquare size={15} aria-hidden="true" />{comments.rows?.length ? `Comments (${comments.rows.length})` : 'Comment'}
            </button>
          )}
          <button className="btn ghost sm" onClick={download}><Download size={15} aria-hidden="true" />Download</button>
          {mine.length > 0 && <button className="btn ghost sm danger" onClick={del}><Trash2 size={15} aria-hidden="true" />{others ? 'Remove mine' : 'Delete'}</button>}
        </div>
      </div>
      {photos.length > 1 && <>
        <button className="lb-nav prev" aria-label="Previous" onClick={(e) => { e.stopPropagation(); go(-1) }}><ChevronLeft size={22} aria-hidden="true" /></button>
        <button className="lb-nav next" aria-label="Next" onClick={(e) => { e.stopPropagation(); go(1) }}><ChevronRight size={22} aria-hidden="true" /></button>
      </>}
      <button className="lb-close" aria-label="Close" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      {talking && comments.ready && (
        <div className="lb-comments-wrap" onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
          <PhotoComments photoId={shot.id} comments={comments} onClose={() => setTalking(false)} />
        </div>
      )}
    </div>
  )
}

/** Pick files, tag a gathering, upload originals plus a small preview for the grid. */
export function Uploader({ gatherings, defaultGatheringId, onUploaded }: { gatherings: Gathering[]; defaultGatheringId: string | null; onUploaded: (p: Photo) => void }) {
  const { me } = useAuth()
  const [gatheringId, setGatheringId] = useState<string>(defaultGatheringId ?? '')
  const [caption, setCaption] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { setGatheringId(defaultGatheringId ?? '') }, [defaultGatheringId])

  const upload = async (files: FileList | null) => {
    if (!files?.length || !me) return
    setErr(null)
    const list = [...files]
    setProgress({ done: 0, total: list.length })
    let failed = 0
    for (const file of list) {
      try {
        const id = crypto.randomUUID()
        const path = `${me.id}/${id}.${extOf(file)}`
        const content_hash = await uploadFile(path, file, file.type || undefined)
        let thumb_path: string | null = null
        const thumb = await makeThumb(file)
        if (thumb) {
          thumb_path = `${me.id}/thumbs/${id}.jpg`
          try { await uploadFile(thumb_path, thumb, 'image/jpeg') } catch { thumb_path = null }
        }
        const row: Record<string, unknown> = {
          gathering_id: gatheringId || null, path, thumb_path, mime: file.type || 'image/jpeg', caption: caption.trim() || null,
          taken_at: (await takenAt(fileReader(file), file.type)) ?? fromLastModified(file), content_hash,
        }
        let { data, error: dbErr } = await supabase.from('photos').insert(row).select().single()
        // Database not updated yet (supabase/schema.sql): save without the newer columns it doesn't have.
        for (const col of ['content_hash', 'taken_at']) {
          if (!dbErr?.message.includes(col)) continue
          delete row[col]
          ;({ data, error: dbErr } = await supabase.from('photos').insert(row).select().single())
        }
        if (dbErr) throw dbErr
        onUploaded(data as Photo)
      } catch (e) {
        failed++
        setErr(`${file.name}: ${(e as Error).message}`)
      }
      setProgress((pr) => pr && { ...pr, done: pr.done + 1 })
    }
    setProgress(null)
    if (!failed) setCaption('')
    if (input.current) input.current.value = ''
  }

  return (
    <div className="uploader card">
      <div className="grid-3">
        <select className="input" value={gatheringId} onChange={(e) => setGatheringId(e.target.value)}>
          <option value="">Not from a get-together</option>
          {gatherings.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <input className="input" placeholder="Caption (optional)" maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <label className={`btn gold ${progress ? 'disabled' : ''}`}>
          <ImagePlus size={17} aria-hidden="true" />
          {progress ? `Uploading ${progress.done}/${progress.total}…` : 'Add photos or videos'}
          <input ref={input} type="file" accept="image/*,video/*" multiple hidden disabled={Boolean(progress)}
            onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  )
}

// No date inside the file: a phone's "last modified" is often the capture time, unless it's just now (a fresh copy).
function fromLastModified(file: File) {
  return file.lastModified && file.lastModified < Date.now() - 5 * 60_000 ? new Date(file.lastModified).toISOString() : null
}

/**
 * Pics uploaded before taken_at existed: read the time from each of your own stored files once, so the gallery
 * can sort them by when they were taken. Files that don't say get their upload time, so they aren't re-read.
 */
const tried = new Set<string>()
export function useBackfillTakenAt(photos: Photo[] | null) {
  const { me } = useAuth()
  useEffect(() => {
    const todo = (photos ?? []).filter((p) => p.uploader_id === me?.id && !p.taken_at && !tried.has(p.id))
    if (!todo.length) return
    todo.forEach((p) => tried.add(p.id))
    ;(async () => {
      for (const p of todo) {
        try {
          const [link] = await signFiles([p.path], 600)
          const reader = link && (await urlReader(link.url))
          const t = reader ? await takenAt(reader, p.mime) : null
          await supabase.from('photos').update({ taken_at: t ?? p.created_at }).eq('id', p.id)
        } catch { /* try again next visit */ tried.delete(p.id) }
      }
    })()
  }, [photos, me?.id])
}

/** Zip every file in the current view and save it. */
export async function downloadAll(photos: Photo[], gatherings: Record<string, Gathering>, zipName: string) {
  const urls = new Map((await signFiles(photos.map((p) => p.path), 600)).map((d) => [d.path, d.url]))
  async function* files() {
    for (const p of photos) {
      const u = urls.get(p.path)
      if (!u) continue
      const res = await fetch(u)
      if (res.ok) yield { name: fileName(p, p.gathering_id ? gatherings[p.gathering_id] : undefined), input: res }
    }
  }
  const blob = await downloadZip(files()).blob()
  const href = URL.createObjectURL(blob)
  saveAs(href, zipName)
  setTimeout(() => URL.revokeObjectURL(href), 60_000)
}
