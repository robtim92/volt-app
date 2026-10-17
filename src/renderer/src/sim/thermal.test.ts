import { describe, it, expect } from 'vitest'
import { stepThermal, componentLoad } from './thermal'
import { buildTransientNetlist } from './netlist'
import { TransientSimulator } from './transient'
import type { CircuitComponent, Wire } from './elements'

const comp = (id: string, type: CircuitComponent['type'], extra: Partial<CircuitComponent> = {}): CircuitComponent =>
  ({ id, type, x: 0, y: 0, rotation: 0, label: id, ...extra })
const wire = (a: string, at: number, b: string, bt: number): Wire =>
  ({ id: `${a}${at}-${b}${bt}`, fromComponentId: a, fromTerminal: at, toComponentId: b, toTerminal: bt })

/** Run a circuit live for `seconds`, applying thermal failures like the app does. */
function runLive(components: CircuitComponent[], wires: Wire[], seconds: number) {
  let comps = components
  let heat: Record<string, number> = {}
  const events: string[] = []
  let sim = new TransientSimulator(buildTransientNetlist(comps, wires).netlist)
  const frame = 1 / 60
  for (let t = 0; t < seconds; t += frame) {
    const built = buildTransientNetlist(comps, wires)
    const snap = sim.advance(frame, 1e-3)
    const res = stepThermal(comps, { ...snap, terminalNodes: built.terminalNodes }, heat, frame)
    heat = res.heat
    if (res.events.length) {
      for (const e of res.events) events.push(`${e.componentId}:${e.kind}`)
      comps = comps.map((c) => {
        const e = res.events.find((ev) => ev.componentId === c.id)
        if (!e) return c
        return e.kind === 'trip' ? { ...c, closed: false } : { ...c, damaged: true }
      })
      sim = new TransientSimulator(buildTransientNetlist(comps, wires).netlist, sim.state)
    }
  }
  return { comps, heat, events }
}

const ledCircuit = (withResistor: number | null) => {
  const comps = [comp('V1', 'voltage_source', { value: 9 }), comp('D1', 'led')]
  const wires = [wire('V1', 1, 'D1', 1)]
  if (withResistor !== null) {
    comps.push(comp('R1', 'resistor', { value: withResistor }))
    wires.push(wire('V1', 0, 'R1', 0), wire('R1', 1, 'D1', 0))
  } else {
    wires.push(wire('V1', 0, 'D1', 0))
  }
  return { comps, wires }
}

describe('thermal model', () => {
  it('burns out an LED connected straight across 9 V', () => {
    const { comps, wires } = ledCircuit(null)
    const out = runLive(comps, wires, 1)
    expect(out.events).toContain('D1:burnout')
    expect(out.comps.find((c) => c.id === 'D1')?.damaged).toBe(true)
  })

  it('keeps an LED with a 390 Ω resistor healthy', () => {
    const { comps, wires } = ledCircuit(390)
    const out = runLive(comps, wires, 3)
    expect(out.events).toEqual([])
    expect(out.heat.D1).toBeGreaterThan(0.4) // ~18 mA of 30 mA
    expect(out.heat.D1).toBeLessThan(1)
  })

  it('burns a ¼ W resistor dissipating 1.44 W (12 V across 100 Ω), but not instantly', () => {
    const comps = [comp('V1', 'voltage_source', { value: 12 }), comp('R1', 'resistor', { value: 100 })]
    const wires = [wire('V1', 0, 'R1', 0), wire('R1', 1, 'V1', 1)]
    expect(runLive(comps, wires, 0.3).events).toEqual([])
    expect(runLive(comps, wires, 3).events).toContain('R1:burnout')
  })

  it('a higher wattage rating survives the same load', () => {
    const comps = [comp('V1', 'voltage_source', { value: 12 }), comp('R1', 'resistor', { value: 100, rating: 2 })]
    const wires = [wire('V1', 0, 'R1', 0), wire('R1', 1, 'V1', 1)]
    expect(runLive(comps, wires, 5).events).toEqual([])
  })

  it('trips an overloaded breaker open instead of destroying it', () => {
    const comps = [
      comp('V1', 'voltage_source', { value: 120 }),
      comp('CB1', 'breaker', { value: 15, closed: true }),
      comp('R1', 'resistor', { value: 4, rating: 10000 }) // 30 A heater
    ]
    const wires = [wire('V1', 0, 'CB1', 0), wire('CB1', 1, 'R1', 0), wire('R1', 1, 'V1', 1)]
    const out = runLive(comps, wires, 2)
    expect(out.events).toContain('CB1:trip')
    const cb = out.comps.find((c) => c.id === 'CB1')!
    expect(cb.closed).toBe(false)
    expect(cb.damaged).toBeUndefined()
  })

  it('returns no load for parts without a thermal model', () => {
    expect(
      componentLoad(comp('G', 'ground'), { nodeVoltages: {}, elementCurrents: {}, terminalNodes: {} })
    ).toBeNull()
  })
})
