/**
 * Volt — junctions
 *
 * Tapping into the middle of a wire splits it at a junction (a `wire_node`
 * part with one terminal). Removing a branch heals the junction: when only two
 * wires meet there, they merge back into one. All functions are pure.
 */
import { snapToGrid, type CircuitComponent, type Wire } from './elements'
import { nearestSegment, pathLength, simplify, wirePath, type Pt } from './wireRoute'

export interface Graph {
  components: CircuitComponent[]
  wires: Wire[]
}

const touches = (w: Wire, id: string): boolean => w.fromComponentId === id || w.toComponentId === id

/** Where on a wire a junction would go: the grid point nearest (x, y) on its path. */
export function junctionPoint(path: Pt[], x: number, y: number): { point: Pt; segment: number } | null {
  const { index } = nearestSegment(path, x, y)
  if (index < 0) return null
  const a = path[index]
  const b = path[index + 1]
  const horizontal = Math.abs(a.y - b.y) < 1e-6
  const clamp = (v: number, lo: number, hi: number): number => Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), v))
  const point = horizontal ? { x: clamp(snapToGrid(x), a.x, b.x), y: a.y } : { x: a.x, y: clamp(snapToGrid(y), a.y, b.y) }
  return { point, segment: index }
}

/**
 * Split `wireId` at the point on it nearest (x, y). Returns the new graph and
 * the junction's id, or null if the point would land on one of its ends.
 */
export function splitWire(g: Graph, wireId: string, x: number, y: number, junctionId: string, label = 'J'): (Graph & { junctionId: string }) | null {
  const wire = g.wires.find((w) => w.id === wireId)
  if (!wire) return null
  const byId = new Map(g.components.map((c) => [c.id, c]))
  const path = wirePath(wire, byId)
  if (!path) return null
  const hit = junctionPoint(path, x, y)
  if (!hit) return null
  const { point, segment } = hit
  const ends = [path[0], path[path.length - 1]]
  if (ends.some((e) => Math.hypot(e.x - point.x, e.y - point.y) < 1e-6)) return null

  const firstHalf = simplify([...path.slice(0, segment + 1), point])
  const secondHalf = simplify([point, ...path.slice(segment + 1)])
  const inner = (p: Pt[]): Pt[] | undefined => (p.length > 2 ? p.slice(1, -1).map((q) => ({ ...q })) : undefined)
  // a wire with a set length shares it in proportion to the drawn path
  const total = pathLength(path)
  const share = total > 0 ? pathLength(firstHalf) / total : 0.5

  const junction: CircuitComponent = { id: junctionId, type: 'wire_node', x: point.x, y: point.y, rotation: 0, label }
  const { id: _id, fromComponentId, fromTerminal, toComponentId, toTerminal, points: _p, length, ...props } = wire
  const w1: Wire = {
    ...props,
    id: wire.id,
    fromComponentId,
    fromTerminal,
    toComponentId: junctionId,
    toTerminal: 0,
    points: inner(firstHalf),
    length: length !== undefined ? length * share : undefined
  }
  const w2: Wire = {
    ...props,
    id: `${wire.id}~${junctionId}`,
    fromComponentId: junctionId,
    fromTerminal: 0,
    toComponentId,
    toTerminal,
    points: inner(secondHalf),
    length: length !== undefined ? length * (1 - share) : undefined
  }
  for (const w of [w1, w2]) {
    if (w.points === undefined) delete w.points
    if (w.length === undefined) delete w.length
  }
  return {
    components: [...g.components, junction],
    wires: g.wires.flatMap((w) => (w.id === wire.id ? [w1, w2] : [w])),
    junctionId
  }
}

/**
 * Tidy junctions after an edit: a junction joining exactly two wires merges
 * them back into one; a junction with no wires left is removed. Junctions
 * with one wire (a branch being built) or three or more are left alone.
 */
export function healJunctions(g: Graph, only?: Set<string>): Graph {
  let { components, wires } = g
  for (const j of g.components) {
    if (j.type !== 'wire_node' || (only && !only.has(j.id))) continue
    const attached = wires.filter((w) => touches(w, j.id))
    if (attached.length === 0) {
      components = components.filter((c) => c.id !== j.id)
      continue
    }
    if (attached.length !== 2) continue
    const [a, b] = attached
    // orient both so the path runs  a.far → junction → b.far
    const farA = a.toComponentId === j.id ? { id: a.fromComponentId, t: a.fromTerminal } : { id: a.toComponentId, t: a.toTerminal }
    const farB = b.fromComponentId === j.id ? { id: b.toComponentId, t: b.toTerminal } : { id: b.fromComponentId, t: b.fromTerminal }
    if (farA.id === j.id || farB.id === j.id) continue
    const byId = new Map(components.map((c) => [c.id, c]))
    const pa = wirePath(a, byId)
    const pb = wirePath(b, byId)
    if (!pa || !pb) continue
    const pathA = a.toComponentId === j.id ? pa : [...pa].reverse()
    const pathB = b.fromComponentId === j.id ? pb : [...pb].reverse()
    const merged = simplify([...pathA, ...pathB.slice(1)])
    const lengths = [a.length, b.length]
    const { id: _id, fromComponentId: _f, fromTerminal: _ft, toComponentId: _t, toTerminal: _tt, points: _p, length: _l, ...props } = a
    const w: Wire = {
      ...props,
      id: a.id,
      fromComponentId: farA.id,
      fromTerminal: farA.t,
      toComponentId: farB.id,
      toTerminal: farB.t
    }
    // a corner where the junction sat is kept so the wire doesn't move
    if (merged.length > 2) w.points = merged.slice(1, -1).map((q) => ({ ...q }))
    if (lengths.every((l) => l !== undefined)) w.length = (lengths[0] as number) + (lengths[1] as number)
    if (a.damaged || b.damaged) w.damaged = true
    else delete w.damaged
    // never create a duplicate or a self-loop by merging
    const dup = wires.some(
      (o) =>
        o.id !== a.id &&
        o.id !== b.id &&
        ((o.fromComponentId === w.fromComponentId && o.fromTerminal === w.fromTerminal && o.toComponentId === w.toComponentId && o.toTerminal === w.toTerminal) ||
          (o.fromComponentId === w.toComponentId && o.fromTerminal === w.toTerminal && o.toComponentId === w.fromComponentId && o.toTerminal === w.fromTerminal))
    )
    if (dup || (w.fromComponentId === w.toComponentId && w.fromTerminal === w.toTerminal)) continue
    wires = wires.filter((o) => o.id !== a.id && o.id !== b.id).concat(w)
    components = components.filter((c) => c.id !== j.id)
  }
  return { components, wires }
}
