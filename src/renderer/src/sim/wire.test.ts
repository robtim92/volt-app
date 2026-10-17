import { describe, it, expect } from 'vitest'
import { ohmsPerMetre, diameterMm, ampacity, driftVelocity, drawnLength } from './wire'

// Published copper resistance (mΩ/m at 20 °C) and diameters (mm)
const PUBLISHED: [number, number, number][] = [
  [10, 3.277, 2.588],
  [12, 5.211, 2.053],
  [14, 8.286, 1.628],
  [18, 20.95, 1.024],
  [22, 52.96, 0.644],
  [24, 84.22, 0.511],
  [30, 338.6, 0.255]
]

describe('wire gauge model', () => {
  for (const [awg, mohm, d] of PUBLISHED) {
    it(`${awg} AWG matches published resistance and diameter within 2%`, () => {
      expect(Math.abs(ohmsPerMetre(awg) * 1000 - mohm) / mohm).toBeLessThan(0.02)
      expect(Math.abs(diameterMm(awg) - d) / d).toBeLessThan(0.02)
    })
  }
  it('uses common building-wire ratings', () => {
    expect(ampacity(14)).toBe(15)
    expect(ampacity(12)).toBe(20)
    expect(ampacity(10)).toBe(30)
    expect(ampacity(22)).toBe(3)
  })
  it('thinner wire means faster electron drift for the same current', () => {
    expect(driftVelocity(1, 30)).toBeGreaterThan(driftVelocity(1, 12) * 10)
    // 1 A in 22 AWG drifts at roughly 0.2 mm/s
    expect(driftVelocity(1, 22)).toBeGreaterThan(1e-4)
    expect(driftVelocity(1, 22)).toBeLessThan(4e-4)
  })
  it('one grid square of drawing is 1 cm of wire', () => {
    expect(drawnLength(0, 0, 200, 0)).toBeCloseTo(0.1, 6)
  })
})
