'use client'

import { useEffect, useRef, useCallback } from 'react'

const IDLE_MS = 6000       // wait 6s before whip appears
const WHIP_DURATION = 800  // ms for whip to reach cursor
const HOLD_MS = 2000       // ms whip holds the cursor
const RETRACT_MS = 600     // ms for whip to retract

/**
 * Balrog whip idle animation.
 * After the mouse is idle for IDLE_MS, a fiery whip emerges from the
 * bottom-left of the viewport, curves toward the cursor, wraps around it,
 * holds briefly, then retracts when the user moves the mouse.
 */
export default function BalrogWhip() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1, y: -1 })
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number>(0)
  const phaseRef = useRef<'idle' | 'extending' | 'holding' | 'retracting' | 'done'>('idle')
  const progressRef = useRef(0)
  const startTimeRef = useRef(0)
  const activeRef = useRef(false)

  const startWhip = useCallback(() => {
    if (activeRef.current) return
    if (mouseRef.current.x < 0) return // no mouse position yet
    activeRef.current = true
    phaseRef.current = 'extending'
    progressRef.current = 0
    startTimeRef.current = performance.now()
    draw()
  }, [])

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)

    // If whip is active and extending/holding, trigger retract
    if (activeRef.current && (phaseRef.current === 'extending' || phaseRef.current === 'holding')) {
      phaseRef.current = 'retracting'
      startTimeRef.current = performance.now()
      progressRef.current = 0
    }

    idleTimerRef.current = setTimeout(startWhip, IDLE_MS)
  }, [startWhip])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const now = performance.now()
    const elapsed = now - startTimeRef.current
    const mx = mouseRef.current.x
    const my = mouseRef.current.y

    // Whip origin: bottom-left corner
    const ox = 0
    const oy = H

    ctx.clearRect(0, 0, W, H)

    let t = 0 // 0→1 how much whip is shown

    if (phaseRef.current === 'extending') {
      t = Math.min(elapsed / WHIP_DURATION, 1)
      if (t >= 1) {
        phaseRef.current = 'holding'
        startTimeRef.current = now
      }
    } else if (phaseRef.current === 'holding') {
      t = 1
      if (elapsed > HOLD_MS) {
        phaseRef.current = 'retracting'
        startTimeRef.current = now
        progressRef.current = 0
      }
    } else if (phaseRef.current === 'retracting') {
      t = 1 - Math.min(elapsed / RETRACT_MS, 1)
      if (t <= 0) {
        phaseRef.current = 'done'
        activeRef.current = false
        ctx.clearRect(0, 0, W, H)
        return
      }
    }

    // Easing
    const eased = easeOutQuart(t)

    // Control points for a whip-like bezier from origin to mouse
    const cp1x = ox + (mx - ox) * 0.15
    const cp1y = oy - (oy - my) * 0.6
    const cp2x = ox + (mx - ox) * 0.65
    const cp2y = my + (oy - my) * 0.1

    // Target point (lerped toward mouse based on eased progress)
    const tx = ox + (mx - ox) * eased
    const ty = oy + (my - oy) * eased

    // Draw multiple layers for fiery glow
    const layers = [
      { width: 14, color: 'rgba(255, 60, 0, 0.08)', blur: 20 },
      { width: 8, color: 'rgba(255, 80, 10, 0.15)', blur: 12 },
      { width: 4, color: 'rgba(255, 120, 20, 0.5)', blur: 6 },
      { width: 2.5, color: 'rgba(255, 180, 40, 0.7)', blur: 3 },
      { width: 1.2, color: 'rgba(255, 220, 100, 0.9)', blur: 0 },
    ]

    // Flickering intensity
    const flicker = 0.85 + 0.15 * Math.sin(now * 0.012) * Math.cos(now * 0.007)

    for (const layer of layers) {
      ctx.save()
      ctx.globalAlpha = flicker
      ctx.strokeStyle = layer.color
      ctx.lineWidth = layer.width
      ctx.lineCap = 'round'
      if (layer.blur > 0) {
        ctx.filter = `blur(${layer.blur}px)`
      }
      ctx.beginPath()
      ctx.moveTo(ox, oy)
      ctx.bezierCurveTo(
        ox + (cp1x - ox) * eased, oy + (cp1y - oy) * eased,
        ox + (cp2x - ox) * eased, oy + (cp2y - oy) * eased,
        tx, ty
      )
      ctx.stroke()
      ctx.restore()
    }

    // Draw ember particles along the whip
    if (t > 0.3) {
      const particleCount = Math.floor(8 * eased)
      for (let i = 0; i < particleCount; i++) {
        const pt = (i + 0.5) / particleCount * eased
        const pos = bezierPoint(ox, oy,
          ox + (cp1x - ox) * eased, oy + (cp1y - oy) * eased,
          ox + (cp2x - ox) * eased, oy + (cp2y - oy) * eased,
          tx, ty, pt)
        const wobble = Math.sin(now * 0.01 + i * 2.3) * 6
        ctx.save()
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now * 0.008 + i)
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 140, 0, 0.8)' : 'rgba(255, 80, 0, 0.6)'
        ctx.beginPath()
        ctx.arc(pos.x + wobble, pos.y + wobble * 0.5, 1.5 + Math.random() * 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // Wrap effect at cursor when holding
    if (phaseRef.current === 'holding' && t === 1) {
      const wrapAngle = (now * 0.003) % (Math.PI * 2)
      const wrapR = 18 + 4 * Math.sin(now * 0.005)
      ctx.save()
      ctx.strokeStyle = 'rgba(255, 120, 20, 0.4)'
      ctx.lineWidth = 2.5
      ctx.filter = 'blur(2px)'
      ctx.beginPath()
      ctx.arc(mx, my, wrapR, wrapAngle, wrapAngle + Math.PI * 1.4)
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = 'rgba(255, 200, 60, 0.6)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(mx, my, wrapR - 2, wrapAngle + 0.3, wrapAngle + Math.PI * 1.2)
      ctx.stroke()
      ctx.restore()
    }

    rafRef.current = requestAnimationFrame(draw)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    function handleMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      resetIdleTimer()
    }

    function handleTouchMove(e: TouchEvent) {
      const touch = e.touches[0]
      if (touch) {
        mouseRef.current = { x: touch.clientX, y: touch.clientY }
        resetIdleTimer()
      }
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    // Start idle timer
    idleTimerRef.current = setTimeout(startWhip, IDLE_MS)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [resetIdleTimer, startWhip])

  return (
    <canvas
      ref={canvasRef}
      className="balrog-whip-canvas"
      aria-hidden="true"
    />
  )
}

/* ── Helpers ── */

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

function bezierPoint(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  t: number
) {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t
  return {
    x: uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3,
    y: uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3,
  }
}
