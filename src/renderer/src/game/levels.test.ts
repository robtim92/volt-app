/**
 * Every campaign level must be solvable: play its reference solution through
 * the live simulator + heat model + level runner and require 3 stars.
 */
import { describe, it, expect } from 'vitest'
import { ALL_LEVELS } from './levels'
import { newProgress, stepLevel, goalMet } from './goals'
import { buildTransientNetlist } from '../sim/netlist'
import { TransientSimulator, suggestMaxStep } from '../sim/transient'
import { stepThermal } from '../sim/thermal'
import type { CircuitComponent, Wire } from '../sim/elements'
import type { Level } from './types'
import { rankFor, xpGain } from './progression'
import { newRuntime, stepHome } from '../home/homeSim'
import type { HomeDesign } from '../home/types'
import { chapterUnlocked, isLevelUnlocked } from '../stores/gameStore'
import { CHAPTERS } from './levels'

function play(level: Level, components: CircuitComponent[], wires: Wire[], seconds: number, actions: { at: number; toggle: string }[] = [], prediction: number | null = null) {
  let comps = components
  let built = buildTransientNetlist(comps, wires)
  let sim = new TransientSimulator(built.netlist)
  let heat: Record<string, number> = {}
  let progress = newProgress(level)
  const frame = 1 / 60
  const pending = [...actions]
  for (let t = 0; t < seconds && !progress.completed; t += frame) {
    let changed = false
    while (pending.length && pending[0].at <= t) {
      const a = pending.shift()!
      comps = comps.map((c) => (c.id === a.toggle ? { ...c, closed: !c.closed } : c))
      changed = true
    }
    if (changed) {
      built = buildTransientNetlist(comps, wires)
      sim = new TransientSimulator(built.netlist, sim.state)
    }
    const snap = sim.advance(frame, suggestMaxStep(built.netlist), 100000)
    const readings = { ...snap, terminalNodes: built.terminalNodes }
    const th = stepThermal(comps, readings, heat, frame, wires)
    heat = th.heat
    if (th.events.length) {
      comps = comps.map((c) => (th.events.some((e) => e.componentId === c.id) ? { ...c, damaged: true } : c))
      wires = wires.map((w) => (th.events.some((e) => e.componentId === w.id) ? { ...w, damaged: true } : w))
      built = buildTransientNetlist(comps, wires)
      sim = new TransientSimulator(built.netlist, sim.state)
    }
    const supplyMode = Object.fromEntries(comps.filter((c) => c.type === 'bench_supply').map((c) => [c.id, sim.supplyMode(c.id)]))
    progress = stepLevel(level, progress, comps, snap.solved ? readings : null, frame, th.events.length, { wires, supplyMode, prediction })
  }
  return progress
}

/** Run a Home Power level in house time, counting trips as burnouts. */
function playHome(level: Level, design: HomeDesign, seconds: number, frame = 1) {
  let d = structuredClone(design)
  let rt = newRuntime()
  let progress = newProgress(level)
  for (let t = 0; t < seconds && !progress.completed; t += frame) {
    const r = stepHome(d, rt, frame)
    rt = r.runtime
    for (const tr of r.trips) d = tr.id === 'main' ? { ...d, mainState: 'tripped' } : { ...d, circuits: d.circuits.map((c) => (c.id === tr.id ? { ...c, state: 'tripped' } : c)) }
    progress = stepLevel(level, progress, [], null, frame, r.trips.length, { home: { design: d, runtime: rt } })
  }
  return progress
}

/** Starter + reference solution, with patches and removals applied. */
function solved(level: Level): { comps: CircuitComponent[]; wires: Wire[] } {
  const sol = level.solution
  const comps = [...level.starter.components.map((c) => ({ ...c, ...(sol.componentPatches?.[c.id] ?? {}) })), ...sol.components]
  const wires = [
    ...level.starter.wires.filter((w) => !sol.removeWires?.includes(w.id)).map((w) => ({ ...w, ...(sol.wirePatches?.[w.id] ?? {}) })),
    ...sol.wires
  ]
  return { comps, wires }
}

describe('campaign levels', () => {
  for (const level of ALL_LEVELS.filter((l) => l.home)) {
    describe(`${level.title} (home)`, () => {
      const hold = level.holdSeconds ?? 0.5
      it('is not already solved by the starter', () => {
        expect(playHome(level, level.home!.starter(), hold + 120).completed).toBe(false)
      })
      it('is solved with three stars by its reference solution', () => {
        const p = playHome(level, level.home!.solve(level.home!.starter()), hold + 120)
        expect(p.goals).toEqual(level.goals.map(() => true))
        expect(p.completed).toBe(true)
        expect(p.starChecks).toEqual([true, true])
      })
    })
  }

  for (const level of ALL_LEVELS.filter((l) => !l.home)) {
    describe(level.title, () => {
      const starter = level.starter
      it('is not already solved by the starter circuit', () => {
        const p = play(level, starter.components, starter.wires, 2)
        expect(p.completed).toBe(false)
      })
      it('is solved with three stars by its reference solution', () => {
        const { comps, wires } = solved(level)
        const p = play(level, comps, wires, 6, level.solution.actions, level.solution.prediction ?? null)
        expect(p.completed).toBe(true)
        expect(p.stars).toBe(3)
      })
      it('has unique wire/component ids and hints', () => {
        const ids = [...starter.components, ...level.solution.components].map((x) => x.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(level.hints.length).toBeGreaterThanOrEqual(2)
      })
    })
  }

  it('Magic Smoke: an LED straight across the battery burns out and fails the clean-run star', () => {
    const level = ALL_LEVELS.find((l) => l.id === 'c1-l2')!
    const bad = play(level, level.starter.components, [...level.starter.wires, { id: 'x', fromComponentId: 'V1', fromTerminal: 0, toComponentId: 'LED1', toTerminal: 0 }], 2)
    expect(bad.burnouts).toBe(1)
    expect(bad.completed).toBe(false)
  })

  it('Afterglow: a small capacitor fades too fast to win', () => {
    const level = ALL_LEVELS.find((l) => l.id === 'c1-l5')!
    const comps = [...level.starter.components, { ...level.solution.components[0], value: 100e-6 }]
    const p = play(level, comps, [...level.starter.wires, ...level.solution.wires], 5, level.solution.actions)
    expect(p.completed).toBe(false)
  })

  it('switch_open goal works without readings', () => {
    expect(goalMet({ kind: 'switch_open', label: '' }, [{ id: 's', type: 'switch', x: 0, y: 0, rotation: 0, closed: false }], null)).toBe(true)
  })
})

describe('chapter unlocking', () => {
  const c2 = CHAPTERS.find((c) => c.id === 'c2')!
  it('opens Chapter 2 only after enough Chapter 1 stars', () => {
    expect(chapterUnlocked(c2, {})).toBe(false)
    const few = { 'c1-l1': { stars: 3, completedAt: 0 }, 'c1-l2': { stars: 3, completedAt: 0 } }
    expect(chapterUnlocked(c2, few)).toBe(false)
    const enough = { ...few, 'c1-l3': { stars: 2, completedAt: 0 } }
    expect(chapterUnlocked(c2, enough)).toBe(true)
    expect(isLevelUnlocked('c2-l1', enough)).toBe(true)
    expect(isLevelUnlocked('c2-l2', enough)).toBe(false)
  })
  it('jump ahead and unlock-all open chapters', () => {
    expect(chapterUnlocked(c2, {}, { jumped: ['c2'] })).toBe(true)
    expect(isLevelUnlocked('c5-l3', {}, { unlockAll: true })).toBe(true)
  })
  it('a Predict mission misses its star without a good prediction', () => {
    const level = ALL_LEVELS.find((l) => l.id === 'c2-l1')!
    const { comps, wires } = solved(level)
    expect(play(level, comps, wires, 6, [], null).starChecks[0]).toBe(false)
    expect(play(level, comps, wires, 6, [], 6).starChecks[0]).toBe(false)
    expect(play(level, comps, wires, 6, [], 8.5).starChecks[0]).toBe(true)
  })
  it('Melted!: replacing the wires at 22 AWG melts them again', () => {
    const level = ALL_LEVELS.find((l) => l.id === 'c2-l3')!
    const wires = level.starter.wires.map((w) => ({ ...w, damaged: false }))
    const p = play(level, level.starter.components, wires, 4)
    expect(p.burnouts).toBeGreaterThan(0)
    expect(p.completed).toBe(false)
  })
})

describe('progression', () => {
  it('pays only for improvements', () => {
    expect(xpGain(100, 0, 1)).toBe(100)
    expect(xpGain(100, 1, 3)).toBe(100)
    expect(xpGain(100, 3, 2)).toBe(0)
  })
  it('ranks up', () => {
    expect(rankFor(0).rank.title).toBe('Apprentice')
    expect(rankFor(260).rank.title).toBe('Tinkerer')
    expect(rankFor(260).progress).toBeGreaterThan(0)
  })
})
