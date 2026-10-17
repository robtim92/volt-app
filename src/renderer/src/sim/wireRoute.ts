/**
 * Volt — wire routing
 *
 * A wire runs terminal → corners → terminal along grid-aligned (orthogonal)
 * segments. Wires the user hasn't shaped get an automatic route (an L or a Z,
 * leaving each terminal in the direction it faces). Shaped wires store their
 * corners in `wire.points`; if a part moves, only the segments touching it
 * re-bend to stay orthogonal.
 *
 * The same path drives the schematic, hit-testing, the 3D jumpers and the
 * wire's physical length (so a wire that goes the long way round has more
 * resistance).
 */
import { ELEMENTS, GRID, rotatePoint, snapToGrid, terminalPosition, type CircuitComponent, type Wire } from './elements'

export interface Pt {
  x: number
  y: number
}

export type WireStyle = 'square' | 'rounded'

const same = (a: Pt, b: Pt): boolean => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6
const isHoriz = (d: Pt | null): boolean => !!d && d.x !== 0
const isVert = (d: Pt | null): boolean => !!d && d.y !== 0

/** Unit direction a terminal faces (away from its part), or null if it sits on the part's centre. */
export function terminalDirection(comp: CircuitComponent, terminal: number): Pt | null {
  const t = ELEMENTS[comp.type]?.terminals[terminal]
  if (!t) return null
  const p = rotatePoint(t.x, t.y, comp.rotation)
  if (p.x === 0 && p.y === 0) return null
  return Math.abs(p.x) >= Math.abs(p.y) ? { x: Math.sign(p.x), y: 0 } : { x: 0, y: Math.sign(p.y) }
}

/** Things an automatic route should steer around. */
export interface Obstacles {
  /** part bodies (axis-aligned boxes) */
  boxes: { x0: number; y0: number; x1: number; y1: number }[]
  /** every terminal on the board */
  terminals: Pt[]
}

export function obstaclesFor(components: Iterable<CircuitComponent>): Obstacles {
  const boxes: Obstacles['boxes'] = []
  const terminals: Pt[] = []
  for (const c of components) {
    const def = ELEMENTS[c.type]
    if (!def) continue
    let minX = 0
    let maxX = 0
    let minY = 0
    let maxY = 0
    def.terminals.forEach((_, t) => {
      const p = terminalPosition(c, t)
      terminals.push(p)
      minX = Math.min(minX, p.x - c.x)
      maxX = Math.max(maxX, p.x - c.x)
      minY = Math.min(minY, p.y - c.y)
      maxY = Math.max(maxY, p.y - c.y)
    })
    // the body sits between the terminals, a little thinner than the leads are long
    const hx = Math.max(GRID * 0.7, (maxX - minX) / 2 - GRID * 0.6)
    const hy = Math.max(GRID * 0.7, (maxY - minY) / 2 - GRID * 0.6)
    const cx = c.x + (maxX + minX) / 2
    const cy = c.y + (maxY + minY) / 2
    boxes.push({ x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy })
  }
  return { boxes, terminals }
}

function segHitsBox(a: Pt, b: Pt, box: Obstacles['boxes'][number]): boolean {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y, b.y)
  return x1 > box.x0 && x0 < box.x1 && y1 > box.y0 && y0 < box.y1
}

function segHitsPoint(a: Pt, b: Pt, p: Pt): boolean {
  return distToSegment(p.x, p.y, a, b) < 1
}

/** Cost of a candidate route: length, plus heavy penalties for crossing parts or touching other terminals. */
function routeCost(path: Pt[], obstacles: Obstacles): number {
  let cost = pathLength(path) + (path.length - 2) * 4
  const ends = [path[0], path[path.length - 1]]
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const box of obstacles.boxes) if (segHitsBox(a, b, box)) cost += 2000
    for (const t of obstacles.terminals) {
      if (ends.some((e) => same(e, t))) continue
      if (segHitsPoint(a, b, t)) cost += 1500
    }
  }
  return cost
}

/**
 * Corners for an automatic route from a to b (empty when a straight line
 * works). Each end leaves in the direction its terminal faces; among a few
 * L, Z and U shapes, the shortest one that doesn't cut through a part or
 * run over another terminal wins.
 */
export function autoCorners(
  a: Pt,
  b: Pt,
  da: Pt | null = null,
  db: Pt | null = null,
  obstacles: Obstacles = { boxes: [], terminals: [] }
): Pt[] {
  const p = da ? { x: a.x + da.x * GRID, y: a.y + da.y * GRID } : a
  const q = db ? { x: b.x + db.x * GRID, y: b.y + db.y * GRID } : b
  const mx = snapToGrid((p.x + q.x) / 2)
  const my = snapToGrid((p.y + q.y) / 2)
  const hiX = Math.max(p.x, q.x) + 2 * GRID
  const loX = Math.min(p.x, q.x) - 2 * GRID
  const hiY = Math.max(p.y, q.y) + 2 * GRID
  const loY = Math.min(p.y, q.y) - 2 * GRID
  const middles: Pt[][] = [
    [{ x: mx, y: p.y }, { x: mx, y: q.y }],
    [{ x: p.x, y: my }, { x: q.x, y: my }],
    [{ x: q.x, y: p.y }],
    [{ x: p.x, y: q.y }],
    [{ x: p.x, y: hiY }, { x: q.x, y: hiY }],
    [{ x: p.x, y: loY }, { x: q.x, y: loY }],
    [{ x: hiX, y: p.y }, { x: hiX, y: q.y }],
    [{ x: loX, y: p.y }, { x: loX, y: q.y }]
  ]
  const candidates: Pt[][] = []
  // a plain straight wire when the terminals already line up
  if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) candidates.push([a, b])
  for (const m of middles) candidates.push(simplify([a, p, ...m, q, b]))
  let best = candidates[0]
  let bestCost = Infinity
  for (const c of candidates) {
    const ortho = c.every((pt, i) => i === 0 || Math.abs(pt.x - c[i - 1].x) < 1e-6 || Math.abs(pt.y - c[i - 1].y) < 1e-6)
    if (!ortho) continue
    const cost = routeCost(c, obstacles)
    if (cost < bestCost - 1e-6) {
      best = c
      bestCost = cost
    }
  }
  return best.slice(1, -1)
}

/**
 * Make every segment horizontal or vertical by inserting an elbow where two
 * consecutive points aren't aligned. The elbow keeps going the way the
 * previous segment went (or the way the first terminal faces).
 */
export function orthogonalize(pts: Pt[], startDir: Pt | null = null): Pt[] {
  if (pts.length === 0) return []
  const out: Pt[] = [pts[0]]
  let dir: 'h' | 'v' | null = isHoriz(startDir) ? 'h' : isVert(startDir) ? 'v' : null
  for (let i = 1; i < pts.length; i++) {
    const p = out[out.length - 1]
    const q = pts[i]
    if (same(p, q)) continue
    if (Math.abs(p.x - q.x) > 1e-6 && Math.abs(p.y - q.y) > 1e-6) {
      const elbow = dir === 'v' ? { x: p.x, y: q.y } : { x: q.x, y: p.y }
      out.push(elbow)
      dir = dir === 'v' ? 'h' : 'v'
    } else {
      dir = Math.abs(p.y - q.y) < 1e-6 ? 'h' : 'v'
    }
    out.push(q)
  }
  return out
}

/** Drop repeated points and corners that sit in the middle of a straight run. */
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    if (out.length && same(out[out.length - 1], p)) continue
    out.push(p)
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const a = out[i - 1]
    const b = out[i]
    const c = out[i + 1]
    const collinear = (Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - c.x) < 1e-6) || (Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.y - c.y) < 1e-6)
    if (collinear) out.splice(i, 1)
  }
  return out
}

/** The full path of a wire in canvas coordinates: [from terminal, …corners, to terminal]. */
export function wirePath(wire: Wire, byId: Map<string, CircuitComponent>): Pt[] | null {
  const from = byId.get(wire.fromComponentId)
  const to = byId.get(wire.toComponentId)
  if (!from || !to) return null
  const a = terminalPosition(from, wire.fromTerminal)
  const b = terminalPosition(to, wire.toTerminal)
  const da = terminalDirection(from, wire.fromTerminal)
  if (wire.points && wire.points.length > 0) return orthogonalize([a, ...wire.points, b], da)
  const db = terminalDirection(to, wire.toTerminal)
  return [a, ...autoCorners(a, b, da, db, obstaclesFor(byId.values())), b]
}

export function pathLength(pts: Pt[]): number {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return L
}

/** Point a fraction of the way along a path (by length). */
export function pointAlong(pts: Pt[], frac: number): Pt {
  const total = pathLength(pts)
  let left = Math.max(0, Math.min(1, frac)) * total
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    if (left <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.min(1, left / seg) : 0
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }
    }
    left -= seg
  }
  return pts[0]
}

export function distToSegment(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2))
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy))
}

/** Nearest segment of a path to a point. */
export function nearestSegment(pts: Pt[], x: number, y: number): { index: number; dist: number } {
  let best = { index: -1, dist: Infinity }
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(x, y, pts[i], pts[i + 1])
    if (d < best.dist) best = { index: i, dist: d }
  }
  return best
}

/**
 * Slide one segment of a path sideways (perpendicular to itself) to `to`.
 * Segments touching a terminal grow a short stub so the wire stays attached.
 * Returns the new interior corners for `wire.points`.
 */
export function dragSegment(path: Pt[], index: number, to: Pt): Pt[] {
  const p = path.map((q) => ({ ...q }))
  let s = index
  if (s === 0) {
    p.splice(1, 0, { ...p[0] })
    s = 1
  }
  if (s === p.length - 2) p.splice(p.length - 1, 0, { ...p[p.length - 1] })
  const a = p[s]
  const b = p[s + 1]
  const horizontal = Math.abs(a.y - b.y) <= Math.abs(a.x - b.x)
  if (horizontal) {
    a.y = to.y
    b.y = to.y
  } else {
    a.x = to.x
    b.x = to.x
  }
  return simplify(p).slice(1, -1)
}

/** Move one corner (an index into the path's interior) to `to`. */
export function dragCorner(path: Pt[], corner: number, to: Pt): Pt[] {
  const interior = path.slice(1, -1).map((q) => ({ ...q }))
  if (corner < 0 || corner >= interior.length) return interior
  interior[corner] = { ...to }
  return interior
}

/** Insert a corner on segment `index` at `at` (snapped onto that segment). */
export function insertCorner(path: Pt[], index: number, at: Pt): Pt[] {
  const a = path[index]
  const b = path[index + 1]
  const horizontal = Math.abs(a.y - b.y) <= Math.abs(a.x - b.x)
  const q = horizontal ? { x: at.x, y: a.y } : { x: a.x, y: at.y }
  const interior = path.slice(1, -1).map((p) => ({ ...p }))
  interior.splice(index, 0, q)
  return interior
}

/** Remove a corner; returns undefined when nothing is left (back to an automatic route). */
export function removeCorner(path: Pt[], corner: number): Pt[] | undefined {
  const interior = path.slice(1, -1).map((p) => ({ ...p }))
  interior.splice(corner, 1)
  return interior.length ? interior : undefined
}

/** Trace a path on a 2D canvas, rounding corners when asked. */
export function tracePath(ctx: CanvasRenderingContext2D, pts: Pt[], style: WireStyle, radius = 10): void {
  ctx.beginPath()
  if (pts.length === 0) return
  ctx.moveTo(pts[0].x, pts[0].y)
  if (style === 'rounded') {
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1]
      const p = pts[i]
      const next = pts[i + 1]
      const r = Math.min(radius, Math.hypot(p.x - prev.x, p.y - prev.y) / 2, Math.hypot(next.x - p.x, next.y - p.y) / 2)
      if (r < 0.5) ctx.lineTo(p.x, p.y)
      else ctx.arcTo(p.x, p.y, next.x, next.y, r)
    }
  } else {
    for (let i = 1; i < pts.length - 1; i++) ctx.lineTo(pts[i].x, pts[i].y)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last.x, last.y)
}
