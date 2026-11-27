// End-to-end encryption for private messages, all in the browser with WebCrypto. The server (and anyone who can
// read its database) only ever gets sealed text.
//
// - Everyone has an ECDH P-256 key pair. The public half goes to the server. The private half is sealed with a key
//   made from their password (PBKDF2-SHA256, 600,000 rounds, its own salt) and only that sealed copy is uploaded,
//   so a new phone can open it with the password. On this device the opened key is kept in IndexedDB.
// - Each message gets a fresh AES-256-GCM key. The words are sealed with it; then it is wrapped (AES-KW) for each
//   person in the conversation with a key both sides can work out from ECDH(my private, their public) + HKDF.
// - The conversation, message id and sender are bound in as associated data, so the server can't move a sealed
//   message to another conversation or pass it off as someone else's.

export type Lock = { key_id: string; sealed: string; salt: string; iv: string; rounds: number; public_key: string }
export type PublicKey = { id: string; user_id: string; public_key: string; created_at: string }
export type DmMessage = {
  id: string; conversation_id: string; sender_id: string; sender_key: string; iv: string; body: string
  keys: Record<string, { k: string; w: string }>; created_at: string
}
export type MyKey = { userId: string; keyId: string; privateKey: CryptoKey; publicJwk: JsonWebKey }

const ROUNDS = 600_000
const subtle = () => crypto.subtle
const te = new TextEncoder()
const td = new TextDecoder()

export const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

async function passwordKey(password: string, salt: Uint8Array, rounds: number) {
  const base = await subtle().importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: rounds }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** Seal a private key with a password, for the server to keep. */
export async function seal(privateKey: CryptoKey, password: string, keyId: string) {
  const salt = random(16)
  const iv = random(12)
  const pk = await subtle().exportKey('pkcs8', privateKey)
  const wrap = await passwordKey(password, salt, ROUNDS)
  const sealed = await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: te.encode(`dm-lock|${keyId}`) }, wrap, pk)
  return { sealed: b64(sealed), salt: b64(salt), iv: b64(iv), rounds: ROUNDS }
}

/** Open the server's sealed copy with the password. Null = wrong password (or a lock from before a reset). */
export async function unseal(lock: Lock, password: string): Promise<CryptoKey | null> {
  try {
    const wrap = await passwordKey(password, unb64(lock.salt), lock.rounds)
    const pk = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(lock.iv) as BufferSource, additionalData: te.encode(`dm-lock|${lock.key_id}`) },
      wrap, unb64(lock.sealed) as BufferSource)
    return await subtle().importKey('pkcs8', pk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  } catch {
    return null
  }
}

export async function newKeyPair() {
  const pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const jwk = await subtle().exportKey('jwk', pair.publicKey)
  return { privateKey: pair.privateKey, publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } as JsonWebKey }
}

/** A short code for a public key, the same on everyone's screen: compare it in person to be sure. */
export async function fingerprint(publicKey: string) {
  const j = JSON.parse(publicKey) as JsonWebKey
  const h = new Uint8Array(await subtle().digest('SHA-256', te.encode(`${j.crv}|${j.x}|${j.y}`)))
  return [...h.slice(0, 6)].map((b) => b.toString().padStart(3, '0')).join(' ')
}

// The key two people share, per (my key, their key). Cached: ECDH is the slow part.
const pairCache = new Map<string, Promise<CryptoKey>>()
function pairKey(me: MyKey, their: PublicKey) {
  const id = `${me.keyId}|${their.id}`
  let p = pairCache.get(id)
  if (!p) {
    p = (async () => {
      const pub = await subtle().importKey('jwk', JSON.parse(their.public_key), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
      const bits = await subtle().deriveBits({ name: 'ECDH', public: pub }, me.privateKey, 256)
      const hk = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey'])
      // Both ends name the same two keys in the same order, whoever is sending.
      const [a, b] = [me.keyId, their.id].sort()
      return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te.encode(`hicks-dm-v1|${a}|${b}`) },
        hk, { name: 'AES-KW', length: 256 }, false, ['wrapKey', 'unwrapKey'])
    })()
    p.catch(() => pairCache.delete(id))
    pairCache.set(id, p)
  }
  return p
}
export const forgetPairs = () => pairCache.clear()

const aad = (convId: string, msgId: string, senderId: string, senderKey: string) =>
  te.encode(`hicks-dm-v1|${convId}|${msgId}|${senderId}|${senderKey}`)

export type Plain = { t: string }

/** Seal a message for everyone in `members` (you included), using their current keys. */
export async function encrypt(me: MyKey, convId: string, members: string[], current: Record<string, PublicKey>, plain: Plain) {
  const id = crypto.randomUUID()
  const msgKey = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = random(12)
  const body = await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(convId, id, me.userId, me.keyId) as BufferSource },
    msgKey, te.encode(JSON.stringify(plain)))
  const keys: DmMessage['keys'] = {}
  for (const who of members) {
    const their = current[who]
    if (!their) throw new Error('missing-key')
    keys[who] = { k: their.id, w: b64(await subtle().wrapKey('raw', msgKey, await pairKey(me, their), 'AES-KW')) }
  }
  return { id, iv: b64(iv), body: b64(body), keys, sender_key: me.keyId }
}

/** Open a message. Null = it wasn't sealed for the key on this device (sent before a reset), or it was tampered with. */
export async function decrypt(me: MyKey, m: DmMessage, keysById: Record<string, PublicKey>): Promise<Plain | null> {
  try {
    const mine = m.keys[me.userId]
    if (!mine || mine.k !== me.keyId) return null
    // The pair key is (sender's key, my key): for my own messages that's my key with itself.
    const sender = keysById[m.sender_key]
    if (!sender || sender.user_id !== m.sender_id) return null
    const msgKey = await subtle().unwrapKey('raw', unb64(mine.w) as BufferSource, await pairKey(me, sender), 'AES-KW', { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(m.iv) as BufferSource, additionalData: aad(m.conversation_id, m.id, m.sender_id, m.sender_key) as BufferSource },
      msgKey, unb64(m.body) as BufferSource)
    const parsed = JSON.parse(td.decode(plain))
    return typeof parsed?.t === 'string' ? parsed : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// The opened key on this device: IndexedDB (private mode may refuse; then it lasts until the tab closes).
// ---------------------------------------------------------------------------
const DB = 'hicks-dm'
const STORE = 'keys'
let memKey: MyKey | null = null

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await idb()
  return new Promise<T>((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE))
    r.onsuccess = () => resolve(r.result as T)
    r.onerror = () => reject(r.error)
  }).finally(() => db.close())
}

export async function loadDeviceKey(userId: string): Promise<MyKey | null> {
  if (memKey?.userId === userId) return memKey
  try {
    const k = await tx<MyKey | undefined>('readonly', (s) => s.get(userId))
    if (k?.privateKey) memKey = k
    return k?.privateKey ? k : null
  } catch {
    return null
  }
}
export async function saveDeviceKey(k: MyKey) {
  memKey = k
  try { await tx('readwrite', (s) => s.put(k, k.userId)) } catch { /* private mode: memKey has it */ }
}
/** Signing out takes the key off this device. */
export async function clearDeviceKeys() {
  memKey = null
  forgetPairs()
  try { await tx('readwrite', (s) => s.clear()) } catch { /* nothing stored */ }
}
