import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface ErrorCardProps {
  glyph?: string
  title: string
  message: string
  action?: { label: string; href: string } | { label: string; onClick: () => void }
}

export default function ErrorCard({ glyph = '🚪', title, message, action }: ErrorCardProps) {
  return (
    <div className="error-card">
      <span className="error-glyph">{glyph}</span>
      <p className="error-title">{title}</p>
      <p className="error-message">{message}</p>
      {action && (
        'href' in action ? (
          <Link href={action.href} className="btn-portal no-underline flex items-center justify-center max-w-[220px] mx-auto">
            <span className="btn-rune">↩</span> {action.label}
          </Link>
        ) : (
          <Button variant="silver" onClick={action.onClick}>↩ {action.label}</Button>
        )
      )}
    </div>
  )
}
