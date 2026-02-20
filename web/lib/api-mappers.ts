import type { Share, Handshake } from '@/lib/types'

/**
 * Maps a Supabase `shares` row to the JSON shape the CLI expects.
 *
 * CLI field        | Supabase column
 * -----------------|-------------------
 * file_size        | size_bytes
 * downloads        | download_count
 * password_protected | derived from password_hash
 * mime_type        | content_type
 */
export function shareToApiJson(row: Share) {
  return {
    id: row.id,
    filename: row.filename,
    file_size: row.size_bytes,
    mime_type: row.content_type ?? '',
    password_hash: row.password_hash ?? undefined,
    max_downloads: row.max_downloads ?? undefined,
    downloads: row.download_count,
    expires_at: row.expires_at ?? undefined,
    created_at: row.created_at,
    storage_path: row.storage_path,
    password_protected: row.password_hash !== null && row.password_hash !== '',
  }
}

/**
 * Maps a Supabase `handshakes` row to the JSON shape the CLI expects.
 */
export function handshakeToApiJson(row: Handshake) {
  return {
    id: row.id,
    code: row.code,
    receiver_public_key: row.receiver_public_key,
    sender_public_key: row.sender_public_key ?? undefined,
    share_id: row.share_id ?? undefined,
    created_at: row.created_at,
    expires_at: row.expires_at ?? undefined,
  }
}
