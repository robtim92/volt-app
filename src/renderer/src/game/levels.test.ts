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

function play(level: Level, components: CircuitComponent[], wires: Wire[], seconds: number, actions: { at: number; toggle: string }[] = []) {
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
    const th = stepThermal(comps, readings, heat, frame)
    heat = th.heat
    if (th.events.length) {
      comps = comps.map((c) => (th.events.some((e) => e.componentId === c.id) ? { ...c, damaged: true } : c))
      built = buildTransientNetlist(comps, wires)
      sim = new TransientSimulator(built.netlist, sim.state)
    }
    progress = stepLevel(level, progress, comps, snap.solved ? readings : null, frame, th.events.length)
  }
  return progress
}

describe('campaign levels', () => {
  for (const level of ALL_LEVELS) {
    describe(level.title, () => {
      const starter = level.starter
      it('is not already solved by the starter circuit', () => {
        const p = play(level, starter.components, starter.wires, 2)
        expect(p.completed).toBe(false)
      })
      it('is solved with three stars by its reference solution', () => {
        const comps = [...starter.components, ...level.solution.components]
        const wires = [...starter.wires, ...level.solution.wires]
        const p = play(level, comps, wires, 6, level.solution.actions)
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
