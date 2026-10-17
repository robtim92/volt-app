import { describe, it, expect } from 'vitest'
import { BREAKER_TAU, THERMAL_TRIP, legOfSlot, newRuntime, ohmsPerFoot, solveCircuit, stepHome, circuitWarnings } from './homeSim'
import { serviceLoad } from './loadCalc'
import { HOME_EXAMPLES, blankHome, shedHome, starterHome } from './examples'
import { GFCI_ROOMS, AFCI_ROOMS } from './appliances'
import type { BranchCircuit, HomeDesign, TripEvent } from './types'

/** Run the home like the app does: frames of `frame` seconds, trips applied. */
function run(design: HomeDesign, seconds: number, frame = 0.5) {
  let d = structuredClone(design)
  let rt = newRuntime()
  const trips: (TripEvent & { at: number })[] = []
  for (let t = 0; t < seconds; t += frame) {
    const r = stepHome(d, rt, frame)
    rt = r.runtime
    for (const tr of r.trips) {
      trips.push({ ...tr, at: rt.t })
      d = tr.id === 'main' ? { ...d, mainState: 'tripped' } : { ...d, circuits: d.circuits.map((c) => (c.id === tr.id ? { ...c, state: 'tripped' } : c)) }
    }
  }
  return { d, rt, trips }
}

const setLoads = (d: HomeDesign, circuitId: string, on: Record<string, boolean>): HomeDesign => ({
  ...d,
  circuits: d.circuits.map((c) => (c.id === circuitId ? { ...c, loads: c.loads.map((l) => (l.appliance in on ? { ...l, on: on[l.appliance] } : l)) } : c))
})

describe('home power simulation', () => {
  it('panel rows alternate legs A, B, A, B', () => {
    expect([1, 2, 3, 4, 5, 6].map(legOfSlot)).toEqual(['A', 'A', 'B', 'B', 'A', 'A'])
  })

  it('12 AWG copper is about 1.59 Ω per 1000 ft', () => {
    expect(ohmsPerFoot(12) * 1000).toBeCloseTo(1.59, 1)
  })

  it('a 1500 W heater on a short run draws 12.5 A', () => {
    const c: BranchCircuit = { id: 'c', name: 'c', room: 'Bedroom', slot: 1, poles: 1, amps: 15, type: 'standard', state: 'on', gauge: 14, lengthFt: 0.01, loads: [{ id: 'l', appliance: 'space_heater', on: true }] }
    const r = solveCircuit(c, () => true, () => 10)
    expect(r.amps).toBeCloseTo(12.5, 2)
  })

  it('the starter home runs for an hour without tripping', () => {
    const { trips, rt } = run(starterHome(), 3600, 2)
    expect(trips).toEqual([])
    expect(rt.kwh).toBeGreaterThan(0.5)
  })

  it('breakfast overload trips Kitchen counter 1 on its thermal curve', () => {
    const d = setLoads(starterHome(), 'kitchen1', { toaster: true, kettle: true })
    const { trips } = run(d, 300)
    expect(trips.map((t) => `${t.id}:${t.kind}`)).toEqual(['kitchen1:overload'])
    // ~34 A on 20 A: x² ≈ 2.9 → t = −τ ln(1 − 1.3/2.9) ≈ 70 s
    const x = 34 / 20
    const expected = -BREAKER_TAU * Math.log(1 - THERMAL_TRIP / (x * x))
    expect(trips[0].at).toBeGreaterThan(expected * 0.7)
    expect(trips[0].at).toBeLessThan(expected * 1.4)
  })

  it('moving the kettle to the other counter circuit fixes it', () => {
    let d = setLoads(starterHome(), 'kitchen1', { toaster: true })
    d = { ...d, circuits: d.circuits.map((c) => (c.id === 'kitchen2' ? { ...c, loads: [...c.loads, { id: 'k', appliance: 'kettle', on: true }] } : c)) }
    expect(run(d, 600).trips).toEqual([])
  })

  it('a short circuit trips magnetically in the first step', () => {
    const d = starterHome()
    d.circuits = d.circuits.map((c) => (c.id === 'living' ? { ...c, fault: 'short' } : c))
    const { trips } = run(d, 1, 0.1)
    expect(trips[0]).toMatchObject({ id: 'living', kind: 'short' })
    expect(trips[0].at).toBeLessThanOrEqual(0.11)
  })

  it('GFCI trips on a ground fault; a standard breaker does not (and is flagged)', () => {
    let d = setLoads(starterHome(), 'bath', { hair_dryer: true })
    d.circuits = d.circuits.map((c) => (c.id === 'bath' ? { ...c, fault: 'ground' } : c))
    expect(run(d, 1, 0.1).trips.map((t) => t.kind)).toEqual(['ground'])
    d.circuits = d.circuits.map((c) => (c.id === 'bath' ? { ...c, type: 'standard' } : c))
    expect(run(d, 1, 0.1).trips).toEqual([])
    const bath = d.circuits.find((c) => c.id === 'bath')!
    expect(circuitWarnings(bath, undefined, 0, GFCI_ROOMS, AFCI_ROOMS).some((w) => w.level === 'danger')).toBe(true)
  })

  it('AFCI trips on an arcing fault', () => {
    const d = starterHome()
    d.circuits = d.circuits.map((c) => (c.id === 'living' ? { ...c, fault: 'arc' } : c))
    expect(run(d, 1, 0.1).trips.map((t) => `${t.id}:${t.kind}`)).toEqual(['living:arc'])
  })

  it('a fridge compressor start surges without tripping', () => {
    const d: HomeDesign = { ...blankHome(), circuits: [starterHome().circuits.find((c) => c.id === 'fridge')!] }
    const r = run(d, 3600, 0.1)
    expect(r.trips).toEqual([])
  })

  it('shed run: ~6% drop on 12 AWG, ~4% on 10 AWG, under 3% on 8 AWG', () => {
    const drop = (gauge: number): number => {
      let d = setLoads(shedHome(), 'shed', { table_saw: true })
      d = { ...d, circuits: d.circuits.map((c) => (c.id === 'shed' ? { ...c, gauge } : c)) }
      const { rt } = run(d, 5, 0.5)
      return rt.readings.shed.dropPct
    }
    expect(drop(12)).toBeGreaterThan(5)
    expect(drop(12)).toBeLessThan(7.5)
    expect(drop(10)).toBeGreaterThan(3)
    expect(drop(8)).toBeLessThan(3)
  })

  it('flags a breaker that is bigger than its wire', () => {
    const shed = { ...shedHome().circuits.find((c) => c.id === 'shed')!, amps: 30 }
    expect(circuitWarnings(shed, undefined, 0, GFCI_ROOMS, AFCI_ROOMS)[0].level).toBe('danger')
  })

  it('double-pole loads sit on both legs; neutral carries only the 120 V imbalance', () => {
    const d: HomeDesign = {
      ...blankHome(),
      circuits: [
        { id: 'a', name: 'a', room: 'Bedroom', slot: 1, poles: 1, amps: 15, type: 'standard', state: 'on', gauge: 14, lengthFt: 1, loads: [{ id: 'h', appliance: 'space_heater', on: true }] },
        { id: 'w', name: 'w', room: 'Utility', slot: 3, poles: 2, amps: 30, type: 'standard', state: 'on', gauge: 10, lengthFt: 1, loads: [{ id: 'd', appliance: 'dryer', on: true }] }
      ]
    }
    const { rt } = run(d, 1, 0.5)
    expect(rt.legs.A).toBeCloseTo(12.5 + 23.3, 0)
    expect(rt.legs.B).toBeCloseTo(23.3, 0)
    expect(rt.legs.N).toBeCloseTo(12.5, 0)
  })

  it('the main breaker trips when one leg is overloaded', () => {
    const d: HomeDesign = { ...blankHome(), mainAmps: 60, circuits: [] }
    for (let i = 0; i < 6; i++)
      d.circuits.push({ id: `h${i}`, name: `h${i}`, room: 'Bedroom', slot: i % 2 === 0 ? 1 + 4 * (i / 2) : 2 + 4 * ((i - 1) / 2), poles: 1, amps: 15, type: 'standard', state: 'on', gauge: 14, lengthFt: 1, loads: [{ id: `l${i}`, appliance: 'space_heater', on: true }] })
    expect(run(d, 600).trips.map((t) => t.id)).toContain('main')
  })

  it('service load calculation for the starter home fits its 200 A service', () => {
    const lc = serviceLoad(starterHome())
    expect(lc.amps).toBeGreaterThan(60)
    expect(lc.amps).toBeLessThan(200)
  })

  it('every example runs its first minute without tripping', () => {
    for (const ex of HOME_EXAMPLES) expect(run(ex.design, 60).trips, ex.id).toEqual([])
  })
})
