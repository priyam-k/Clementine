'use client'

import { useRef, useEffect } from 'react'

const NUM_SLOTS = 8
const MAX_DEVICES = 6
const MIN_LIFETIME_MS = 8000
const MAX_LIFETIME_MS = 13000

type DeviceType = 'laptop' | 'phone' | 'tablet' | 'desktop'

interface Device {
  slotIndex: number
  baseAngle: number
  driftSeed: number
  opacity: number
  lifetime: number
  born: number
  type: DeviceType
  nextPulse: number
}

interface Pulse {
  fromX: number
  fromY: number
  progress: number
  triggered: boolean
}

interface GlowRing {
  born: number
  duration: number
}

function slotAngle(i: number) {
  return (i / NUM_SLOTS) * Math.PI * 2 - Math.PI / 2
}

function drawClementine(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.translate(cx, cy)
  // Clementines are slightly oblate (wider than tall)
  ctx.scale(1.0, 0.91)

  // Body — warm orange, darker at edges and shadow side
  const body = ctx.createRadialGradient(-r * 0.2, -r * 0.15, r * 0.04, r * 0.08, r * 0.1, r * 1.08)
  body.addColorStop(0,   '#FFB94A')
  body.addColorStop(0.3, '#F57320')
  body.addColorStop(0.7, '#E05412')
  body.addColorStop(1,   '#B03A08')
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()

  // Segment lines: curves from top pole → bottom pole (longitude style)
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.clip()
  const NUM_SEG_LINES = 9
  for (let i = 0; i < NUM_SEG_LINES; i++) {
    // x offset at the equator, spread from -r to +r
    const xEq = (((i + 0.5) / NUM_SEG_LINES) * 2 - 1) * r * 0.88
    ctx.beginPath()
    ctx.moveTo(0, -r)                           // top pole
    ctx.bezierCurveTo(xEq * 0.72, -r * 0.48, xEq * 0.72, r * 0.48, 0, r) // bottom pole
    ctx.strokeStyle = 'rgba(150, 48, 8, 0.17)'
    ctx.lineWidth = 0.75
    ctx.stroke()
  }
  ctx.restore()

  // Pole dimple — top (stem end): characteristic dark indent of a clementine
  const topDimple = ctx.createRadialGradient(0, -r * 0.84, 0, 0, -r * 0.84, r * 0.24)
  topDimple.addColorStop(0,   'rgba(110, 30, 4, 0.55)')
  topDimple.addColorStop(0.5, 'rgba(150, 50, 8, 0.22)')
  topDimple.addColorStop(1,   'rgba(150, 50, 8, 0)')
  ctx.beginPath()
  ctx.ellipse(0, -r * 0.86, r * 0.2, r * 0.14, 0, 0, Math.PI * 2)
  ctx.fillStyle = topDimple
  ctx.fill()

  // Pole dimple — bottom (blossom end)
  const btmDimple = ctx.createRadialGradient(0, r * 0.86, 0, 0, r * 0.86, r * 0.18)
  btmDimple.addColorStop(0,   'rgba(110, 30, 4, 0.42)')
  btmDimple.addColorStop(1,   'rgba(110, 30, 4, 0)')
  ctx.beginPath()
  ctx.ellipse(0, r * 0.87, r * 0.15, r * 0.1, 0, 0, Math.PI * 2)
  ctx.fillStyle = btmDimple
  ctx.fill()

  // Specular highlight — soft upper-left glow
  const hl = ctx.createRadialGradient(-r * 0.3, -r * 0.32, 0, -r * 0.22, -r * 0.26, r * 0.54)
  hl.addColorStop(0,   'rgba(255, 252, 215, 0.62)')
  hl.addColorStop(0.4, 'rgba(255, 230, 150, 0.18)')
  hl.addColorStop(1,   'rgba(255, 230, 150, 0)')
  ctx.beginPath()
  ctx.ellipse(-r * 0.24, -r * 0.28, r * 0.38, r * 0.26, -0.42, 0, Math.PI * 2)
  ctx.fillStyle = hl
  ctx.fill()

  ctx.restore() // end translate + scale

  // Leaves and stem drawn in world-space (unaffected by oblate scale)
  ctx.save()
  ctx.translate(cx, cy - r * 0.9)

  // Stem
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -r * 0.2)
  ctx.strokeStyle = '#5C3514'
  ctx.lineWidth = Math.max(1.2, r * 0.085)
  ctx.lineCap = 'round'
  ctx.stroke()

  // Left leaf — larger, sweeps up-left
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.05)
  ctx.bezierCurveTo(-r * 0.14, -r * 0.3, -r * 0.56, -r * 0.32, -r * 0.32, -r * 0.7)
  ctx.bezierCurveTo(-r * 0.6,  -r * 0.36, -r * 0.32, -r * 0.02,  0, -r * 0.05)
  ctx.fillStyle = '#3C7220'
  ctx.fill()
  // Central vein
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.05)
  ctx.quadraticCurveTo(-r * 0.28, -r * 0.4, -r * 0.32, -r * 0.7)
  ctx.strokeStyle = 'rgba(22, 65, 6, 0.36)'
  ctx.lineWidth = 0.65
  ctx.stroke()

  // Right leaf — slightly smaller, different angle
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.05)
  ctx.bezierCurveTo(r * 0.1, -r * 0.24, r * 0.44, -r * 0.26, r * 0.24, -r * 0.58)
  ctx.bezierCurveTo(r * 0.48, -r * 0.3,  r * 0.26, -r * 0.02,  0, -r * 0.05)
  ctx.fillStyle = '#4A8828'
  ctx.fill()
  // Central vein
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.05)
  ctx.quadraticCurveTo(r * 0.22, -r * 0.34, r * 0.24, -r * 0.58)
  ctx.strokeStyle = 'rgba(22, 65, 6, 0.36)'
  ctx.lineWidth = 0.65
  ctx.stroke()

  ctx.restore()
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
}

function drawDevice(ctx: CanvasRenderingContext2D, x: number, y: number, type: DeviceType, opacity: number) {
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.translate(x, y)
  const s = 13

  ctx.strokeStyle = '#EF8354'
  ctx.lineWidth = 1

  if (type === 'laptop') {
    ctx.fillStyle = '#1E1410'
    ctx.beginPath()
    rrect(ctx, -s * 0.9, -s, s * 1.8, s * 1.2, 2)
    ctx.fill(); ctx.stroke()
    ctx.fillStyle = 'rgba(239,131,84,0.28)'
    ctx.fillRect(-s * 0.68, -s * 0.78, s * 1.36, 0.55)
    ctx.fillRect(-s * 0.68, -s * 0.22, s * 0.95, 0.55)
    ctx.fillStyle = '#2E1E18'
    ctx.beginPath()
    rrect(ctx, -s * 1.08, s * 0.22, s * 2.16, s * 0.3, 1)
    ctx.fill()
  } else if (type === 'phone') {
    ctx.fillStyle = '#1E1410'
    ctx.beginPath()
    rrect(ctx, -s * 0.5, -s, s, s * 2, 4)
    ctx.fill(); ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, s * 0.72, 2.4, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(239,131,84,0.45)'
    ctx.stroke()
    ctx.fillStyle = 'rgba(239,131,84,0.22)'
    ctx.fillRect(-s * 0.3, -s * 0.55, s * 0.6, 0.5)
    ctx.fillRect(-s * 0.3, -s * 0.1, s * 0.45, 0.5)
  } else if (type === 'tablet') {
    ctx.fillStyle = '#1E1410'
    ctx.beginPath()
    rrect(ctx, -s * 0.7, -s * 0.92, s * 1.4, s * 1.84, 3)
    ctx.fill(); ctx.stroke()
    ctx.fillStyle = 'rgba(239,131,84,0.22)'
    ctx.fillRect(-s * 0.5, -s * 0.66, s, 0.5)
    ctx.fillRect(-s * 0.5, -s * 0.1, s * 0.7, 0.5)
    ctx.fillRect(-s * 0.5, s * 0.28, s * 0.5, 0.5)
  } else { // desktop
    ctx.fillStyle = '#1E1410'
    ctx.beginPath()
    rrect(ctx, -s * 0.95, -s * 0.82, s * 1.9, s * 1.38, 2)
    ctx.fill(); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-s * 0.28, s * 0.56)
    ctx.lineTo(-s * 0.44, s * 0.94)
    ctx.lineTo(s * 0.44, s * 0.94)
    ctx.lineTo(s * 0.28, s * 0.56)
    ctx.closePath()
    ctx.fillStyle = '#2E1E18'; ctx.fill()
    ctx.fillStyle = 'rgba(239,131,84,0.22)'
    ctx.fillRect(-s * 0.72, -s * 0.58, s * 1.44, 0.5)
    ctx.fillRect(-s * 0.72, -s * 0.1, s, 0.5)
  }

  ctx.restore()
}

export default function ClusterOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (!ctx) return

    const TYPES: DeviceType[] = ['laptop', 'phone', 'tablet', 'desktop']

    const state = {
      devices: [] as Device[],
      pulses: [] as Pulse[],
      glowRings: [] as GlowRing[],
      occupied: new Set<number>(),
      lastSpawn: 0,
    }

    function spawn(now: number) {
      if (state.devices.length >= MAX_DEVICES) return
      const empty: number[] = []
      for (let i = 0; i < NUM_SLOTS; i++) if (!state.occupied.has(i)) empty.push(i)
      if (!empty.length) return
      const si = empty[Math.floor(Math.random() * empty.length)]
      state.occupied.add(si)
      state.devices.push({
        slotIndex: si,
        baseAngle: slotAngle(si),
        driftSeed: Math.random() * 100,
        opacity: 0,
        lifetime: MIN_LIFETIME_MS + Math.random() * (MAX_LIFETIME_MS - MIN_LIFETIME_MS),
        born: now,
        type: TYPES[Math.floor(Math.random() * 4)],
        nextPulse: now + 2000 + Math.random() * 3000,
      })
    }

    function resize() {
      const p = canvas.parentElement
      if (!p) return
      canvas.width = p.clientWidth
      canvas.height = p.clientHeight
    }

    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    resize()

    let rafId = 0

    function tick(now: number) {
      const W = canvas.width, H = canvas.height
      const cx = W / 2, cy = H / 2
      const minD = Math.min(W, H)
      const OR = minD * 0.37    // orbit radius
      const HR = minD * 0.082   // hub (fruit) radius

      // Spawn
      if (now - state.lastSpawn > 1600 && state.devices.length < MAX_DEVICES) {
        spawn(now)
        state.lastSpawn = now
      }

      // Update devices
      state.devices = state.devices.filter(d => {
        const age = now - d.born
        if (age >= d.lifetime) { state.occupied.delete(d.slotIndex); return false }
        const FADE = 900
        d.opacity = age < FADE ? age / FADE : age > d.lifetime - FADE ? (d.lifetime - age) / FADE : 1
        if (now >= d.nextPulse && d.opacity > 0.6) {
          const a = d.baseAngle + Math.sin(now / 5000 + d.driftSeed) * 0.045
          state.pulses.push({
            fromX: cx + Math.cos(a) * OR,
            fromY: cy + Math.sin(a) * OR,
            progress: 0,
            triggered: false,
          })
          d.nextPulse = now + 2500 + Math.random() * 4000
        }
        return true
      })

      // Update pulses
      state.pulses = state.pulses.filter(p => p.progress < 1.0)
      state.pulses.forEach(p => {
        p.progress = Math.min(p.progress + 0.012, 1.0)
        if (p.progress >= 0.92 && !p.triggered) {
          p.triggered = true
          state.glowRings.push({ born: now, duration: 1400 })
        }
      })

      // Prune finished glow rings
      state.glowRings = state.glowRings.filter(g => now - g.born < g.duration)

      // ── DRAW ─────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#EDE5D8'
      ctx.fillRect(0, 0, W, H)

      // Fine background grid
      const GS = Math.round(minD / 22)
      ctx.strokeStyle = 'rgba(18,11,9,0.038)'
      ctx.lineWidth = 0.5
      for (let x = cx % GS; x < W; x += GS) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = cy % GS; y < H; y += GS) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Faint concentric rings for depth
      const ringFracs = [0.12, 0.22, 0.32, 0.47, 0.60, 0.75, 0.92]
      ringFracs.forEach((f, i) => {
        ctx.beginPath()
        ctx.arc(cx, cy, (minD / 2) * f, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(18,11,9,${0.035 + i * 0.006})`
        ctx.lineWidth = 0.7
        ctx.stroke()
      })

      // Dashed orbit ring
      ctx.beginPath()
      ctx.arc(cx, cy, OR, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(239,131,84,0.22)'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 7])
      ctx.stroke()
      ctx.setLineDash([])

      // Radar sweep arm (slow, ~15 s per rotation)
      const ra = (now / 1000) * 0.42
      ctx.save()
      ctx.translate(cx, cy)
      const SWEEP_STEPS = 28
      const SWEEP_SPAN = Math.PI * 0.38
      for (let i = 0; i < SWEEP_STEPS; i++) {
        const a = ra - (i / SWEEP_STEPS) * SWEEP_SPAN
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(a) * OR * 1.12, Math.sin(a) * OR * 1.12)
        ctx.strokeStyle = `rgba(239,131,84,${((SWEEP_STEPS - i) / SWEEP_STEPS) * 0.11})`
        ctx.lineWidth = 1.8
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(ra) * OR * 1.12, Math.sin(ra) * OR * 1.12)
      ctx.strokeStyle = 'rgba(239,131,84,0.52)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()

      // Slot markers on orbit
      for (let i = 0; i < NUM_SLOTS; i++) {
        const a = slotAngle(i)
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * OR, cy + Math.sin(a) * OR, 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(239,131,84,0.22)'
        ctx.fill()
      }

      // Dashed connection lines: device → hub
      state.devices.forEach(d => {
        const a = d.baseAngle + Math.sin(now / 5000 + d.driftSeed) * 0.045
        const dx = cx + Math.cos(a) * OR, dy = cy + Math.sin(a) * OR
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(dx, dy)
        ctx.strokeStyle = `rgba(239,131,84,${0.3 * d.opacity})`
        ctx.lineWidth = 1
        ctx.setLineDash([4, 5])
        ctx.stroke()
        ctx.setLineDash([])
      })

      // Glow rings triggered by arriving pulses
      state.glowRings.forEach(g => {
        const t = (now - g.born) / g.duration
        const r = HR + HR * 3.4 * t
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(239,131,84,${0.75 * (1 - t)})`
        ctx.lineWidth = 2.5 * (1 - t * 0.7)
        ctx.stroke()
      })

      // Clementine hub
      drawClementine(ctx, cx, cy, HR)

      // Device icons
      state.devices.forEach(d => {
        const a = d.baseAngle + Math.sin(now / 5000 + d.driftSeed) * 0.045
        drawDevice(ctx, cx + Math.cos(a) * OR, cy + Math.sin(a) * OR, d.type, d.opacity)
      })

      // Pulse dots with tails
      state.pulses.forEach(p => {
        const t = p.progress
        const px = p.fromX + (cx - p.fromX) * t
        const py = p.fromY + (cy - p.fromY) * t
        const alpha = t < 0.88 ? 1 : 1 - (t - 0.88) / 0.12

        const vx = cx - p.fromX, vy = cy - p.fromY
        const vlen = Math.sqrt(vx * vx + vy * vy)
        const tailLen = 18
        const tx = px - (vx / vlen) * tailLen
        const ty = py - (vy / vlen) * tailLen

        const tg = ctx.createLinearGradient(tx, ty, px, py)
        tg.addColorStop(0, 'rgba(239,131,84,0)')
        tg.addColorStop(1, `rgba(239,131,84,${alpha * 0.85})`)
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(px, py)
        ctx.strokeStyle = tg
        ctx.lineWidth = 2
        ctx.stroke()

        // Glow halo
        ctx.beginPath()
        ctx.arc(px, py, 6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(239,131,84,${alpha * 0.22})`
        ctx.fill()

        // Bright dot
        ctx.beginPath()
        ctx.arc(px, py, 3.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,190,110,${alpha})`
        ctx.fill()
      })

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
