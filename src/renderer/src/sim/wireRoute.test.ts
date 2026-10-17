import { describe, it, expect } from 'vitest'
import { autoCorners, distToSegment, dragCorner, obstaclesFor, dragSegment, insertCorner, orthogonalize, pathLength, removeCorner, simplify, wirePath } from './wireRoute'
import { wireLength, buildTransientNetlist } from './netlist'
import { GRID, type CircuitComponent, type Wire } from './elements'
import { METRES_PER_PIXEL } from './wire'
import { EXAMPLES } from '../examples/examples'

const orthogonal = (pts: { x: number; y: number }[]): boolean =>
  pts.every((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) < 1e-6 || Math.abs(p.y - pts[i - 1].y) < 1e-6)

const R = (id: string, x: number, y: number, rotation = 0): CircuitComponent => ({ id, type: 'resistor', x, y, rotation, value: 100 })
const wire = (extra: Partial<Wire> = {}): Wire => ({ id: 'w', fromComponentId: 'A', fromTerminal: 1, toComponentId: 'B', toTerminal: 0, ...extra })

describe('wire routing', () => {
  it('auto-routes with a Z between facing terminals, and straight when they line up', () => {
    expect(autoCorners({ x: 0, y: 0 }, { x: 100, y: 60 }, { x: 1, y: 0 }, { x: -1, y: 0 })).toEqual([
      { x: 60, y: 0 },
      { x: 60, y: 60 }
    ])
    expect(autoCorners({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 })).toEqual([])
  })

  it('auto-routes around parts instead of through them or over their terminals', () => {
    // LED return to the supply's (−) used to run back over the top wire and the ammeter
    for (const ex of EXAMPLES) {
      const byId = new Map(ex.circuit.components.map((c) => [c.id, c]))
      const obstacles = obstaclesFor(ex.circuit.components)
      for (const w of ex.circuit.wires) {
        const path = wirePath(w, byId)!
        const ends = [path[0], path[path.length - 1]]
        for (let i = 0; i < path.length - 1; i++) {
          for (const t of obstacles.terminals) {
            if (ends.some((e) => e.x === t.x && e.y === t.y)) continue
            expect(distToSegment(t.x, t.y, path[i], path[i + 1]), `${ex.id} ${w.id} runs over a terminal`).toBeGreaterThan(0.5)
          }
        }
      }
    }
  })

  it('every example wire is drawn with only horizontal and vertical runs', () => {
    for (const ex of EXAMPLES) {
      const byId = new Map(ex.circuit.components.map((c) => [c.id, c]))
      for (const w of ex.circuit.wires) expect(orthogonal(wirePath(w, byId)!), `${ex.id} ${w.id}`).toBe(true)
    }
  })

  it('orthogonalize adds an elbow between misaligned points', () => {
    const p = orthogonalize([{ x: 0, y: 0 }, { x: 40, y: 40 }], { x: 1, y: 0 })
    expect(p).toEqual([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }])
    expect(simplify([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }])).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 20 }
    ])
  })

  it('length follows the route, so bends add resistance', () => {
    const comps = [R('A', 0, 0), R('B', 200, 100)]
    const byId = new Map(comps.map((c) => [c.id, c]))
    // A:1 at (40,0), B:0 at (160,100): Z route = 120 across + 100 down
    expect(pathLength(wirePath(wire(), byId)!)).toBeCloseTo(220, 6)
    expect(wireLength(wire(), byId)).toBeCloseTo(220 * METRES_PER_PIXEL, 9)
    // a detour through a hand-placed corner is longer still
    const detour = wire({ points: [{ x: 40, y: 200 }] })
    expect(wireLength(detour, byId)).toBeGreaterThan(wireLength(wire(), byId))
    const built = buildTransientNetlist(comps, [detour])
    const el = built.netlist.elements.find((e) => e.id === 'w')!
    expect(el.value).toBeGreaterThan(buildTransientNetlist(comps, [wire()]).netlist.elements.find((e) => e.id === 'w')!.value)
  })

  it('hand-placed corners survive a part moving; only the touching run re-bends', () => {
    const w = wire({ points: [{ x: 100, y: 0 }, { x: 100, y: 200 }] })
    const before = wirePath(w, new Map([R('A', 0, 0), R('B', 300, 200)].map((c) => [c.id, c])))!
    const after = wirePath(w, new Map([R('A', 0, 0), R('B', 300, 260)].map((c) => [c.id, c])))!
    expect(after.slice(0, 3)).toEqual(before.slice(0, 3))
    expect(orthogonal(after)).toBe(true)
    expect(after[after.length - 1]).toEqual({ x: 260, y: 260 })
  })

  it('dragging an end segment keeps the wire attached to its terminal', () => {
    const path = [{ x: 40, y: 0 }, { x: 160, y: 0 }]
    const inner = dragSegment(path, 0, { x: 100, y: 3 * GRID })
    const full = orthogonalize([path[0], ...inner, path[1]])
    expect(full[0]).toEqual(path[0])
    expect(full[full.length - 1]).toEqual(path[1])
    expect(orthogonal(full)).toBe(true)
    expect(full.some((p) => p.y === 3 * GRID)).toBe(true)
  })

  it('corners can be added, moved and removed', () => {
    const path = [{ x: 0, y: 0 }, { x: 200, y: 0 }]
    const one = insertCorner(path, 0, { x: 100, y: 7 })
    expect(one).toEqual([{ x: 100, y: 0 }])
    const moved = dragCorner([path[0], ...one, path[1]], 0, { x: 100, y: 80 })
    expect(moved).toEqual([{ x: 100, y: 80 }])
    expect(removeCorner([path[0], ...moved, path[1]], 0)).toBeUndefined()
  })

  it('circuits saved before routing (no points) still load and solve', () => {
    const comps: CircuitComponent[] = [
      { id: 'V', type: 'voltage_source', x: 0, y: 100, rotation: 90, value: 9 },
      R('A', 200, 0),
      { id: 'G', type: 'ground', x: 0, y: 220, rotation: 0 }
    ]
    const wires: Wire[] = [
      { id: 'w1', fromComponentId: 'V', fromTerminal: 0, toComponentId: 'A', toTerminal: 0 },
      { id: 'w2', fromComponentId: 'A', fromTerminal: 1, toComponentId: 'V', toTerminal: 1 },
      { id: 'w3', fromComponentId: 'V', fromTerminal: 1, toComponentId: 'G', toTerminal: 0 }
    ]
    expect(buildTransientNetlist(comps, wires).warnings).toEqual([])
  })
})
