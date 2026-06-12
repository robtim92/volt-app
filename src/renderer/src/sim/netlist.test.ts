import { describe, it, expect } from 'vitest'
import { buildNetlist, terminalKey } from './netlist'
import { solveDC, GROUND, LED_PARAMS } from './solver'
import type { CircuitComponent, Wire } from './elements'

// ── Helpers ──────────────────────────────────────────────────────────────────

let nextId = 0
const comp = (
  type: CircuitComponent['type'],
  extra: Partial<CircuitComponent> = {}
): CircuitComponent => ({
  id: `c${++nextId}`,
  type,
  x: 0,
  y: 0,
  rotation: 0,
  ...extra
})

const wire = (
  from: CircuitComponent,
  fromTerminal: number,
  to: CircuitComponent,
  toTerminal: number
): Wire => ({
  id: `w${++nextId}`,
  fromComponentId: from.id,
  fromTerminal,
  toComponentId: to.id,
  toTerminal
})

describe('buildNetlist — node identification', () => {
  it('merges wired terminals into shared nodes and names ground', () => {
    const v = comp('voltage_source', { value: 10, label: 'V1' })
    const r = comp('resistor', { value: 1000, label: 'R1' })
    const g = comp('ground')
    const wires = [wire(v, 0, r, 0), wire(r, 1, v, 1), wire(v, 1, g, 0)]

    const { netlist, terminalNodes, warnings } = buildNetlist([v, r, g], wires)
    expect(warnings).toEqual([])
    expect(netlist.elements).toHaveLength(2)

    // v- , r1 and ground share the 'gnd' node
    expect(terminalNodes[terminalKey(v.id, 1)]).toBe(GROUND)
    expect(terminalNodes[terminalKey(r.id, 1)]).toBe(GROUND)
    expect(terminalNodes[terminalKey(g.id, 0)]).toBe(GROUND)
    // v+ and r0 share a non-ground node
    expect(terminalNodes[terminalKey(v.id, 0)]).toBe(terminalNodes[terminalKey(r.id, 0)])
    expect(terminalNodes[terminalKey(v.id, 0)]).not.toBe(GROUND)
  })

  it('routes connections through wire_node junctions', () => {
    const v = comp('voltage_source', { value: 5 })
    const r1 = comp('resistor', { value: 1000 })
    const r2 = comp('resistor', { value: 1000 })
    const j = comp('wire_node')
    const g = comp('ground')
    // v+ → junction → both resistors (parallel); other ends → v- → ground
    const wires = [
      wire(v, 0, j, 0),
      wire(j, 0, r1, 0),
      wire(j, 0, r2, 0),
      wire(r1, 1, v, 1),
      wire(r2, 1, v, 1),
      wire(v, 1, g, 0)
    ]
    const { netlist, warnings } = buildNetlist([v, r1, r2, j, g], wires)
    expect(warnings).toEqual([])
    const result = solveDC(netlist)
    expect(result.solved).toBe(true)
    // Parallel 1k ∥ 1k = 500 Ω → 10 mA total from the source
    expect(result.elementCurrents[v.id]).toBeCloseTo(-0.01, 9)
  })
})

describe('buildNetlist — end-to-end with solver', () => {
  it('solves a voltage divider built from canvas parts', () => {
    const v = comp('voltage_source', { value: 10 })
    const r1 = comp('resistor', { value: 1000 })
    const r2 = comp('resistor', { value: 2000 })
    const g = comp('ground')
    const wires = [
      wire(v, 0, r1, 0),
      wire(r1, 1, r2, 0),
      wire(r2, 1, v, 1),
      wire(v, 1, g, 0)
    ]
    const { netlist, terminalNodes } = buildNetlist([v, r1, r2, g], wires)
    const result = solveDC(netlist)
    expect(result.solved).toBe(true)
    const midNode = terminalNodes[terminalKey(r1.id, 1)]
    expect(result.nodeVoltages[midNode]).toBeCloseTo(6.6667, 3)
  })

  it('LED components map to diodes with LED params', () => {
    const v = comp('voltage_source', { value: 5 })
    const r = comp('resistor', { value: 220 })
    const led = comp('led')
    const g = comp('ground')
    const wires = [
      wire(v, 0, r, 0),
      wire(r, 1, led, 0),
      wire(led, 1, v, 1),
      wire(v, 1, g, 0)
    ]
    const { netlist } = buildNetlist([v, r, led, g], wires)
    const el = netlist.elements.find((e) => e.id === led.id)
    expect(el?.type).toBe('diode')
    expect(el?.params).toEqual(LED_PARAMS)

    const result = solveDC(netlist)
    expect(result.solved).toBe(true)
    expect(result.elementCurrents[led.id]).toBeGreaterThan(0.01)
  })
})

describe('buildNetlist — switches and reactive components', () => {
  const makeSwitchCircuit = (closed: boolean) => {
    const v = comp('voltage_source', { value: 5 })
    const s = comp('switch', { closed })
    const r = comp('resistor', { value: 1000 })
    const g = comp('ground')
    const wires = [
      wire(v, 0, s, 0),
      wire(s, 1, r, 0),
      wire(r, 1, v, 1),
      wire(v, 1, g, 0)
    ]
    return buildNetlist([v, s, r, g], wires)
  }

  it('open switch stops the current', () => {
    const { netlist } = makeSwitchCircuit(false)
    // Switch contributes no element → no complete loop → zero current everywhere
    const result = solveDC(netlist)
    expect(result.solved).toBe(true)
    const r = netlist.elements.find((e) => e.value === 1000)!
    expect(Math.abs(result.elementCurrents[r.id])).toBeLessThan(1e-12)
  })

  it('closed switch conducts', () => {
    const { netlist } = makeSwitchCircuit(true)
    const result = solveDC(netlist)
    expect(result.solved).toBe(true)
    expect(result.elementCurrents[netlist.elements.find((e) => e.value === 1000)!.id])
      .toBeCloseTo(0.005, 4)
  })

  it('inductor conducts DC; capacitor blocks it', () => {
    const v = comp('voltage_source', { value: 5 })
    const l = comp('inductor', { value: 1e-3 })
    const r = comp('resistor', { value: 1000 })
    const c = comp('capacitor', { value: 1e-6 })
    const g = comp('ground')
    // V — L — R — gnd loop, plus a capacitor in parallel with R
    const wires = [
      wire(v, 0, l, 0),
      wire(l, 1, r, 0),
      wire(r, 1, v, 1),
      wire(v, 1, g, 0),
      wire(c, 0, r, 0),
      wire(c, 1, r, 1)
    ]
    const { netlist } = buildNetlist([v, l, r, c, g], wires)
    // Capacitor produces no element
    expect(netlist.elements.find((e) => e.id === c.id)).toBeUndefined()
    const result = solveDC(netlist)
    expect(result.solved).toBe(true)
    // Inductor ≈ wire → essentially the full 5 mA flows
    expect(result.elementCurrents[r.id]).toBeCloseTo(0.005, 5)
  })
})

describe('buildNetlist — warnings', () => {
  it('warns about unconnected terminals and omits the element', () => {
    const v = comp('voltage_source', { value: 5, label: 'V1' })
    const r = comp('resistor', { value: 1000, label: 'R1' })
    const g = comp('ground')
    // R1 terminal 1 left dangling
    const wires = [wire(v, 0, r, 0), wire(v, 1, g, 0)]
    const { netlist, warnings } = buildNetlist([v, r, g], wires)
    expect(warnings.some((w) => w.includes('R1') && w.includes('unconnected'))).toBe(true)
    expect(netlist.elements.find((e) => e.id === r.id)).toBeUndefined()
  })

  it('warns about short-circuited voltage sources', () => {
    const v = comp('voltage_source', { value: 5, label: 'V1' })
    const g = comp('ground')
    const wires = [wire(v, 0, v, 1), wire(v, 1, g, 0)]
    const { warnings } = buildNetlist([v, g], wires)
    expect(warnings.some((w) => w.includes('V1') && w.includes('short'))).toBe(true)
  })

  it('warns about wires to missing components', () => {
    const r = comp('resistor', { value: 100 })
    const ghost: Wire = {
      id: 'w-ghost',
      fromComponentId: r.id,
      fromTerminal: 0,
      toComponentId: 'does-not-exist',
      toTerminal: 0
    }
    const { warnings } = buildNetlist([r], [ghost])
    expect(warnings.some((w) => w.includes('missing component'))).toBe(true)
  })

  it('warns that transistors are unsupported', () => {
    const q = comp('transistor_npn', { label: 'Q1' })
    const { warnings } = buildNetlist([q], [])
    expect(warnings.some((w) => w.includes('Q1') && w.includes('not supported'))).toBe(true)
  })
})
