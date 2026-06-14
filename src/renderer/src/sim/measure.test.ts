import { describe, it, expect } from 'vitest'
import { wireCurrent, wireNetVoltage } from './measure'
import type { Wire } from './elements'
import type { SimulationResult } from '../stores/circuitStore'

const wire = (over: Partial<Wire>): Wire => ({
  id: 'w1',
  fromComponentId: 'R1',
  fromTerminal: 1,
  toComponentId: 'R2',
  toTerminal: 0,
  ...over
})

const sim = (over: Partial<SimulationResult>): SimulationResult => ({
  solved: true,
  nodeVoltages: {},
  elementCurrents: {},
  terminalNodes: {},
  warnings: [],
  ...over
})

describe('wireCurrent', () => {
  it('exits the from-component at terminal 1 with positive sign', () => {
    const s = sim({ elementCurrents: { R1: 0.004 } })
    expect(wireCurrent(wire({ fromTerminal: 1 }), s)).toBeCloseTo(0.004, 9)
  })

  it('flips sign when leaving the from-component at terminal 0', () => {
    const s = sim({ elementCurrents: { R1: 0.004 } })
    expect(wireCurrent(wire({ fromTerminal: 0 }), s)).toBeCloseTo(-0.004, 9)
  })

  it('falls back to the to-component when the from-component has no current', () => {
    const s = sim({ elementCurrents: { R2: 0.004 } })
    // to-component at terminal 0 → -(−I) = I... per convention: -(toTerminal===1?toI:-toI)
    expect(wireCurrent(wire({ fromComponentId: 'X', toComponentId: 'R2', toTerminal: 0 }), s)).toBeCloseTo(0.004, 9)
  })

  it('returns null when neither endpoint has a current', () => {
    expect(wireCurrent(wire({ fromComponentId: 'X', toComponentId: 'Y' }), sim({}))).toBeNull()
  })
})

describe('wireNetVoltage', () => {
  it('reads the node voltage at the from endpoint', () => {
    const s = sim({ terminalNodes: { 'R1:1': 'n2' }, nodeVoltages: { n2: 4 } })
    expect(wireNetVoltage(wire({ fromComponentId: 'R1', fromTerminal: 1 }), s)).toBe(4)
  })

  it('returns null for an unknown terminal/node', () => {
    expect(wireNetVoltage(wire({}), sim({}))).toBeNull()
  })
})
