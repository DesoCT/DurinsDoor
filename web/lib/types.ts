export interface Share {
  id: string
  filename: string
  size_bytes: number
  content_type: string | null
  storage_path: string
  password_hash: string | null
  max_downloads: number | null
  download_count: number
  expires_at: string | null
  created_at: string
  created_by: string | null
}

export interface Handshake {
  id: string
  code: string
  receiver_public_key: string
  sender_public_key: string | null
  share_id: string | null
  status: 'waiting' | 'paired' | 'completed' | 'expired'
  expires_at: string
  created_at: string
}
