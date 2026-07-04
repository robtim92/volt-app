import { describe, it, expect } from 'vitest'
import { buildACNetlist, terminalKey } from './netlist'
import { solveAC } from './acSolver'
import { abs, phaseDeg } from './complex'
import type { CircuitComponent, Wire } from './elements'

let nextId = 0
const comp = (
  type: CircuitComponent['type'],
  extra: Partial<CircuitComponent> = {}
): CircuitComponent => ({ id: `c${++nextId}`, type, x: 0, y: 0, rotation: 0, ...extra })

const wire = (
  from: CircuitComponent, fromTerminal: number,
  to: CircuitComponent, toTerminal: number
): Wire => ({
  id: `w${++nextId}`,
  fromComponentId: from.id, fromTerminal,
  toComponentId: to.id, toTerminal
})

describe('buildACNetlist', () => {
  it('emits R/L/C and AC source with their real values', () => {
    const v = comp('ac_voltage_source', { value: 2, phase: 30, label: 'Vac1' })
    const r = comp('resistor', { value: 470, label: 'R1' })
    const l = comp('inductor', { value: 1e-3, label: 'L1' })
    const c = comp('capacitor', { value: 1e-6, label: 'C1' })
    const g = comp('ground')
    // v+ — r — l — c — gnd, and v- — gnd  (a single loop)
    const wires = [
      wire(v, 0, r, 0), wire(r, 1, l, 0), wire(l, 1, c, 0),
      wire(c, 1, g, 0), wire(v, 1, g, 0)
    ]
    const { netlist, warnings } = buildACNetlist([v, r, l, c, g], wires)
    expect(warnings).toEqual([])

    const byType = (t: string): typeof netlist.elements => netlist.elements.filter((e) => e.type === t)
    expect(byType('resistor')[0].value).toBe(470)
    expect(byType('inductor')[0].value).toBe(1e-3)
    expect(byType('capacitor')[0].value).toBe(1e-6)
    const src = byType('ac_voltage_source')[0]
    expect(src.amplitude).toBe(2)
    expect(src.phaseDeg).toBe(30)
  })

  it('round-trips an RC low-pass through solveAC (-3 dB, -45° at cutoff)', () => {
    // R = 1kΩ, C = 1µF → cutoff ω = 1/RC = 1000 rad/s
    const v = comp('ac_voltage_source', { value: 1, label: 'Vac1' })
    const r = comp('resistor', { value: 1000, label: 'R1' })
    const c = comp('capacitor', { value: 1e-6, label: 'C1' })
    const g = comp('ground')
    const wires = [wire(v, 0, r, 0), wire(r, 1, c, 0), wire(c, 1, g, 0), wire(v, 1, g, 0)]

    const { netlist, terminalNodes } = buildACNetlist([v, r, c, g], wires)
    const res = solveAC(netlist, 1000)
    expect(res.solved).toBe(true)

    // output node = capacitor's high side (terminal 0)
    const outNode = terminalNodes[terminalKey(c.id, 0)]
    const vout = res.nodeVoltages[outNode]
    expect(abs(vout)).toBeCloseTo(Math.SQRT1_2, 4) // 0.7071
    expect(phaseDeg(vout)).toBeCloseTo(-45, 3)
  })

  it('treats a DC voltage source as a short and warns', () => {
    const vac = comp('ac_voltage_source', { value: 1, label: 'Vac1' })
    const vdc = comp('voltage_source', { value: 9, label: 'V1' })
    const r = comp('resistor', { value: 100, label: 'R1' })
    const g = comp('ground')
    const wires = [wire(vac, 0, r, 0), wire(r, 1, vdc, 0), wire(vdc, 1, g, 0), wire(vac, 1, g, 0)]
    const { netlist, warnings } = buildACNetlist([vac, vdc, r, g], wires)
    const dc = netlist.elements.find((e) => e.id === vdc.id)
    expect(dc?.type).toBe('ac_voltage_source')
    expect(dc?.amplitude).toBe(0)
    expect(warnings.some((w) => /short in AC/i.test(w))).toBe(true)
  })

  it('drops diodes with a warning (not modelled in AC)', () => {
    const vac = comp('ac_voltage_source', { value: 1, label: 'Vac1' })
    const d = comp('diode', { label: 'D1' })
    const g = comp('ground')
    const wires = [wire(vac, 0, d, 0), wire(d, 1, g, 0), wire(vac, 1, g, 0)]
    const { netlist, warnings } = buildACNetlist([vac, d, g], wires)
    expect(netlist.elements.some((e) => e.id === d.id)).toBe(false)
    expect(warnings.some((w) => /not modelled in AC/i.test(w))).toBe(true)
  })
})
