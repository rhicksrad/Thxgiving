/**
 * Small JPEG preview for the gallery grid (originals stay untouched): the photo itself, or a video's first
 * moments. Null if the browser can't decode it.
 */
export async function makeThumb(file: File, max = 640): Promise<Blob | null> {
  try {
    if (file.type.startsWith('video/')) return await videoThumb(file, max)
    if (!file.type.startsWith('image/')) return null
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const blob = await toJpeg(bmp, bmp.width, bmp.height, max)
    bmp.close()
    return blob
  } catch {
    return null
  }
}

function toJpeg(src: CanvasImageSource, w: number, h: number, max: number): Promise<Blob | null> {
  if (!w || !h) return Promise.resolve(null)
  const scale = Math.min(1, max / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')!.drawImage(src, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
}

// A frame from just after the start (the very first is often black). Gives up after a few seconds, so a video
// the browser can't play still uploads, just without a preview.
async function videoThumb(file: File, max: number): Promise<Blob | null> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  try {
    const frame = new Promise<void>((resolve, reject) => {
      v.onerror = () => reject(new Error('unplayable'))
      v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2) }
      v.onseeked = () => resolve()
    })
    v.src = url
    v.load()
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    await Promise.race([frame, timeout])
    return await toJpeg(v, v.videoWidth, v.videoHeight, max)
  } catch {
    return null
  } finally {
    v.removeAttribute('src')
    v.load()
    URL.revokeObjectURL(url)
  }
}

export const extOf = (file: File) => {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  return fromName || file.type.split('/')[1] || 'bin'
}

/** Save a blob or URL to the device. */
export function saveAs(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
