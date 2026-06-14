import { describe, it, expect } from 'vitest'
import { solveAC, rms, type ACNetlistElement } from './acSolver'
import { abs, phaseDeg } from './complex'

const R = (id: string, value: number, a: string, b: string): ACNetlistElement => ({ id, type: 'resistor', value, nodes: [a, b] })
const L = (id: string, value: number, a: string, b: string): ACNetlistElement => ({ id, type: 'inductor', value, nodes: [a, b] })
const C = (id: string, value: number, a: string, b: string): ACNetlistElement => ({ id, type: 'capacitor', value, nodes: [a, b] })
const Vac = (id: string, amplitude: number, a: string, b: string, phaseDegree = 0): ACNetlistElement => ({
  id, type: 'ac_voltage_source', value: 0, amplitude, phaseDeg: phaseDegree, nodes: [a, b]
})

describe('solveAC — RC low-pass filter', () => {
  // Vsrc — R — out — C — gnd.  R=1k, C=1µF → ωc = 1/RC = 1000 rad/s
  const net = { elements: [Vac('V1', 1, 'in', 'gnd'), R('R1', 1000, 'in', 'out'), C('C1', 1e-6, 'out', 'gnd')] }

  it('is -3 dB (|H|=1/√2) and -45° at the cutoff frequency', () => {
    const r = solveAC(net, 1000)
    expect(r.solved).toBe(true)
    expect(abs(r.nodeVoltages['out'])).toBeCloseTo(Math.SQRT1_2, 4) // 0.70711
    expect(phaseDeg(r.nodeVoltages['out'])).toBeCloseTo(-45, 3)
  })

  it('passes low frequencies nearly unattenuated', () => {
    const r = solveAC(net, 10) // well below cutoff
    expect(abs(r.nodeVoltages['out'])).toBeGreaterThan(0.99)
    expect(phaseDeg(r.nodeVoltages['out'])).toBeGreaterThan(-10)
  })

  it('attenuates high frequencies', () => {
    const r = solveAC(net, 100000) // well above cutoff
    expect(abs(r.nodeVoltages['out'])).toBeLessThan(0.02)
  })
})

describe('solveAC — reactive element phase relationships', () => {
  it('capacitor current leads its voltage by 90°', () => {
    const r = solveAC({ elements: [Vac('V1', 1, 'a', 'gnd'), C('C1', 1e-6, 'a', 'gnd')] }, 1000)
    const ic = r.elementCurrents['C1']
    expect(abs(ic)).toBeCloseTo(1000 * 1e-6, 9) // ωC = 1e-3
    expect(phaseDeg(ic)).toBeCloseTo(90, 6)
  })

  it('inductor current lags its voltage by 90°', () => {
    const r = solveAC({ elements: [Vac('V1', 1, 'a', 'gnd'), L('L1', 1, 'a', 'gnd')] }, 1000)
    const il = r.elementCurrents['L1']
    expect(abs(il)).toBeCloseTo(1 / (1000 * 1), 9) // 1/(ωL) = 1e-3
    expect(phaseDeg(il)).toBeCloseTo(-90, 6)
  })
})

describe('solveAC — series RL', () => {
  // R = ωL → current phase = -45°.  ω=1000, L=1H → ωL=1000, R=1000
  it('current lags by 45° when R = ωL', () => {
    const net = { elements: [Vac('V1', 1, 'in', 'gnd'), R('R1', 1000, 'in', 'm'), L('L1', 1, 'm', 'gnd')] }
    const r = solveAC(net, 1000)
    const ir = r.elementCurrents['R1']
    expect(abs(ir)).toBeCloseTo(1 / Math.hypot(1000, 1000), 9) // |I| = V/√(R²+(ωL)²)
    expect(phaseDeg(ir)).toBeCloseTo(-45, 3)
  })
})

describe('solveAC — series RLC resonance', () => {
  // L=1mH, C=1µF → ω0 = 1/√(LC) = 31622.78 rad/s; R=10
  const L0 = 1e-3, C0 = 1e-6, R0 = 10
  const omega0 = 1 / Math.sqrt(L0 * C0)
  const net = {
    elements: [Vac('V1', 1, 'in', 'gnd'), R('R1', R0, 'in', 'a'), L('L1', L0, 'a', 'b'), C('C1', C0, 'b', 'gnd')]
  }

  it('at resonance the current is in phase and equals V/R', () => {
    const r = solveAC(net, omega0)
    const ir = r.elementCurrents['R1']
    expect(abs(ir)).toBeCloseTo(1 / R0, 6) // 0.1 A
    expect(phaseDeg(ir)).toBeCloseTo(0, 3)
  })

  it('shows voltage magnification across the capacitor (Q ≈ 3.16)', () => {
    const r = solveAC(net, omega0)
    const Q = (1 / R0) * Math.sqrt(L0 / C0)
    expect(abs(r.nodeVoltages['b'])).toBeCloseTo(Q, 4)
  })
})

describe('solveAC — basics and errors', () => {
  it('resistive divider is frequency-independent and in phase', () => {
    const net = { elements: [Vac('V1', 1, 'in', 'gnd'), R('R1', 1000, 'in', 'out'), R('R2', 1000, 'out', 'gnd')] }
    const r = solveAC(net, 500)
    expect(abs(r.nodeVoltages['out'])).toBeCloseTo(0.5, 9)
    expect(phaseDeg(r.nodeVoltages['out'])).toBeCloseTo(0, 9)
  })

  it('rms() converts peak phasor to RMS', () => {
    const r = solveAC({ elements: [Vac('V1', 1, 'a', 'gnd'), R('R1', 1000, 'a', 'gnd')] }, 1000)
    expect(rms(r.nodeVoltages['a'])).toBeCloseTo(Math.SQRT1_2, 9) // 1/√2
  })

  it('rejects a non-positive frequency', () => {
    const r = solveAC({ elements: [Vac('V1', 1, 'a', 'gnd'), R('R1', 1, 'a', 'gnd')] }, 0)
    expect(r.solved).toBe(false)
    expect(r.error).toMatch(/frequency/i)
  })

  it('requires a ground reference', () => {
    const r = solveAC({ elements: [Vac('V1', 1, 'a', 'b'), R('R1', 1, 'a', 'b')] }, 1000)
    expect(r.solved).toBe(false)
    expect(r.error).toMatch(/ground/i)
  })
})
