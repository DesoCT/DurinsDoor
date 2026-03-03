/**
 * Zero-knowledge crypto utilities — all operations happen in the browser.
 * The server never sees plaintext files or encryption keys.
 */

/** Encrypt a file buffer with AES-256-GCM. Returns {blob, keyB64}. */
export async function encryptFile(buffer: ArrayBuffer): Promise<{ blob: Uint8Array; keyB64: string }> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer)

  // Prepend IV to ciphertext
  const blob = new Uint8Array(iv.length + encrypted.byteLength)
  blob.set(iv)
  blob.set(new Uint8Array(encrypted), iv.length)

  // Export key for URL fragment
  const rawKey = await crypto.subtle.exportKey('raw', key)
  const keyB64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return { blob, keyB64 }
}

/** Encrypt a file buffer with an existing CryptoKey (for handshake mode). */
export async function encryptFileWithKey(buffer: ArrayBuffer, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer)
  const blob = new Uint8Array(iv.length + encrypted.byteLength)
  blob.set(iv)
  blob.set(new Uint8Array(encrypted), iv.length)
  return blob
}

/** Decrypt a blob using the base64url key from the URL fragment. */
export async function decryptFile(cipherBlob: ArrayBuffer, keyB64: string): Promise<ArrayBuffer> {
  // Restore base64url → standard base64 with correct padding
  const std = keyB64.replace(/-/g, '+').replace(/_/g, '/')
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4)
  const keyBytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt'])

  const cipherArray = new Uint8Array(cipherBlob)
  const iv = cipherArray.slice(0, 12)
  const data = cipherArray.slice(12)

  return await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
}

/** Decrypt a blob using an existing CryptoKey (for handshake mode). */
export async function decryptFileWithKey(cipherBlob: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const cipherArray = new Uint8Array(cipherBlob)
  const iv = cipherArray.slice(0, 12)
  const data = cipherArray.slice(12)
  return await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
}

/**
 * Returns the plaintext password unchanged.
 *
 * Previously this hashed with SHA-256 client-side, but bcrypt hashing must be
 * done server-side (the server API routes use bcrypt.compare()). Passwords are
 * sent as plaintext over HTTPS and hashed with bcrypt (cost 10) on the server,
 * matching the Go CLI's bcrypt.DefaultCost for cross-platform interoperability.
 *
 * @deprecated Use the password value directly and let the server handle hashing.
 */
export function hashPassword(password: string): string {
  return password
}

/** Trigger a browser file download from an ArrayBuffer. */
export function triggerDownload(buffer: ArrayBuffer, filename: string, contentType = 'application/octet-stream') {
  const blob = new Blob([buffer], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

/** Format bytes into a human-readable string. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

/** Format a duration in ms to a human-readable string. */
export function humanDuration(ms: number): string {
  if (ms < 0) return 'expired'
  const s = Math.floor(ms / 1000)
  if (s < 60) return s + 's'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm'
  const h = Math.floor(m / 60)
  const rm = m % 60
  if (h < 24) return rm ? `${h}h ${rm}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}d ${rh}h` : `${d}d`
}

/** Get a file icon emoji based on file extension/type. */
export function fileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: '📄', zip: '📦', tar: '📦', gz: '📦', '7z': '📦', rar: '📦',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵',
    doc: '📝', docx: '📝', txt: '📜', md: '📜',
    xls: '📊', xlsx: '📊', csv: '📊',
    ppt: '📊', pptx: '📊',
    py: '💻', js: '💻', ts: '💻', go: '💻', rs: '💻', sh: '💻',
    json: '⚙️', yaml: '⚙️', yml: '⚙️', toml: '⚙️', xml: '⚙️',
    exe: '⚙️', dmg: '💿', iso: '💿',
  }
  return map[ext] ?? '📜'
}
