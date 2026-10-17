import { describe, it, expect } from 'vitest'
import { resistorBands, BAND_COLORS, GOLD, toWorld, toWorldRotation, circuitBounds, terminalWorld } from './benchMath'

describe('resistorBands', () => {
  it('encodes 4.7 kΩ as yellow-violet-red-gold', () => {
    expect(resistorBands(4700).colors).toEqual([BAND_COLORS[4], BAND_COLORS[7], BAND_COLORS[2], GOLD])
  })
  it('encodes 220 Ω, 1 kΩ, 10 Ω and 1 MΩ', () => {
    expect(resistorBands(220).colors.slice(0, 3)).toEqual([BAND_COLORS[2], BAND_COLORS[2], BAND_COLORS[1]])
    expect(resistorBands(1000).colors.slice(0, 3)).toEqual([BAND_COLORS[1], BAND_COLORS[0], BAND_COLORS[2]])
    expect(resistorBands(10).colors.slice(0, 3)).toEqual([BAND_COLORS[1], BAND_COLORS[0], BAND_COLORS[0]])
    expect(resistorBands(1e6).colors.slice(0, 3)).toEqual([BAND_COLORS[1], BAND_COLORS[0], BAND_COLORS[5]])
  })
  it('uses a gold multiplier below 10 Ω', () => {
    expect(resistorBands(4.7).colors.slice(0, 3)).toEqual([BAND_COLORS[4], BAND_COLORS[7], GOLD])
  })
  it('rounds to two significant digits', () => {
    expect(resistorBands(996).digits).toEqual([1, 0])
    expect(resistorBands(996).exponent).toBe(2)
  })
})

describe('bench mapping', () => {
  it('maps two grid squares to one world unit', () => {
    expect(toWorld(40, 80)).toEqual([1, expect.any(Number), 2])
  })
  it('puts a rotated resistor\'s terminals where the schematic has them', () => {
    const r = { id: 'r', type: 'resistor' as const, x: 200, y: 200, rotation: 90 }
    const [x0, , z0] = terminalWorld(r, 0)
    const [x1, , z1] = terminalWorld(r, 1)
    expect(x0).toBeCloseTo(x1)
    expect(Math.abs(z1 - z0)).toBeCloseTo(2)
    // three.js y-rotation of -90° sends local +x to world +z
    const th = toWorldRotation(90)
    expect(-Math.sin(th)).toBeCloseTo(1)
  })
  it('frames the circuit', () => {
    const b = circuitBounds([
      { id: 'a', type: 'resistor', x: 0, y: 0, rotation: 0 },
      { id: 'b', type: 'resistor', x: 400, y: 0, rotation: 0 }
    ])
    expect(b.center[0]).toBeCloseTo(5)
    expect(b.size).toBeGreaterThanOrEqual(12)
  })
})
