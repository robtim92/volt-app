/**
 * Every example must wire up cleanly, run in the live simulator without
 * burning anything, and behave the way its guide says it does.
 */
import { describe, it, expect } from 'vitest'
import { EXAMPLES, getExample } from './examples'
import { buildTransientNetlist, buildACNetlist, usesPhasorAnalysis } from '../sim/netlist'
import { TransientSimulator, suggestMaxStep } from '../sim/transient'
import { stepThermal, type ThermalEvent } from '../sim/thermal'
import { solveAC } from '../sim/acSolver'
import { ELEMENTS, type CircuitComponent, type Wire } from '../sim/elements'

interface RunResult {
  comps: CircuitComponent[]
  wires: Wire[]
  failures: ThermalEvent[]
  arcs: number
  min: Record<string, number>
  max: Record<string, number>
  last: Record<string, number>
  currents: Record<string, number>
}

/** Run like the app: frames of `frame` sim-seconds, thermal + trips applied, optional toggles. */
function run(
  components: CircuitComponent[],
  wires: Wire[],
  seconds: number,
  frame: number,
  toggles: { at: number; id: string }[] = []
): RunResult {
  let comps = components.map((c) => ({ ...c }))
  wires = wires.map((w) => ({ ...w }))
  let built = buildTransientNetlist(comps, wires)
  let sim = new TransientSimulator(built.netlist)
  let heat: Record<string, number> = {}
  const failures: ThermalEvent[] = []
  const min: Record<string, number> = {}
  const max: Record<string, number> = {}
  let arcs = 0
  let snap = sim.snapshot()
  const pending = [...toggles]
  for (let t = 0; t < seconds; t += frame) {
    let changed = false
    while (pending.length && pending[0].at <= t) {
      const id = pending.shift()!.id
      comps = comps.map((c) => (c.id === id ? { ...c, closed: !c.closed } : c))
      changed = true
    }
    if (changed) {
      built = buildTransientNetlist(comps, wires)
      sim = new TransientSimulator(built.netlist, sim.state)
    }
    snap = sim.advance(frame, suggestMaxStep(built.netlist), 100000)
    arcs += sim.events.filter((e) => e.kind === 'arc').length
    for (const [n, v] of Object.entries(snap.nodeVoltages)) {
      min[n] = Math.min(min[n] ?? Infinity, v)
      max[n] = Math.max(max[n] ?? -Infinity, v)
    }
    const r = stepThermal(comps, { ...snap, terminalNodes: built.terminalNodes }, heat, frame, wires)
    heat = r.heat
    if (r.events.length) {
      failures.push(...r.events)
      wires = wires.map((w) => (r.events.some((ev) => ev.componentId === w.id) ? { ...w, damaged: true } : w))
      comps = comps.map((c) => {
        const e = r.events.find((ev) => ev.componentId === c.id)
        if (!e) return c
        return e.kind === 'trip' ? { ...c, closed: false } : { ...c, damaged: true }
      })
      built = buildTransientNetlist(comps, wires)
      sim = new TransientSimulator(built.netlist, sim.state)
    }
  }
  return { comps, wires, failures, arcs, min, max, last: snap.nodeVoltages, currents: snap.elementCurrents }
}

const nodeOf = (ex: ReturnType<typeof getExample>, id: string, t: number): string =>
  buildTransientNetlist(ex!.circuit.components, ex!.circuit.wires).terminalNodes[`${id}:${t}`]

describe('example circuits', () => {
  it('have unique ids and at least three guide steps', () => {
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length)
    for (const e of EXAMPLES) expect(e.steps.length).toBeGreaterThanOrEqual(3)
  })

  for (const ex of EXAMPLES) {
    describe(ex.title, () => {
      it('wires only to real terminals, with nothing left unconnected', () => {
        const ids = new Set(ex.circuit.components.map((c) => c.id))
        expect(ids.size).toBe(ex.circuit.components.length)
        for (const w of ex.circuit.wires) {
          const a = ex.circuit.components.find((c) => c.id === w.fromComponentId)
          const b = ex.circuit.components.find((c) => c.id === w.toComponentId)
          expect(a, w.id).toBeDefined()
          expect(b, w.id).toBeDefined()
          expect(w.fromTerminal).toBeLessThan(ELEMENTS[a!.type].terminals.length)
          expect(w.toTerminal).toBeLessThan(ELEMENTS[b!.type].terminals.length)
        }
        const { warnings } = buildTransientNetlist(ex.circuit.components, ex.circuit.wires)
        expect(warnings).toEqual([])
      })

      it('runs in the live simulator without burning anything', () => {
        const { netlist } = buildTransientNetlist(ex.circuit.components, ex.circuit.wires)
        expect(new TransientSimulator(netlist).error).toBeNull()
        const r = run(ex.circuit.components, ex.circuit.wires, 3 * (ex.timeScale ?? 1), (ex.timeScale ?? 1) / 60)
        expect(r.failures.map((f) => f.message)).toEqual([])
      })

      if (usesPhasorAnalysis(ex.circuit.components)) {
        it('solves in AC (phasor) analysis', () => {
          const { netlist, warnings } = buildACNetlist(ex.circuit.components, ex.circuit.wires)
          expect(warnings).toEqual([])
          const f = ex.circuit.components.find((c) => c.type === 'ac_voltage_source')!.frequency!
          expect(solveAC(netlist, 2 * Math.PI * f).solved).toBe(true)
        })
      }
    })
  }

  it('LED example: about 15 mA, and 47 Ω burns the LED', () => {
    const ex = getExample('led-resistor')!
    const ok = run(ex.circuit.components, ex.circuit.wires, 1, 1 / 60)
    expect(ok.currents.LED1).toBeGreaterThan(0.013)
    expect(ok.currents.LED1).toBeLessThan(0.017)
    const hot = ex.circuit.components.map((c) => (c.id === 'R1' ? { ...c, value: 47 } : c))
    expect(run(hot, ex.circuit.wires, 2, 1 / 60).failures.map((f) => f.componentId)).toContain('LED1')
  })

  it('divider reads 4 V', () => {
    const ex = getExample('voltage-divider')!
    const r = run(ex.circuit.components, ex.circuit.wires, 0.1, 1 / 60)
    expect(r.last[nodeOf(ex, 'R2', 0)]).toBeCloseTo(4, 2)
  })

  it('Kirchhoff: A1 = A2 + A3 + A4', () => {
    const ex = getExample('kirchhoff-current')!
    const r = run(ex.circuit.components, ex.circuit.wires, 0.1, 1 / 60)
    const sum = r.currents.A2 + r.currents.A3 + r.currents.A4
    expect(Math.abs(r.currents.A1)).toBeCloseTo(Math.abs(sum), 5)
    expect(Math.abs(r.currents.A1)).toBeGreaterThan(0.04)
  })

  it('RC charging reaches ~63% one time constant after the switch closes', () => {
    const ex = getExample('rc-charging')!
    const r = run(ex.circuit.components, ex.circuit.wires, 1.0, 1 / 60, [{ at: 0, id: 'SW1' }])
    expect(r.last[nodeOf(ex, 'C1', 0)]).toBeGreaterThan(5.4)
    expect(r.last[nodeOf(ex, 'C1', 0)]).toBeLessThan(6.0)
  })

  it('kickback: opening the switch arcs; a flyback diode prevents it', () => {
    const ex = getExample('inductive-kickback')!
    const bare = run(ex.circuit.components, ex.circuit.wires, 0.1, 0.1 / 60, [{ at: 0.05, id: 'SW1' }])
    expect(bare.arcs).toBeGreaterThan(0)
    const withDiode = run(
      [...ex.circuit.components, { id: 'D1', type: 'diode', x: 640, y: 260, rotation: 270 }],
      [...ex.circuit.wires, { id: 'wd1', fromComponentId: 'D1', fromTerminal: 1, toComponentId: 'L1', toTerminal: 0 }, { id: 'wd2', fromComponentId: 'D1', fromTerminal: 0, toComponentId: 'L1', toTerminal: 1 }],
      0.1,
      0.1 / 60,
      [{ at: 0.05, id: 'SW1' }]
    )
    expect(withDiode.arcs).toBe(0)
    expect(withDiode.failures).toEqual([])
  })

  it('rectifier output never goes meaningfully negative and peaks ~0.7 V below the input', () => {
    const ex = getExample('half-wave-rectifier')!
    const r = run(ex.circuit.components, ex.circuit.wires, 0.1, 0.01 / 60)
    const out = nodeOf(ex, 'R1', 0)
    expect(r.min[out]).toBeGreaterThan(-0.05)
    expect(r.max[out]).toBeGreaterThan(9)
    expect(r.max[out]).toBeLessThan(9.6)
  })

  it('breaker holds with two loads and trips when the microwave is switched on', () => {
    const ex = getExample('breaker-overload')!
    expect(run(ex.circuit.components, ex.circuit.wires, 2, 1 / 60).failures).toEqual([])
    const r = run(ex.circuit.components, ex.circuit.wires, 3, 1 / 60, [{ at: 0.5, id: 'SW2' }])
    expect(r.failures.map((f) => `${f.componentId}:${f.kind}`)).toEqual(['CB1:trip'])
    expect(r.comps.find((c) => c.id === 'CB1')!.closed).toBe(false)
  })

  it('battery: light load ≈ 9.5 V, heavy load sags by about a volt', () => {
    const ex = getExample('battery-sag')!
    const node = nodeOf(ex, 'VM1', 0)
    const light = run(ex.circuit.components, ex.circuit.wires, 0.2, 1 / 60)
    expect(light.last[node]).toBeGreaterThan(9.3)
    const heavy = run(ex.circuit.components, ex.circuit.wires, 0.5, 1 / 60, [{ at: 0.1, id: 'SW1' }])
    expect(light.last[node] - heavy.last[node]).toBeGreaterThan(0.8)
    expect(heavy.failures).toEqual([])
  })

  it('long run: 18 AWG drops ~2.7 V, 12 AWG much less, 22 AWG starves the lamp', () => {
    const ex = getExample('long-wire-drop')!
    const vLoad = (wires: Wire[]): number => {
      const r = run(ex.circuit.components, wires, 0.2, 1 / 60)
      const built = buildTransientNetlist(ex.circuit.components, wires)
      return r.last[built.terminalNodes['VM1:0']] - r.last[built.terminalNodes['VM1:1']]
    }
    const v18 = vLoad(ex.circuit.wires)
    expect(v18).toBeGreaterThan(9)
    expect(v18).toBeLessThan(9.6)
    const regauge = (g: number): Wire[] => ex.circuit.wires.map((w) => (w.length ? { ...w, gauge: g } : w))
    expect(vLoad(regauge(12))).toBeGreaterThan(11)
    expect(vLoad(regauge(22))).toBeLessThan(7.2)
  })

  it('bench supply: 20 mA limit protects a bare LED; 0.1 A burns it', () => {
    const ex = getExample('bench-current-limit')!
    const ok = run(ex.circuit.components, ex.circuit.wires, 1, 1 / 60)
    expect(Math.abs(ok.currents.A1)).toBeCloseTo(0.02, 3)
    const hot = ex.circuit.components.map((c) => (c.id === 'PS1' ? { ...c, currentLimit: 0.1 } : c))
    expect(run(hot, ex.circuit.wires, 2, 1 / 60).failures.map((f) => f.componentId)).toContain('LED1')
  })
})
