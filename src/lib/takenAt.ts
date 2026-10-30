// When a photo or video was actually taken, read from the file itself:
// - Photos: EXIF DateTimeOriginal (+ OffsetTimeOriginal when the phone wrote one, else the uploader's local time).
// - Videos: the creation time in the MP4/MOV header (always UTC).
// Reads only the few bytes it needs, so it works on a picked File or on a stored file over HTTP range requests.

type Reader = { size: number; read: (offset: number, length: number) => Promise<Uint8Array> }

export const fileReader = (file: Blob): Reader => ({
  size: file.size,
  read: async (offset, length) => new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()),
})

/** Read a stored file over HTTP range requests (signed URLs from storage both support them). */
export async function urlReader(url: string): Promise<Reader | null> {
  const head = await fetch(url, { headers: { range: 'bytes=0-0' } })
  const total = Number(head.headers.get('content-range')?.split('/')[1] ?? head.headers.get('content-length'))
  await head.body?.cancel()
  if (!head.ok || !total) return null
  return {
    size: total,
    read: async (offset, length) => {
      const end = Math.min(total, offset + length) - 1
      const res = await fetch(url, { headers: { range: `bytes=${offset}-${end}` } })
      return new Uint8Array(await res.arrayBuffer())
    },
  }
}

const sane = (d: Date | null) =>
  d && !isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getTime() < Date.now() + 86400_000 ? d : null

/** ISO time the file was taken, or null if the file doesn't say. */
export async function takenAt(r: Reader, mime: string): Promise<string | null> {
  try {
    const d = mime.startsWith('video/') ? await videoTime(r) : await photoTime(r)
    return sane(d)?.toISOString() ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------
const ascii = (b: Uint8Array, start = 0, end = b.length) => String.fromCharCode(...b.subarray(start, end))

function exifDate(s: string, offset?: string) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s)
  if (!m) return null
  const [, y, mo, d, h, mi, se] = m
  if (offset && /^[+-]\d{2}:\d{2}$/.test(offset)) return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}${offset}`)
  return new Date(+y, +mo - 1, +d, +h, +mi, +se) // no zone in the file: the uploader's local time
}

async function photoTime(r: Reader) {
  const b = await r.read(0, Math.min(r.size, 256 * 1024))
  if (b[0] === 0xff && b[1] === 0xd8) {
    // JPEG: walk the markers to the APP1 "Exif" block.
    let i = 2
    while (i + 4 < b.length && b[i] === 0xff) {
      const marker = b[i + 1]
      const len = (b[i + 2] << 8) | b[i + 3]
      if (marker === 0xe1 && ascii(b, i + 4, i + 8) === 'Exif') return tiffTime(b.subarray(i + 10, i + 2 + len))
      if (marker === 0xda) break // image data starts; no EXIF before it
      i += 2 + len
    }
    return null
  }
  // HEIC, PNG, WebP…: find the TIFF block ("II*\0" or "MM\0*") and read it the same way.
  for (let i = 0; i + 8 < b.length; i++) {
    if ((b[i] === 0x49 && b[i + 1] === 0x49 && b[i + 2] === 0x2a && b[i + 3] === 0)
      || (b[i] === 0x4d && b[i + 1] === 0x4d && b[i + 2] === 0 && b[i + 3] === 0x2a)) {
      const d = tiffTime(b.subarray(i))
      if (d) return d
    }
  }
  return null
}

function tiffTime(t: Uint8Array) {
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength)
  const le = t[0] === 0x49
  const u16 = (o: number) => v.getUint16(o, le)
  const u32 = (o: number) => v.getUint32(o, le)
  const str = (entry: number) => {
    const count = u32(entry + 4)
    const at = count > 4 ? u32(entry + 8) : entry + 8
    return ascii(t, at, at + count).replace(/\0.*$/, '')
  }
  const tags = (ifd: number) => {
    const out = new Map<number, number>()
    if (ifd <= 0 || ifd + 2 > t.length) return out
    const n = u16(ifd)
    for (let k = 0; k < n && ifd + 2 + k * 12 + 12 <= t.length; k++) out.set(u16(ifd + 2 + k * 12), ifd + 2 + k * 12)
    return out
  }
  const ifd0 = tags(u32(4))
  const exif = ifd0.has(0x8769) ? tags(u32(ifd0.get(0x8769)! + 8)) : new Map<number, number>()
  const original = exif.get(0x9003) ?? exif.get(0x9004)
  if (original != null) return exifDate(str(original), exif.has(0x9011) ? str(exif.get(0x9011)!) : undefined)
  return ifd0.has(0x0132) ? exifDate(str(ifd0.get(0x0132)!), exif.has(0x9010) ? str(exif.get(0x9010)!) : undefined) : null
}

// ---------------------------------------------------------------------------
// Videos: moov → mvhd creation time, seconds since 1904-01-01 UTC.
// ---------------------------------------------------------------------------
const MAC_EPOCH = Date.UTC(1904, 0, 1)

async function videoTime(r: Reader) {
  const moov = await findBox(r, 0, r.size, 'moov')
  if (!moov) return null
  const mvhd = await findBox(r, moov.body, moov.end, 'mvhd')
  if (!mvhd) return null
  const b = await r.read(mvhd.body, 12)
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const secs = b[0] === 1 ? Number(v.getBigUint64(4)) : v.getUint32(4)
  return secs ? new Date(MAC_EPOCH + secs * 1000) : null
}

async function findBox(r: Reader, start: number, end: number, type: string) {
  for (let at = start; at + 8 <= end;) {
    const h = await r.read(at, 16)
    const v = new DataView(h.buffer, h.byteOffset, h.byteLength)
    let size = v.getUint32(0)
    let header = 8
    if (size === 1) { size = Number(v.getBigUint64(8)); header = 16 }
    else if (size === 0) size = end - at
    if (size < header) return null
    if (ascii(h, 4, 8) === type) return { body: at + header, end: at + size }
    at += size
  }
  return null
}
