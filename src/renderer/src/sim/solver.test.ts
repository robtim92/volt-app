/**
 * MNA solver tests.
 *
 * Expected values are hand-calculated and cross-checked against ngspice
 * (SPICE conventions: voltage source current is negative when sourcing power).
 */
import { describe, it, expect } from 'vitest'
import { solveDC, solveLinearSystem, GROUND, type Netlist } from './solver'

const close = (actual: number, expected: number, digits = 9): void =>
  expect(actual).toBeCloseTo(expected, digits)

describe('solveLinearSystem', () => {
  it('solves a simple 2x2 system', () => {
    // 2x + y = 5 ; x - y = 1  →  x = 2, y = 1
    const x = solveLinearSystem(
      [
        [2, 1],
        [1, -1]
      ],
      [5, 1]
    )
    expect(x).not.toBeNull()
    close(x![0], 2)
    close(x![1], 1)
  })

  it('requires pivoting when a diagonal entry is zero', () => {
    // 0x + y = 3 ; 2x + y = 7  →  x = 2, y = 3
    const x = solveLinearSystem(
      [
        [0, 1],
        [2, 1]
      ],
      [3, 7]
    )
    expect(x).not.toBeNull()
    close(x![0], 2)
    close(x![1], 3)
  })

  it('returns null for a singular matrix', () => {
    const x = solveLinearSystem(
      [
        [1, 2],
        [2, 4]
      ],
      [3, 6]
    )
    expect(x).toBeNull()
  })
})

describe('solveDC — basic circuits', () => {
  it('solves a voltage divider (10V, 1kΩ + 2kΩ)', () => {
    // SPICE: V(mid) = 6.6667V, I = 3.3333mA
    const netlist: Netlist = {
      elements: [
        { id: 'V1', type: 'voltage_source', value: 10, nodes: ['vcc', GROUND] },
        { id: 'R1', type: 'resistor', value: 1000, nodes: ['vcc', 'mid'] },
        { id: 'R2', type: 'resistor', value: 2000, nodes: ['mid', GROUND] }
      ]
    }
    const r = solveDC(netlist)
    expect(r.solved).toBe(true)
    close(r.nodeVoltages['vcc'], 10)
    close(r.nodeVoltages['mid'], 10 * (2000 / 3000), 6)
    close(r.nodeVoltages[GROUND], 0)
    close(r.elementCurrents['R1'], 10 / 3000, 9)
    close(r.elementCurrents['R2'], 10 / 3000, 9)
    // SPICE convention: source current is negative when delivering power
    close(r.elementCurrents['V1'], -10 / 3000, 9)
  })

  it('solves parallel resistors (12V across 1kΩ ∥ 3kΩ)', () => {
    // Req = 750Ω → total I = 16mA; I(R1) = 12mA, I(R2) = 4mA
    const netlist: Netlist = {
      elements: [
        { id: 'V1', type: 'voltage_source', value: 12, nodes: ['a', GROUND] },
        { id: 'R1', type: 'resistor', value: 1000, nodes: ['a', GROUND] },
        { id: 'R2', type: 'resistor', value: 3000, nodes: ['a', GROUND] }
      ]
    }
    const r = solveDC(netlist)
    expect(r.solved).toBe(true)
    close(r.nodeVoltages['a'], 12)
    close(r.elementCurrents['R1'], 0.012)
    close(r.elementCurrents['R2'], 0.004)
    close(r.elementCurrents['V1'], -0.016)
  })

  it('solves a current source into a resistor (1mA into 4.7kΩ)', () => {
    const netlist: Netlist = {
      elements: [
        { id: 'I1', type: 'current_source', value: 0.001, nodes: ['out', GROUND] },
        { id: 'R1', type: 'resistor', value: 4700, nodes: ['out', GROUND] }
      ]
    }
    const r = solveDC(netlist)
    expect(r.solved).toBe(true)
    close(r.nodeVoltages['out'], 4.7)
    close(r.elementCurrents['R1'], 0.001)
  })

  it('solves a series-parallel combination', () => {
    // 9V — R1(1k) — node m — [R2(2k) ∥ R3(2k)] — gnd
    // Req = 1k + 1k = 2k → I = 4.5mA, V(m) = 4.5V, I(R2) = I(R3) = 2.25mA
    const netlist: Netlist = {
      elements: [
        { id: 'V1', type: 'voltage_source', value: 9, nodes: ['vcc', GROUND] },
        { id: 'R1', type: 'resistor', value: 1000, nodes: ['vcc', 'm'] },
        { id: 'R2', type: 'resistor', value: 2000, nodes: ['m', GROUND] },
        { id: 'R3', type: 'resistor', value: 2000, nodes: ['m', GROUND] }
      ]
    }
    const r = solveDC(netlist)
    expect(r.solved).toBe(true)
    close(r.nodeVoltages['m'], 4.5)
    close(r.elementCurrents['R1'], 0.0045)
    close(r.elementCurrents['R2'], 0.00225)
    close(r.elementCurrents['R3'], 0.00225)
  })

  it('solves a balanced Wheatstone bridge (no current through the bridge)', () => {
    // All arms 1kΩ, 10V source. V(left) = V(right) = 5V → bridge current = 0
    const netlist: Netlist = {
      elements: [
        { id: 'V1', type: 'voltage_source', value: 10, nodes: ['top', GROUND] },
        { id: 'R1', type: 'resistor', value: 1000, nodes: ['top', 'left'] },
        { id: 'R2', type: 'resistor', value: 1000, nodes: ['top', 'right'] },
        { id: 'R3', type: 'resistor', value: 1000, nodes: ['left', GROUND] },
        { id: 'R4', type: 'resistor', value: 1000, nodes: ['right', GROUND] },
        { id: 'Rb', type: 'resistor', value: 5000, nodes: ['left', 'right'] }
      ]
    }
    const r = solveDC(netlist)
    expect(r.solved).toBe(true)
    close(r.nodeVoltages['left'], 5)
    close(r.nodeVoltages['right'], 5)
    close(r.elementCurrents['Rb'], 0)
  })

  it('solves a two-voltage-source mesh (superposition check)', () => {
    // V1(10V) — R1(1k) — m — R2(2k) — V2(5V), R3(1k) from m to gnd
    // Nodal at m: (10-Vm)/1k + (5-Vm)/2k = Vm/1k → Vm = 5V
    const netlist: Netlist = {
      elements: [
        { id: 'V1', type: 'voltage_source', value: 10, nodes: ['a', GROUND] },
        { id: 'R1', type: 'resistor', value: 1000, nodes: ['a', 'm'] },
        { id: 'V2', type: 'voltage_source', value: 5, nodes: ['b', GROUND] },
        { id: 'R2', type: 'resistor', value: 2000, nodes: ['b', 'm'] },
        { id: 'R3', type: 'resistor', value: 1000, nodes: ['m', GROUND] }
      ]
    }
    const r = solveDC(netlist)
    expect(r.solved).toBe(true)
    close(r.nodeVoltages['m'], 5, 6)
    close(r.elementCurrents['R1'], 0.005) // (10-5)/1k
    close(r.elementCurrents['R2'], 0)     // (5-5)/2k
    close(r.elementCurrents['R3'], 0.005)
  })
})

describe('solveDC — error handling', () => {
  it('rejects an empty circuit', () => {
    const r = solveDC({ elements: [] })
    expect(r.solved).toBe(false)
    expect(r.error).toMatch(/empty/i)
  })

  it('rejects a circuit with no ground', () => {
    const netlist: Netlist = {
      elements: [
        { id: 'V1', type: 'voltage_source', value: 5, nodes: ['a', 'b'] },
        { id: 'R1', type: 'resistor', value: 100, nodes: ['a', 'b'] }
      ]
    }
    const r = solveDC(netlist)
    expect(r.solved).toBe(false)
    expect(r.error).toMatch(/ground/i)
  })

  it('rejects a floating subcircuit', () => {
    const netlist: Netlist = {
      elements: [
        { id: 'V1', type: 'voltage_source', value: 5, nodes: ['a', GROUND] },
        { id: 'R1', type: 'resistor', value: 100, nodes: ['a', GROUND] },
        // x–y island not connected to anything grounded
        { id: 'R2', type: 'resistor', value: 100, nodes: ['x', 'y'] }
      ]
    }
    const r = solveDC(netlist)
    expect(r.solved).toBe(false)
    expect(r.error).toMatch(/floating|not connected/i)
  })

  it('rejects a non-positive resistance', () => {
    const netlist: Netlist = {
      elements: [
        { id: 'V1', type: 'voltage_source', value: 5, nodes: ['a', GROUND] },
        { id: 'R1', type: 'resistor', value: 0, nodes: ['a', GROUND] }
      ]
    }
    const r = solveDC(netlist)
    expect(r.solved).toBe(false)
    expect(r.error).toMatch(/positive resistance/i)
  })
})
