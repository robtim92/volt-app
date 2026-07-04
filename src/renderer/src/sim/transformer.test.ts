import { describe, it, expect } from 'vitest'
import { solveAC, type ACNetlist } from './acSolver'
import { buildACNetlist, buildNetlist, terminalKey } from './netlist'
import { abs } from './complex'
import type { CircuitComponent, Wire } from './elements'

// ── Solver-level (direct ACNetlist) ──────────────────────────────────────────

function transformerCircuit(ratio: number): ACNetlist {
  return {
    elements: [
      { id: 'V', type: 'ac_voltage_source', value: 0, amplitude: 10, phaseDeg: 0, nodes: ['a', 'gnd'] },
      { id: 'T', type: 'transformer', value: 0, ratio, nodes: ['a', 'gnd'], secondaryNodes: ['b', 'gnd'] },
      { id: 'R', type: 'resistor', value: 100, nodes: ['b', 'gnd'] }
    ]
  }
}

describe('ideal transformer — solver', () => {
  it('steps voltage down by the turns ratio (2:1 → half)', () => {
    const r = solveAC(transformerCircuit(2), 1000)
    expect(r.solved).toBe(true)
    expect(abs(r.nodeVoltages['a'])).toBeCloseTo(10, 6) // primary
    expect(abs(r.nodeVoltages['b'])).toBeCloseTo(5, 4) // secondary = 10 / 2
  })

  it('steps voltage up when the ratio is < 1 (0.5 → double)', () => {
    const r = solveAC(transformerCircuit(0.5), 1000)
    expect(abs(r.nodeVoltages['b'])).toBeCloseTo(20, 4) // 10 / 0.5
  })

  it('conserves apparent power (ideal, lossless)', () => {
    const r = solveAC(transformerCircuit(2), 1000)
    const vp = abs(r.nodeVoltages['a'])
    const vs = abs(r.nodeVoltages['b'])
    const ip = abs(r.elementCurrents['T']) // primary current
    const is = vs / 100 // secondary load current
    expect(ip).toBeCloseTo(is / 2, 6) // ampere-turns: Ip = Is / n
    expect(vp * ip).toBeCloseTo(vs * is, 6) // Sp = Ss
  })
})

// ── Netlist round-trip (canvas graph) ────────────────────────────────────────

let nextId = 0
const comp = (
  type: CircuitComponent['type'],
  extra: Partial<CircuitComponent> = {}
): CircuitComponent => ({ id: `c${++nextId}`, type, x: 0, y: 0, rotation: 0, ...extra })
const wire = (
  from: CircuitComponent, ft: number, to: CircuitComponent, tt: number
): Wire => ({ id: `w${++nextId}`, fromComponentId: from.id, fromTerminal: ft, toComponentId: to.id, toTerminal: tt })

describe('transformer — netlist builders', () => {
  it('round-trips a 2:1 step-down through buildACNetlist + solveAC', () => {
    const v = comp('ac_voltage_source', { value: 10, label: 'Vac1' })
    const t = comp('transformer', { value: 2, label: 'T1' })
    const r = comp('resistor', { value: 100, label: 'R1' })
    const g = comp('ground')
    const wires = [
      wire(v, 0, t, 0),   // Vac+ → P+
      wire(v, 1, g, 0),   // Vac− → gnd
      wire(t, 1, g, 0),   // P−   → gnd
      wire(t, 2, r, 0),   // S+   → R
      wire(r, 1, g, 0),   // R    → gnd
      wire(t, 3, g, 0)    // S−   → gnd
    ]
    const { netlist, terminalNodes, warnings } = buildACNetlist([v, t, r, g], wires)
    expect(warnings).toEqual([])
    const tf = netlist.elements.find((e) => e.id === t.id)
    expect(tf?.type).toBe('transformer')
    expect(tf?.ratio).toBe(2)

    const res = solveAC(netlist, 1000)
    const secondaryNode = terminalNodes[terminalKey(t.id, 2)] // S+
    expect(abs(res.nodeVoltages[secondaryNode])).toBeCloseTo(5, 4)
  })

  it('warns and drops a transformer with an unconnected terminal', () => {
    const v = comp('ac_voltage_source', { value: 10 })
    const t = comp('transformer', { value: 2, label: 'T1' })
    const g = comp('ground')
    // only primary wired; secondary left floating
    const wires = [wire(v, 0, t, 0), wire(v, 1, g, 0), wire(t, 1, g, 0)]
    const { netlist, warnings } = buildACNetlist([v, t, g], wires)
    expect(netlist.elements.some((e) => e.id === t.id)).toBe(false)
    expect(warnings.some((w) => /unconnected terminal/i.test(w))).toBe(true)
  })

  it('DC builder refuses a transformer with a clear message', () => {
    const v = comp('voltage_source', { value: 5 })
    const t = comp('transformer', { value: 2, label: 'T1' })
    const g = comp('ground')
    const wires = [wire(v, 0, t, 0), wire(v, 1, g, 0), wire(t, 1, g, 0), wire(t, 2, g, 0), wire(t, 3, g, 0)]
    const { warnings } = buildNetlist([v, t, g], wires)
    expect(warnings.some((w) => /require AC analysis/i.test(w))).toBe(true)
  })
})
