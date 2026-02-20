import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { shareToApiJson } from '@/lib/api-mappers'
import { randomUUID } from 'crypto'

/**
 * Hash a password with SHA-256 → base64, matching the web client's hashPassword().
 */
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(password))
  return Buffer.from(hash).toString('base64')
}

/**
 * POST /api/upload — Upload an encrypted file via multipart form.
 *
 * Form fields:
 *   file          (required) — the encrypted blob
 *   password      (optional) — plaintext password, hashed server-side
 *   expires_at    (optional) — RFC3339 expiry timestamp
 *   max_downloads (optional) — integer download limit
 */
export async function POST(request: NextRequest) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
    }

    const filename = (file as File).name || 'upload'
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const sizeBytes = fileBuffer.length

    // Generate storage path
    const storagePath = `cli/${randomUUID()}`

    const supabase = createAdminClient()

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('encrypted-files')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      })

    if (uploadErr) {
      return NextResponse.json(
        { error: 'Storage upload failed: ' + uploadErr.message },
        { status: 500 },
      )
    }

    // Parse optional fields
    const passwordRaw = formData.get('password') as string | null
    const expiresAtRaw = formData.get('expires_at') as string | null
    const maxDownloadsRaw = formData.get('max_downloads') as string | null

    let passwordHash: string | null = null
    if (passwordRaw) {
      passwordHash = await hashPassword(passwordRaw)
    }

    let expiresAt: string
    if (expiresAtRaw) {
      // Validate it parses as a date
      const d = new Date(expiresAtRaw)
      expiresAt = isNaN(d.getTime())
        ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
        : d.toISOString()
    } else {
      expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    }

    let maxDownloads: number | null = null
    if (maxDownloadsRaw) {
      const n = parseInt(maxDownloadsRaw, 10)
      if (!isNaN(n) && n > 0) maxDownloads = n
    }

    // Insert share record
    const { data, error: insertErr } = await supabase
      .from('shares')
      .insert({
        filename,
        size_bytes: sizeBytes,
        content_type: 'application/octet-stream',
        storage_path: storagePath,
        password_hash: passwordHash,
        max_downloads: maxDownloads,
        download_count: 0,
        expires_at: expiresAt,
        created_by: null,
      })
      .select()
      .single()

    if (insertErr || !data) {
      // Clean up the uploaded file on DB failure
      await supabase.storage.from('encrypted-files').remove([storagePath])
      return NextResponse.json(
        { error: insertErr?.message ?? 'Failed to create share record' },
        { status: 500 },
      )
    }

    return NextResponse.json(shareToApiJson(data), { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
