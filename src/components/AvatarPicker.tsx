import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { removeFiles, uploadFile } from '../lib/storage'
import { useAuth } from '../auth'
import { Avatar, BADGES, Badge, badgeFor } from './Avatar'

/** Square, center-cropped JPEG small enough for an avatar. Null if the browser can't read the file. */
async function squareJpeg(file: File, size = 320): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const side = Math.min(bmp.width, bmp.height)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(size, side)
    canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
    bmp.close()
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  } catch {
    return null
  }
}

/**
 * Pick a badge (saved with the rest of the form through `onPick`) or upload a photo (saved right away).
 * A photo wins over the badge wherever avatars show; the badge is the fallback.
 */
export default function AvatarPicker({ badge, onPick }: { badge: string; onPick: (key: string) => void }) {
  const { me, saveProfile } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!me) return null
  const hasPhoto = Boolean(me.avatar_path)

  const upload = async (file?: File) => {
    if (!file) return
    setErr(null); setBusy(true)
    try {
      const jpeg = await squareJpeg(file)
      if (!jpeg) throw new Error("Couldn't read that image. Try a JPEG or PNG.")
      const path = `${me.id}/avatar/${crypto.randomUUID()}.jpg`
      await uploadFile(path, jpeg, 'image/jpeg')
      const old = me.avatar_path
      const msg = await saveProfile({ avatar_path: path })
      if (msg) { removeFiles([path]).catch(() => {}); throw new Error(msg) }
      if (old) removeFiles([old]).catch(() => {})
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const removePhoto = async () => {
    const old = me.avatar_path
    setErr(null); setBusy(true)
    const msg = await saveProfile({ avatar_path: null })
    setBusy(false)
    if (msg) return setErr(msg)
    if (old) removeFiles([old]).catch(() => {})
  }

  return (
    <div className="av-picker">
      <div className="av-top">
        {hasPhoto ? <Avatar p={me} size={64} /> : <Badge value={badge} name={me.display_name} size={64} />}
        <div className="av-top-text">
          <div className="av-top-title">{hasPhoto ? 'Using your photo' : `Badge: ${badgeFor(badge)?.label ?? 'initials'}`}</div>
          <div className="row wrap">
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => input.current?.click()}>
              <Camera size={15} aria-hidden="true" />{busy ? 'Saving…' : hasPhoto ? 'Change photo' : 'Upload a photo'}
            </button>
            {hasPhoto && (
              <button type="button" className="btn ghost sm danger" disabled={busy} onClick={removePhoto}>
                <Trash2 size={15} aria-hidden="true" />Remove
              </button>
            )}
          </div>
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="av-grid-label muted small">{hasPhoto ? 'Badge (shows if you remove your photo)' : 'Or pick a badge'}</div>
      <div className="av-grid" role="radiogroup" aria-label="Avatar badge">
        {BADGES.map((b) => (
          <button type="button" key={b.key} role="radio" aria-checked={b.key === badge} aria-label={b.label} title={b.label}
            className={b.key === badge ? 'on' : ''} onClick={() => onPick(b.key)}>
            <Badge value={b.key} size={40} />
          </button>
        ))}
      </div>
    </div>
  )
}
