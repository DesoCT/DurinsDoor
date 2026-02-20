'use client'

import { useEffect, useRef, useCallback } from 'react'

/* ── Timing constants ── */
const INITIAL_IDLE_MS = 6000   // first whip after 6s idle
const MIN_ATTACK_MS = 1800     // min gap between attacks once active
const MAX_ATTACK_MS = 4500     // max gap
const WHIP_DURATION = 550      // ms for whip to reach target
const RETRACT_MS = 400         // ms for whip to retract
const CATCH_RADIUS = 50        // px — how close cursor must be to get caught
const CAUGHT_DURATION = 6500   // ms for the full Balrog caught sequence
const COOLDOWN_AFTER_CATCH = 12000 // pause after caught animation

/* ── Types ── */
interface Spark {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; bright: boolean
}

type Phase = 'idle' | 'extending' | 'retracting' | 'caught' | 'cooldown'

interface FallingRock {
  x: number; y: number; vy: number; size: number; rot: number; rotSpeed: number
}

/**
 * Balrog whip dodge game.
 *
 * After the mouse idles, a fiery S-curve whip cracks from the bottom-left
 * toward the cursor. The user can dodge by moving. If the whip tip lands
 * near the cursor → caught! Full-screen Balrog mine collapse animation.
 * Attacks repeat at random intervals.
 */
export default function BalrogWhip() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: -1, y: -1 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number>(0)
  const phaseRef = useRef<Phase>('idle')
  const startTimeRef = useRef(0)
  const targetRef = useRef({ x: 0, y: 0 })
  const sparksRef = useRef<Spark[]>([])
  const huntingRef = useRef(false)  // are we in attack-repeat mode?
  const caughtTimeRef = useRef(0)
  const rocksRef = useRef<FallingRock[]>([])
  const dodgeCountRef = useRef(0)

  /* ── Schedule next attack ── */
  const scheduleAttack = useCallback((delay?: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const ms = delay ?? (MIN_ATTACK_MS + Math.random() * (MAX_ATTACK_MS - MIN_ATTACK_MS))
    timerRef.current = setTimeout(() => {
      if (mouseRef.current.x < 0) { scheduleAttack(1000); return }
      if (phaseRef.current !== 'idle' && phaseRef.current !== 'cooldown') return
      phaseRef.current = 'extending'
      startTimeRef.current = performance.now()
      targetRef.current = { ...mouseRef.current }
      sparksRef.current = []
      huntingRef.current = true
      draw()
    }, ms)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Mouse move: reset idle or dodge detection ── */
  const handleMove = useCallback((x: number, y: number) => {
    mouseRef.current = { x, y }
    // If idle and not hunting yet, restart idle timer
    if (!huntingRef.current && phaseRef.current === 'idle') {
      scheduleAttack(INITIAL_IDLE_MS)
    }
  }, [scheduleAttack])

  /* ── Caught sequence ── */
  function triggerCaught() {
    phaseRef.current = 'caught'
    caughtTimeRef.current = performance.now()
    rocksRef.current = []
    dodgeCountRef.current = 0

    // Show overlay
    const ol = overlayRef.current
    if (ol) {
      ol.style.display = 'flex'
      ol.style.opacity = '0'
    }
  }

  /* ── Main draw loop ── */
  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const now = performance.now()
    const elapsed = now - startTimeRef.current

    ctx.clearRect(0, 0, W, H)

    if (phaseRef.current === 'caught') {
      drawCaughtSequence(ctx, W, H, now)
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    if (phaseRef.current === 'idle' || phaseRef.current === 'cooldown') return

    const mx = targetRef.current.x
    const my = targetRef.current.y

    // Origin: bottom-left
    const ox = -30
    const oy = H + 30

    let t = 0

    if (phaseRef.current === 'extending') {
      t = Math.min(elapsed / WHIP_DURATION, 1)
      if (t >= 1) {
        // Check if caught
        const curX = mouseRef.current.x
        const curY = mouseRef.current.y
        const dist = Math.sqrt((curX - mx) ** 2 + (curY - my) ** 2)
        if (dist < CATCH_RADIUS) {
          // CAUGHT!
          spawnImpactSparks(mx, my, 40)
          triggerCaught()
          rafRef.current = requestAnimationFrame(draw)
          return
        }
        // Missed — retract
        phaseRef.current = 'retracting'
        startTimeRef.current = now
        dodgeCountRef.current++
      }
    } else if (phaseRef.current === 'retracting') {
      t = 1 - Math.min(elapsed / RETRACT_MS, 1)
      if (t <= 0) {
        phaseRef.current = 'idle'
        ctx.clearRect(0, 0, W, H)
        // Schedule next attack (faster as dodges increase)
        const speedUp = Math.max(0.4, 1 - dodgeCountRef.current * 0.08)
        scheduleAttack(
          (MIN_ATTACK_MS + Math.random() * (MAX_ATTACK_MS - MIN_ATTACK_MS)) * speedUp
        )
        return
      }
    }

    // ── S-curve whip shape ──
    // The whip unfurls as a traveling S-wave along its length
    const dx = mx - ox
    const dy = my - oy
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const perpX = -dy / len
    const perpY = dx / len

    // Draw the whip as a polyline of many segments with S-wave displacement
    const SEG = 60
    const points: { x: number; y: number }[] = []

    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG // 0→1 along whip
      // How much of the whip is "arrived" at this point
      const arrival = Math.min(t * 1.3 - s * 0.3, 1)
      if (arrival <= 0) break

      const easedS = easeOutQuart(Math.min(arrival, 1))

      // Base position along straight line
      let px = ox + dx * s * easedS
      let py = oy + dy * s * easedS

      // S-wave: traveling sinusoidal displacement
      // Wave propagates from origin to tip, amplitude peaks in middle, zero at ends
      const waveProgress = Math.max(0, t * 2.5 - s * 1.5) // wave front travels
      const envelope = Math.sin(s * Math.PI) // zero at ends, max in middle
      const dampening = Math.max(0, 1 - t * 1.2) // wave calms as whip straightens
      const waveAmp = envelope * dampening * 90 * Math.min(waveProgress, 1)
      const waveFreq = s * Math.PI * 3 - t * 12 // traveling wave
      const displacement = Math.sin(waveFreq) * waveAmp

      px += perpX * displacement
      py += perpY * displacement

      points.push({ x: px, y: py })
    }

    if (points.length < 2) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    // Tip curl — the last few segments curl into a hook
    if (t > 0.7 && points.length > 5) {
      const curlAmount = Math.min((t - 0.7) / 0.3, 1)
      const curlSegs = Math.min(8, points.length - 1)
      for (let i = 0; i < curlSegs; i++) {
        const idx = points.length - 1 - i
        if (idx < 1) break
        const curlFactor = (1 - i / curlSegs) * curlAmount * 25
        const angle = curlAmount * Math.PI * 1.2 * (1 - i / curlSegs)
        points[idx].x += perpX * curlFactor * Math.cos(angle) - (dx / len) * curlFactor * Math.sin(angle) * 0.5
        points[idx].y += perpY * curlFactor * Math.cos(angle) - (dy / len) * curlFactor * Math.sin(angle) * 0.5
      }
    }

    // Flicker
    const flicker = 0.75 + 0.25 * Math.sin(now * 0.025) * Math.cos(now * 0.017)
    const rage = 0.8 + 0.2 * Math.sin(now * 0.04)

    // Draw whip layers
    const layers = [
      { width: 26, color: 'rgba(160, 15, 0, 0.06)', blur: 28 },
      { width: 16, color: 'rgba(255, 35, 0, 0.12)', blur: 16 },
      { width: 8, color: 'rgba(255, 70, 0, 0.35)', blur: 8 },
      { width: 4, color: `rgba(255, 130, 10, ${0.7 * rage})`, blur: 3 },
      { width: 2, color: `rgba(255, 200, 40, ${0.85 * rage})`, blur: 1 },
      { width: 0.8, color: `rgba(255, 255, 160, ${0.95 * rage})`, blur: 0 },
    ]

    for (const layer of layers) {
      ctx.save()
      ctx.globalAlpha = flicker
      ctx.strokeStyle = layer.color
      ctx.lineWidth = layer.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (layer.blur > 0) ctx.filter = `blur(${layer.blur}px)`
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      // Smooth curve through points
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2
        const yc = (points[i].y + points[i + 1].y) / 2
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc)
      }
      const last = points[points.length - 1]
      ctx.lineTo(last.x, last.y)
      ctx.stroke()
      ctx.restore()
    }

    // Secondary tendril (thinner, offset)
    if (points.length > 4) {
      const tendrilLayers = [
        { width: 10, color: 'rgba(200, 25, 0, 0.06)', blur: 14 },
        { width: 4, color: 'rgba(255, 55, 0, 0.2)', blur: 6 },
        { width: 1.5, color: 'rgba(255, 120, 20, 0.5)', blur: 2 },
      ]
      for (const layer of tendrilLayers) {
        ctx.save()
        ctx.globalAlpha = flicker * 0.5
        ctx.strokeStyle = layer.color
        ctx.lineWidth = layer.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        if (layer.blur > 0) ctx.filter = `blur(${layer.blur}px)`
        ctx.beginPath()
        const off = 15 + 5 * Math.sin(now * 0.003)
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length - 1; i++) {
          const wobble = Math.sin(now * 0.008 + i * 0.5) * off * Math.sin(i / points.length * Math.PI)
          const xc = (points[i].x + points[i + 1].x) / 2 + perpX * wobble
          const yc = (points[i].y + points[i + 1].y) / 2 + perpY * wobble
          ctx.quadraticCurveTo(
            points[i].x + perpX * wobble,
            points[i].y + perpY * wobble,
            xc, yc
          )
        }
        ctx.stroke()
        ctx.restore()
      }
    }

    // Embers along whip
    if (t > 0.15) {
      const count = Math.floor(14 * t)
      for (let i = 0; i < count; i++) {
        const idx = Math.min(Math.floor((i / count) * (points.length - 1)), points.length - 1)
        const p = points[idx]
        const wobX = Math.sin(now * 0.02 + i * 2.3) * 10
        const wobY = Math.cos(now * 0.018 + i * 3.1) * 6
        const sz = 1.5 + Math.random() * 2.5
        ctx.save()
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now * 0.015 + i)
        const colors = ['rgba(255,220,80,0.9)', 'rgba(255,140,0,0.85)', 'rgba(255,60,0,0.8)', 'rgba(255,255,200,0.95)']
        ctx.fillStyle = colors[i % colors.length]
        ctx.shadowColor = 'rgba(255,100,0,0.6)'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(p.x + wobX, p.y + wobY, sz, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // Spark emission
    if (t > 0.3 && Math.random() < 0.7) {
      const idx = Math.floor(Math.random() * points.length)
      const p = points[idx]
      sparksRef.current.push({
        x: p.x, y: p.y,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 4 - 1,
        life: 1, maxLife: 25 + Math.random() * 30,
        size: 1 + Math.random() * 2.5,
        bright: Math.random() < 0.3,
      })
    }

    // Update & draw sparks
    drawSparks(ctx)

    rafRef.current = requestAnimationFrame(draw)
  }

  /* ── Caught animation: Balrog in the mines, falling ── */
  function drawCaughtSequence(ctx: CanvasRenderingContext2D, W: number, H: number, now: number) {
    const elapsed = now - caughtTimeRef.current
    const t = elapsed / CAUGHT_DURATION // 0→1 overall

    const ol = overlayRef.current

    // Phase breakdown:
    // 0.00-0.08: Flash + shake
    // 0.08-0.35: Balrog rises, fire everywhere
    // 0.35-0.50: "YOU SHALL NOT PASS" text
    // 0.50-0.85: Bridge breaks, falling
    // 0.85-1.00: Fade to black, then recover

    // Screen shake
    const shakeIntensity = t < 0.5 ? 15 * (1 - t * 2) : t < 0.85 ? 8 * Math.sin(now * 0.05) : 0
    if (shakeIntensity > 0) {
      document.body.style.transform = `translate(${(Math.random() - 0.5) * shakeIntensity}px, ${(Math.random() - 0.5) * shakeIntensity}px)`
    } else {
      document.body.style.transform = ''
    }

    // Flash
    if (t < 0.08) {
      const flashAlpha = 1 - t / 0.08
      ctx.save()
      ctx.fillStyle = `rgba(255, 120, 0, ${flashAlpha * 0.6})`
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }

    // Canvas fire particles during entire sequence
    if (t < 0.85) {
      // Spawn fire from bottom
      for (let i = 0; i < 3; i++) {
        sparksRef.current.push({
          x: Math.random() * W,
          y: H + 10,
          vx: (Math.random() - 0.5) * 3,
          vy: -3 - Math.random() * 8,
          life: 1,
          maxLife: 40 + Math.random() * 40,
          size: 3 + Math.random() * 5,
          bright: Math.random() < 0.4,
        })
      }
    }

    // Falling rocks during bridge-break phase
    if (t > 0.45 && t < 0.85) {
      if (Math.random() < 0.3) {
        rocksRef.current.push({
          x: Math.random() * W,
          y: -20,
          vy: 2 + Math.random() * 4,
          size: 5 + Math.random() * 20,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.1,
        })
      }
    }

    // Draw falling rocks
    for (let i = rocksRef.current.length - 1; i >= 0; i--) {
      const r = rocksRef.current[i]
      r.y += r.vy
      r.vy += 0.15
      r.rot += r.rotSpeed
      if (r.y > H + 50) { rocksRef.current.splice(i, 1); continue }

      ctx.save()
      ctx.translate(r.x, r.y)
      ctx.rotate(r.rot)
      ctx.fillStyle = `rgba(30, 25, 20, ${0.7 + Math.random() * 0.3})`
      ctx.strokeStyle = 'rgba(80, 50, 20, 0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      // Irregular rock shape
      const sides = 5 + Math.floor(Math.random() * 3)
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2
        const rr = r.size * (0.7 + Math.random() * 0.3)
        if (s === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    drawSparks(ctx)

    // Overlay content
    if (ol) {
      if (t < 0.04) {
        ol.style.opacity = String(t / 0.04)
      } else if (t < 0.85) {
        ol.style.opacity = '1'
      } else {
        ol.style.opacity = String(Math.max(0, 1 - (t - 0.85) / 0.15))
      }

      // Update overlay inner content based on phase
      if (t < 0.35) {
        ol.innerHTML = createBalrogRising(t / 0.35)
      } else if (t < 0.55) {
        ol.innerHTML = createYouShallNotPass((t - 0.35) / 0.2)
      } else if (t < 0.85) {
        ol.innerHTML = createFalling((t - 0.55) / 0.3)
      } else {
        ol.innerHTML = createFadeOut((t - 0.85) / 0.15)
      }
    }

    // End of sequence
    if (t >= 1) {
      document.body.style.transform = ''
      if (ol) {
        ol.style.display = 'none'
        ol.innerHTML = ''
      }
      ctx.clearRect(0, 0, W, H)
      sparksRef.current = []
      rocksRef.current = []
      phaseRef.current = 'cooldown'
      // Resume attacks after cooldown
      setTimeout(() => {
        phaseRef.current = 'idle'
        huntingRef.current = false
        dodgeCountRef.current = 0
        scheduleAttack(INITIAL_IDLE_MS)
      }, COOLDOWN_AFTER_CATCH)
      return
    }
  }

  function drawSparks(ctx: CanvasRenderingContext2D) {
    const sparks = sparksRef.current
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.08
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
  }

  function spawnImpactSparks(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 3 + Math.random() * 8
      sparksRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 1, maxLife: 30 + Math.random() * 40,
        size: 2 + Math.random() * 4,
        bright: Math.random() < 0.5,
      })
    }
  }

  /* ── Setup ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    function onMouseMove(e: MouseEvent) { handleMove(e.clientX, e.clientY) }
    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0]
      if (t) handleMove(t.clientX, t.clientY)
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    scheduleAttack(INITIAL_IDLE_MS)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      document.body.style.transform = ''
    }
  }, [handleMove, scheduleAttack])

  return (
    <>
      <canvas ref={canvasRef} className="balrog-whip-canvas" aria-hidden="true" />
      <div ref={overlayRef} className="balrog-caught-overlay" aria-hidden="true" />
    </>
  )
}

/* ══════════════════════════════════════════════════════
   Overlay HTML generators for caught sequence phases
   ══════════════════════════════════════════════════════ */

function createBalrogRising(t: number): string {
  const scale = 0.6 + t * 0.8
  const glowOpacity = t * 0.8
  return `
    <div class="balrog-scene">
      <div class="balrog-creature" style="transform: scale(${scale}) translateY(${(1 - t) * 40}%); opacity: ${Math.min(t * 2, 1)}">
        <div class="balrog-horns">⛧</div>
        <div class="balrog-eyes">◉ ◉</div>
        <div class="balrog-body">𖤐</div>
      </div>
      <div class="balrog-fire-glow" style="opacity: ${glowOpacity}"></div>
      <div class="mine-text" style="opacity: ${Math.max(0, t - 0.5) * 2}">
        <em>A Balrog of Morgoth…</em>
      </div>
    </div>
  `
}

function createYouShallNotPass(t: number): string {
  const scale = 0.8 + t * 0.4
  const shake = t < 0.5 ? `translateX(${Math.sin(t * 60) * 4}px)` : ''
  return `
    <div class="balrog-scene">
      <div class="balrog-creature" style="transform: scale(1.2); opacity: 0.7">
        <div class="balrog-horns">⛧</div>
        <div class="balrog-eyes" style="color: #ff3300">◉ ◉</div>
        <div class="balrog-body">𖤐</div>
      </div>
      <div class="balrog-fire-glow" style="opacity: 0.9"></div>
      <div class="ysnp-text" style="transform: scale(${scale}) ${shake}; opacity: ${Math.min(t * 3, 1)}">
        YOU SHALL NOT PASS
      </div>
      <div class="gandalf-silhouette-scene" style="opacity: ${Math.min(t * 2, 1)}">🧙</div>
    </div>
  `
}

function createFalling(t: number): string {
  const fallY = t * 300
  const spin = t * 720
  const fadeText = Math.max(0, 1 - t * 1.5)
  return `
    <div class="balrog-scene falling-scene">
      <div class="falling-darkness" style="opacity: ${0.3 + t * 0.7}"></div>
      <div class="falling-figure" style="transform: translateY(${fallY}px) rotate(${spin}deg); opacity: ${1 - t}">
        🧙
      </div>
      <div class="falling-balrog" style="transform: translateY(${fallY * 0.6}px); opacity: ${1 - t * 0.8}">
        <span style="font-size: 4rem; filter: hue-rotate(-10deg) brightness(1.5)">𖤐</span>
      </div>
      <div class="falling-text" style="opacity: ${fadeText}; transform: translateY(${t * 50}px)">
        <div class="bridge-quote">"Fly, you fools!"</div>
        <div class="bridge-sub">— Gandalf, Bridge of Khazad-dûm</div>
      </div>
      <div class="depth-lines" style="opacity: ${t * 0.6}">
        ${'<div class="depth-line"></div>'.repeat(8)}
      </div>
    </div>
  `
}

function createFadeOut(t: number): string {
  return `
    <div class="balrog-scene">
      <div class="falling-darkness" style="opacity: 1"></div>
      <div class="aftermath-text" style="opacity: ${Math.min(t * 4, 1 - Math.max(0, (t - 0.7) / 0.3))}">
        <div class="mine-text"><em>…and the bridge broke beneath them.</em></div>
      </div>
    </div>
  `
}

/* ── Math helpers ── */

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}
