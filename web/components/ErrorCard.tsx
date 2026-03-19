import Link from 'next/link'

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
          <Link href={action.href} className="btn-portal" style={{ maxWidth: '220px', margin: '0 auto', textDecoration: 'none', display: 'flex' }}>
            <span className="btn-rune">↩</span> {action.label}
          </Link>
        ) : (
          <button className="btn-silver" onClick={action.onClick}>↩ {action.label}</button>
        )
      )}
    </div>
  )
}
