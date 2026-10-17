/**
 * Step 5 physics: wire resistance + heating, batteries (internal resistance,
 * drain), bench supply current limiting.
 */
import { describe, it, expect } from 'vitest'
import { buildTransientNetlist, batteryParams } from './netlist'
import { TransientSimulator, suggestMaxStep } from './transient'
import { stepThermal, type ThermalEvent } from './thermal'
import { drain, packOcv, hoursRemaining, cellOcv } from './battery'
import type { CircuitComponent, Wire } from './elements'

const comp = (id: string, type: CircuitComponent['type'], extra: Partial<CircuitComponent> = {}): CircuitComponent =>
  ({ id, type, x: 0, y: 0, rotation: 0, label: id, ...extra })
const wire = (id: string, a: string, at: number, b: string, bt: number, extra: Partial<Wire> = {}): Wire =>
  ({ id, fromComponentId: a, fromTerminal: at, toComponentId: b, toTerminal: bt, length: 0.1, ...extra })

function run(components: CircuitComponent[], wires: Wire[], seconds: number) {
  let comps = components
  let ws = wires
  const soc: Record<string, number> = {}
  let built = buildTransientNetlist(comps, ws, { soc })
  let sim = new TransientSimulator(built.netlist)
  let heat: Record<string, number> = {}
  const failures: ThermalEvent[] = []
  let snap = sim.snapshot()
  const frame = 1 / 60
  for (let t = 0; t < seconds; t += frame) {
    snap = sim.advance(frame, suggestMaxStep(built.netlist), 100000)
    for (const c of comps) if (c.type === 'battery') {
      const p = batteryParams(c, soc)
      soc[c.id] = drain(p, -(snap.elementCurrents[c.id] ?? 0), frame)
      sim.setSourceValue(c.id, packOcv({ ...p, soc: soc[c.id] }))
    }
    const r = stepThermal(comps, { ...snap, terminalNodes: built.terminalNodes }, heat, frame, ws)
    heat = r.heat
    if (r.events.length) {
      failures.push(...r.events)
      const ids = new Set(r.events.map((e) => e.componentId))
      comps = comps.map((c) => (ids.has(c.id) ? { ...c, damaged: true } : c))
      ws = ws.map((w) => (ids.has(w.id) ? { ...w, damaged: true } : w))
      built = buildTransientNetlist(comps, ws, { soc })
      sim = new TransientSimulator(built.netlist, sim.state)
    }
  }
  return { snap, failures, built, sim, heat }
}

describe('wires', () => {
  it('a 10 m run of thin wire drops noticeable voltage', () => {
    const comps = [comp('V1', 'voltage_source', { value: 12 }), comp('R1', 'resistor', { value: 6, rating: 100 })]
    const thin = run(comps, [wire('a', 'V1', 0, 'R1', 0, { length: 10, gauge: 22 }), wire('b', 'R1', 1, 'V1', 1, { length: 10, gauge: 22 })], 0.1)
    const load = (r: ReturnType<typeof run>) =>
      r.snap.nodeVoltages[r.built.terminalNodes['R1:0']] - r.snap.nodeVoltages[r.built.terminalNodes['R1:1']]
    // 2 × 10 m × 53.4 mΩ/m ≈ 1.07 Ω of wire → load sees ≈ 12 × 6/7.07
    expect(load(thin)).toBeCloseTo((12 * 6) / (6 + 2 * 10 * 0.0534), 1)
    const thick = run(comps, [wire('a', 'V1', 0, 'R1', 0, { length: 10, gauge: 12 }), wire('b', 'R1', 1, 'V1', 1, { length: 10, gauge: 12 })], 0.1)
    expect(load(thick)).toBeGreaterThan(11.7)
  })

  it('20 A melts 22 AWG hookup wire but 12 AWG carries it', () => {
    const comps = [comp('V1', 'voltage_source', { value: 12 }), comp('R1', 'resistor', { value: 0.6, rating: 1000 })]
    const thin = run(comps, [wire('a', 'V1', 0, 'R1', 0), wire('b', 'R1', 1, 'V1', 1)], 2)
    expect(thin.failures.map((f) => f.componentId)).toContain('a')
    expect(thin.failures[0].message).toMatch(/22 AWG/)
    const thick = run(comps, [wire('a', 'V1', 0, 'R1', 0, { gauge: 12 }), wire('b', 'R1', 1, 'V1', 1, { gauge: 12 })], 2)
    expect(thick.failures).toEqual([])
  })

  it('a melted wire is an open circuit', () => {
    const comps = [comp('V1', 'voltage_source', { value: 12 }), comp('R1', 'resistor', { value: 100 })]
    const r = run(comps, [wire('a', 'V1', 0, 'R1', 0, { damaged: true }), wire('b', 'R1', 1, 'V1', 1)], 0.1)
    expect(Math.abs(r.snap.elementCurrents.R1)).toBeLessThan(1e-6)
  })
})

describe('batteries', () => {
  it('a fresh 9 V battery reads about 9.6 V open-circuit and sags under load', () => {
    const p = batteryParams(comp('B1', 'battery'))
    expect(packOcv(p)).toBeCloseTo(9.6, 1)
    const r = run([comp('B1', 'battery'), comp('R1', 'resistor', { value: 47, rating: 10 })], [wire('a', 'B1', 0, 'R1', 0), wire('b', 'R1', 1, 'B1', 1)], 0.1)
    const vLoad = Math.abs(r.snap.elementCurrents.R1) * 47
    expect(vLoad).toBeLessThan(9.6)
    expect(vLoad).toBeGreaterThan(8.5)
  })

  it('shorting a 9 V battery gives a few amps (not thousands) and overheats the battery', () => {
    const r = run([comp('B1', 'battery')], [wire('a', 'B1', 0, 'B1', 1)], 0.05)
    const i = Math.abs(r.snap.elementCurrents.a)
    expect(i).toBeGreaterThan(4)
    expect(i).toBeLessThan(7)
    const long = run([comp('B1', 'battery')], [wire('a', 'B1', 0, 'B1', 1)], 4)
    expect(long.failures.map((f) => f.componentId)).toContain('B1')
  })

  it('drains: two AA cells at 1 A for an hour use 40% of 2.5 Ah', () => {
    const p = batteryParams(comp('B1', 'battery', { chemistry: 'alkaline_aa' }))
    expect(drain(p, 1, 3600)).toBeCloseTo(0.6, 5)
    expect(hoursRemaining(p, 0.5)).toBeCloseTo(5, 5)
    expect(cellOcv('liion', 1)).toBeCloseTo(4.2)
    expect(cellOcv('liion', 0)).toBeCloseTo(3.0)
  })
})

describe('bench supply', () => {
  const circuit = (load: number) => [
    [comp('PS1', 'bench_supply', { value: 12, currentLimit: 1 }), comp('R1', 'resistor', { value: load, rating: 100 })],
    [wire('a', 'PS1', 0, 'R1', 0), wire('b', 'R1', 1, 'PS1', 1)]
  ] as const

  it('regulates voltage under a light load (CV)', () => {
    const [c, w] = circuit(24)
    const r = run([...c], [...w], 0.1)
    expect(r.sim.supplyMode('PS1')).toBe('CV')
    expect(Math.abs(r.snap.elementCurrents.R1)).toBeCloseTo(0.5, 2)
  })

  it('limits current under a heavy load (CC)', () => {
    const [c, w] = circuit(4)
    const r = run([...c], [...w], 0.1)
    expect(r.sim.supplyMode('PS1')).toBe('CC')
    expect(Math.abs(r.snap.elementCurrents.R1)).toBeCloseTo(1, 3)
  })

  it('survives a dead short at its current limit', () => {
    const r = run([comp('PS1', 'bench_supply', { value: 12, currentLimit: 2 })], [wire('a', 'PS1', 0, 'PS1', 1)], 1)
    expect(Math.abs(r.snap.elementCurrents.a)).toBeCloseTo(2, 3)
    expect(r.failures).toEqual([])
  })
})
