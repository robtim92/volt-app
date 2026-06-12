import { describe, it, expect, beforeEach } from 'vitest'
import {
  deleteCircuit,
  exportCircuitJSON,
  importCircuitJSON,
  listCircuits,
  loadCircuit,
  saveCircuit,
  validateCircuitFile
} from './circuitFiles'
import type { CircuitComponent, Wire } from '../sim/elements'

const sampleComponents: CircuitComponent[] = [
  { id: 'v1', type: 'voltage_source', x: 100, y: 100, rotation: 0, value: 5, label: 'V1' },
  { id: 'r1', type: 'resistor', x: 200, y: 100, rotation: 0, value: 1000, label: 'R1' },
  { id: 'g1', type: 'ground', x: 100, y: 200, rotation: 0 }
]
const sampleWires: Wire[] = [
  { id: 'w1', fromComponentId: 'v1', fromTerminal: 0, toComponentId: 'r1', toTerminal: 0 },
  { id: 'w2', fromComponentId: 'r1', fromTerminal: 1, toComponentId: 'v1', toTerminal: 1 },
  { id: 'w3', fromComponentId: 'v1', fromTerminal: 1, toComponentId: 'g1', toTerminal: 0 }
]

beforeEach(() => {
  localStorage.clear()
})

describe('save / load / list / delete', () => {
  it('round-trips a circuit', () => {
    saveCircuit('My divider', sampleComponents, sampleWires)
    const loaded = loadCircuit('My divider')
    expect(loaded).not.toBeNull()
    expect(loaded!.components).toHaveLength(3)
    expect(loaded!.wires).toHaveLength(3)
  })

  it('lists saved circuits with summaries', () => {
    saveCircuit('A', sampleComponents, sampleWires)
    saveCircuit('B', sampleComponents.slice(0, 2), [])
    const list = listCircuits()
    expect(list).toHaveLength(2)
    expect(list.map((s) => s.name).sort()).toEqual(['A', 'B'])
    expect(list.find((s) => s.name === 'B')!.componentCount).toBe(2)
  })

  it('overwrites on same name and deletes', () => {
    saveCircuit('X', sampleComponents, sampleWires)
    saveCircuit('X', sampleComponents.slice(0, 1), [])
    expect(listCircuits()).toHaveLength(1)
    expect(loadCircuit('X')!.components).toHaveLength(1)
    deleteCircuit('X')
    expect(loadCircuit('X')).toBeNull()
    expect(listCircuits()).toHaveLength(0)
  })
})

describe('export / import / validation', () => {
  it('round-trips through JSON', () => {
    const json = exportCircuitJSON('Exported', sampleComponents, sampleWires)
    const imported = importCircuitJSON(json)
    expect('error' in imported).toBe(false)
    if (!('error' in imported)) {
      expect(imported.components).toHaveLength(3)
      expect(imported.wires).toHaveLength(3)
    }
  })

  it('rejects invalid JSON and bad schemas', () => {
    expect(importCircuitJSON('not json at all')).toHaveProperty('error')
    expect(importCircuitJSON('{"version": 99}')).toHaveProperty('error')
    expect(
      importCircuitJSON(
        JSON.stringify({
          version: 1,
          components: [{ id: 'x', type: 'flux_capacitor', x: 0, y: 0 }],
          wires: []
        })
      )
    ).toHaveProperty('error')
  })

  it('rejects wires that reference missing components', () => {
    const err = validateCircuitFile({
      version: 1,
      components: sampleComponents,
      wires: [{ id: 'w', fromComponentId: 'nope', fromTerminal: 0, toComponentId: 'r1', toTerminal: 0 }]
    })
    expect(err).toMatch(/missing component/)
  })
})
