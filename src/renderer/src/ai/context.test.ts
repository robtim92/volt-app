import { describe, it, expect } from 'vitest'
import {
  fmtCurrent,
  buildCircuitSummary,
  buildLessonSummary,
  assembleSystemPrompt
} from './context'
import type { CircuitComponent, Wire } from '../sim/elements'
import type { SimulationResult } from '../stores/circuitStore'
import type { Lesson } from '../lessons/types'

function comp(p: Partial<CircuitComponent> & Pick<CircuitComponent, 'id' | 'type'>): CircuitComponent {
  return { x: 0, y: 0, rotation: 0, ...p }
}

const lesson = (id: string, title: string): Lesson => ({
  id, track: 'dc', module: 'Fundamentals', title, summary: '', estMinutes: 5, cards: []
})

describe('fmtCurrent', () => {
  it('scales to A / mA / µA', () => {
    expect(fmtCurrent(0)).toBe('0 A')
    expect(fmtCurrent(2)).toBe('2.00 A')
    expect(fmtCurrent(0.0179)).toContain('mA')
    expect(fmtCurrent(0.0000051)).toContain('µA')
  })
})

describe('buildCircuitSummary', () => {
  it('reports an empty canvas', () => {
    expect(buildCircuitSummary([], [], null)).toMatch(/empty/i)
  })

  it('lists components with values and measured current, plus sim state', () => {
    const components = [
      comp({ id: 'v1', type: 'voltage_source', value: 9, label: 'V1' }),
      comp({ id: 'r1', type: 'resistor', value: 470, label: 'R1' }),
      comp({ id: 'd1', type: 'led', label: 'D1' })
    ]
    const wires: Wire[] = [
      { id: 'w1', fromComponentId: 'v1', fromTerminal: 0, toComponentId: 'r1', toTerminal: 0 }
    ]
    const sim: SimulationResult = {
      solved: true,
      nodeVoltages: {},
      elementCurrents: { r1: 0.0179, d1: 0.0179 },
      terminalNodes: {},
      warnings: []
    }
    const out = buildCircuitSummary(components, wires, sim)
    expect(out).toContain('V1 [voltage_source] = 9V')
    expect(out).toContain('R1 [resistor] = 470Ω')
    expect(out).toMatch(/D1 \[led\].*mA/)
    expect(out).toContain('1 connection')
    expect(out).toMatch(/solved successfully/i)
  })

  it('flags an unsolved circuit', () => {
    const components = [comp({ id: 'r1', type: 'resistor', value: 100 })]
    const sim: SimulationResult = {
      solved: false, nodeVoltages: {}, elementCurrents: {}, terminalNodes: {}, warnings: ['open terminal']
    }
    const out = buildCircuitSummary(components, [], sim)
    expect(out).toMatch(/did not solve/i)
    expect(out).toContain('open terminal')
  })
})

describe('buildLessonSummary', () => {
  const lessons = [lesson('a', 'Ohm\'s Law'), lesson('b', 'Power')]
  it('names the active lesson and completion count', () => {
    const progress = { a: { lessonId: 'a', completed: true, lastQuizScore: 80 } }
    const out = buildLessonSummary(progress, lessons, 'a')
    expect(out).toContain('Ohm\'s Law')
    expect(out).toContain('80%')
    expect(out).toContain('1/2 lessons')
  })
  it('handles free sandbox (no active lesson)', () => {
    expect(buildLessonSummary({}, lessons, null)).toMatch(/free sandbox/i)
  })
})

describe('assembleSystemPrompt', () => {
  it('includes persona, circuit, and progress sections', () => {
    const out = assembleSystemPrompt({
      components: [comp({ id: 'r1', type: 'resistor', value: 100, label: 'R1' })],
      wires: [],
      sim: null,
      progress: {},
      lessons: [lesson('a', 'Ohm')],
      activeLessonId: null
    })
    expect(out).toContain('Volt AI')
    expect(out).toContain('--- CURRENT CIRCUIT ---')
    expect(out).toContain('--- LEARNER PROGRESS ---')
    expect(out).toContain('R1 [resistor]')
  })
})
