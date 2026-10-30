import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Download, HardDrive, Images } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isPast, isToday, plural } from '../lib/format'
import { useLiveTable, upsertById } from '../lib/realtime'
import type { Gathering, Photo } from '../lib/types'
import { storageUsage, type Usage } from '../lib/storage'
import { useAuth } from '../auth'
import { nameOf } from '../components/Avatar'
import { byShot, downloadAll, Lightbox, PhotoGrid, stackDupes, Uploader, useBackfillTakenAt, useStackKeys } from '../components/Photos'

export default function Gallery() {
  const [params, setParams] = useSearchParams()
  const filter = params.get('gathering') ?? 'all' // 'all' | 'none' | <gathering id>
  const by = params.get('by') ?? 'all' // 'all' | <profile id>: pics they added
  const { profiles } = useAuth()
  const pick = (gathering: string, person: string) =>
    setParams({ ...(gathering !== 'all' ? { gathering } : {}), ...(person !== 'all' ? { by: person } : {}) })
  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  // By id, not position: a new upload landing at the front of the grid shouldn't swap what's on screen.
  const [openId, setOpenId] = useState<string | null>(null)
  // ?photo=… (from the bell: a reaction or comment on a pic) opens that pic.
  const wantPhoto = params.get('photo')
  useEffect(() => { if (wantPhoto) setOpenId(wantPhoto) }, [wantPhoto])
  const close = () => {
    setOpenId(null)
    if (wantPhoto) setParams({ ...(filter !== 'all' ? { gathering: filter } : {}), ...(by !== 'all' ? { by } : {}) }, { replace: true })
  }
  const [zipping, setZipping] = useState(false)
  const [usage, setUsage] = useState<Usage | null>(null)

  const loadPhotos = useCallback(() => {
    supabase.from('photos').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => setPhotos((cur) => (error && cur ? cur : (data ?? []) as Photo[])))
  }, [])
  useEffect(() => {
    supabase.from('gatherings').select('*').order('starts_at', { ascending: false }).then(({ data }) => setGatherings((data ?? []) as Gathering[]))
    loadPhotos()
  }, [loadPhotos])

  useLiveTable<Photo>('photos', undefined, {
    onUpsert: (p) => setPhotos((cur) => cur && (cur.some((x) => x.id === p.id) ? upsertById(cur, p) : [p, ...cur])),
    onDelete: (id) => setPhotos((cur) => cur?.filter((x) => x.id !== id) ?? cur),
    onResync: loadPhotos,
  })

  const gatheringsById = useMemo(() => Object.fromEntries(gatherings.map((g) => [g.id, g])), [gatherings])
  const stackKey = useStackKeys(photos)
  // Counted the way they show: the same pic added by two people is one.
  const counts = useMemo(() => {
    const seen: Record<string, Set<string>> = {}
    photos?.forEach((p) => { const k = p.gathering_id ?? 'none'; (seen[k] ??= new Set()).add(stackKey(p) ?? p.id) })
    return Object.fromEntries(Object.entries(seen).map(([k, s]) => [k, s.size]))
  }, [photos, stackKey])
  const total = useMemo(() => new Set(photos?.map((p) => stackKey(p) ?? p.id)).size, [photos, stackKey])

  // Re-check storage whenever the number of files changes (an upload or delete, here or from someone else).
  const fileCount = photos?.length
  useEffect(() => {
    if (fileCount === undefined) return
    const t = setTimeout(() => { storageUsage().then(setUsage, () => {}) }, 1500)
    return () => clearTimeout(t)
  }, [fileCount])

  useBackfillTakenAt(photos)
  // In the order they were taken: one gathering reads start to finish; everything else shows the newest first.
  // Duplicates (the same pic from more than one person) stack into one tile.
  const inGathering = useMemo(() => stackDupes(byShot((photos ?? []).filter((p) =>
    filter === 'all' ? true : filter === 'none' ? !p.gathering_id : p.gathering_id === filter), gatheringsById, filter === 'all' || filter === 'none'), stackKey),
  [photos, gatheringsById, filter, stackKey])
  // One person's pics: any stack they added a copy to.
  const shown = useMemo(() => (by === 'all' ? inGathering : inGathering.filter((s) => s.copies.some((c) => c.uploader_id === by))), [inGathering, by])
  // Who added pics to the gathering in view, most first.
  const people = useMemo(() => {
    const n: Record<string, number> = {}
    inGathering.forEach((s) => new Set(s.copies.map((c) => c.uploader_id)).forEach((id) => { n[id] = (n[id] ?? 0) + 1 }))
    return Object.entries(n).sort((a, b) => b[1] - a[1] || nameOf(profiles[a[0]]).localeCompare(nameOf(profiles[b[0]])))
  }, [inGathering, profiles])
  // A pic further down a stack (someone else's copy) opens the stack.
  const open = openId ? shown.findIndex((p) => p.id === openId || p.copies.some((c) => c.id === openId)) : -1

  // Default upload target: the gathering in view, else today's / the most recent one.
  const defaultGathering = filter !== 'all' && filter !== 'none' ? filter
    : (gatherings.find(isToday) ?? gatherings.find(isPast) ?? gatherings[gatherings.length - 1])?.id ?? null
  const uploadable = gatherings.filter((g) => new Date(g.starts_at).getTime() < Date.now() + 86400000)

  const slug = (t: string) => t.toLowerCase().replace(/\W+/g, '-')
  const zipName = `family-${filter === 'all' ? 'all' : filter === 'none' ? 'other' : slug(gatheringsById[filter]?.title ?? 'gathering')}${
    by === 'all' ? '' : `-${slug(nameOf(profiles[by]))}`}.zip`

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="display">Gallery</h1>
        <p className="muted">Everyone's photos and videos, kept at full size. Download one, or a whole get-together at once.</p>
      </header>

      {usage && <StorageMeter usage={usage} />}

      <Uploader gatherings={uploadable.length ? uploadable : gatherings} defaultGatheringId={defaultGathering}
        onUploaded={(p) => setPhotos((cur) => cur && (cur.some((x) => x.id === p.id) ? cur : [p, ...cur]))} />

      <div className="filter-bar">
        <select className="input" value={filter} onChange={(e) => pick(e.target.value, by)} aria-label="Gathering">
          <option value="all">All photos ({total})</option>
          {gatherings.filter((g) => counts[g.id]).map((g) => (
            <option key={g.id} value={g.id}>{g.title} ({counts[g.id]})</option>
          ))}
          {counts.none ? <option value="none">Other ({counts.none})</option> : null}
          {filter !== 'all' && filter !== 'none' && !counts[filter] && gatheringsById[filter] &&
            <option value={filter}>{gatheringsById[filter].title} (0)</option>}
        </select>
        <select className="input" value={by} onChange={(e) => pick(filter, e.target.value)} aria-label="Added by">
          <option value="all">Everyone ({inGathering.length})</option>
          {people.map(([id, n]) => <option key={id} value={id}>{nameOf(profiles[id])} ({n})</option>)}
          {by !== 'all' && !people.some(([id]) => id === by) && <option value={by}>{nameOf(profiles[by])} (0)</option>}
        </select>
        <button className="btn ghost" disabled={!shown.length || zipping}
          onClick={async () => { setZipping(true); try { await downloadAll(shown, gatheringsById, zipName) } finally { setZipping(false) } }}>
          <Download size={16} aria-hidden="true" />
          {zipping ? 'Zipping…' : `Download ${plural(shown.length, 'file')}`}
        </button>
      </div>

      {photos === null ? <div className="loading">Loading pics…</div>
        : shown.length ? <PhotoGrid photos={shown} gatherings={gatheringsById} onOpen={(i) => setOpenId(shown[i].id)} />
        : <div className="card empty"><Images size={26} aria-hidden="true" />Nothing here yet. Add the first photo above.</div>}

      {open >= 0 && (
        <Lightbox photos={shown} index={open} gatherings={gatheringsById} onClose={close} onIndex={(i) => setOpenId(shown[i].id)}
          onDeleted={(id) => { setPhotos((cur) => cur?.filter((x) => x.id !== id) ?? cur); close() }} />
      )}
    </div>
  )
}

function gb(bytes: number) {
  const g = bytes / 1024 ** 3
  return g >= 10 ? `${Math.round(g)} GB` : g >= 1 ? `${g.toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}

function StorageMeter({ usage }: { usage: Usage }) {
  return (
    <div className="storage-meter">
      <span><HardDrive size={14} aria-hidden="true" /> Storage</span>
      <span className="muted">{gb(usage.bytes)} used</span>
    </div>
  )
}
