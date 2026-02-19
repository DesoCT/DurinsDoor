'use client'
import { useEffect, useRef } from 'react'

export default function StarCanvas({ count = 200, heightFrac = 0.7 }: { count?: number; heightFrac?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const cx = cv.getContext('2d')
    if (!cx) return

    let W = 0, H = 0
    let stars: { x: number; y: number; r: number; phase: number; speed: number; blue: boolean }[] = []
    let frame = 0
    let rafId: number

    function resize() {
      W = cv!.width = window.innerWidth
      H = cv!.height = window.innerHeight
      stars = []
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H * heightFrac,
          r: Math.random() * 1.3 + 0.2,
          phase: Math.random() * Math.PI * 2,
          speed: 0.004 + Math.random() * 0.016,
          blue: Math.random() < 0.2,
        })
      }
    }

    function draw() {
      cx!.clearRect(0, 0, W, H)
      frame++
      for (const s of stars) {
        const lum = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(s.phase + frame * s.speed))
        cx!.fillStyle = s.blue
          ? `rgba(150,210,255,${lum})`
          : `rgba(215,205,185,${lum * 0.85})`
        cx!.beginPath()
        cx!.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        cx!.fill()
      }
      rafId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafId)
    }
  }, [count, heightFrac])

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
