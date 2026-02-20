'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

/* ── Timing constants ── */
const IDLE_BEFORE_PROMPT = 8000  // 8s idle before showing the prompt
const FIRST_ATTACK_DELAY = 3000  // 3s after game starts before first whip
const MIN_ATTACK_MS = 2500       // min gap between attacks
const MAX_ATTACK_MS = 5000       // max gap
const WHIP_DURATION = 750        // ms for whip to reach target (slower, more readable)
const RETRACT_MS = 500           // ms for whip to retract
const CATCH_RADIUS = 45          // px — how close cursor must be to get caught
const CAUGHT_DURATION = 10000    // 10s for the full Balrog caught sequence (slower)
const COOLDOWN_AFTER_CATCH = 8000

/* ── Types ── */
interface Spark {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; bright: boolean
}

type GameState = 'off' | 'prompt' | 'playing' | 'caught' | 'cooldown'

interface FallingRock {
  x: number; y: number; vy: number; size: number; rot: number; rotSpeed: number
}

type WhipPhase = 'idle' | 'extending' | 'retracting'

/**
 * Balrog whip dodge mini-game.
 *
 * Shows a prompt after idle. Press Space to start. Dodge the fiery whip
 * by moving your mouse. If caught → Balrog cinematic in the Mines of Moria.
 */
export default function BalrogWhip() {
  const [gameState, setGameState] = useState<GameState>('off')
  const [dodges, setDodges] = useState(0)
  const [score, setScore] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: -1, y: -1 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number>(0)
  const whipPhaseRef = useRef<WhipPhase>('idle')
  const startTimeRef = useRef(0)
  const targetRef = useRef({ x: 0, y: 0 })
  const sparksRef = useRef<Spark[]>([])
  const caughtTimeRef = useRef(0)
  const rocksRef = useRef<FallingRock[]>([])
  const dodgeCountRef = useRef(0)
  const gameStateRef = useRef<GameState>('off')
  const scoreRef = useRef(0)

  // Keep ref in sync with state
  useEffect(() => { gameStateRef.current = gameState }, [gameState])

  /* ── Schedule next whip attack ── */
  const scheduleAttack = useCallback((delay?: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const speedUp = Math.max(0.5, 1 - dodgeCountRef.current * 0.06)
    const ms = delay ?? (MIN_ATTACK_MS + Math.random() * (MAX_ATTACK_MS - MIN_ATTACK_MS)) * speedUp
    timerRef.current = setTimeout(() => {
      if (gameStateRef.current !== 'playing') return
      if (mouseRef.current.x < 0) { scheduleAttack(1000); return }
      if (whipPhaseRef.current !== 'idle') return
      whipPhaseRef.current = 'extending'
      startTimeRef.current = performance.now()
      targetRef.current = { ...mouseRef.current }
      sparksRef.current = []
      draw()
    }, ms)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Start game ── */
  const startGame = useCallback(() => {
    setGameState('playing')
    setDodges(0)
    setScore(0)
    dodgeCountRef.current = 0
    scoreRef.current = 0
    whipPhaseRef.current = 'idle'
    sparksRef.current = []
    scheduleAttack(FIRST_ATTACK_DELAY)
  }, [scheduleAttack])

  /* ── End game (caught) ── */
  function triggerCaught() {
    setGameState('caught')
    caughtTimeRef.current = performance.now()
    rocksRef.current = []
    const finalScore = scoreRef.current
    setScore(finalScore)

    const ol = overlayRef.current
    if (ol) {
      ol.style.display = 'flex'
      ol.style.opacity = '0'
    }
  }

  /* ── Stop game ── */
  const stopGame = useCallback(() => {
    setGameState('off')
    whipPhaseRef.current = 'idle'
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    sparksRef.current = []
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    // Restart idle detection
    resetIdleDetection()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Idle detection for showing prompt ── */
  const resetIdleDetection = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (gameStateRef.current !== 'off') return
    idleTimerRef.current = setTimeout(() => {
      if (gameStateRef.current === 'off' && mouseRef.current.x > 0) {
        setGameState('prompt')
      }
    }, IDLE_BEFORE_PROMPT)
  }, [])

  /* ── Mouse tracking ── */
  const handleMove = useCallback((x: number, y: number) => {
    mouseRef.current = { x, y }
    if (gameStateRef.current === 'off') {
      resetIdleDetection()
    }
  }, [resetIdleDetection])

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

    // Draw dodge score during gameplay
    if (gameStateRef.current === 'playing' || gameStateRef.current === 'caught') {
      ctx.save()
      ctx.font = '13px Cinzel, serif'
      ctx.fillStyle = 'rgba(200, 160, 100, 0.5)'
      ctx.textAlign = 'right'
      ctx.fillText(`Dodges: ${dodgeCountRef.current}`, W - 20, 30)
      ctx.restore()
    }

    if (gameStateRef.current === 'caught') {
      drawCaughtSequence(ctx, W, H, now)
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    if (gameStateRef.current !== 'playing') return
    if (whipPhaseRef.current === 'idle') return

    const mx = targetRef.current.x
    const my = targetRef.current.y

    const ox = -30
    const oy = H + 30

    let t = 0

    if (whipPhaseRef.current === 'extending') {
      t = Math.min(elapsed / WHIP_DURATION, 1)
      if (t >= 1) {
        const curX = mouseRef.current.x
        const curY = mouseRef.current.y
        const dist = Math.sqrt((curX - mx) ** 2 + (curY - my) ** 2)
        if (dist < CATCH_RADIUS) {
          spawnImpactSparks(mx, my, 40)
          triggerCaught()
          rafRef.current = requestAnimationFrame(draw)
          return
        }
        // Missed — retract
        whipPhaseRef.current = 'retracting'
        startTimeRef.current = now
        dodgeCountRef.current++
        scoreRef.current = dodgeCountRef.current
        setDodges(dodgeCountRef.current)
        setScore(dodgeCountRef.current)
      }
    } else if (whipPhaseRef.current === 'retracting') {
      t = 1 - Math.min(elapsed / RETRACT_MS, 1)
      if (t <= 0) {
        whipPhaseRef.current = 'idle'
        ctx.clearRect(0, 0, W, H)
        scheduleAttack()
        return
      }
    }

    // ── S-curve whip shape ──
    const dx = mx - ox
    const dy = my - oy
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const perpX = -dy / len
    const perpY = dx / len

    const SEG = 60
    const points: { x: number; y: number }[] = []

    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG
      const arrival = Math.min(t * 1.3 - s * 0.3, 1)
      if (arrival <= 0) break

      const easedS = easeOutQuart(Math.min(arrival, 1))

      let px = ox + dx * s * easedS
      let py = oy + dy * s * easedS

      // S-wave traveling displacement
      const waveProgress = Math.max(0, t * 2.5 - s * 1.5)
      const envelope = Math.sin(s * Math.PI)
      const dampening = Math.max(0, 1 - t * 1.2)
      const waveAmp = envelope * dampening * 100 * Math.min(waveProgress, 1)
      const waveFreq = s * Math.PI * 3 - t * 10
      const displacement = Math.sin(waveFreq) * waveAmp

      px += perpX * displacement
      py += perpY * displacement

      points.push({ x: px, y: py })
    }

    if (points.length < 2) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    // Tip curl
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

    // Secondary tendril
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

    drawSparks(ctx)

    rafRef.current = requestAnimationFrame(draw)
  }

  /* ── Caught animation ── */
  function drawCaughtSequence(ctx: CanvasRenderingContext2D, W: number, H: number, now: number) {
    const elapsed = now - caughtTimeRef.current
    const t = elapsed / CAUGHT_DURATION

    const ol = overlayRef.current

    // Phase breakdown (slower, more cinematic):
    // 0.00–0.06: Flash
    // 0.06–0.30: Balrog rises
    // 0.30–0.50: "YOU SHALL NOT PASS"
    // 0.50–0.82: Falling
    // 0.82–1.00: Fade out + score

    // Screen shake
    const shakeIntensity = t < 0.4 ? 12 * (1 - t * 2.5) : t < 0.82 ? 6 * Math.sin(now * 0.04) : 0
    if (shakeIntensity > 0) {
      document.body.style.transform = `translate(${(Math.random() - 0.5) * shakeIntensity}px, ${(Math.random() - 0.5) * shakeIntensity}px)`
    } else {
      document.body.style.transform = ''
    }

    // Flash
    if (t < 0.06) {
      const flashAlpha = 1 - t / 0.06
      ctx.save()
      ctx.fillStyle = `rgba(255, 120, 0, ${flashAlpha * 0.6})`
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }

    // Fire particles
    if (t < 0.82) {
      for (let i = 0; i < 2; i++) {
        sparksRef.current.push({
          x: Math.random() * W,
          y: H + 10,
          vx: (Math.random() - 0.5) * 3,
          vy: -3 - Math.random() * 6,
          life: 1,
          maxLife: 50 + Math.random() * 50,
          size: 3 + Math.random() * 5,
          bright: Math.random() < 0.4,
        })
      }
    }

    // Falling rocks
    if (t > 0.45 && t < 0.82) {
      if (Math.random() < 0.25) {
        rocksRef.current.push({
          x: Math.random() * W,
          y: -20,
          vy: 1.5 + Math.random() * 3,
          size: 5 + Math.random() * 20,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.08,
        })
      }
    }

    // Draw rocks
    for (let i = rocksRef.current.length - 1; i >= 0; i--) {
      const r = rocksRef.current[i]
      r.y += r.vy
      r.vy += 0.12
      r.rot += r.rotSpeed
      if (r.y > H + 50) { rocksRef.current.splice(i, 1); continue }

      ctx.save()
      ctx.translate(r.x, r.y)
      ctx.rotate(r.rot)
      ctx.fillStyle = `rgba(30, 25, 20, ${0.7 + Math.random() * 0.3})`
      ctx.strokeStyle = 'rgba(80, 50, 20, 0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
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
      if (t < 0.03) {
        ol.style.opacity = String(t / 0.03)
      } else if (t < 0.82) {
        ol.style.opacity = '1'
      } else {
        ol.style.opacity = String(Math.max(0, 1 - (t - 0.82) / 0.18))
      }

      if (t < 0.30) {
        ol.innerHTML = createBalrogRising(t / 0.30)
      } else if (t < 0.50) {
        ol.innerHTML = createYouShallNotPass((t - 0.30) / 0.20)
      } else if (t < 0.82) {
        ol.innerHTML = createFalling((t - 0.50) / 0.32)
      } else {
        ol.innerHTML = createFadeOut((t - 0.82) / 0.18, scoreRef.current)
      }
    }

    // End
    if (t >= 1) {
      document.body.style.transform = ''
      if (ol) { ol.style.display = 'none'; ol.innerHTML = '' }
      ctx.clearRect(0, 0, W, H)
      sparksRef.current = []
      rocksRef.current = []
      setGameState('cooldown')
      setTimeout(() => {
        setGameState('off')
        dodgeCountRef.current = 0
        whipPhaseRef.current = 'idle'
        resetIdleDetection()
      }, COOLDOWN_AFTER_CATCH)
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

    function onKeyDown(e: KeyboardEvent) {
      // Don't capture space when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.code === 'Space') {
        e.preventDefault()
        if (gameStateRef.current === 'prompt') {
          startGame()
        }
      }
      if (e.code === 'Escape') {
        if (gameStateRef.current === 'playing') {
          stopGame()
        } else if (gameStateRef.current === 'prompt') {
          setGameState('off')
          resetIdleDetection()
        }
      }
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKeyDown)

    // Start idle detection
    resetIdleDetection()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      document.body.style.transform = ''
    }
  }, [handleMove, startGame, stopGame, resetIdleDetection])

  return (
    <>
      <canvas ref={canvasRef} className="balrog-whip-canvas" aria-hidden="true" />
      <div ref={overlayRef} className="balrog-caught-overlay" aria-hidden="true" />

      {/* Prompt overlay */}
      {gameState === 'prompt' && (
        <div className="whip-prompt-overlay" onClick={() => setGameState('off')}>
          <div className="whip-prompt-card" onClick={e => e.stopPropagation()}>
            <div className="whip-prompt-icon">🔥</div>
            <h2 className="whip-prompt-title">The Balrog Stirs…</h2>
            <p className="whip-prompt-desc">
              A shadow and a flame. The Balrog&apos;s whip lashes from the depths
              of Khazad-d&ucirc;m. Dodge its fiery strikes by moving your cursor.
            </p>
            <div className="whip-prompt-rules">
              <div className="whip-prompt-rule">
                <span className="whip-prompt-rule-icon">🖱️</span>
                <span>Move your mouse to dodge the whip</span>
              </div>
              <div className="whip-prompt-rule">
                <span className="whip-prompt-rule-icon">🔥</span>
                <span>The whip gets faster with each dodge</span>
              </div>
              <div className="whip-prompt-rule">
                <span className="whip-prompt-rule-icon">💀</span>
                <span>If it catches you… you fall into shadow</span>
              </div>
            </div>
            <button className="whip-prompt-btn" onClick={startGame}>
              <span className="whip-prompt-key">Space</span> to face the Balrog
            </button>
            <p className="whip-prompt-dismiss">
              Press <strong>Esc</strong> to dismiss
            </p>
          </div>
        </div>
      )}

      {/* Playing HUD */}
      {gameState === 'playing' && (
        <div className="whip-hud">
          <span className="whip-hud-score">Dodges: {dodges}</span>
          <button className="whip-hud-quit" onClick={stopGame}>
            Esc to quit
          </button>
        </div>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════
   ASCII Art & Overlay generators for caught sequence
   ══════════════════════════════════════════════════════ */

const BALROG_ASCII = `
        )  (  (     )
     (   )  ) )  ( (
       \\  { }  /
        \\{   }/
    .----{   }----.
   /  .-'{   }'-.  \\
  / .'  /{   }\\  '. \\
 / /   / {   } \\   \\ \\
| ;   ;  {   }  ;   ; |
 \\ \\   \\ { , } /   / /
  \\ '.  \\{/ \\}/  .' /
   \\  '-..___...-'  /
    '-----._.------'
     /  (o   o)  \\
    |   /|   |\\   |
    |  / |   | \\  |
     \\/  |   |  \\/
         |   |
    ~~~~~ | | ~~~~~
   ~~~~~~~   ~~~~~~~
  ~~~~~~~~~^~~~~~~~~~
`

const GANDALF_ASCII = `
       _____
      /     \\
     | () () |
      \\  ^  /
    ___|\\ /|___
   /   |     |   \\
  /    |  |  |    \\
       | /|\\ |
       |/ | \\|
       /  |  \\
      /   |   \\
`

const FALLING_ASCII = `
  \\       |       /
   \\   \\  |  /   /
    \\   \\ | /   /
     '.  \\|/  .'
       '-.V.-'
      ___/ \\___
     /    |    \\
    /     |     \\
   /   \\  |  /   \\
  .     '.|.'     .
  :    __/ \\__    :
  '.  /       \\  .'
    '/    |    \\'
     \\   |   /
      \\  |  /
       \\_|_/
        \\|/
`

function createBalrogRising(t: number): string {
  const scale = 0.5 + t * 0.9
  const glowOpacity = t * 0.7
  return `
    <div class="balrog-scene">
      <pre class="balrog-ascii" style="transform: scale(${scale}) translateY(${(1 - t) * 50}%); opacity: ${Math.min(t * 1.8, 1)}">${escHtml(BALROG_ASCII)}</pre>
      <div class="balrog-fire-glow" style="opacity: ${glowOpacity}"></div>
      <div class="mine-text" style="opacity: ${Math.max(0, t - 0.4) * 1.7}">
        <em>A Balrog of Morgoth&hellip;</em><br>
        <em style="font-size: 0.8em; opacity: 0.7">What did you say?</em>
      </div>
    </div>
  `
}

function createYouShallNotPass(t: number): string {
  const scale = 0.8 + t * 0.4
  const shake = t < 0.5 ? `translateX(${Math.sin(t * 50) * 3}px)` : ''
  return `
    <div class="balrog-scene">
      <pre class="balrog-ascii balrog-ascii-bg" style="transform: scale(1.3); opacity: 0.4">${escHtml(BALROG_ASCII)}</pre>
      <div class="balrog-fire-glow" style="opacity: 0.9"></div>
      <div class="ysnp-text" style="transform: scale(${scale}) ${shake}; opacity: ${Math.min(t * 2.5, 1)}">
        YOU SHALL NOT PASS
      </div>
      <pre class="gandalf-ascii" style="opacity: ${Math.min(t * 2, 1)}">${escHtml(GANDALF_ASCII)}</pre>
    </div>
  `
}

function createFalling(t: number): string {
  const fallY = t * 250
  const fadeText = Math.max(0, 1 - t * 1.2)
  return `
    <div class="balrog-scene falling-scene">
      <div class="falling-darkness" style="opacity: ${0.2 + t * 0.8}"></div>
      <pre class="falling-ascii" style="transform: translateY(${fallY}px); opacity: ${1 - t * 0.9}">${escHtml(FALLING_ASCII)}</pre>
      <div class="falling-text" style="opacity: ${fadeText}; transform: translateY(${t * 40}px)">
        <div class="bridge-quote">&ldquo;Fly, you fools!&rdquo;</div>
        <div class="bridge-sub">&mdash; Gandalf, Bridge of Khazad-d&ucirc;m</div>
      </div>
      <div class="depth-lines" style="opacity: ${t * 0.5}">
        ${'<div class="depth-line"></div>'.repeat(8)}
      </div>
    </div>
  `
}

function createFadeOut(t: number, score: number): string {
  const textFade = t < 0.5 ? t * 2 : Math.max(0, 1 - (t - 0.7) / 0.3)
  return `
    <div class="balrog-scene">
      <div class="falling-darkness" style="opacity: 1"></div>
      <div class="aftermath-text" style="opacity: ${textFade}">
        <div class="mine-text"><em>&hellip;and the bridge broke beneath them.</em></div>
        ${score > 0 ? `<div class="caught-score">You dodged ${score} time${score === 1 ? '' : 's'} before falling.</div>` : ''}
      </div>
    </div>
  `
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ── Math helpers ── */

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}
