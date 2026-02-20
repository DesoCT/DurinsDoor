'use client'

import { useEffect, useRef, useCallback } from 'react'

const IDLE_MS = 6000       // wait 6s before whip appears
const WHIP_DURATION = 500  // ms for whip to snap to cursor (faster = more violent)
const HOLD_MS = 2400       // ms whip holds the cursor
const RETRACT_MS = 350     // ms for whip to yank back

// Spark pool — reused across frames to avoid GC churn
interface Spark {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; bright: boolean
}

/**
 * Balrog whip idle animation.
 * After the mouse is idle for IDLE_MS, a fiery whip cracks out from the
 * bottom-left, snaps toward the cursor with aggressive lashing motion,
 * wraps around it with violent flames, then retracts.
 */
export default function BalrogWhip() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1, y: -1 })
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number>(0)
  const phaseRef = useRef<'idle' | 'extending' | 'holding' | 'retracting' | 'done'>('idle')
  const startTimeRef = useRef(0)
  const activeRef = useRef(false)
  const sparksRef = useRef<Spark[]>([])
  // snapshot mouse position at whip start so it targets a fixed point
  const targetRef = useRef({ x: 0, y: 0 })

  const startWhip = useCallback(() => {
    if (activeRef.current) return
    if (mouseRef.current.x < 0) return
    activeRef.current = true
    phaseRef.current = 'extending'
    startTimeRef.current = performance.now()
    targetRef.current = { ...mouseRef.current }
    sparksRef.current = []
    draw()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)

    if (activeRef.current && (phaseRef.current === 'extending' || phaseRef.current === 'holding')) {
      phaseRef.current = 'retracting'
      startTimeRef.current = performance.now()
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
    const mx = targetRef.current.x
    const my = targetRef.current.y

    // Whip origin: bottom-left corner, slightly inset
    const ox = -20
    const oy = H + 20

    ctx.clearRect(0, 0, W, H)

    let t = 0

    if (phaseRef.current === 'extending') {
      t = Math.min(elapsed / WHIP_DURATION, 1)
      if (t >= 1) {
        phaseRef.current = 'holding'
        startTimeRef.current = now
        // Burst of sparks on impact
        spawnImpactSparks(mx, my, 25)
      }
    } else if (phaseRef.current === 'holding') {
      t = 1
      if (elapsed > HOLD_MS) {
        phaseRef.current = 'retracting'
        startTimeRef.current = now
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

    // Aggressive snap easing — overshoots then settles
    const eased = phaseRef.current === 'retracting'
      ? easeInBack(1 - t)  // yank back hard
      : easeOutBack(t)     // snap past target then settle

    // Whipping oscillation — the curve thrashes side-to-side during extension
    const lashFreq = 14
    const lashDecay = Math.max(0, 1 - t * 1.8) // dies down as it reaches target
    const lash = Math.sin(t * lashFreq) * lashDecay * 120

    // Perpendicular direction for lash offset
    const dx = mx - ox
    const dy = my - oy
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const perpX = -dy / len
    const perpY = dx / len

    // Control points with violent lashing motion
    const cp1x = ox + dx * 0.25 + perpX * lash * 1.4
    const cp1y = oy + dy * 0.25 + perpY * lash * 1.4
    const cp2x = ox + dx * 0.65 - perpX * lash * 0.7
    const cp2y = oy + dy * 0.65 - perpY * lash * 0.7

    // Target point
    const tx = ox + dx * Math.min(eased, 1.0)
    const ty = oy + dy * Math.min(eased, 1.0)

    // Secondary whip tendril — offset and slightly delayed
    const lash2 = Math.sin(t * lashFreq + 1.8) * lashDecay * 80
    const cp1x2 = ox + dx * 0.20 - perpX * lash2 * 1.2
    const cp1y2 = oy + dy * 0.20 - perpY * lash2 * 1.2
    const cp2x2 = ox + dx * 0.55 + perpX * lash2 * 0.9
    const cp2y2 = oy + dy * 0.55 + perpY * lash2 * 0.9
    const tendrilEased = Math.min(eased * 0.85, 1)
    const tx2 = ox + dx * tendrilEased
    const ty2 = oy + dy * tendrilEased

    // Aggressive flickering
    const flicker = 0.7 + 0.3 * Math.sin(now * 0.025) * Math.cos(now * 0.017)
    const rage = 0.8 + 0.2 * Math.sin(now * 0.04) // fast pulse

    // ── Draw main whip ──
    const mainLayers = [
      { width: 28, color: 'rgba(180, 20, 0, 0.06)', blur: 30 },
      { width: 18, color: 'rgba(255, 40, 0, 0.12)', blur: 18 },
      { width: 10, color: 'rgba(255, 80, 0, 0.35)', blur: 10 },
      { width: 5, color: `rgba(255, 140, 10, ${0.7 * rage})`, blur: 4 },
      { width: 2.5, color: `rgba(255, 200, 40, ${0.85 * rage})`, blur: 1 },
      { width: 1.0, color: `rgba(255, 255, 160, ${0.95 * rage})`, blur: 0 },
    ]

    for (const layer of mainLayers) {
      ctx.save()
      ctx.globalAlpha = flicker
      ctx.strokeStyle = layer.color
      ctx.lineWidth = layer.width
      ctx.lineCap = 'round'
      if (layer.blur > 0) ctx.filter = `blur(${layer.blur}px)`
      ctx.beginPath()
      ctx.moveTo(ox, oy)
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty)
      ctx.stroke()
      ctx.restore()
    }

    // ── Draw secondary tendril ──
    const tendrilLayers = [
      { width: 12, color: 'rgba(200, 30, 0, 0.06)', blur: 16 },
      { width: 6, color: 'rgba(255, 60, 0, 0.2)', blur: 8 },
      { width: 2.5, color: 'rgba(255, 120, 20, 0.5)', blur: 3 },
      { width: 1.0, color: 'rgba(255, 180, 60, 0.7)', blur: 0 },
    ]

    for (const layer of tendrilLayers) {
      ctx.save()
      ctx.globalAlpha = flicker * 0.6
      ctx.strokeStyle = layer.color
      ctx.lineWidth = layer.width
      ctx.lineCap = 'round'
      if (layer.blur > 0) ctx.filter = `blur(${layer.blur}px)`
      ctx.beginPath()
      ctx.moveTo(ox, oy)
      ctx.bezierCurveTo(cp1x2, cp1y2, cp2x2, cp2y2, tx2, ty2)
      ctx.stroke()
      ctx.restore()
    }

    // ── Ember trail along main whip ──
    if (t > 0.15) {
      const count = Math.floor(16 * Math.min(eased, 1))
      for (let i = 0; i < count; i++) {
        const pt = (i + 0.5) / count * Math.min(eased, 1)
        const pos = bezierPoint(ox, oy, cp1x, cp1y, cp2x, cp2y, tx, ty, pt)
        // Violent wobble
        const wobbleAmt = 12 + 8 * Math.sin(now * 0.015 + i * 1.7)
        const wobX = Math.sin(now * 0.02 + i * 2.3) * wobbleAmt
        const wobY = Math.cos(now * 0.018 + i * 3.1) * wobbleAmt * 0.6
        const sz = 2 + Math.random() * 3

        ctx.save()
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now * 0.015 + i)
        // Hot color palette
        const colors = [
          'rgba(255, 220, 80, 0.9)',
          'rgba(255, 140, 0, 0.85)',
          'rgba(255, 60, 0, 0.8)',
          'rgba(255, 255, 200, 0.95)',
        ]
        ctx.fillStyle = colors[i % colors.length]
        ctx.shadowColor = 'rgba(255, 100, 0, 0.6)'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(pos.x + wobX, pos.y + wobY, sz, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // ── Continuous spark emission along whip ──
    if (t > 0.3 && Math.random() < 0.6) {
      const spawnT = Math.random() * Math.min(eased, 1)
      const pos = bezierPoint(ox, oy, cp1x, cp1y, cp2x, cp2y, tx, ty, spawnT)
      sparksRef.current.push({
        x: pos.x, y: pos.y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        life: 1, maxLife: 30 + Math.random() * 30,
        size: 1 + Math.random() * 2,
        bright: Math.random() < 0.3,
      })
    }

    // ── Update & draw sparks ──
    const sparks = sparksRef.current
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.08 // gravity
      s.vx *= 0.98
      s.life++
      const alpha = Math.max(0, 1 - s.life / s.maxLife)
      if (alpha <= 0) { sparks.splice(i, 1); continue }

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = s.bright
        ? `rgba(255, 255, 180, ${alpha})`
        : `rgba(255, ${80 + Math.floor(80 * alpha)}, 0, ${alpha})`
      ctx.shadowColor = 'rgba(255, 80, 0, 0.5)'
      ctx.shadowBlur = 4
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * alpha, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // ── Violent wrap at cursor when holding ──
    if (phaseRef.current === 'holding' && t === 1) {
      const holdElapsed = now - startTimeRef.current

      // Multiple spinning wrap tendrils
      for (let w = 0; w < 3; w++) {
        const baseAngle = (now * 0.006 + w * 2.1) % (Math.PI * 2)
        const wrapR = 14 + 8 * Math.sin(now * 0.008 + w) + w * 4
        const arcLen = Math.PI * (1.0 + 0.4 * Math.sin(now * 0.004 + w * 1.5))

        // Outer glow
        ctx.save()
        ctx.strokeStyle = `rgba(255, ${60 + w * 30}, 0, ${0.25 - w * 0.05})`
        ctx.lineWidth = 6 - w
        ctx.filter = `blur(${4 - w}px)`
        ctx.beginPath()
        ctx.arc(mx, my, wrapR + 4, baseAngle, baseAngle + arcLen)
        ctx.stroke()
        ctx.restore()

        // Hot core
        ctx.save()
        ctx.strokeStyle = `rgba(255, ${180 + w * 25}, ${40 + w * 30}, ${0.7 - w * 0.15})`
        ctx.lineWidth = 2.5 - w * 0.5
        ctx.beginPath()
        ctx.arc(mx, my, wrapR, baseAngle + 0.2, baseAngle + arcLen - 0.3)
        ctx.stroke()
        ctx.restore()
      }

      // Pulsing heat glow around cursor
      const pulseR = 30 + 10 * Math.sin(now * 0.01)
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, pulseR)
      grad.addColorStop(0, `rgba(255, 80, 0, ${0.15 * rage})`)
      grad.addColorStop(0.5, `rgba(255, 40, 0, ${0.06 * rage})`)
      grad.addColorStop(1, 'rgba(255, 0, 0, 0)')
      ctx.save()
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(mx, my, pulseR, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // Emit sparks from the wrap
      if (Math.random() < 0.4) {
        const angle = Math.random() * Math.PI * 2
        sparksRef.current.push({
          x: mx + Math.cos(angle) * 18,
          y: my + Math.sin(angle) * 18,
          vx: Math.cos(angle) * (2 + Math.random() * 3),
          vy: Math.sin(angle) * (2 + Math.random() * 3) - 1,
          life: 1, maxLife: 20 + Math.random() * 20,
          size: 1 + Math.random() * 2,
          bright: Math.random() < 0.4,
        })
      }

      // Screen-edge vignette heat during hold
      if (holdElapsed > 400) {
        const vigAlpha = Math.min((holdElapsed - 400) / 1000, 0.12) * rage
        const vigGrad = ctx.createRadialGradient(mx, my, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8)
        vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
        vigGrad.addColorStop(1, `rgba(120, 20, 0, ${vigAlpha})`)
        ctx.save()
        ctx.fillStyle = vigGrad
        ctx.fillRect(0, 0, W, H)
        ctx.restore()
      }
    }

    rafRef.current = requestAnimationFrame(draw)
  }

  function spawnImpactSparks(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 6
      sparksRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        maxLife: 25 + Math.random() * 35,
        size: 1.5 + Math.random() * 3,
        bright: Math.random() < 0.5,
      })
    }
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

/** Snap past target then settle — gives the whip crack feel */
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Yank back hard */
function easeInBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return c3 * t * t * t - c1 * t * t
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
