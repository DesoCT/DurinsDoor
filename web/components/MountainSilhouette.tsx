export default function MountainSilhouette({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'mountain-silhouette'} viewBox="0 0 1400 130" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="mountFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0e1a" stopOpacity="0" />
          <stop offset="55%" stopColor="#080c16" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#050810" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M0 130 L0 90 L60 55 L110 75 L170 32 L230 62 L290 20 L360 58 L430 35 L500 70 L570 15 L640 55 L700 30 L760 65 L830 10 L890 50 L950 25 L1020 60 L1080 38 L1140 70 L1200 22 L1260 55 L1320 40 L1380 68 L1400 50 L1400 130 Z" fill="#07090f" />
      <rect x="0" y="0" width="1400" height="130" fill="url(#mountFade)" />
    </svg>
  )
}
