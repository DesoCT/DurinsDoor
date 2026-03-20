'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'

gsap.registerPlugin(useGSAP, DrawSVGPlugin)

export default function DoorSVG({ onStarClick }: { onStarClick: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useGSAP(() => {
    const svg = svgRef.current
    if (!svg) return

    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })

    // 1. Stone wall fades in
    tl.from(svg.querySelector('.door-wall')!, { opacity: 0, duration: 0.5 }, 0)

    // 2. Door void fades in
    tl.from(svg.querySelector('.door-void')!, { opacity: 0, duration: 0.6 }, 0.2)

    // 3. Draw the three arch outlines from bottom up
    tl.from('.arch-outer', { drawSVG: '0%', duration: 1.8, ease: 'power1.inOut' }, 0.3)
    tl.from('.arch-mid', { drawSVG: '0%', duration: 1.6, ease: 'power1.inOut' }, 0.5)
    tl.from('.arch-gold', { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut' }, 0.7)

    // 4. Rune inscription band fades in
    tl.from(svg.querySelector('.rune-inscription')!, { opacity: 0, duration: 0.8 }, 1.2)

    // 5. Pillar rune strips draw
    tl.from('.rune-line-anim', { drawSVG: '100% 100%', duration: 1.0, stagger: 0.3, ease: 'power1.out' }, 1.0)

    // 6. Pillar runes stagger in
    tl.from('.pillar-rune', { opacity: 0, y: 4, duration: 0.3, stagger: 0.06 }, 1.2)

    // 7. Star of Durin scales in
    tl.from(svg.querySelector('.star-of-durin')!, { scale: 0, transformOrigin: 'center', duration: 0.8, ease: 'back.out(1.4)' }, 1.4)

    // 8. Elvish tree fades in
    tl.from(svg.querySelector('.elvish-tree')!, { opacity: 0, duration: 0.6 }, 1.6)

    // 9. Crown jewel pulses in
    tl.from(svg.querySelector('.crown-jewel')!, { opacity: 0, scale: 0, transformOrigin: 'center', duration: 0.5, ease: 'back.out(2)' }, 1.8)

    // 10. Crack glow fades in
    tl.from(svg.querySelector('.crack-glow')!, { opacity: 0, duration: 0.8 }, 1.5)

    // 11. Corner knotwork
    tl.from('.corner-knot', { opacity: 0, scale: 0, transformOrigin: 'center', duration: 0.4, stagger: 0.15 }, 2.0)

    // Rune inscription starts at baseline opacity
    gsap.set('.rune-inscription', { opacity: 0.3 })

  }, { scope: svgRef })

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // Scale to SVG viewBox coordinates
    const svgX = (x / rect.width) * 400
    const svgY = (y / rect.height) * 520
    // Distance to rune inscription (at y=52, centered at x=200)
    const dist = Math.sqrt((svgX - 200) ** 2 + (svgY - 52) ** 2)
    const glow = Math.max(0, 1 - dist / 200)
    gsap.to('.rune-inscription', {
      opacity: 0.3 + glow * 0.7,
      filter: `drop-shadow(0 0 ${glow * 8}px rgba(107,197,255,${glow * 0.6}))`,
      duration: 0.3,
      overwrite: true,
    })
  }

  const handleMouseLeave = () => {
    gsap.to('.rune-inscription', {
      opacity: 0.3,
      filter: 'drop-shadow(0 0 0px rgba(107,197,255,0))',
      duration: 0.5,
      overwrite: true,
    })
  }

  return (
    <svg ref={svgRef} className="door-svg" viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Durin's Door arch" id="door-svg" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <defs>
        <filter id="glow-elvish" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-silver" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-gold" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-crack" x="-200%" y="-50%" width="500%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="voidGrad" cx="50%" cy="25%" r="70%">
          <stop offset="0%" stopColor="#0c1424"/>
          <stop offset="60%" stopColor="#060910"/>
          <stop offset="100%" stopColor="#020408"/>
        </radialGradient>
        <radialGradient id="crackGrad" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="rgba(107,197,255,0.45)"/>
          <stop offset="100%" stopColor="rgba(107,197,255,0)"/>
        </radialGradient>
        <pattern id="stoneTex" x="0" y="0" width="60" height="44" patternUnits="userSpaceOnUse">
          <rect width="60" height="44" fill="#0d1525"/>
          <line x1="0" y1="0" x2="60" y2="0" stroke="#111e34" strokeWidth="0.7"/>
          <line x1="0" y1="22" x2="60" y2="22" stroke="#111e34" strokeWidth="0.7"/>
          <line x1="30" y1="0" x2="30" y2="22" stroke="#111e34" strokeWidth="0.4"/>
        </pattern>
        <clipPath id="archVoidClip">
          <path d="M 88 512 L 88 308 Q 86 105 200 68 Q 314 105 312 308 L 312 512 Z"/>
        </clipPath>
      </defs>

      {/* Stone wall */}
      <path className="door-wall" fill="url(#stoneTex)" stroke="#1a2844" strokeWidth="0.6" fillRule="evenodd"
        d="M 0 0 L 400 0 L 400 520 L 0 520 Z M 88 512 L 88 308 Q 86 105 200 68 Q 314 105 312 308 L 312 512 Z"/>

      {/* Door void */}
      <path className="door-void" fill="url(#voidGrad)" d="M 88 512 L 88 308 Q 86 105 200 68 Q 314 105 312 308 L 312 512 Z"/>

      {/* Base crack glow */}
      <ellipse className="crack-glow" cx="200" cy="512" rx="90" ry="16" fill="url(#crackGrad)">
        <animate attributeName="opacity" values="0.5;1.0;0.5" dur="3.2s" repeatCount="indefinite"/>
      </ellipse>

      {/* Arch outlines — DrawSVG animated */}
      <path className="arch-outer" fill="none" stroke="#2e4268" strokeWidth="1.2" opacity="0.45"
        d="M 65 512 L 65 305 Q 62 90 200 48 Q 338 90 335 305 L 335 512"/>
      <path className="arch-mid" fill="none" stroke="#3a5080" strokeWidth="2"
        d="M 88 512 L 88 308 Q 86 105 200 68 Q 314 105 312 308 L 312 512"/>
      <path className="arch-gold" fill="none" stroke="var(--gold)" strokeWidth="1" opacity="0.7"
        d="M 106 512 L 106 312 Q 106 122 200 87 Q 294 122 294 312 L 294 512"/>

      {/* Rune inscription band */}
      <text className="rune-inscription rune-text" x="200" y="52" textAnchor="middle" fontSize="12" letterSpacing="5">ᛗᛖᛚᛚᛟᚾ · ᚠᚱᛖᛟᚾᛞ · ᛖᚾᛏᛖᚱ</text>

      {/* Rune spin ring */}
      <circle cx="200" cy="200" r="148" fill="none" stroke="rgba(107,197,255,0.06)" strokeWidth="0.8" strokeDasharray="4 8">
        <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="60s" repeatCount="indefinite"/>
      </circle>

      {/* Star of Durin */}
      <g filter="url(#glow-silver)">
        <g className="star-of-durin" transform="translate(200,196)" style={{ cursor: 'pointer' }}
           onClick={e => { e.stopPropagation(); onStarClick() }}
           role="button" aria-label="Star of Durin">
          <line x1="0" y1="-46" x2="0" y2="46" stroke="var(--silver-glow)" strokeWidth="1.5"/>
          <line x1="-46" y1="0" x2="46" y2="0" stroke="var(--silver-glow)" strokeWidth="1.5"/>
          <line x1="-33" y1="-33" x2="33" y2="33" stroke="var(--silver-glow)" strokeWidth="1.4"/>
          <line x1="33" y1="-33" x2="-33" y2="33" stroke="var(--silver-glow)" strokeWidth="1.4"/>
          <polygon points="0,-54 38,-38 54,0 38,38 0,54 -38,38 -54,0 -38,-38" fill="none" stroke="var(--silver)" strokeWidth="0.7" opacity="0.45"/>
          <circle r="30" fill="none" stroke="var(--silver)" strokeWidth="0.5" opacity="0.3"/>
          <circle r="10" fill="none" stroke="var(--silver-glow)" strokeWidth="1.2"/>
          <circle r="4" fill="var(--silver-glow)" stroke="none"/>
          <circle r="60" fill="transparent" stroke="none"/>
        </g>
      </g>

      {/* Elvish tree */}
      <g className="elvish-tree" filter="url(#glow-elvish)" opacity="0.80">
        <line x1="200" y1="278" x2="200" y2="335" stroke="var(--elvish)" strokeWidth="1.6"/>
        <line x1="200" y1="335" x2="182" y2="346" stroke="var(--elvish)" strokeWidth="1"/>
        <line x1="200" y1="335" x2="218" y2="346" stroke="var(--elvish)" strokeWidth="1"/>
        <line x1="200" y1="325" x2="176" y2="312" stroke="var(--elvish)" strokeWidth="1.0"/>
        <line x1="200" y1="313" x2="170" y2="296" stroke="var(--elvish)" strokeWidth="0.8"/>
        <line x1="200" y1="325" x2="224" y2="312" stroke="var(--elvish)" strokeWidth="1.0"/>
        <line x1="200" y1="313" x2="230" y2="296" stroke="var(--elvish)" strokeWidth="0.8"/>
        <circle cx="174" cy="310" r="2.8" fill="var(--elvish)" opacity="0.75"/>
        <circle cx="168" cy="293" r="2.2" fill="var(--elvish)" opacity="0.65"/>
        <circle cx="226" cy="310" r="2.8" fill="var(--elvish)" opacity="0.75"/>
        <circle cx="232" cy="293" r="2.2" fill="var(--elvish)" opacity="0.65"/>
        <circle cx="200" cy="255" r="2.5" fill="var(--elvish)" opacity="0.55"/>
      </g>

      {/* Pillar rune strips */}
      <rect fill="rgba(30,44,72,0.35)" stroke="rgba(42,58,92,0.3)" strokeWidth="0.5" x="65" y="112" width="23" height="195" rx="2"/>
      <rect fill="rgba(30,44,72,0.35)" stroke="rgba(42,58,92,0.3)" strokeWidth="0.5" x="312" y="112" width="23" height="195" rx="2"/>

      {/* Left pillar runes */}
      {['ᚠ','ᚢ','ᚱ','ᚨ','ᛊ','ᛏ','ᛁ','ᛜ'].map((r, i) => (
        <text key={`L${i}`} className="pillar-rune rune-text" x="76.5" y={140 + i * 21} textAnchor="middle" fontSize="11">{r}</text>
      ))}
      {/* Right pillar runes */}
      {['ᛞ','ᚢ','ᚱ','ᛁ','ᚾ','ᛊ','ᛟ','ᛗ'].map((r, i) => (
        <text key={`R${i}`} className="pillar-rune rune-text" x="323.5" y={140 + i * 21} textAnchor="middle" fontSize="11">{r}</text>
      ))}

      {/* Animated rune lines — DrawSVG */}
      <line className="rune-line-anim" x1="76.5" y1="118" x2="76.5" y2="305" stroke="var(--elvish)" strokeWidth="0.6" opacity="0.3"/>
      <line className="rune-line-anim" x1="323.5" y1="118" x2="323.5" y2="305" stroke="var(--elvish)" strokeWidth="0.6" opacity="0.3"/>

      {/* Central door crack */}
      <line x1="200" y1="90" x2="200" y2="512" stroke="var(--elvish)" strokeWidth="0.6" filter="url(#glow-crack)">
        <animate attributeName="opacity" values="0.10;0.38;0.10" dur="4.5s" repeatCount="indefinite"/>
      </line>

      {/* Crown jewel */}
      <g className="crown-jewel">
        <circle cx="200" cy="68" r="5" fill="none" stroke="var(--gold)" strokeWidth="1.2" filter="url(#glow-gold)" opacity="0.8"/>
        <circle cx="200" cy="68" r="9" fill="none" stroke="var(--gold-dim)" strokeWidth="0.5" opacity="0.45"/>
        <circle cx="200" cy="68" r="2.5" fill="var(--gold)" filter="url(#glow-gold)" opacity="0.9"/>
      </g>

      {/* Stone threshold */}
      <rect x="55" y="508" width="290" height="9" rx="2" fill="#0d1525" stroke="#1e2d48" strokeWidth="0.8"/>

      {/* Corner knotwork */}
      <circle className="corner-knot" cx="86" cy="110" r="8" fill="none" stroke="rgba(107,197,255,0.18)" strokeWidth="0.8"/>
      <circle className="corner-knot" cx="314" cy="110" r="8" fill="none" stroke="rgba(107,197,255,0.18)" strokeWidth="0.8"/>
    </svg>
  )
}
