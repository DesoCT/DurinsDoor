import { useId } from 'react'

export default function SmallArch({ size = 60 }: { size?: number }) {
  const filterId = useId()
  const height = Math.round(size * 1.2)

  return (
    <svg width={size} height={height} viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path fill="#0d1525" stroke="#2a3a5c" strokeWidth="1" fillRule="evenodd"
        d="M 0 80 L 0 0 L 60 0 L 60 80 Z M 10 78 L 10 42 Q 9 12 30 8 Q 51 12 50 42 L 50 78 Z" />
      <path fill="#060910" d="M 10 78 L 10 42 Q 9 12 30 8 Q 51 12 50 42 L 50 78 Z" />
      <path fill="none" stroke="var(--gold)" strokeWidth="0.8" opacity="0.6"
        d="M 10 42 Q 9 12 30 8 Q 51 12 50 42" />
      <g filter={`url(#${filterId})`} transform="translate(30,36)">
        <line x1="0" y1="-10" x2="0" y2="10" stroke="var(--silver-glow)" strokeWidth="0.9" />
        <line x1="-10" y1="0" x2="10" y2="0" stroke="var(--silver-glow)" strokeWidth="0.9" />
        <line x1="-7" y1="-7" x2="7" y2="7" stroke="var(--silver-glow)" strokeWidth="0.8" />
        <line x1="7" y1="-7" x2="-7" y2="7" stroke="var(--silver-glow)" strokeWidth="0.8" />
        <circle r="2" fill="var(--silver-glow)" />
      </g>
    </svg>
  )
}
