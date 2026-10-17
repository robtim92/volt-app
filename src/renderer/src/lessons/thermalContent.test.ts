/**
 * Content integrity: no lesson circuit should burn a part out when opened in
 * the live simulator (lessons that teach failures opt in by setting ratings).
 */
import { describe, it, expect } from 'vitest'
import { ALL_LESSONS } from './index'
import type { CircuitPreset } from './types'
import { buildTransientNetlist } from '../sim/netlist'
import { TransientSimulator, suggestMaxStep } from '../sim/transient'
import { stepThermal } from '../sim/thermal'

function presetsOf(): { where: string; preset: CircuitPreset }[] {
  const out: { where: string; preset: CircuitPreset }[] = []
  for (const lesson of ALL_LESSONS) {
    lesson.cards.forEach((card, i) => {
      const c = card as unknown as { circuit?: CircuitPreset; starterCircuit?: CircuitPreset }
      if (c.circuit) out.push({ where: `${lesson.id}#${i}`, preset: c.circuit })
      if (c.starterCircuit) out.push({ where: `${lesson.id}#${i} starter`, preset: c.starterCircuit })
    })
  }
  return out
}

describe('lesson circuits survive the heat model', () => {
  for (const { where, preset } of presetsOf()) {
    it(where, () => {
      const built = buildTransientNetlist(preset.components, preset.wires)
      const sim = new TransientSimulator(built.netlist)
      if (sim.error) return // incomplete starter circuits are fine
      const maxStep = suggestMaxStep(built.netlist)
      let heat: Record<string, number> = {}
      const failures: string[] = []
      for (let k = 0; k < 100; k++) {
        const snap = sim.advance(0.05, maxStep, 100000)
        const r = stepThermal(preset.components, { ...snap, terminalNodes: built.terminalNodes }, heat, 0.05, preset.wires)
        heat = r.heat
        failures.push(...r.events.map((e) => e.message))
      }
      expect(failures).toEqual([])
    })
  }
})
