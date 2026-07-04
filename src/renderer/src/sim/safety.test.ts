import { describe, it, expect } from 'vitest'
import { buildNetlist } from './netlist'
import { solveDC } from './solver'
import type { CircuitComponent, Wire } from './elements'

let nextId = 0
const comp = (
  type: CircuitComponent['type'],
  extra: Partial<CircuitComponent> = {}
): CircuitComponent => ({ id: `c${++nextId}`, type, x: 0, y: 0, rotation: 0, ...extra })
const wire = (
  from: CircuitComponent, ft: number, to: CircuitComponent, tt: number
): Wire => ({ id: `w${++nextId}`, fromComponentId: from.id, fromTerminal: ft, toComponentId: to.id, toTerminal: tt })

/** V(12) — protective device — R(2) — gnd loop. */
function loopWith(device: CircuitComponent): {
  components: CircuitComponent[]
  wires: Wire[]
  device: CircuitComponent
} {
  const v = comp('voltage_source', { value: 12, label: 'V1' })
  const r = comp('resistor', { value: 2, label: 'R1' })
  const g = comp('ground')
  const wires = [wire(v, 0, device, 0), wire(device, 1, r, 0), wire(r, 1, g, 0), wire(v, 1, g, 0)]
  return { components: [v, device, r, g], wires, device }
}

describe('breaker / GFCI netlist behaviour', () => {
  it('conducts (short) when closed and is absent when open', () => {
    const { components, wires, device } = loopWith(comp('breaker', { value: 15, closed: true, label: 'CB1' }))
    const closed = buildNetlist(components, wires)
    expect(closed.netlist.elements.some((e) => e.id === device.id && e.type === 'resistor')).toBe(true)

    const openDev = { ...device, closed: false }
    const openComps = components.map((c) => (c.id === device.id ? openDev : c))
    const open = buildNetlist(openComps, wires)
    expect(open.netlist.elements.some((e) => e.id === device.id)).toBe(false)
  })

  it('a closed breaker passes the full loop current (so trip logic can compare it)', () => {
    const { components, wires, device } = loopWith(comp('breaker', { value: 3, closed: true, label: 'CB1' }))
    const { netlist } = buildNetlist(components, wires)
    const res = solveDC(netlist)
    expect(res.solved).toBe(true)
    expect(Math.abs(res.elementCurrents[device.id])).toBeCloseTo(6, 2) // 12 / 2
    expect(Math.abs(res.elementCurrents[device.id])).toBeGreaterThan(3) // over its 3 A rating → would trip
  })

  it('GFCI conducts like a breaker (leakage-trip approximation)', () => {
    const { components, wires, device } = loopWith(comp('gfci', { value: 0.005, closed: true, label: 'GF1' }))
    const { netlist } = buildNetlist(components, wires)
    expect(netlist.elements.some((e) => e.id === device.id && e.type === 'resistor')).toBe(true)
  })
})
