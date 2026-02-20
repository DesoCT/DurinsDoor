/**
 * ECDH key exchange utilities for Handshake mode.
 * All cryptography runs in the browser via Web Crypto API.
 * The server never sees private keys or shared secrets.
 */

/** Generate a P-256 ECDH keypair. */
export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )
}

/** Export public key to base64 (uncompressed point format). */
export async function exportPublicKey(keyPair: CryptoKeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

/** Import a public key from base64. */
export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  )
}

/** Export private key to JWK JSON string for sessionStorage. */
export async function exportPrivateKey(keyPair: CryptoKeyPair): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
  return JSON.stringify(jwk)
}

/** Import a private key from JWK JSON string. */
export async function importPrivateKey(jwkStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkStr)
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )
}

/**
 * Derive a shared AES-256-GCM key from our private key and the other party's public key.
 * Both sides will arrive at the same key via ECDH.
 * extractable: true so we can export raw bytes for the verification phrase.
 */
export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    true, // extractable for verification phrase export
    ['encrypt', 'decrypt']
  )
}

/**
 * Derive the raw ECDH shared secret (32 bytes) for verification phrase generation.
 * This matches the Go CLI's DeriveSharedSecret which returns the raw ECDH output
 * before any KDF is applied.
 */
export async function deriveRawSharedSecret(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<ArrayBuffer> {
  return await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    256,
  )
}

/** Generate a random 6-character pairing code (unambiguous alphanumeric). */
export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}
