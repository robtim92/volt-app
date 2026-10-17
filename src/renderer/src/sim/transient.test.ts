import { describe, it, expect } from 'vitest'
import { TransientSimulator, suggestMaxStep, type TransientNetlist } from './transient'
import { LED_PARAMS, solveDC } from './solver'
import { buildTransientNetlist } from './netlist'
import type { CircuitComponent, Wire } from './elements'

const rc = (R: number, C: number, V = 10): TransientNetlist => ({
  elements: [
    { id: 'V1', type: 'voltage_source', value: V, nodes: ['in', 'gnd'] },
    { id: 'R1', type: 'resistor', value: R, nodes: ['in', 'out'] },
    { id: 'C1', type: 'capacitor', value: C, nodes: ['out', 'gnd'] }
  ]
})

describe('TransientSimulator', () => {
  it('charges an RC circuit along V(1 − e^(−t/RC))', () => {
    const sim = new TransientSimulator(rc(1000, 1e-3)) // τ = 1 s
    for (const t of [0.5, 1, 2, 3]) {
      const snap = sim.advance(t - sim.time, 1e-3)
      const expected = 10 * (1 - Math.exp(-t))
      expect(snap.nodeVoltages.out).toBeCloseTo(expected, 1)
      expect(Math.abs(snap.nodeVoltages.out - expected) / expected).toBeLessThan(0.01)
    }
  })

  it('reports capacitor current decaying as V/R · e^(−t/RC)', () => {
    const sim = new TransientSimulator(rc(1000, 1e-3))
    const snap = sim.advance(1, 1e-3)
    expect(snap.elementCurrents.C1).toBeCloseTo((10 / 1000) * Math.exp(-1), 4)
    expect(snap.elementCurrents.R1).toBeCloseTo(snap.elementCurrents.C1, 6)
  })

  it('ramps RL current along V/R (1 − e^(−tR/L))', () => {
    const sim = new TransientSimulator({
      elements: [
        { id: 'V1', type: 'voltage_source', value: 12, nodes: ['in', 'gnd'] },
        { id: 'R1', type: 'resistor', value: 10, nodes: ['in', 'm'] },
        { id: 'L1', type: 'inductor', value: 1, nodes: ['m', 'gnd'] }
      ]
    }) // τ = 0.1 s
    const snap = sim.advance(0.1, 1e-4)
    expect(snap.elementCurrents.L1).toBeCloseTo(1.2 * (1 - Math.exp(-1)), 3)
  })

  it('keeps an LC tank oscillating at 1/(2π√LC) without decaying (trapezoidal)', () => {
    // Pre-charged capacitor across an inductor
    const L = 1e-3
    const C = 1e-6
    const net: TransientNetlist = {
      elements: [
        { id: 'L1', type: 'inductor', value: L, nodes: ['a', 'gnd'] },
        { id: 'C1', type: 'capacitor', value: C, nodes: ['a', 'gnd'] }
      ]
    }
    const sim = new TransientSimulator(net, {
      time: 0,
      capVoltage: { C1: 5 },
      capCurrent: { C1: 0 },
      indCurrent: { L1: 0 },
      indVoltage: { L1: 5 },
      junction: {}
    })
    const period = 2 * Math.PI * Math.sqrt(L * C)
    const dt = suggestMaxStep(net)
    expect(dt).toBeLessThanOrEqual(period / 64)
    let maxV = 0
    // run 10 periods, track peak in the last one
    sim.advance(9 * period, dt)
    for (let k = 0; k < 200; k++) {
      const s = sim.advance(period / 200, dt)
      maxV = Math.max(maxV, Math.abs(s.nodeVoltages.a))
    }
    expect(maxV).toBeGreaterThan(4.8)
    expect(maxV).toBeLessThan(5.2)
  })

  it('settles a resistive + LED circuit to the DC solution', () => {
    const elements = [
      { id: 'V1', type: 'voltage_source' as const, value: 9, nodes: ['a', 'gnd'] as [string, string] },
      { id: 'R1', type: 'resistor' as const, value: 390, nodes: ['a', 'b'] as [string, string] },
      { id: 'D1', type: 'diode' as const, value: 0, nodes: ['b', 'gnd'] as [string, string], params: LED_PARAMS }
    ]
    const sim = new TransientSimulator({ elements })
    const snap = sim.advance(0.01, 1e-3)
    const dc = solveDC({ elements })
    expect(snap.elementCurrents.D1).toBeCloseTo(dc.elementCurrents.D1, 6)
    expect(snap.nodeVoltages.b).toBeCloseTo(dc.nodeVoltages.b, 5)
  })

  it('half-wave rectifies a sine source through a diode', () => {
    const sim = new TransientSimulator({
      elements: [
        { id: 'V1', type: 'sine_source', value: 10, frequency: 50, nodes: ['a', 'gnd'] },
        { id: 'D1', type: 'diode', value: 0, nodes: ['a', 'b'] },
        { id: 'R1', type: 'resistor', value: 1000, nodes: ['b', 'gnd'] }
      ]
    })
    let min = Infinity
    let max = -Infinity
    for (let k = 0; k < 400; k++) {
      const s = sim.advance(0.02 / 100, 1e-4)
      min = Math.min(min, s.nodeVoltages.b)
      max = Math.max(max, s.nodeVoltages.b)
    }
    expect(max).toBeGreaterThan(9)
    expect(max).toBeLessThan(9.6)
    expect(min).toBeGreaterThan(-0.01)
  })

  it('carries capacitor charge into a rebuilt simulator (topology change)', () => {
    const a = new TransientSimulator(rc(1000, 1e-3))
    a.advance(5, 1e-3, 10000) // essentially fully charged (τ = 1 s)
    // Remove the source: the capacitor now discharges through R
    const b = new TransientSimulator(
      {
        elements: [
          { id: 'R1', type: 'resistor', value: 1000, nodes: ['out', 'gnd'] },
          { id: 'C1', type: 'capacitor', value: 1e-3, nodes: ['out', 'gnd'] }
        ]
      },
      a.state
    )
    expect(b.settleInstant().nodeVoltages.out).toBeCloseTo(9.93, 1)
    const s = b.advance(1, 1e-3)
    expect(s.nodeVoltages.out).toBeCloseTo(9.93 * Math.exp(-1), 1)
  })

  it('arcs when an inductor current is interrupted', () => {
    const run = new TransientSimulator({
      elements: [
        { id: 'V1', type: 'voltage_source', value: 12, nodes: ['in', 'gnd'] },
        { id: 'R1', type: 'resistor', value: 10, nodes: ['in', 'm'] },
        { id: 'L1', type: 'inductor', value: 1, nodes: ['m', 'gnd'] }
      ]
    })
    run.advance(1, 1e-3)
    expect(run.state.indCurrent.L1).toBeGreaterThan(1)
    // Switch opens: inductor left alone (only the leakage path remains)
    const open = new TransientSimulator(
      {
        elements: [
          { id: 'V1', type: 'voltage_source', value: 12, nodes: ['in', 'gnd'] },
          { id: 'L1', type: 'inductor', value: 1, nodes: ['m', 'gnd'] }
        ]
      },
      run.state
    )
    open.advance(1e-3, 1e-4)
    expect(open.events.some((e) => e.kind === 'arc' && e.elementId === 'L1')).toBe(true)
    expect(open.state.indCurrent.L1).toBe(0)
  })

  it('reports a missing ground', () => {
    const sim = new TransientSimulator({
      elements: [{ id: 'R1', type: 'resistor', value: 10, nodes: ['a', 'b'] }]
    })
    expect(sim.error).toMatch(/ground/)
  })
})

describe('buildTransientNetlist', () => {
  const comp = (id: string, type: CircuitComponent['type'], extra: Partial<CircuitComponent> = {}): CircuitComponent =>
    ({ id, type, x: 0, y: 0, rotation: 0, ...extra })
  const wire = (a: string, at: number, b: string, bt: number): Wire =>
    ({ id: `${a}${at}-${b}${bt}`, fromComponentId: a, fromTerminal: at, toComponentId: b, toTerminal: bt })

  it('auto-grounds the negative terminal of the source when no ground is placed', () => {
    const comps = [comp('V1', 'voltage_source', { value: 9 }), comp('R1', 'resistor', { value: 100 })]
    const wires = [wire('V1', 0, 'R1', 0), wire('R1', 1, 'V1', 1)]
    const { netlist } = buildTransientNetlist(comps, wires)
    const sim = new TransientSimulator(netlist)
    expect(sim.error).toBeNull()
    expect(sim.advance(0.001, 1e-3).elementCurrents.R1).toBeCloseTo(0.09, 6)
  })

  it('treats damaged components as open circuits', () => {
    const comps = [
      comp('V1', 'voltage_source', { value: 9 }),
      comp('R1', 'resistor', { value: 100, damaged: true })
    ]
    const wires = [wire('V1', 0, 'R1', 0), wire('R1', 1, 'V1', 1)]
    const { netlist } = buildTransientNetlist(comps, wires)
    expect(netlist.elements.map((e) => e.id)).toEqual(['V1'])
  })

  it('keeps capacitors and turns AC sources into sine sources', () => {
    const comps = [
      comp('V1', 'ac_voltage_source', { value: 10, frequency: 50 }),
      comp('C1', 'capacitor', { value: 1e-6 }),
      comp('G', 'ground')
    ]
    const wires = [wire('V1', 0, 'C1', 0), wire('C1', 1, 'V1', 1), wire('V1', 1, 'G', 0)]
    const { netlist } = buildTransientNetlist(comps, wires)
    expect(netlist.elements.find((e) => e.id === 'V1')).toMatchObject({ type: 'sine_source', frequency: 50 })
    expect(netlist.elements.find((e) => e.id === 'C1')).toMatchObject({ type: 'capacitor' })
  })
})
