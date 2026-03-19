import { createClient } from '@/lib/supabase/server'
import { humanSize, humanDuration, fileIcon } from '@/lib/crypto'
import type { Share } from '@/lib/types'
import DownloadClient from './DownloadClient'
import SmallArch from '@/components/SmallArch'
import ErrorCard from '@/components/ErrorCard'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DownloadPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: share, error } = await supabase
    .from('shares')
    .select('*')
    .eq('id', id)
    .single()

  // Error states
  if (error || !share) {
    return <DownloadError message="This portal does not exist or has already closed." />
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return <DownloadError message="This portal has expired. The door is sealed." />
  }

  if (share.max_downloads && share.download_count >= share.max_downloads) {
    return <DownloadError message="This portal has reached its download limit. The door is sealed." />
  }

  const msLeft = share.expires_at ? new Date(share.expires_at).getTime() - Date.now() : null
  const downloadsLeft = share.max_downloads ? share.max_downloads - share.download_count : null

  return (
    <DownloadClient
      share={share as Share}
      humanSizeStr={humanSize(share.size_bytes)}
      expiresIn={msLeft !== null ? humanDuration(msLeft) : '∞'}
      fileIconStr={fileIcon(share.filename)}
      downloadsLeft={downloadsLeft}
    />
  )
}

function DownloadError({ message }: { message: string }) {
  return (
    <>
      <div className="mist-layer" />
      <div className="page-wrapper">
        <div style={{ marginBottom: '1.5rem', opacity: 0.55 }}>
          <SmallArch />
        </div>
        <div className="download-card fade-in-up">
          <ErrorCard
            title="The Door is Sealed"
            message={message}
            action={{ label: 'Return Home', href: '/' }}
          />
        </div>
      </div>
    </>
  )
}
