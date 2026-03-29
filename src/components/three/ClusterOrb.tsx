'use client'

import { useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceType = 'laptop' | 'phone' | 'desktop'
type DeviceState = 'connected' | 'disconnecting' | 'disconnected' | 'connecting'

interface Device {
  type: DeviceType
  posX: number
  posY: number
  cp1Nudge: number
  cp2Nudge: number
  state: DeviceState
  stateTimer: number
  connectedDuration: number
  opacity: number
  nextPulse: number
}

interface GlowRing {
  born: number
  duration: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FADE_MS          = 1400
const CONNECTED_MIN    = 7000
const CONNECTED_MAX    = 13000
const DISCONNECTED_MIN = 3000
const DISCONNECTED_MAX = 7000

function rand(min: number, max: number) { return min + Math.random() * (max - min) }
const lv = (a: number, b: number, t: number) => a + (b - a) * t  // lerp

// ─── Clementine illustration ──────────────────────────────────────────────────
// power: 0 = withered/rotten, 1 = fresh/vibrant

function drawClementine(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  r: number,
  power: number,
  now: number,
) {
  // Shimmer: gentle highlight oscillation when fresh
  const shimmer = Math.sin(now / 900) * 0.5 + 0.5

  // Scale: slightly deflated when withered
  const scX = lv(0.93, 1.00, power)
  const scY = lv(0.84, 0.91, power)

  // ── Body ──────────────────────────────────────────────────────────────────
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scX, scY)

  // Gradient colours: lerp fresh-orange ↔ dark rotten-brown
  const g = ctx.createRadialGradient(
    -r * 0.20, -r * 0.18, r * 0.04,
     r * 0.05,  r * 0.08, r * 1.08
  )
  g.addColorStop(0,    `rgb(${lv(105,255,power)|0},${lv( 52,185,power)|0},${lv(12, 71,power)|0})`)
  g.addColorStop(0.35, `rgb(${lv( 68,244,power)|0},${lv( 32,115,power)|0},${lv( 6, 32,power)|0})`)
  g.addColorStop(1,    `rgb(${lv( 32,200,power)|0},${lv( 14, 69,power)|0},${lv( 2, 16,power)|0})`)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()

  // ── Segment lines ──────────────────────────────────────────────────────────
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.clip()
  const segOpacity = lv(0.32, 0.17, power)
  const segWidth   = lv(1.10, 0.75, power)
  for (let i = 0; i < 9; i++) {
    const xEq = (((i + 0.5) / 9) * 2 - 1) * r * 0.88
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.bezierCurveTo(xEq * 0.72, -r * 0.48, xEq * 0.72, r * 0.48, 0, r)
    ctx.strokeStyle = `rgba(70,22,4,${segOpacity})`
    ctx.lineWidth = segWidth
    ctx.stroke()
  }

  // ── Rot blemishes (appear below power=0.65) ────────────────────────────────
  if (power < 0.65) {
    const bAlpha = ((0.65 - power) / 0.65) * 0.80
    const spots = [
      { x: -r * 0.24, y: -r * 0.26, s: r * 0.15 },
      { x:  r * 0.30, y:  r * 0.10, s: r * 0.12 },
      { x: -r * 0.06, y:  r * 0.38, s: r * 0.11 },
      { x:  r * 0.14, y: -r * 0.44, s: r * 0.09 },
    ]
    spots.forEach(sp => {
      const sg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.s)
      sg.addColorStop(0,   `rgba(12,4,1,${bAlpha})`)
      sg.addColorStop(0.55,`rgba(28,10,2,${bAlpha * 0.55})`)
      sg.addColorStop(1,   `rgba(28,10,2,0)`)
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, sp.s, 0, Math.PI * 2)
      ctx.fillStyle = sg
      ctx.fill()
    })
  }
  ctx.restore()

  // ── Pole dimples ───────────────────────────────────────────────────────────
  const pd = ctx.createRadialGradient(0, -r * 0.84, 0, 0, -r * 0.84, r * 0.24)
  pd.addColorStop(0,   `rgba(${lv(8,110,power)|0},${lv(3,30,power)|0},${lv(0,4,power)|0},${lv(0.65,0.55,power)})`)
  pd.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.ellipse(0, -r * 0.86, r * 0.20, r * 0.14, 0, 0, Math.PI * 2)
  ctx.fillStyle = pd
  ctx.fill()

  const bd = ctx.createRadialGradient(0, r * 0.86, 0, 0, r * 0.86, r * 0.18)
  bd.addColorStop(0,   `rgba(${lv(6,110,power)|0},${lv(2,30,power)|0},${lv(0,4,power)|0},0.45)`)
  bd.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.ellipse(0, r * 0.87, r * 0.15, r * 0.10, 0, 0, Math.PI * 2)
  ctx.fillStyle = bd
  ctx.fill()

  // ── Specular highlight ─────────────────────────────────────────────────────
  const hlBase  = lv(0.04, 0.52, power)
  const hlShimmer = hlBase + power * shimmer * 0.14
  const hl = ctx.createRadialGradient(
    -r * 0.30, -r * 0.32, 0,
    -r * 0.22, -r * 0.26, r * 0.54
  )
  hl.addColorStop(0,   `rgba(255,252,215,${hlShimmer})`)
  hl.addColorStop(0.4, `rgba(255,230,150,${hlShimmer * 0.28})`)
  hl.addColorStop(1,   'rgba(255,230,150,0)')
  ctx.beginPath()
  ctx.ellipse(-r * 0.24, -r * 0.28, r * 0.38, r * 0.26, -0.42, 0, Math.PI * 2)
  ctx.fillStyle = hl
  ctx.fill()

  // ── Subtle secondary highlight at fresh ───────────────────────────────────
  if (power > 0.5) {
    const sh2 = (power - 0.5) / 0.5 * 0.22
    const hl2 = ctx.createRadialGradient(r * 0.28, r * 0.22, 0, r * 0.28, r * 0.22, r * 0.28)
    hl2.addColorStop(0, `rgba(255,200,100,${sh2})`)
    hl2.addColorStop(1, 'rgba(255,200,100,0)')
    ctx.beginPath()
    ctx.arc(r * 0.28, r * 0.22, r * 0.28, 0, Math.PI * 2)
    ctx.fillStyle = hl2
    ctx.fill()
  }

  ctx.restore() // end translate + scale

  // ── Stem & leaves (world space, unscaled) ─────────────────────────────────
  const stemY = cy - r * lv(0.84, 0.90, power)
  ctx.save()
  ctx.translate(cx, stemY)

  // Stem colour and length
  const stemLen = r * lv(0.12, 0.20, power)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -stemLen)
  ctx.strokeStyle = `rgb(${lv(38,92,power)|0},${lv(22,53,power)|0},${lv(5,20,power)|0})`
  ctx.lineWidth = Math.max(1.2, r * 0.085)
  ctx.lineCap = 'round'
  ctx.stroke()

  // Leaf colours: fresh green → wilted olive-brown
  const lc1 = `rgb(${lv(78,60,power)|0},${lv(72,114,power)|0},${lv(14,32,power)|0})`
  const lc2 = `rgb(${lv(88,74,power)|0},${lv(82,136,power)|0},${lv(18,40,power)|0})`
  const veinA = lv(0.20, 0.36, power)

  // Left leaf — lerp upright (fresh) ↔ drooped (withered)
  const llEndX  = lv(-r * 0.38, -r * 0.32, power)
  const llEndY  = lv( r * 0.14, -r * 0.70, power)
  const llCp1X  = lv(-r * 0.10, -r * 0.14, power)
  const llCp1Y  = lv(-r * 0.03, -r * 0.30, power)
  const llCp2X  = lv(-r * 0.32, -r * 0.56, power)
  const llCp2Y  = lv( r * 0.12, -r * 0.32, power)
  const llR1X   = lv(-r * 0.40, -r * 0.60, power)
  const llR1Y   = lv( r * 0.18, -r * 0.36, power)
  const llR2X   = lv(-r * 0.16, -r * 0.32, power)
  const llR2Y   = lv( r * 0.06, -r * 0.02, power)

  ctx.beginPath()
  ctx.moveTo(0, -r * 0.05)
  ctx.bezierCurveTo(llCp1X, llCp1Y, llCp2X, llCp2Y, llEndX, llEndY)
  ctx.bezierCurveTo(llR1X, llR1Y, llR2X, llR2Y, 0, -r * 0.05)
  ctx.fillStyle = lc1
  ctx.fill()
  // Vein
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.05)
  ctx.quadraticCurveTo(lv(-r * 0.20, -r * 0.28, power), lv(r * 0.06, -r * 0.40, power), llEndX, llEndY)
  ctx.strokeStyle = `rgba(20,45,5,${veinA})`
  ctx.lineWidth = 0.7
  ctx.stroke()

  // Right leaf — also lerp upright ↔ drooped
  const rlEndX  = lv( r * 0.32,  r * 0.24, power)
  const rlEndY  = lv( r * 0.12, -r * 0.58, power)
  const rlCp1X  = lv( r * 0.08,  r * 0.10, power)
  const rlCp1Y  = lv(-r * 0.03, -r * 0.24, power)
  const rlCp2X  = lv( r * 0.35,  r * 0.44, power)
  const rlCp2Y  = lv( r * 0.12, -r * 0.26, power)
  const rlR1X   = lv( r * 0.33,  r * 0.48, power)
  const rlR1Y   = lv( r * 0.16, -r * 0.30, power)
  const rlR2X   = lv( r * 0.14,  r * 0.26, power)
  const rlR2Y   = lv( r * 0.05, -r * 0.02, power)

  ctx.beginPath()
  ctx.moveTo(0, -r * 0.05)
  ctx.bezierCurveTo(rlCp1X, rlCp1Y, rlCp2X, rlCp2Y, rlEndX, rlEndY)
  ctx.bezierCurveTo(rlR1X, rlR1Y, rlR2X, rlR2Y, 0, -r * 0.05)
  ctx.fillStyle = lc2
  ctx.fill()
  // Vein
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.05)
  ctx.quadraticCurveTo(lv(r * 0.20, r * 0.22, power), lv(r * 0.06, -r * 0.34, power), rlEndX, rlEndY)
  ctx.strokeStyle = `rgba(20,45,5,${veinA})`
  ctx.lineWidth = 0.7
  ctx.stroke()

  ctx.restore()
}

// ─── Supporting helpers ───────────────────────────────────────────────────────

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

function resolveDeviceBezier(d: Device, W: number, H: number, cx: number, cy: number) {
  const p0x = d.posX * W, p0y = d.posY * H
  const p3x = cx,         p3y = cy
  const dx = p3x - p0x, dy = p3y - p0y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const perpX = -dy / dist, perpY = dx / dist
  return {
    p0x, p0y,
    p1x: p0x + dx * 0.38 + perpX * dist * d.cp1Nudge,
    p1y: p0y + dy * 0.38 + perpY * dist * d.cp1Nudge,
    p2x: p0x + dx * 0.72 + perpX * dist * d.cp2Nudge,
    p2y: p0y + dy * 0.72 + perpY * dist * d.cp2Nudge,
    p3x, p3y,
  }
}

function computeBarColor(level: number): string {
  if (level < 0.5) {
    const t = level * 2
    return `rgb(${lv(0xD9,0xEF,t)|0},${lv(0x40,0x83,t)|0},${lv(0x40,0x54,t)|0})`
  }
  const t = (level - 0.5) * 2
  return `rgb(${lv(0xEF,0x4C,t)|0},${lv(0x83,0xAF,t)|0},${lv(0x54,0x50,t)|0})`
}

function drawDevice(ctx: CanvasRenderingContext2D, x: number, y: number, type: DeviceType, opacity: number) {
  if (opacity < 0.01) return
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.translate(x, y)
  const s = 15

  ctx.strokeStyle = '#EF8354'
  ctx.lineWidth = 1.2

  if (type === 'laptop') {
    ctx.fillStyle = '#2A1810'
    ctx.beginPath()
    rrect(ctx, -s * 0.9, -s, s * 1.8, s * 1.2, 2)
    ctx.fill(); ctx.stroke()
    ctx.fillStyle = 'rgba(239,131,84,0.30)'
    ctx.fillRect(-s * 0.68, -s * 0.78, s * 1.36, 0.7)
    ctx.fillRect(-s * 0.68, -s * 0.22, s * 0.95, 0.7)
    ctx.fillStyle = '#3A2218'
    ctx.beginPath()
    rrect(ctx, -s * 1.08, s * 0.22, s * 2.16, s * 0.3, 1)
    ctx.fill()
  } else if (type === 'phone') {
    ctx.fillStyle = '#2A1810'
    ctx.beginPath()
    rrect(ctx, -s * 0.5, -s, s, s * 2, 4)
    ctx.fill(); ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, s * 0.72, 2.8, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(239,131,84,0.45)'
    ctx.stroke()
    ctx.fillStyle = 'rgba(239,131,84,0.25)'
    ctx.fillRect(-s * 0.3, -s * 0.55, s * 0.6, 0.7)
    ctx.fillRect(-s * 0.3, -s * 0.1,  s * 0.45, 0.7)
  } else {
    ctx.fillStyle = '#2A1810'
    ctx.beginPath()
    rrect(ctx, -s * 0.95, -s * 0.82, s * 1.9, s * 1.38, 2)
    ctx.fill(); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-s * 0.28, s * 0.56)
    ctx.lineTo(-s * 0.44, s * 0.94)
    ctx.lineTo( s * 0.44, s * 0.94)
    ctx.lineTo( s * 0.28, s * 0.56)
    ctx.closePath()
    ctx.fillStyle = '#3A2218'; ctx.fill()
    ctx.fillStyle = 'rgba(239,131,84,0.25)'
    ctx.fillRect(-s * 0.72, -s * 0.58, s * 1.44, 0.7)
    ctx.fillRect(-s * 0.72, -s * 0.1,  s, 0.7)
  }

  ctx.restore()
}

function initDevices(now: number): Device[] {
  return [
    {
      type: 'laptop',
      posX: 0.13, posY: 0.15,
      cp1Nudge: +0.30, cp2Nudge: +0.18,
      state: 'connected',
      stateTimer: now - rand(2000, 6000),
      connectedDuration: rand(CONNECTED_MIN, CONNECTED_MAX),
      opacity: 1,
      nextPulse: now + rand(3000, 6000),
    },
    {
      type: 'phone',
      posX: 0.12, posY: 0.72,
      cp1Nudge: -0.25, cp2Nudge: -0.15,
      state: 'disconnected',
      stateTimer: now - rand(0, 3000),
      connectedDuration: rand(CONNECTED_MIN, CONNECTED_MAX),
      opacity: 0,
      nextPulse: 0,
    },
    {
      type: 'desktop',
      posX: 0.82, posY: 0.22,
      cp1Nudge: -0.20, cp2Nudge: +0.12,
      state: 'connecting',
      stateTimer: now - rand(0, 800),
      connectedDuration: rand(CONNECTED_MIN, CONNECTED_MAX),
      opacity: 0,
      nextPulse: 0,
    },
  ]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClusterOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (!ctx) return

    const now0 = performance.now()
    const state = {
      devices: initDevices(now0),
      glowRings: [] as GlowRing[],
    }

    function resize() {
      const p = canvas.parentElement
      if (!p) return
      canvas.width  = p.clientWidth
      canvas.height = p.clientHeight
    }

    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    resize()

    let rafId = 0

    function tick(now: number) {
      const W = canvas.width, H = canvas.height
      const minD = Math.min(W, H)
      const cx = W * 0.58, cy = H * 0.52
      const HR = minD * 0.15

      // ── Device state machines ─────────────────────────────────────────────
      state.devices.forEach(d => {
        const elapsed = now - d.stateTimer

        if (d.state === 'connected') {
          d.opacity = 1
          if (elapsed >= d.connectedDuration) {
            d.state = 'disconnecting'
            d.stateTimer = now
            d.connectedDuration = rand(CONNECTED_MIN, CONNECTED_MAX)
          }
          if (now >= d.nextPulse) {
            state.glowRings.push({ born: now, duration: 800 })
            d.nextPulse = now + rand(3000, 6000)
          }
        } else if (d.state === 'disconnecting') {
          d.opacity = Math.max(0, 1 - elapsed / FADE_MS)
          if (elapsed >= FADE_MS) {
            d.opacity = 0; d.state = 'disconnected'; d.stateTimer = now
          }
        } else if (d.state === 'disconnected') {
          d.opacity = 0
          if (elapsed >= rand(DISCONNECTED_MIN, DISCONNECTED_MAX)) {
            d.state = 'connecting'; d.stateTimer = now
          }
        } else if (d.state === 'connecting') {
          d.opacity = Math.min(1, elapsed / FADE_MS)
          if (elapsed >= FADE_MS) {
            d.opacity = 1; d.state = 'connected'; d.stateTimer = now
            d.nextPulse = now + rand(2000, 4000)
          }
        }
      })

      state.glowRings = state.glowRings.filter(g => now - g.born < g.duration)

      const powerLevel = (state.devices[0].opacity + state.devices[1].opacity + state.devices[2].opacity) / 3

      // ── DRAW ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H)

      const flowOffset = -(now / 55) % 20

      // 1. Wires
      state.devices.forEach(d => {
        if (d.opacity < 0.01) return
        const bz = resolveDeviceBezier(d, W, H, cx, cy)

        // Soft outer glow
        ctx.beginPath()
        ctx.moveTo(bz.p0x, bz.p0y)
        ctx.bezierCurveTo(bz.p1x, bz.p1y, bz.p2x, bz.p2y, bz.p3x, bz.p3y)
        ctx.strokeStyle = `rgba(239,131,84,${0.07 * d.opacity})`
        ctx.lineWidth = 7
        ctx.setLineDash([])
        ctx.stroke()

        // Base wire
        ctx.beginPath()
        ctx.moveTo(bz.p0x, bz.p0y)
        ctx.bezierCurveTo(bz.p1x, bz.p1y, bz.p2x, bz.p2y, bz.p3x, bz.p3y)
        ctx.strokeStyle = `rgba(239,131,84,${0.18 * d.opacity})`
        ctx.lineWidth = 1.5
        ctx.setLineDash([])
        ctx.stroke()

        // Animated current
        ctx.beginPath()
        ctx.moveTo(bz.p0x, bz.p0y)
        ctx.bezierCurveTo(bz.p1x, bz.p1y, bz.p2x, bz.p2y, bz.p3x, bz.p3y)
        ctx.strokeStyle = `rgba(239,131,84,${0.65 * d.opacity})`
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 11])
        ctx.lineDashOffset = flowOffset
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineDashOffset = 0
      })

      // 2. Glow rings
      state.glowRings.forEach(g => {
        const t = (now - g.born) / g.duration
        ctx.beginPath()
        ctx.arc(cx, cy, HR * 0.85 + HR * 1.2 * t, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(239,131,84,${0.45 * (1 - t) * powerLevel})`
        ctx.lineWidth = 1.5 * (1 - t)
        ctx.stroke()
      })

      // 3. Ambient glow (scales with power, dims when withered)
      if (powerLevel > 0.05) {
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, HR * 2.6)
        grd.addColorStop(0, `rgba(239,131,84,${0.18 * powerLevel})`)
        grd.addColorStop(1, 'rgba(239,131,84,0)')
        ctx.beginPath()
        ctx.arc(cx, cy, HR * 2.6, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()
      }

      // 4. Clementine (state-driven illustration)
      drawClementine(ctx, cx, cy, HR, powerLevel, now)

      // 5. Compute bar
      const barW = W * 0.20
      const barH = 6
      const barR = 3
      const barX = cx - barW / 2
      const barY = cy - HR * lv(0.84, 0.90, powerLevel) - 30

      ctx.fillStyle = 'rgba(18,11,9,0.28)'
      ctx.font = '700 7.5px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('C O M P U T E', cx, barY - 7)

      ctx.beginPath()
      rrect(ctx, barX, barY, barW, barH, barR)
      ctx.fillStyle = 'rgba(18,11,9,0.08)'
      ctx.fill()

      ctx.save()
      ctx.beginPath()
      rrect(ctx, barX, barY, barW, barH, barR)
      ctx.clip()
      ctx.fillStyle = computeBarColor(powerLevel)
      ctx.fillRect(barX, barY, barW * powerLevel, barH)
      ctx.restore()

      // 6. Devices
      state.devices.forEach(d => {
        drawDevice(ctx, d.posX * W, d.posY * H, d.type, d.opacity)
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
