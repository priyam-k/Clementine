'use client'

import { useEffect, useRef } from 'react'

// ── Canvas primitives ─────────────────────────────────────────────────────────

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
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


type Col = [number, number, number]
const c = (col: Col, a: number) => `rgba(${col[0]},${col[1]},${col[2]},${a})`

// Per-device accent colors — muted jewel tones that complement the warm clementine theme
const DEVICE_COLORS: Col[] = [
  [91,  184, 168],  // teal
  [123, 163, 200],  // slate blue
  [124, 184, 122],  // sage green
  [155, 135, 196],  // soft lavender
  [212, 168,  67],  // warm amber
  [196, 123, 142],  // dusty rose
]

function drawPhone(
  ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number, col: Col,
) {
  const w = s * 0.52, h = s * 0.92, r = s * 0.1
  ctx.globalAlpha = alpha
  ctx.beginPath(); rrect(ctx, x - w / 2, y - h / 2, w, h, r)
  ctx.fillStyle = '#1c1008'; ctx.fill()
  ctx.strokeStyle = c(col, 0.75); ctx.lineWidth = 1.5; ctx.stroke()
  ctx.beginPath(); rrect(ctx, x - w / 2 + 2.5, y - h / 2 + 4, w - 5, h - 12, r * 0.6)
  ctx.fillStyle = c(col, 0.14); ctx.fill()
  ctx.beginPath(); ctx.arc(x, y - h / 2 + 2, 1.2, 0, Math.PI * 2)
  ctx.fillStyle = c(col, 0.6); ctx.fill()
  ctx.globalAlpha = 1
}

function drawLaptop(
  ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number, col: Col,
) {
  const sw = s * 1.1, sh = s * 0.72, bw = s * 1.2, bh = s * 0.12, r = 3
  const screenTop = y - sh / 2 - bh
  ctx.globalAlpha = alpha
  ctx.beginPath(); rrect(ctx, x - sw / 2, screenTop, sw, sh, r)
  ctx.fillStyle = '#1c1008'; ctx.fill()
  ctx.strokeStyle = c(col, 0.75); ctx.lineWidth = 1.5; ctx.stroke()
  ctx.beginPath(); rrect(ctx, x - sw / 2 + 3, screenTop + 3, sw - 6, sh - 6, r * 0.5)
  ctx.fillStyle = c(col, 0.14); ctx.fill()
  ctx.beginPath(); rrect(ctx, x - bw / 2, y + sh / 2 - bh * 2, bw, bh * 2, 2)
  ctx.fillStyle = '#1c1008'; ctx.fill()
  ctx.strokeStyle = c(col, 0.45); ctx.lineWidth = 1; ctx.stroke()
  ctx.globalAlpha = 1
}

function drawWire(
  ctx: CanvasRenderingContext2D,
  hx: number, hy: number, dx: number, dy: number,
  alpha: number, now: number, idx: number, col: Col,
) {
  if (alpha < 0.01) return
  const isLeft = dx < hx
  const archLift = Math.abs(dy - hy) < 80 ? 0.18 : 0.10
  const cp1x = hx + (isLeft ? -0.12 : 0.12) * Math.abs(dx - hx)
  const cp1y = hy - Math.abs(dy - hy) * archLift - 30
  const cp2x = dx + (isLeft ? 0.12 : -0.12) * Math.abs(dx - hx)
  const cp2y = dy - Math.abs(dy - hy) * archLift - 20

  const path = () => {
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, dx, dy)
  }

  path(); ctx.strokeStyle = c(col, 0.05 * alpha); ctx.lineWidth = 14; ctx.setLineDash([]); ctx.stroke()
  path(); ctx.strokeStyle = c(col, 0.12 * alpha); ctx.lineWidth = 5; ctx.stroke()
  path(); ctx.strokeStyle = c(col, 0.38 * alpha); ctx.lineWidth = 1.2; ctx.stroke()
  path()
  ctx.strokeStyle = c(col, 0.6 * alpha); ctx.lineWidth = 1
  ctx.setLineDash([5, 14]); ctx.lineDashOffset = -(now / 32 + idx * 18) % 19; ctx.stroke()
  ctx.setLineDash([]); ctx.lineDashOffset = 0

  const bezPt = (t: number) => {
    const u = 1 - t
    return {
      x: u*u*u*hx + 3*u*u*t*cp1x + 3*u*t*t*cp2x + t*t*t*dx,
      y: u*u*u*hy + 3*u*u*t*cp1y + 3*u*t*t*cp2y + t*t*t*dy,
    }
  }
  const t1 = ((now / 1400 + idx * 0.37)) % 1
  for (const t of [t1, (t1 + 0.5) % 1]) {
    const p = bezPt(t)
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6)
    g.addColorStop(0, c(col, 0.65 * alpha))
    g.addColorStop(1, c(col, 0))
    ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = c(col, 0.95 * alpha); ctx.fill()
  }
  for (const [ex, ey] of [[hx, hy], [dx, dy]]) {
    const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 10)
    eg.addColorStop(0, c(col, 0.18 * alpha)); eg.addColorStop(1, c(col, 0))
    ctx.beginPath(); ctx.arc(ex, ey, 10, 0, Math.PI * 2); ctx.fillStyle = eg; ctx.fill()
  }
}

function drawClementine(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number, now: number,
) {
  const cy = y + Math.sin(now / 1900) * 3

  const aura = ctx.createRadialGradient(x, cy, r * 0.5, x, cy, r * 2.6)
  aura.addColorStop(0, 'rgba(239,131,84,0.14)'); aura.addColorStop(1, 'rgba(239,131,84,0)')
  ctx.beginPath(); ctx.arc(x, cy, r * 2.6, 0, Math.PI * 2); ctx.fillStyle = aura; ctx.fill()

  const body = ctx.createRadialGradient(x - r * 0.28, cy - r * 0.3, r * 0.05, x, cy, r)
  body.addColorStop(0, '#FFA366'); body.addColorStop(0.55, '#EF8354'); body.addColorStop(1, '#C05A28')
  ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fillStyle = body; ctx.fill()

  ctx.save()
  ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.clip()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.strokeStyle = 'rgba(150,55,15,0.10)'; ctx.lineWidth = 1; ctx.stroke()
  }
  ctx.restore()

  ctx.beginPath(); ctx.arc(x - r * 0.28, cy - r * 0.3, r * 0.26, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,235,210,0.38)'; ctx.fill()

  // Stem: exits top-right, hooks upward then arcs to the side
  const stx = x + r * 0.12, sty = cy - r * 0.92
  const ex = x + r * 0.72, ey = cy - r * 1.08
  ctx.beginPath(); ctx.moveTo(stx, sty)
  ctx.bezierCurveTo(stx + r * 0.02, sty - r * 0.42, ex - r * 0.18, ey - r * 0.12, ex, ey)
  ctx.strokeStyle = '#4A2E1A'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round'; ctx.setLineDash([]); ctx.stroke()

  // Leaf: droops outward and downward from stem tip
  ctx.beginPath(); ctx.moveTo(ex, ey)
  ctx.bezierCurveTo(ex + r * 0.38, ey - r * 0.38, ex + r * 0.58, ey + r * 0.08, ex + r * 0.30, ey + r * 0.42)
  ctx.bezierCurveTo(ex + r * 0.10, ey + r * 0.28, ex - r * 0.06, ey + r * 0.06, ex, ey)
  ctx.fillStyle = '#2D6A4F'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(ex, ey)
  ctx.bezierCurveTo(ex + r * 0.22, ey + r * 0.05, ex + r * 0.32, ey + r * 0.22, ex + r * 0.28, ey + r * 0.40)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.8; ctx.stroke()
}

// ── Cycle timing ──────────────────────────────────────────────────────────────

const CYCLE = 5400, FADE = 450, HOLD = 1800

function devAlpha(phase: number, now: number): number {
  const t = ((now - phase) % CYCLE + CYCLE) % CYCLE
  if (t < FADE) return t / FADE
  if (t < FADE + HOLD) return 1
  if (t < FADE * 2 + HOLD) return 1 - (t - FADE - HOLD) / FADE
  return 0
}

function devSlide(phase: number, fx: number, now: number, W: number): number {
  const t = ((now - phase) % CYCLE + CYCLE) % CYCLE
  const dir = fx < 0.5 ? -1 : 1
  const max = W * 0.045
  if (t < FADE) return dir * max * (1 - t / FADE)
  if (t < FADE + HOLD) return 0
  if (t < FADE * 2 + HOLD) return dir * max * ((t - FADE - HOLD) / FADE)
  return dir * max
}

const DEVICES = [
  { fx: 0.11, fy: 0.22, type: 'phone',  phase: 0    },
  { fx: 0.88, fy: 0.22, type: 'laptop', phase: 900  },
  { fx: 0.09, fy: 0.52, type: 'phone',  phase: 1800 },
  { fx: 0.90, fy: 0.52, type: 'laptop', phase: 2700 },
  { fx: 0.11, fy: 0.80, type: 'phone',  phase: 3600 },
  { fx: 0.88, fy: 0.80, type: 'laptop', phase: 4500 },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function HeroMeshViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    const c = canvas;
    function resize() {
      const p = c.parentElement; if (!p) return
      c.width = p.clientWidth; c.height = p.clientHeight
    }
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    resize()

    const start = performance.now()
    let raf = 0

    function tick() {
      raf = requestAnimationFrame(tick)
      const now = performance.now() - start
      const W = c.width, H = c.height
      ctx.clearRect(0, 0, W, H)

      const hx = W * 0.50, hy = H * 0.50
      const s = Math.min(W, H)
      const fr = s * 0.085
      const ds = s * 0.065

      // Wires (behind clementine and devices)
      DEVICES.forEach((d, i) => {
        const a = devAlpha(d.phase, now)
        const dx = d.fx * W + devSlide(d.phase, d.fx, now, W)
        drawWire(ctx, hx, hy, dx, d.fy * H, a, now, i, DEVICE_COLORS[i])
      })

      // Clementine hub
      drawClementine(ctx, hx, hy, fr, now)

      // Devices
      DEVICES.forEach((d, i) => {
        const a = devAlpha(d.phase, now)
        if (a < 0.01) return
        const dx = d.fx * W + devSlide(d.phase, d.fx, now, W)
        if (d.type === 'phone') drawPhone(ctx, dx, d.fy * H, ds, a, DEVICE_COLORS[i])
        else drawLaptop(ctx, dx, d.fy * H, ds, a, DEVICE_COLORS[i])
      })
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="w-full h-full">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
