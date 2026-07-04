import { describe, it, expect } from 'vitest'
import { instantaneous, periodSeconds, sampleWave } from './waveform'

const OMEGA = 1000

describe('instantaneous', () => {
  it('equals peak·cos(phase) at t=0', () => {
    expect(instantaneous(5, 0, OMEGA, 0)).toBeCloseTo(5, 9) // cos(0)=1
    expect(instantaneous(5, 90, OMEGA, 0)).toBeCloseTo(0, 9) // cos(90°)=0
    expect(instantaneous(5, 180, OMEGA, 0)).toBeCloseTo(-5, 9)
  })

  it('is periodic with period 2π/ω', () => {
    const T = periodSeconds(OMEGA)
    const a = instantaneous(3, 37, OMEGA, 0.0007)
    const b = instantaneous(3, 37, OMEGA, 0.0007 + T)
    expect(b).toBeCloseTo(a, 9)
  })

  it('reaches its peak somewhere in a cycle', () => {
    const T = periodSeconds(OMEGA)
    let max = -Infinity
    for (let i = 0; i <= 1000; i++) max = Math.max(max, instantaneous(2, 0, OMEGA, (T * i) / 1000))
    expect(max).toBeCloseTo(2, 3)
  })
})

describe('periodSeconds', () => {
  it('is 2π/ω', () => {
    expect(periodSeconds(OMEGA)).toBeCloseTo((2 * Math.PI) / 1000, 12)
  })
})

describe('sampleWave', () => {
  it('returns samples+1 inclusive points over the requested span', () => {
    const { t, v } = sampleWave(1, 0, OMEGA, 2, 100)
    expect(t).toHaveLength(101)
    expect(v).toHaveLength(101)
    expect(t[0]).toBe(0)
    expect(t[t.length - 1]).toBeCloseTo(periodSeconds(OMEGA) * 2, 12)
  })

  it('never exceeds the peak magnitude', () => {
    const { v } = sampleWave(4, 63, OMEGA, 2, 500)
    expect(Math.max(...v.map(Math.abs))).toBeLessThanOrEqual(4 + 1e-9)
  })
})
