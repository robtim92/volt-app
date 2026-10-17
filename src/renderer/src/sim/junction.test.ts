import { describe, it, expect } from 'vitest'
import { healJunctions, splitWire } from './junction'
import { pathLength, wirePath } from './wireRoute'
import { buildTransientNetlist } from './netlist'
import { TransientSimulator, suggestMaxStep } from './transient'
import type { CircuitComponent, Wire } from './elements'

const comps: CircuitComponent[] = [
  { id: 'V', type: 'voltage_source', x: 100, y: 200, rotation: 90, value: 10 },
  { id: 'R1', type: 'resistor', x: 400, y: 100, rotation: 0, value: 1000 },
  { id: 'R2', type: 'resistor', x: 400, y: 300, rotation: 0, value: 1000 },
  { id: 'G', type: 'ground', x: 100, y: 340, rotation: 0 }
]
const base: Wire[] = [
  { id: 'top', fromComponentId: 'V', fromTerminal: 0, toComponentId: 'R1', toTerminal: 0, points: [{ x: 100, y: 100 }] },
  { id: 'ret', fromComponentId: 'R1', fromTerminal: 1, toComponentId: 'V', toTerminal: 1 },
  { id: 'gnd', fromComponentId: 'V', fromTerminal: 1, toComponentId: 'G', toTerminal: 0 }
]

function solve(components: CircuitComponent[], wires: Wire[]) {
  const built = buildTransientNetlist(components, wires)
  const sim = new TransientSimulator(built.netlist)
  return { snap: sim.advance(0.01, suggestMaxStep(built.netlist), 100000), built }
}

describe('junctions', () => {
  it('splitting a wire keeps its route and total length', () => {
    const byId = new Map(comps.map((c) => [c.id, c]))
    const before = pathLength(wirePath(base[0], byId)!)
    const g = splitWire({ components: comps, wires: base }, 'top', 205, 103, 'J')!
    expect(g).not.toBeNull()
    const j = g.components.find((c) => c.id === 'J')!
    expect([j.x, j.y]).toEqual([200, 100])
    const byId2 = new Map(g.components.map((c) => [c.id, c]))
    const halves = g.wires.filter((w) => w.fromComponentId === 'J' || w.toComponentId === 'J')
    expect(halves).toHaveLength(2)
    const after = halves.reduce((s, w) => s + pathLength(wirePath(w, byId2)!), 0)
    expect(after).toBeCloseTo(before, 6)
  })

  it('a set length is shared between the two halves', () => {
    const wires = base.map((w) => (w.id === 'top' ? { ...w, length: 10, gauge: 14 } : w))
    const g = splitWire({ components: comps, wires }, 'top', 200, 100, 'J')!
    const halves = g.wires.filter((w) => w.fromComponentId === 'J' || w.toComponentId === 'J')
    expect(halves.reduce((s, w) => s + (w.length ?? 0), 0)).toBeCloseTo(10, 9)
    expect(halves.every((w) => w.gauge === 14)).toBe(true)
  })

  it("won't split on a wire's end", () => {
    expect(splitWire({ components: comps, wires: base }, 'top', 100, 160, 'J')).toBeNull()
  })

  it('a branch from a junction works like a plain parallel connection', () => {
    const g = splitWire({ components: comps, wires: base }, 'top', 200, 100, 'J')!
    const wires: Wire[] = [
      ...g.wires,
      { id: 'b1', fromComponentId: 'J', fromTerminal: 0, toComponentId: 'R2', toTerminal: 0 },
      { id: 'b2', fromComponentId: 'R2', fromTerminal: 1, toComponentId: 'V', toTerminal: 1 }
    ]
    const { snap } = solve(g.components, wires)
    expect(snap.elementCurrents.R1).toBeCloseTo(0.01, 4)
    expect(snap.elementCurrents.R2).toBeCloseTo(0.01, 4)
  })

  it('removing the branch merges the junction back into one wire', () => {
    const g = splitWire({ components: comps, wires: base }, 'top', 200, 100, 'J')!
    const healed = healJunctions(g, new Set(['J']))
    expect(healed.components.some((c) => c.id === 'J')).toBe(false)
    const top = healed.wires.filter((w) => w.fromComponentId === 'V' && w.toComponentId === 'R1')
    expect(top).toHaveLength(1)
    const byId = new Map(comps.map((c) => [c.id, c]))
    expect(pathLength(wirePath(top[0], byId)!)).toBeCloseTo(pathLength(wirePath(base[0], byId)!), 6)
    // and it still solves
    expect(solve(healed.components, healed.wires).snap.elementCurrents.R1).toBeCloseTo(0.01, 4)
  })

  it('leaves junctions with one wire or three or more alone; removes empty ones', () => {
    const lone: CircuitComponent = { id: 'J', type: 'wire_node', x: 600, y: 600, rotation: 0 }
    const g1 = healJunctions({ components: [...comps, lone], wires: base })
    expect(g1.components.some((c) => c.id === 'J')).toBe(false)
    const one: Wire = { id: 'x', fromComponentId: 'J', fromTerminal: 0, toComponentId: 'R2', toTerminal: 0 }
    const g2 = healJunctions({ components: [...comps, lone], wires: [...base, one] })
    expect(g2.components.some((c) => c.id === 'J')).toBe(true)
  })
})

describe('junctions in the editor store', () => {
  it('connectToWire adds a junction; deleting the branch heals it; undo brings it back', async () => {
    const { useCircuitStore } = await import('../stores/circuitStore')
    const st = useCircuitStore.getState()
    st.loadCircuitData(comps, base)
    const j = useCircuitStore.getState().connectToWire({ id: 'b1', fromComponentId: 'R2', fromTerminal: 0 }, 'top', 200, 100)
    expect(j).not.toBeNull()
    let s = useCircuitStore.getState()
    expect(s.components.some((c) => c.type === 'wire_node')).toBe(true)
    expect(s.wires).toHaveLength(base.length + 2)
    s.removeWire('b1')
    s = useCircuitStore.getState()
    expect(s.components.some((c) => c.type === 'wire_node')).toBe(false)
    expect(s.wires).toHaveLength(base.length)
    s.undo()
    expect(useCircuitStore.getState().wires).toHaveLength(base.length + 2)
  })

  it('deleting a junction that joins two wires merges them instead of cutting the circuit', async () => {
    const { useCircuitStore } = await import('../stores/circuitStore')
    const g = splitWire({ components: comps, wires: base }, 'top', 200, 100, 'J')!
    useCircuitStore.getState().loadCircuitData(g.components, g.wires)
    useCircuitStore.getState().removeComponents(['J'])
    const s = useCircuitStore.getState()
    expect(s.wires.filter((w) => w.fromComponentId === 'V' && w.toComponentId === 'R1')).toHaveLength(1)
  })
})
