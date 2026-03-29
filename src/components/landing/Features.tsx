'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion'

// ─── Step data ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    tag: 'Distributed Mesh',
    title: 'Any Device,\nInstant Worker',
    body: 'Any device on your local network joins as a worker — phone, tablet, or laptop. No installation, no accounts.',
  },
  {
    num: '02',
    tag: 'Voice Dispatch',
    title: 'Say It.\nDone.',
    body: 'Say "Hey Clementine" and dictate your compute job. No config files, no CLI.',
  },
  {
    num: '03',
    tag: 'Real Compute',
    title: 'Split.\nDistribute.\nHarvest.',
    body: "Jobs split into subtasks and distributed intelligently by each worker's capacity.",
  },
  {
    num: '04',
    tag: 'Stays Local',
    title: 'Your Network,\nYour Rules',
    body: 'Your data never leaves your network. Everything runs on your own hardware.',
  },
]

// ─── Shared canvas helpers ────────────────────────────────────────────────────

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

function dotGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const sp = 28
  for (let x = sp / 2; x < W; x += sp) {
    for (let y = sp / 2; y < H; y += sp) {
      ctx.beginPath()
      ctx.arc(x, y, 0.7, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(239,131,84,0.07)'
      ctx.fill()
    }
  }
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, alpha: number, pulse: number,
) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2)
  gr.addColorStop(0, `rgba(239,131,84,${0.22 * alpha})`)
  gr.addColorStop(1, 'rgba(239,131,84,0)')
  ctx.beginPath()
  ctx.arc(x, y, r * 3.2, 0, Math.PI * 2)
  ctx.fillStyle = gr
  ctx.fill()

  if (pulse > 0) {
    ctx.beginPath()
    ctx.arc(x, y, r + r * 2.8 * pulse, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(239,131,84,${0.55 * (1 - pulse) * alpha})`
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(239,131,84,${alpha})`
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, r * 0.38, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255,235,200,${alpha})`
  ctx.fill()
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// ─── Viz 1: Distributed Mesh ──────────────────────────────────────────────────

function MeshViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    function resize() {
      const p = canvas.parentElement; if (!p) return
      canvas.width = p.clientWidth; canvas.height = p.clientHeight
    }
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    resize()

    const start = performance.now()
    let raf = 0

    // Hub + 5 satellites, staggered appearance
    const nodes = [
      { fx: 0.50, fy: 0.47, appear: 0 },
      { fx: 0.24, fy: 0.22, appear: 350 },
      { fx: 0.76, fy: 0.20, appear: 700 },
      { fx: 0.84, fy: 0.62, appear: 1050 },
      { fx: 0.52, fy: 0.80, appear: 1400 },
      { fx: 0.16, fy: 0.65, appear: 1750 },
    ]
    // Hub connects to all; outer ring connects to adjacent
    const edges = [
      [0,1],[0,2],[0,3],[0,4],[0,5],
      [1,2],[2,3],[3,4],[4,5],[5,1],
    ]

    const pulses = nodes.map(() => -1)
    const nextPulse = nodes.map((n, i) => n.appear + 1800 + i * 420)

    function tick() {
      raf = requestAnimationFrame(tick)
      const now = performance.now() - start
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      dotGrid(ctx, W, H)

      const nr = Math.min(W, H) * 0.027
      const opacities = nodes.map(n => now < n.appear ? 0 : Math.min(1, (now - n.appear) / 650))

      // Update pulses
      nodes.forEach((_, i) => {
        if (pulses[i] < 0 && now >= nextPulse[i] && opacities[i] > 0.8) {
          pulses[i] = 0
        }
        if (pulses[i] >= 0) {
          pulses[i] = (now - nextPulse[i]) / 1100
          if (pulses[i] > 1) {
            pulses[i] = -1
            nextPulse[i] = now + 1600 + i * 280
          }
        }
      })

      // Edges
      edges.forEach(([a, b]) => {
        const al = opacities[a] * opacities[b]
        if (al < 0.01) return
        const ax = nodes[a].fx * W, ay = nodes[a].fy * H
        const bx = nodes[b].fx * W, by = nodes[b].fy * H

        ctx.beginPath()
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
        ctx.strokeStyle = `rgba(239,131,84,${0.07 * al})`
        ctx.lineWidth = 5
        ctx.setLineDash([])
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
        ctx.strokeStyle = `rgba(239,131,84,${0.22 * al})`
        ctx.lineWidth = 1
        ctx.setLineDash([3, 9])
        ctx.lineDashOffset = -(now / 58) % 12
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineDashOffset = 0
      })

      // Nodes
      nodes.forEach((n, i) => {
        if (opacities[i] < 0.01) return
        drawNode(ctx, n.fx * W, n.fy * H, nr, opacities[i], pulses[i] >= 0 ? pulses[i] : 0)
      })

      // Hub label
      if (opacities[0] > 0.5) {
        ctx.font = '700 8px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255,210,170,${opacities[0] * 0.65})`
        ctx.fillText('HUB', nodes[0].fx * W, nodes[0].fy * H + nr + 12)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

// ─── Viz 2: Voice Dispatch ────────────────────────────────────────────────────

function VoiceViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    function resize() {
      const p = canvas.parentElement; if (!p) return
      canvas.width = p.clientWidth; canvas.height = p.clientHeight
    }
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    resize()

    const start = performance.now()
    let raf = 0
    const NUM_BARS = 30

    function tick() {
      raf = requestAnimationFrame(tick)
      const now = performance.now() - start
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      dotGrid(ctx, W, H)

      const cx = W * 0.5, cy = H * 0.40
      const mr = Math.min(W, H) * 0.095
      const t = now / 1000

      // Expanding rings
      for (let i = 0; i < 3; i++) {
        const phase = (t * 0.55 + i * 0.33) % 1
        const ringR = mr * 1.6 + mr * 3.8 * phase
        ctx.beginPath()
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(239,131,84,${0.5 * (1 - phase)})`
        ctx.lineWidth = 1.5 * (1 - phase * 0.6)
        ctx.stroke()
      }

      // Mic glow
      const mg = ctx.createRadialGradient(cx, cy, 0, cx, cy, mr * 1.5)
      mg.addColorStop(0, 'rgba(239,131,84,0.20)')
      mg.addColorStop(1, 'rgba(239,131,84,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, mr * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = mg
      ctx.fill()

      // Mic capsule body
      const mw = mr * 0.60, mh = mr * 1.45
      ctx.beginPath()
      rrect(ctx, cx - mw / 2, cy - mh * 0.60, mw, mh * 0.95, mw / 2)
      ctx.fillStyle = '#EF8354'
      ctx.fill()

      // Mic stand arc
      ctx.beginPath()
      ctx.arc(cx, cy + mh * 0.38, mr * 0.72, Math.PI * 0.1, Math.PI * 0.9)
      ctx.strokeStyle = 'rgba(239,131,84,0.75)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Stand post
      ctx.beginPath()
      ctx.moveTo(cx, cy + mh * 0.38 + mr * 0.72)
      ctx.lineTo(cx, cy + mh * 0.38 + mr * 0.72 + mr * 0.40)
      ctx.strokeStyle = 'rgba(239,131,84,0.55)'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.stroke()

      // Base
      const baseY = cy + mh * 0.38 + mr * 0.72 + mr * 0.40
      ctx.beginPath()
      ctx.moveTo(cx - mr * 0.52, baseY)
      ctx.lineTo(cx + mr * 0.52, baseY)
      ctx.strokeStyle = 'rgba(239,131,84,0.45)'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.stroke()

      // Waveform bars
      const barsY = H * 0.79
      const totalBW = W * 0.52
      const slotW = totalBW / NUM_BARS
      const barW = slotW * 0.52
      const startX = (W - totalBW) / 2

      for (let i = 0; i < NUM_BARS; i++) {
        const wave = 0.10 + 0.48 * Math.abs(Math.sin(t * 2.0 + i * 0.44))
                   + 0.18 * Math.abs(Math.sin(t * 3.5 + i * 0.19))
        const bh = Math.max(3, wave * H * 0.17)
        const bx = startX + i * slotW
        const by = barsY - bh / 2
        ctx.beginPath()
        rrect(ctx, bx, by, barW, bh, 1.5)
        ctx.fillStyle = `rgba(239,131,84,${0.28 + wave * 0.62})`
        ctx.fill()
      }

      // Label
      const la = 0.45 + 0.20 * Math.sin(t * 0.75)
      ctx.font = '700 10px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(239,131,84,${la})`
      ctx.fillText('H E Y  C L E M E N T I N E', cx, H * 0.91)
    }

    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

// ─── Viz 3: Real Compute ──────────────────────────────────────────────────────

function ComputeViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    function resize() {
      const p = canvas.parentElement; if (!p) return
      canvas.width = p.clientWidth; canvas.height = p.clientHeight
    }
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    resize()

    const CYCLE = 5600
    const start = performance.now()
    let raf = 0

    const workers = [
      { fx: 0.20, fy: 0.25 },
      { fx: 0.80, fy: 0.25 },
      { fx: 0.20, fy: 0.75 },
      { fx: 0.80, fy: 0.75 },
    ]

    function tick() {
      raf = requestAnimationFrame(tick)
      const now = performance.now() - start
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      dotGrid(ctx, W, H)

      const cx = W * 0.50, cy = H * 0.46
      const tW = W * 0.20, tH = H * 0.09
      const sW = tW * 0.44, sH = tH * 0.90
      const nr = Math.min(W, H) * 0.042

      const phase = (now % CYCLE) / CYCLE
      const SPLIT_S = 0.14, SPLIT_E = 0.32
      const PROC_E  = 0.72
      const MERGE_S = 0.72, MERGE_E = 0.91

      // Helper: draw a task block
      const taskBlock = (x: number, y: number, w: number, h: number, label: string, col: string, alpha: number) => {
        ctx.globalAlpha = alpha
        ctx.beginPath()
        rrect(ctx, x - w / 2, y - h / 2, w, h, 4)
        ctx.fillStyle = '#1E0E0A'
        ctx.fill()
        ctx.strokeStyle = col
        ctx.lineWidth = 1.4
        ctx.stroke()
        ctx.font = '700 8px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = col
        ctx.fillText(label, x, y + 3)
        ctx.globalAlpha = 1
      }

      if (phase < SPLIT_S) {
        // Show unified task block
        const a = phase < 0.04 ? phase / 0.04 : 1
        taskBlock(cx, cy, tW, tH, 'TASK', 'rgba(239,131,84,0.70)', a)

      } else if (phase < SPLIT_E) {
        // Split: 4 fragments fly from center to workers
        const t = easeInOut((phase - SPLIT_S) / (SPLIT_E - SPLIT_S))

        workers.forEach((w, i) => {
          const wx = w.fx * W, wy = w.fy * H
          const fx = cx + (wx - cx) * t
          const fy = cy + (wy - cy) * t
          taskBlock(fx, fy, sW * (1 - t * 0.15), sH, `T${i + 1}`, `rgba(239,131,84,${0.45 + t * 0.35})`, 1)
        })

        // Fading source block
        taskBlock(cx, cy, tW, tH, 'TASK', 'rgba(239,131,84,0.50)', 1 - t)

      } else if (phase < PROC_E) {
        // Workers processing
        const t = (phase - SPLIT_E) / (PROC_E - SPLIT_E)

        workers.forEach((w, i) => {
          const wx = w.fx * W, wy = w.fy * H
          const stagger = i * 0.10
          const prog = Math.min(1, Math.max(0, (t - stagger) / (0.88 - stagger)))

          // Node glow
          const ng = ctx.createRadialGradient(wx, wy, 0, wx, wy, nr * 2.2)
          ng.addColorStop(0, `rgba(239,131,84,${0.14 * (0.3 + prog * 0.7)})`)
          ng.addColorStop(1, 'rgba(239,131,84,0)')
          ctx.beginPath()
          ctx.arc(wx, wy, nr * 2.2, 0, Math.PI * 2)
          ctx.fillStyle = ng
          ctx.fill()

          // Node
          ctx.beginPath()
          ctx.arc(wx, wy, nr, 0, Math.PI * 2)
          ctx.fillStyle = '#1E0E0A'
          ctx.fill()
          ctx.strokeStyle = 'rgba(239,131,84,0.55)'
          ctx.lineWidth = 1.2
          ctx.stroke()

          ctx.font = '700 7px Inter, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillStyle = 'rgba(255,200,150,0.75)'
          ctx.fillText(`T${i + 1}`, wx, wy + 2.8)

          // Progress bar
          const bw = nr * 3.4, bh = 4, br = 2
          const bx = wx - bw / 2, by = wy + nr + 9
          ctx.beginPath()
          rrect(ctx, bx, by, bw, bh, br)
          ctx.fillStyle = 'rgba(239,131,84,0.12)'
          ctx.fill()
          ctx.save()
          ctx.beginPath()
          rrect(ctx, bx, by, bw, bh, br)
          ctx.clip()
          ctx.fillStyle = 'rgba(239,131,84,0.80)'
          ctx.fillRect(bx, by, bw * prog, bh)
          ctx.restore()
        })

        // Connection lines
        const la = t < 0.06 ? t / 0.06 : t > 0.92 ? (1 - t) / 0.08 : 1
        workers.forEach(w => {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(w.fx * W, w.fy * H)
          ctx.strokeStyle = `rgba(239,131,84,${0.14 * la})`
          ctx.lineWidth = 1
          ctx.setLineDash([3, 9])
          ctx.lineDashOffset = -(now / 60) % 12
          ctx.stroke()
          ctx.setLineDash([])
          ctx.lineDashOffset = 0
        })

      } else if (phase < MERGE_E) {
        // Merge: fragments fly back to center
        const t = easeInOut((phase - MERGE_S) / (MERGE_E - MERGE_S))

        workers.forEach((w, i) => {
          const wx = w.fx * W, wy = w.fy * H
          const fx = wx + (cx - wx) * t
          const fy = wy + (cy - wy) * t
          taskBlock(fx, fy, sW, sH, `T${i + 1}`, `rgba(76,175,80,${0.5 + t * 0.3})`, 1 - t * 0.15)
        })

        // Center glow builds
        if (t > 0.6) {
          const ga = (t - 0.6) / 0.4
          const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, tW * 1.2)
          gg.addColorStop(0, `rgba(76,175,80,${0.28 * ga})`)
          gg.addColorStop(1, 'rgba(76,175,80,0)')
          ctx.beginPath()
          ctx.arc(cx, cy, tW * 1.2, 0, Math.PI * 2)
          ctx.fillStyle = gg
          ctx.fill()
        }

      } else {
        // Merged result shown briefly
        const a = phase > 0.94 ? (1 - (phase - 0.94) / 0.06) : 1
        taskBlock(cx, cy, tW, tH, 'DONE', 'rgba(76,175,80,0.80)', a)

        const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, tW * 1.4)
        gg.addColorStop(0, `rgba(76,175,80,${0.20 * a})`)
        gg.addColorStop(1, 'rgba(76,175,80,0)')
        ctx.globalAlpha = a
        ctx.beginPath()
        ctx.arc(cx, cy, tW * 1.4, 0, Math.PI * 2)
        ctx.fillStyle = gg
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

// ─── Viz 4: Stays Local ───────────────────────────────────────────────────────

function LocalViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    function resize() {
      const p = canvas.parentElement; if (!p) return
      canvas.width = p.clientWidth; canvas.height = p.clientHeight
    }
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    resize()

    const start = performance.now()
    let raf = 0

    const innerNodes = [
      { fx: 0.39, fy: 0.37 },
      { fx: 0.61, fy: 0.37 },
      { fx: 0.39, fy: 0.63 },
      { fx: 0.61, fy: 0.63 },
    ]

    const packets = Array.from({ length: 7 }, (_, i) => ({
      angle: (i / 7) * Math.PI * 2,
      radius: 0.13 + (i % 3) * 0.04,
      speed: 0.00038 + (i % 4) * 0.00018,
      dir: i % 2 === 0 ? 1 : -1,
    }))

    function tick() {
      raf = requestAnimationFrame(tick)
      const now = performance.now() - start
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      dotGrid(ctx, W, H)

      const cx = W * 0.5, cy = H * 0.50
      const boundR = Math.min(W, H) * 0.295
      const t = now / 1000

      // Dark vignette outside boundary
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, W, H)
      ctx.arc(cx, cy, boundR, 0, Math.PI * 2, true)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fill('evenodd')
      ctx.restore()

      // Boundary glow layers
      for (let i = 4; i > 0; i--) {
        ctx.beginPath()
        ctx.arc(cx, cy, boundR + i * 2.5, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(239,131,84,${0.04 / i})`
        ctx.lineWidth = i * 3
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(cx, cy, boundR, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(239,131,84,${0.62 + 0.14 * Math.sin(t * 1.4)})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Inner node connections
      for (let a = 0; a < innerNodes.length; a++) {
        for (let b = a + 1; b < innerNodes.length; b++) {
          ctx.beginPath()
          ctx.moveTo(innerNodes[a].fx * W, innerNodes[a].fy * H)
          ctx.lineTo(innerNodes[b].fx * W, innerNodes[b].fy * H)
          ctx.strokeStyle = 'rgba(239,131,84,0.14)'
          ctx.lineWidth = 1
          ctx.setLineDash([3, 7])
          ctx.lineDashOffset = -(now / 55) % 10
          ctx.stroke()
          ctx.setLineDash([])
          ctx.lineDashOffset = 0
        }
      }

      // Inner nodes
      const nr = Math.min(W, H) * 0.026
      innerNodes.forEach(n => drawNode(ctx, n.fx * W, n.fy * H, nr, 0.88, 0))

      // Packets
      packets.forEach(pk => {
        pk.angle += pk.speed * pk.dir * 16
        const px = cx + Math.cos(pk.angle) * pk.radius * Math.min(W, H)
        const py = cy + Math.sin(pk.angle) * pk.radius * Math.min(W, H)
        const pg = ctx.createRadialGradient(px, py, 0, px, py, 7)
        pg.addColorStop(0, 'rgba(255,210,160,0.80)')
        pg.addColorStop(1, 'rgba(239,131,84,0)')
        ctx.beginPath()
        ctx.arc(px, py, 7, 0, Math.PI * 2)
        ctx.fillStyle = pg
        ctx.fill()
        ctx.beginPath()
        ctx.arc(px, py, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,230,180,0.90)'
        ctx.fill()
      })

      // Lock icon above boundary
      const lx = cx, ly = cy - boundR - 28
      const lw = 17, lh = 12, lsr = 5.5

      // Shackle
      ctx.beginPath()
      ctx.arc(lx, ly + lsr * 0.5, lsr, Math.PI, 0)
      ctx.strokeStyle = `rgba(239,131,84,${0.82 + 0.14 * Math.sin(t * 1.3)})`
      ctx.lineWidth = 2.4
      ctx.stroke()

      // Body
      ctx.beginPath()
      rrect(ctx, lx - lw / 2, ly + lsr * 0.5 - 1, lw, lh, 3)
      ctx.fillStyle = `rgba(239,131,84,${0.82 + 0.14 * Math.sin(t * 1.3)})`
      ctx.fill()

      // Keyhole
      ctx.beginPath()
      ctx.arc(lx, ly + lsr * 0.5 + lh * 0.38, 2.2, 0, Math.PI * 2)
      ctx.fillStyle = '#120B09'
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(lx, ly + lsr * 0.5 + lh * 0.38 + 2.2)
      ctx.lineTo(lx, ly + lsr * 0.5 + lh * 0.78)
      ctx.strokeStyle = '#120B09'
      ctx.lineWidth = 1.8
      ctx.lineCap = 'round'
      ctx.stroke()

      // Bottom label
      ctx.font = '700 9px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(239,131,84,${0.38 + 0.10 * Math.sin(t * 0.7)})`
      ctx.fillText('L O C A L  N E T W O R K', cx, cy + boundR + 22)
    }

    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

// ─── Main export ──────────────────────────────────────────────────────────────

const VIZZES = [MeshViz, VoiceViz, ComputeViz, LocalViz]

export default function Features() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState(0)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  useMotionValueEvent(scrollYProgress, 'change', v => {
    setActiveStep(Math.min(3, Math.floor(v * 4)))
  })

  return (
    <section ref={containerRef} id="how-it-works" className="relative bg-[#120B09]" style={{ height: '400vh' }}>

      {/* ── Desktop: sticky scroll layout ── */}
      <div className="sticky top-0 h-screen overflow-hidden hidden lg:flex">

        {/* Left text column */}
        <div className="relative z-10 flex flex-col justify-center w-[44%] shrink-0 pl-14 pr-10">
          <div className="mb-10">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354]">
              How it works
            </span>
            <div className="mt-2 h-px w-10 bg-[#EF8354]/30" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="flex items-start gap-4 mb-6">
                <span className="text-[80px] leading-none font-black italic text-[#EF8354]/20 select-none mt-2 shrink-0">
                  {STEPS[activeStep].num}
                </span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#EF8354]/65 mb-2">
                    {STEPS[activeStep].tag}
                  </p>
                  <h2 className="text-4xl xl:text-5xl font-black text-white tracking-tighter uppercase leading-[0.88] whitespace-pre-line">
                    {STEPS[activeStep].title}
                  </h2>
                </div>
              </div>
              <p className="text-white/45 text-sm leading-relaxed font-medium max-w-[280px]">
                {STEPS[activeStep].body}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Step progress bars */}
          <div className="flex items-center gap-2 mt-12">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-[2px] rounded-full transition-all duration-500"
                style={{
                  width: i === activeStep ? 36 : 14,
                  backgroundColor: i === activeStep ? '#EF8354' : 'rgba(239,131,84,0.22)',
                }}
              />
            ))}
          </div>

          {/* Scroll hint on first step */}
          {activeStep === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.2 }}
              className="mt-6 text-[9px] font-black uppercase tracking-[0.25em] text-white/20"
            >
              Scroll to explore ↓
            </motion.p>
          )}
        </div>

        {/* Vertical divider */}
        <div className="absolute left-[44%] top-[15%] bottom-[15%] w-px bg-white/[0.06]" />

        {/* Right viz column */}
        <div className="flex-1 relative">
          <AnimatePresence>
            {STEPS.map((_, i) => {
              const Viz = VIZZES[i]
              return i === activeStep ? (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45 }}
                  className="absolute inset-0"
                >
                  <Viz />
                </motion.div>
              ) : null
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile: stacked sections ── */}
      <div className="lg:hidden">
        {STEPS.map((step, i) => {
          const Viz = VIZZES[i]
          return (
            <div key={i} className="px-6 py-20 border-b border-white/[0.06]">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#EF8354]/65 mb-2">
                {step.tag}
              </p>
              <div className="flex items-start gap-3 mb-5">
                <span className="text-6xl leading-none font-black italic text-[#EF8354]/20 select-none shrink-0">
                  {step.num}
                </span>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-[0.9] whitespace-pre-line">
                  {step.title}
                </h2>
              </div>
              <p className="text-white/45 text-sm leading-relaxed font-medium mb-8">
                {step.body}
              </p>
              <div className="aspect-square max-w-[320px] mx-auto">
                <Viz />
              </div>
            </div>
          )
        })}
      </div>

    </section>
  )
}
