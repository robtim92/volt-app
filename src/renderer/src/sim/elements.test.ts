import { describe, it, expect } from 'vitest'
import {
  ELEMENTS,
  GRID,
  formatValue,
  nextLabel,
  parseValue,
  rotatePoint,
  snapToGrid,
  terminalPosition,
  type CircuitComponent
} from './elements'

describe('formatValue', () => {
  it('uses engineering suffixes', () => {
    expect(formatValue(4700, 'Ω')).toBe('4.7k Ω')
    expect(formatValue(1000000)).toBe('1M')
    expect(formatValue(0.01, 'A')).toBe('10m A')
    expect(formatValue(0.0000047, 'F')).toBe('4.7µ F')
    expect(formatValue(5, 'V')).toBe('5 V')
    expect(formatValue(0, 'V')).toBe('0 V')
  })

  it('handles negatives', () => {
    expect(formatValue(-0.005, 'A')).toBe('-5m A')
  })
})

describe('parseValue', () => {
  it('parses plain numbers and suffixes', () => {
    expect(parseValue('100')).toBe(100)
    expect(parseValue('4.7k')).toBeCloseTo(4700)
    expect(parseValue('10m')).toBeCloseTo(0.01)
    expect(parseValue('10u')).toBeCloseTo(1e-5)
    expect(parseValue('2.2M')).toBeCloseTo(2.2e6)
    expect(parseValue(' 5 ')).toBe(5)
  })

  it('rejects garbage', () => {
    expect(parseValue('abc')).toBeNull()
    expect(parseValue('')).toBeNull()
  })
})

describe('geometry', () => {
  it('rotates points in 90° steps', () => {
    expect(rotatePoint(10, 0, 0)).toEqual({ x: 10, y: 0 })
    expect(rotatePoint(10, 0, 90)).toEqual({ x: -0, y: 10 })
    expect(rotatePoint(10, 0, 180)).toEqual({ x: -10, y: -0 })
    expect(rotatePoint(10, 0, 270)).toEqual({ x: 0, y: -10 })
  })

  it('terminal positions follow component rotation', () => {
    const comp: CircuitComponent = {
      id: 'r1', type: 'resistor', x: 100, y: 100, rotation: 90
    }
    // unrotated terminal 0 at (-40, 0) → rotated 90° → (0, -40)... wait: (x,y)=(-40,0) → 90° → (-0·? )
    const p = terminalPosition(comp, 0)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(100 - 2 * GRID)
  })

  it('snaps to the grid', () => {
    expect(snapToGrid(33)).toBe(40)
    expect(snapToGrid(9)).toBe(0)
  })
})

describe('registry', () => {
  it('every element has at least one terminal and a display name', () => {
    for (const def of Object.values(ELEMENTS)) {
      expect(def.terminals.length).toBeGreaterThan(0)
      expect(def.displayName.length).toBeGreaterThan(0)
    }
  })

  it('generates sequential labels per type', () => {
    const existing: CircuitComponent[] = [
      { id: 'a', type: 'resistor', x: 0, y: 0, rotation: 0, label: 'R1' },
      { id: 'b', type: 'resistor', x: 0, y: 0, rotation: 0, label: 'R2' }
    ]
    expect(nextLabel('resistor', existing)).toBe('R3')
    expect(nextLabel('voltage_source', existing)).toBe('V1')
  })
})
