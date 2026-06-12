/**
 * Volt — Circuit Canvas
 *
 * Canvas-API renderer and interaction layer for the sandbox.
 *   - Click a palette item, then click the canvas to place (ghost preview).
 *   - Drag from terminal to terminal to wire.
 *   - Drag a component body to move it (grid-snapped).
 *   - Mouse wheel zooms (about the cursor); middle-drag or Alt+drag pans.
 *   - Double-click a switch to toggle it. Right-click a wire to delete it.
 *   - R rotates the selection, Delete removes it, Escape cancels.
 *
 * Rendering runs on a requestAnimationFrame loop reading the store directly,
 * so current-flow animation stays smooth without React re-renders.
 */
import { useEffect, useRef } from 'react'
import { useCircuitStore, type SimulationResult } from '@stores/circuitStore'
import { useUIStore } from '@stores/uiStore'
import {
  ELEMENTS,
  GRID,
  formatValue,
  nextLabel,
  snapToGrid,
  terminalPosition,
  type CircuitComponent,
  type ComponentType,
  type Wire
} from '../../sim/elements'
import { terminalKey } from '../../sim/netlist'

interface CircuitCanvasProps {
  pendingType: ComponentType | null
  onPlaced: () => void
  /** Receives the underlying canvas element (for PNG export). */
  canvasElRef?: React.MutableRefObject<HTMLCanvasElement | null>
}

interface TerminalHit {
  componentId: string
  terminal: number
  x: number
  y: number
}

const TERMINAL_RADIUS = 5
const TERMINAL_HIT_RADIUS = 9
const COMPONENT_HIT_RADIUS = 2 * GRID
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5

// ── Color helpers ────────────────────────────────────────────────────────────

function voltageColor(v: number, maxAbs: number, neutral: string): string {
  if (maxAbs < 1e-9) return neutral
  const t = Math.max(-1, Math.min(1, v / maxAbs))
  if (Math.abs(t) < 0.02) return neutral
  const hue = t >= 0 ? 25 : 215 // warm = positive, cool = negative
  const sat = Math.round(85 * Math.abs(t))
  return `hsl(${hue}, ${sat}%, 52%)`
}

/** Current flowing along a wire from its `from` endpoint to its `to` endpoint. */
function wireCurrent(wire: Wire, sim: SimulationResult): number | null {
  const fromI = sim.elementCurrents[wire.fromComponentId]
  if (fromI !== undefined) {
    // element current runs t0 → t1 inside the component; at t1 it exits into the wire
    return wire.fromTerminal === 1 ? fromI : -fromI
  }
  const toI = sim.elementCurrents[wire.toComponentId]
  if (toI !== undefined) {
    return -(wire.toTerminal === 1 ? toI : -toI)
  }
  return null
}

function distToSegment(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

// ── Symbol drawing (horizontal, centred at origin, terminals at ±2·GRID) ────

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  comp: CircuitComponent,
  stroke: string,
  lit: boolean
): void {
  const E = 2 * GRID // terminal extent
  ctx.strokeStyle = stroke
  ctx.fillStyle = stroke
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()

  switch (comp.type) {
    case 'resistor': {
      ctx.moveTo(-E, 0)
      ctx.lineTo(-24, 0)
      const n = 6
      const w = 48 / n
      for (let i = 0; i < n; i++) {
        ctx.lineTo(-24 + w * (i + 0.5), i % 2 === 0 ? -9 : 9)
      }
      ctx.lineTo(24, 0)
      ctx.lineTo(E, 0)
      ctx.stroke()
      break
    }
    case 'capacitor': {
      ctx.moveTo(-E, 0); ctx.lineTo(-6, 0)
      ctx.moveTo(6, 0);  ctx.lineTo(E, 0)
      ctx.moveTo(-6, -14); ctx.lineTo(-6, 14)
      ctx.moveTo(6, -14);  ctx.lineTo(6, 14)
      ctx.stroke()
      break
    }
    case 'inductor': {
      ctx.moveTo(-E, 0); ctx.lineTo(-24, 0)
      for (const cx of [-16, 0, 16]) {
        ctx.arc(cx, 0, 8, Math.PI, 0, false)
      }
      ctx.moveTo(24, 0); ctx.lineTo(E, 0)
      ctx.stroke()
      break
    }
    case 'voltage_source': {
      ctx.moveTo(-E, 0); ctx.lineTo(-6, 0)
      ctx.moveTo(6, 0);  ctx.lineTo(E, 0)
      ctx.moveTo(-6, -14); ctx.lineTo(-6, 14)   // long plate = +
      ctx.moveTo(6, -7);   ctx.lineTo(6, 7)     // short plate = −
      ctx.moveTo(-20, -14); ctx.lineTo(-12, -14)
      ctx.moveTo(-16, -18); ctx.lineTo(-16, -10)
      ctx.stroke()
      break
    }
    case 'current_source': {
      ctx.moveTo(-E, 0); ctx.lineTo(-16, 0)
      ctx.moveTo(16, 0); ctx.lineTo(E, 0)
      ctx.moveTo(16, 0)
      ctx.arc(0, 0, 16, 0, Math.PI * 2)
      ctx.moveTo(8, 0); ctx.lineTo(-8, 0)
      ctx.moveTo(-8, 0); ctx.lineTo(-2, -5)
      ctx.moveTo(-8, 0); ctx.lineTo(-2, 5)
      ctx.stroke()
      break
    }
    case 'voltmeter':
    case 'ammeter': {
      ctx.moveTo(-E, 0); ctx.lineTo(-16, 0)
      ctx.moveTo(16, 0); ctx.lineTo(E, 0)
      ctx.moveTo(16, 0)
      ctx.arc(0, 0, 16, 0, Math.PI * 2)
      ctx.stroke()
      ctx.font = 'bold 14px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(comp.type === 'voltmeter' ? 'V' : 'A', 0, 1)
      ctx.textBaseline = 'alphabetic'
      break
    }
    case 'diode':
    case 'led': {
      ctx.moveTo(-E, 0); ctx.lineTo(-12, 0)
      ctx.moveTo(12, 0); ctx.lineTo(E, 0)
      ctx.moveTo(12, -11); ctx.lineTo(12, 11)   // cathode bar
      ctx.stroke()
      ctx.beginPath()                            // anode triangle (filled)
      ctx.moveTo(-12, -10); ctx.lineTo(-12, 10); ctx.lineTo(12, 0)
      ctx.closePath()
      ctx.fill()
      if (comp.type === 'led') {
        if (lit) {
          ctx.save()
          ctx.globalAlpha = 0.35
          ctx.fillStyle = '#ffd54a'
          ctx.beginPath()
          ctx.arc(0, 0, 26, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
        ctx.beginPath()
        ctx.moveTo(2, -12); ctx.lineTo(10, -20)
        ctx.moveTo(10, -20); ctx.lineTo(5, -19)
        ctx.moveTo(10, -20); ctx.lineTo(9, -15)
        ctx.moveTo(-6, -14); ctx.lineTo(2, -22)
        ctx.moveTo(2, -22); ctx.lineTo(-3, -21)
        ctx.moveTo(2, -22); ctx.lineTo(1, -17)
        ctx.stroke()
      }
      break
    }
    case 'switch': {
      ctx.moveTo(-E, 0); ctx.lineTo(-14, 0)
      ctx.moveTo(14, 0); ctx.lineTo(E, 0)
      ctx.moveTo(-14, 0)
      if (comp.closed) ctx.lineTo(14, 0)
      else ctx.lineTo(10, -16)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(-14, 0, 3, 0, Math.PI * 2)
      ctx.arc(14, 0, 3, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'ground': {
      ctx.moveTo(0, -GRID); ctx.lineTo(0, 2)
      ctx.moveTo(-12, 2); ctx.lineTo(12, 2)
      ctx.moveTo(-8, 8);  ctx.lineTo(8, 8)
      ctx.moveTo(-4, 14); ctx.lineTo(4, 14)
      ctx.stroke()
      break
    }
    case 'wire_node': {
      ctx.arc(0, 0, 4, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    default: {
      ctx.strokeRect(-16, -16, 32, 32)
    }
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CircuitCanvas({
  pendingType,
  onPlaced,
  canvasElRef
}: CircuitCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // mouse position in WORLD coordinates
  const mouseRef = useRef({ x: -10000, y: -10000, inside: false })
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const panRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)
  const wireStartRef = useRef<TerminalHit | null>(null)
  const viewRef = useRef({ ox: 0, oy: 0, scale: 1 })
  const pendingRef = useRef<ComponentType | null>(pendingType)
  pendingRef.current = pendingType

  // ── Coordinate transforms ──
  const screenToWorld = (sx: number, sy: number): { x: number; y: number } => {
    const v = viewRef.current
    return { x: (sx - v.ox) / v.scale, y: (sy - v.oy) / v.scale }
  }

  const canvasPoint = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
  }

  // ── Hit testing against current store state (world coords) ──
  const findTerminal = (x: number, y: number): TerminalHit | null => {
    const { components } = useCircuitStore.getState()
    for (let i = components.length - 1; i >= 0; i--) {
      const c = components[i]
      const def = ELEMENTS[c.type]
      for (let t = 0; t < def.terminals.length; t++) {
        const p = terminalPosition(c, t)
        if (Math.hypot(p.x - x, p.y - y) <= TERMINAL_HIT_RADIUS) {
          return { componentId: c.id, terminal: t, x: p.x, y: p.y }
        }
      }
    }
    return null
  }

  const findComponent = (x: number, y: number): CircuitComponent | null => {
    const { components } = useCircuitStore.getState()
    for (let i = components.length - 1; i >= 0; i--) {
      const c = components[i]
      const r = c.type === 'ground' || c.type === 'wire_node' ? GRID : COMPONENT_HIT_RADIUS
      if (Math.hypot(c.x - x, c.y - y) <= r) return c
    }
    return null
  }

  const findWire = (x: number, y: number): Wire | null => {
    const { components, wires } = useCircuitStore.getState()
    const byId = new Map(components.map((c) => [c.id, c]))
    for (const w of wires) {
      const from = byId.get(w.fromComponentId)
      const to = byId.get(w.toComponentId)
      if (!from || !to) continue
      const a = terminalPosition(from, w.fromTerminal)
      const b = terminalPosition(to, w.toTerminal)
      if (distToSegment(x, y, a.x, a.y, b.x, b.y) < 6) return w
    }
    return null
  }

  // ── Mouse interaction ──
  const handleMouseDown = (e: React.MouseEvent): void => {
    // middle button or Alt+left → pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      const rect = canvasRef.current!.getBoundingClientRect()
      panRef.current = {
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        ox: viewRef.current.ox,
        oy: viewRef.current.oy
      }
      e.preventDefault()
      return
    }
    if (e.button !== 0) return

    const { x, y } = canvasPoint(e)
    const store = useCircuitStore.getState()

    if (pendingRef.current) {
      const type = pendingRef.current
      const def = ELEMENTS[type]
      const comp: CircuitComponent = {
        id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
        type,
        x: snapToGrid(x),
        y: snapToGrid(y),
        rotation: 0,
        value: def.defaultValue ?? undefined,
        label: nextLabel(type, store.components),
        closed: type === 'switch' ? false : undefined
      }
      store.addComponent(comp)
      store.selectComponent(comp.id)
      onPlaced()
      return
    }

    const terminal = findTerminal(x, y)
    if (terminal) {
      wireStartRef.current = terminal
      return
    }

    const comp = findComponent(x, y)
    if (comp) {
      store.selectComponent(comp.id)
      dragRef.current = { id: comp.id, dx: comp.x - x, dy: comp.y - y }
      return
    }

    store.selectComponent(null)
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    const pan = panRef.current
    if (pan) {
      const rect = canvasRef.current!.getBoundingClientRect()
      viewRef.current.ox = pan.ox + (e.clientX - rect.left - pan.startX)
      viewRef.current.oy = pan.oy + (e.clientY - rect.top - pan.startY)
      return
    }

    const { x, y } = canvasPoint(e)
    mouseRef.current = { x, y, inside: true }

    const drag = dragRef.current
    if (drag) {
      useCircuitStore
        .getState()
        .updateComponent(drag.id, { x: snapToGrid(x + drag.dx), y: snapToGrid(y + drag.dy) })
    }
  }

  const handleMouseUp = (e: React.MouseEvent): void => {
    if (panRef.current) {
      panRef.current = null
      return
    }
    const { x, y } = canvasPoint(e)
    const start = wireStartRef.current
    if (start) {
      const end = findTerminal(x, y)
      if (end && !(end.componentId === start.componentId && end.terminal === start.terminal)) {
        useCircuitStore.getState().addWire({
          id: `w-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
          fromComponentId: start.componentId,
          fromTerminal: start.terminal,
          toComponentId: end.componentId,
          toTerminal: end.terminal
        })
      }
      wireStartRef.current = null
    }
    dragRef.current = null
  }

  const handleDoubleClick = (e: React.MouseEvent): void => {
    const { x, y } = canvasPoint(e)
    const comp = findComponent(x, y)
    if (comp?.type === 'switch') useCircuitStore.getState().toggleSwitch(comp.id)
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    const { x, y } = canvasPoint(e)
    const wire = findWire(x, y)
    if (wire) useCircuitStore.getState().removeWire(wire.id)
  }

  // ── Wheel zoom (native listener so preventDefault works) ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const v = viewRef.current
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * factor))
      // keep the world point under the cursor fixed
      const wx = (sx - v.ox) / v.scale
      const wy = (sy - v.oy) / v.scale
      v.scale = newScale
      v.ox = sx - wx * newScale
      v.oy = sy - wy * newScale
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const store = useCircuitStore.getState()
      const selected = store.selectedComponentId

      if (e.key === 'Escape') {
        wireStartRef.current = null
        onPlaced()
        store.selectComponent(null)
      } else if ((e.key === 'r' || e.key === 'R') && selected) {
        const comp = store.components.find((c) => c.id === selected)
        if (comp) store.updateComponent(selected, { rotation: (comp.rotation + 90) % 360 })
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        store.removeComponent(selected)
      } else if (e.key === '0') {
        viewRef.current = { ox: 0, oy: 0, scale: 1 } // reset view
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPlaced])

  // ── Render loop ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (canvasElRef) canvasElRef.current = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return // jsdom / test environment

    let raf = 0
    let disposed = false

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    resize()
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(canvas)

    const draw = (time: number): void => {
      if (disposed) return
      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      const view = viewRef.current

      const dark = useUIStore.getState().darkMode
      const { components, wires, simResult, selectedComponentId } =
        useCircuitStore.getState()
      const byId = new Map(components.map((c) => [c.id, c]))

      const bg = dark ? '#0F0F1A' : '#ffffff'
      const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
      const inkNeutral = dark ? '#cbd5e1' : '#334155'
      const labelColor = dark ? '#94a3b8' : '#64748b'
      const readoutColor = dark ? '#E8B500' : '#b45309'

      // clear in screen space
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // world transform
      ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.ox, dpr * view.oy)

      // visible world bounds
      const worldLeft = -view.ox / view.scale
      const worldTop = -view.oy / view.scale
      const worldRight = (w - view.ox) / view.scale
      const worldBottom = (h - view.oy) / view.scale

      // grid dots
      ctx.fillStyle = gridColor
      const startX = Math.floor(worldLeft / GRID) * GRID
      const startY = Math.floor(worldTop / GRID) * GRID
      for (let gx = startX; gx < worldRight; gx += GRID) {
        for (let gy = startY; gy < worldBottom; gy += GRID) {
          ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5)
        }
      }

      const solved = simResult?.solved === true
      const maxV = solved
        ? Math.max(1e-9, ...Object.values(simResult!.nodeVoltages).map(Math.abs))
        : 0
      const maxI = solved
        ? Math.max(1e-12, ...Object.values(simResult!.elementCurrents).map(Math.abs))
        : 0

      const nodeVoltageAt = (componentId: string, terminal: number): number | null => {
        if (!solved) return null
        const node = simResult!.terminalNodes[terminalKey(componentId, terminal)]
        const v = node !== undefined ? simResult!.nodeVoltages[node] : undefined
        return v ?? null
      }

      // ── wires ──
      for (const wire of wires) {
        const from = byId.get(wire.fromComponentId)
        const to = byId.get(wire.toComponentId)
        if (!from || !to) continue
        const a = terminalPosition(from, wire.fromTerminal)
        const b = terminalPosition(to, wire.toTerminal)

        const v = nodeVoltageAt(wire.fromComponentId, wire.fromTerminal)
        ctx.strokeStyle = v !== null ? voltageColor(v, maxV, inkNeutral) : inkNeutral
        ctx.lineWidth = 2.5
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()

        if (solved) {
          const i = wireCurrent(wire, simResult!)
          if (i !== null && Math.abs(i) > maxI * 1e-4 && Math.abs(i) > 1e-12) {
            const speed = 14 + 40 * Math.min(1, Math.abs(i) / maxI)
            const offset = ((time / 1000) * speed) % 12
            ctx.strokeStyle = dark ? 'rgba(232,181,0,0.9)' : 'rgba(202,138,4,0.9)'
            ctx.lineWidth = 2.5
            ctx.setLineDash([3, 9])
            ctx.lineDashOffset = i > 0 ? -offset : offset
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
            ctx.setLineDash([])
          }
        }
      }

      // rubber-band wire preview
      const wireStart = wireStartRef.current
      if (wireStart && mouseRef.current.inside) {
        ctx.strokeStyle = dark ? 'rgba(232,181,0,0.6)' : 'rgba(202,138,4,0.6)'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(wireStart.x, wireStart.y)
        ctx.lineTo(mouseRef.current.x, mouseRef.current.y)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // ── components ──
      for (const comp of components) {
        const lit =
          comp.type === 'led' &&
          solved &&
          (simResult!.elementCurrents[comp.id] ?? 0) > 1e-3

        ctx.save()
        ctx.translate(comp.x, comp.y)
        ctx.rotate((comp.rotation * Math.PI) / 180)
        drawSymbol(ctx, comp, inkNeutral, lit)
        ctx.restore()

        if (comp.id === selectedComponentId) {
          ctx.strokeStyle = '#E8B500'
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 3])
          const r = comp.type === 'ground' || comp.type === 'wire_node' ? 24 : 48
          ctx.strokeRect(comp.x - r, comp.y - r, r * 2, r * 2)
          ctx.setLineDash([])
        }

        // labels
        ctx.font = '11px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        if (comp.label && comp.type !== 'wire_node') {
          ctx.fillStyle = labelColor
          ctx.fillText(comp.label, comp.x, comp.y - 26)
        }
        const def = ELEMENTS[comp.type]
        if (comp.value !== undefined && def.defaultValue !== null) {
          ctx.fillStyle = labelColor
          ctx.fillText(formatValue(comp.value, def.unit), comp.x, comp.y + 34)
        }

        // live meter readouts
        if (solved && (comp.type === 'voltmeter' || comp.type === 'ammeter')) {
          let reading: string | null = null
          if (comp.type === 'voltmeter') {
            const v0 = nodeVoltageAt(comp.id, 0)
            const v1 = nodeVoltageAt(comp.id, 1)
            if (v0 !== null && v1 !== null) reading = formatValue(v0 - v1, 'V')
          } else {
            const i = simResult!.elementCurrents[comp.id]
            if (i !== undefined) reading = formatValue(Math.abs(i), 'A')
          }
          if (reading !== null) {
            ctx.font = 'bold 12px JetBrains Mono, monospace'
            ctx.fillStyle = readoutColor
            ctx.fillText(reading, comp.x, comp.y + 34)
          }
        }

        // terminals
        for (let t = 0; t < def.terminals.length; t++) {
          const p = terminalPosition(comp, t)
          const hovered =
            mouseRef.current.inside &&
            Math.hypot(p.x - mouseRef.current.x, p.y - mouseRef.current.y) <=
              TERMINAL_HIT_RADIUS
          const isWireOrigin =
            wireStart?.componentId === comp.id && wireStart.terminal === t
          ctx.beginPath()
          ctx.arc(p.x, p.y, hovered || isWireOrigin ? TERMINAL_RADIUS + 1.5 : TERMINAL_RADIUS, 0, Math.PI * 2)
          if (hovered || isWireOrigin) {
            ctx.fillStyle = '#E8B500'
            ctx.fill()
          } else {
            ctx.fillStyle = bg
            ctx.fill()
            ctx.strokeStyle = inkNeutral
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
        }
      }

      // ghost preview for pending placement
      if (pendingRef.current && mouseRef.current.inside) {
        const type = pendingRef.current
        ctx.save()
        ctx.globalAlpha = 0.45
        ctx.translate(snapToGrid(mouseRef.current.x), snapToGrid(mouseRef.current.y))
        drawSymbol(ctx, { id: 'ghost', type, x: 0, y: 0, rotation: 0 }, '#E8B500', false)
        ctx.restore()
      }

      // zoom indicator (screen space)
      if (Math.abs(view.scale - 1) > 0.01) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.font = '11px Inter, system-ui, sans-serif'
        ctx.fillStyle = labelColor
        ctx.textAlign = 'right'
        ctx.fillText(`${Math.round(view.scale * 100)}% (press 0 to reset)`, w - 10, h - 10)
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer?.disconnect()
      if (canvasElRef) canvasElRef.current = null
    }
  }, [canvasElRef])

  return (
    <canvas
      ref={canvasRef}
      data-testid="circuit-canvas"
      className="w-full h-full block cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        mouseRef.current.inside = false
        dragRef.current = null
        panRef.current = null
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    />
  )
}
